import { and, asc, count, eq, gt, isNull } from "drizzle-orm"
import { Hono } from "hono"
import { ORG_COLORS, ORG_ICONS, ROLES, type Catalog, type Invite, type Member } from "../../shared/domain"
import { q, toInput, toOrg, toProduct, toScheme } from "../catalog"
import { invite, member, organization, pricingScheme, user } from "../db/schema"
import type { AppEnv } from "../env"
import { email, fail, newId, oneOf, readBody, requireRole, str } from "../lib"
import { randomToken, sha256Hex } from "../password"

export const org = new Hono<AppEnv>()

/** Everything a screen needs in one request (one D1 round trip). Alerts are derived client-side. */
org.get("/catalog", async (c) => {
  const db = c.get("db")
  const orgId = c.get("orgId")
  const [orgRows, inputRows, productRows, schemeRows] = await db.batch([
    q.org(db, orgId),
    q.inputs(db, orgId),
    q.products(db, orgId),
    q.schemes(db, orgId).orderBy(asc(pricingScheme.createdAt)),
  ])
  const row = orgRows[0]
  if (!row) fail(404, "Organization not found.")
  return c.json<Catalog>({
    org: toOrg(row),
    inputs: inputRows.map(toInput),
    products: productRows.map(toProduct),
    schemes: schemeRows.map(toScheme),
  })
})

org.patch("/settings", async (c) => {
  requireRole(c, "admin")
  const db = c.get("db")
  const orgId = c.get("orgId")
  const body = await readBody(c)
  const values = {
    name: str(body, "name", { min: 1, max: 80, label: "a name" }),
    icon: oneOf(body, "icon", ORG_ICONS, "an icon"),
    color: oneOf(body, "color", ORG_COLORS, "a color"),
    contactName: str(body, "contactName", { max: 120, label: "Contact name" }),
    contactEmail: str(body, "contactEmail", { max: 254, label: "Contact email" }),
    contactPhone: str(body, "contactPhone", { max: 60, label: "Contact phone" }),
    invoiceAddress: str(body, "invoiceAddress", { max: 300, label: "Address" }),
  }
  const [, rows] = await db.batch([db.update(organization).set(values).where(eq(organization.id, orgId)), q.org(db, orgId)])
  return c.json({ patch: { org: toOrg(rows[0]!) } })
})

// ---------------------------------------------------------------------------
// Pricing schemes (shared price names, e.g. Retail and Wholesale)

org.post("/schemes", async (c) => {
  requireRole(c, "admin")
  const db = c.get("db")
  const orgId = c.get("orgId")
  const name = str(await readBody(c), "name", { min: 1, max: 40, label: "a name" })
  const id = newId()
  const [, rows] = await db.batch([
    db.insert(pricingScheme).values({ id, orgId, name }),
    q.schemes(db, orgId).orderBy(asc(pricingScheme.createdAt)),
  ])
  return c.json({ id, patch: { schemes: rows.map(toScheme) } })
})

org.patch("/schemes/:id", async (c) => {
  requireRole(c, "admin")
  const db = c.get("db")
  const orgId = c.get("orgId")
  const name = str(await readBody(c), "name", { min: 1, max: 40, label: "a name" })
  const [, rows] = await db.batch([
    db.update(pricingScheme).set({ name }).where(and(eq(pricingScheme.id, c.req.param("id")), eq(pricingScheme.orgId, orgId))),
    q.schemes(db, orgId).orderBy(asc(pricingScheme.createdAt)),
  ])
  return c.json({ patch: { schemes: rows.map(toScheme) } })
})

// ---------------------------------------------------------------------------
// Members and invites

org.get("/members", async (c) => {
  const db = c.get("db")
  const orgId = c.get("orgId")
  const [members, invites] = await db.batch([
    db
      .select({ userId: member.userId, name: user.name, email: user.email, role: member.role, createdAt: member.createdAt })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(member.orgId, orgId)),
    db
      .select()
      .from(invite)
      .where(and(eq(invite.orgId, orgId), isNull(invite.usedAt), isNull(invite.revokedAt), gt(invite.expiresAt, new Date()))),
  ])
  const isAdmin = c.get("role") === "admin"
  return c.json({
    members: members.map<Member>((m) => ({ ...m, createdAt: m.createdAt.getTime() })),
    invites: isAdmin
      ? invites.map<Invite>((i) => ({ id: i.id, name: i.name, email: i.email, role: i.role, expiresAt: i.expiresAt.getTime(), createdAt: i.createdAt.getTime() }))
      : [],
  })
})

/** Creates a one-time invite link (valid 7 days). There is no email provider: the admin copies the link. */
org.post("/invites", async (c) => {
  requireRole(c, "admin")
  const db = c.get("db")
  const orgId = c.get("orgId")
  const body = await readBody(c)
  const name = str(body, "name", { min: 1, max: 80, label: "a name" })
  const address = email(body)
  const role = oneOf(body, "role", ROLES, "a role")
  const already = await db
    .select({ id: user.id })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.orgId, orgId), eq(user.email, address)))
    .get()
  if (already) fail(409, "This person is already a member.")
  const token = randomToken(24)
  await db.insert(invite).values({
    id: newId(),
    orgId,
    name,
    email: address,
    role,
    tokenHash: await sha256Hex(token),
    expiresAt: new Date(Date.now() + 7 * 86_400_000),
    createdBy: c.get("user").id,
  })
  return c.json({ token })
})

org.delete("/invites/:id", async (c) => {
  requireRole(c, "admin")
  const db = c.get("db")
  await db
    .update(invite)
    .set({ revokedAt: new Date() })
    .where(and(eq(invite.id, c.req.param("id")), eq(invite.orgId, c.get("orgId"))))
  return c.json({ ok: true })
})

async function adminCount(db: AppEnv["Variables"]["db"], orgId: string) {
  const row = await db
    .select({ n: count() })
    .from(member)
    .where(and(eq(member.orgId, orgId), eq(member.role, "admin")))
    .get()
  return row?.n ?? 0
}

org.patch("/members/:userId", async (c) => {
  requireRole(c, "admin")
  const db = c.get("db")
  const orgId = c.get("orgId")
  const userId = c.req.param("userId")
  const role = oneOf(await readBody(c), "role", ROLES, "a role")
  const target = await db.select({ role: member.role }).from(member).where(and(eq(member.orgId, orgId), eq(member.userId, userId))).get()
  if (!target) fail(404, "Member not found.")
  if (target.role === "admin" && role !== "admin" && (await adminCount(db, orgId)) <= 1) {
    fail(409, "Every organization keeps at least one admin.")
  }
  await db.update(member).set({ role }).where(and(eq(member.orgId, orgId), eq(member.userId, userId)))
  return c.json({ ok: true })
})

org.delete("/members/:userId", async (c) => {
  requireRole(c, "admin")
  const db = c.get("db")
  const orgId = c.get("orgId")
  const userId = c.req.param("userId")
  const target = await db.select({ role: member.role }).from(member).where(and(eq(member.orgId, orgId), eq(member.userId, userId))).get()
  if (!target) fail(404, "Member not found.")
  if (target.role === "admin" && (await adminCount(db, orgId)) <= 1) fail(409, "Every organization keeps at least one admin.")
  await db.delete(member).where(and(eq(member.orgId, orgId), eq(member.userId, userId)))
  return c.json({ ok: true })
})
