import { and, eq, gt, isNull } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { ORG_COLORS, ORG_ICONS, type Me, type Role } from "../shared/domain"
import { getAuth, signInCookies } from "./auth"
import * as schema from "./db/schema"
import type { AppEnv, DB } from "./env"
import { email, fail, friendlyDbError, newId, readBody, str } from "./lib"
import { ensureMigrated } from "./migrate"
import { hashPassword, verifyPassword } from "better-auth/crypto"
import { randomToken, sha256Hex } from "./password"
import { audit } from "./routes/audit"
import { inputs } from "./routes/inputs"
import { org } from "./routes/org"
import { products } from "./routes/products"
import { sales } from "./routes/sales"

const { user, account, meta, organization, member, invite, pricingScheme } = schema

const app = new Hono<AppEnv>().basePath("/api")

let dbCache: { binding: D1Database; db: DB } | null = null

app.use("*", async (c, next) => {
  await ensureMigrated(c.env.DB)
  if (dbCache?.binding !== c.env.DB) dbCache = { binding: c.env.DB, db: drizzle(c.env.DB, { schema }) }
  c.set("db", dbCache.db)
  await next()
})

app.onError((error, c) => {
  if (error instanceof HTTPException) return c.json({ error: error.message }, error.status)
  const friendly = friendlyDbError(error)
  if (friendly) return c.json({ error: friendly }, 409)
  console.error(error)
  return c.json({ error: "Something went wrong. Try again." }, 500)
})

// ---------------------------------------------------------------------------
// Better Auth (sign in, sign out, change password)

app.on(["GET", "POST"], "/auth/*", async (c) => {
  const auth = await getAuth(c.env, c.get("db"))
  if (!auth) return c.json({ error: "Finish setup first." }, 409)
  return auth.handler(c.req.raw)
})

async function sessionUser(c: { env: AppEnv["Bindings"]; req: { raw: Request } }, db: DB) {
  const auth = await getAuth(c.env, db)
  if (!auth) return null
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  return session ? { id: session.user.id, name: session.user.name, email: session.user.email } : null
}

/** Defaults for a new organization: a random icon + color and two shared price names. */
function newOrgStatements(db: DB, orgId: string, name: string, userId: string) {
  return [
    db.insert(organization).values({
      id: orgId,
      name,
      icon: ORG_ICONS[Math.floor(Math.random() * ORG_ICONS.length)]!,
      color: ORG_COLORS[Math.floor(Math.random() * ORG_COLORS.length)]!,
    }),
    db.insert(member).values({ orgId, userId, role: "admin" }),
    db.insert(pricingScheme).values([
      { id: newId(), orgId, name: "Retail" },
      { id: newId(), orgId, name: "Wholesale" },
    ]),
  ] as const
}

function withCookies(response: Response, cookies: string[]) {
  for (const cookie of cookies) response.headers.append("Set-Cookie", cookie)
  return response
}

// ---------------------------------------------------------------------------
// Session + first-run

app.get("/me", async (c) => {
  const db = c.get("db")
  const current = await sessionUser(c, db)
  if (!current) {
    const any = await db.select({ id: user.id }).from(user).limit(1).get()
    return c.json<Me>({ user: null, isOwner: false, orgs: [], needsSetup: !any })
  }
  const [orgs, owner] = await db.batch([
    db
      .select({ id: organization.id, name: organization.name, icon: organization.icon, color: organization.color, role: member.role })
      .from(member)
      .innerJoin(organization, eq(organization.id, member.orgId))
      .where(eq(member.userId, current.id)),
    db.select({ value: meta.value }).from(meta).where(eq(meta.key, "owner_user_id")),
  ])
  return c.json<Me>({
    user: current,
    isOwner: owner[0]?.value === current.id,
    orgs: orgs.map((o) => ({ ...o, icon: o.icon as Me["orgs"][number]["icon"], color: o.color as Me["orgs"][number]["color"] })),
    needsSetup: false,
  })
})

/**
 * First-run setup: the first person to open a fresh deploy creates the owner account and
 * the first organization. It works exactly once (guarded by a unique meta row).
 */
app.post("/setup", async (c) => {
  const db = c.get("db")
  const body = await readBody(c)
  const orgName = str(body, "orgName", { min: 1, max: 80, label: "an organization name" })
  const name = str(body, "name", { min: 1, max: 80, label: "your name" })
  const address = email(body)
  const password = str(body, "password", { min: 8, max: 128, label: "Password" })

  const existing = await db.select({ id: user.id }).from(user).limit(1).get()
  if (existing) fail(409, "Setup is already complete. Sign in instead.")

  const userId = newId()
  const orgId = newId()
  const hash = await hashPassword(password)
  await db.batch([
    // Fails (and rolls back everything) if another setup won the race.
    db.insert(meta).values({ key: "owner_user_id", value: userId }),
    db.insert(meta).values({ key: "auth_secret", value: randomToken(32) }).onConflictDoNothing(),
    db.insert(user).values({ id: userId, name, email: address, emailVerified: true }),
    db.insert(account).values({ id: newId(), accountId: userId, providerId: "credential", userId, password: hash }),
    ...newOrgStatements(db, orgId, orgName, userId),
  ])

  const auth = await getAuth(c.env, db)
  const cookies = auth ? await signInCookies(auth, address, password, c.req.raw.headers) : []
  return withCookies(c.json({ ok: true, orgId }), cookies)
})

/** Owner only: add another organization (for example a second business). */
app.post("/orgs", async (c) => {
  const db = c.get("db")
  const current = await sessionUser(c, db)
  if (!current) fail(401, "Sign in first.")
  const owner = await db.select({ value: meta.value }).from(meta).where(eq(meta.key, "owner_user_id")).get()
  if (owner?.value !== current.id) fail(403, "Only the owner can add organizations.")
  const body = await readBody(c)
  const name = str(body, "name", { min: 1, max: 80, label: "a name" })
  const orgId = newId()
  await db.batch([...newOrgStatements(db, orgId, name, current.id)])
  return c.json({ ok: true, orgId })
})

// ---------------------------------------------------------------------------
// Invite links

async function findInvite(db: DB, token: string) {
  const tokenHash = await sha256Hex(token)
  return db
    .select({ invite, orgName: organization.name })
    .from(invite)
    .innerJoin(organization, eq(organization.id, invite.orgId))
    .where(and(eq(invite.tokenHash, tokenHash), isNull(invite.usedAt), isNull(invite.revokedAt), gt(invite.expiresAt, new Date())))
    .get()
}

app.get("/invite/:token", async (c) => {
  const db = c.get("db")
  const found = await findInvite(db, c.req.param("token"))
  if (!found) return c.json({ valid: false })
  const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, found.invite.email)).get()
  return c.json({
    valid: true,
    name: found.invite.name,
    email: found.invite.email,
    role: found.invite.role,
    orgName: found.orgName,
    hasAccount: !!existing,
  })
})

app.post("/invite/:token", async (c) => {
  const db = c.get("db")
  const found = await findInvite(db, c.req.param("token"))
  if (!found) fail(410, "Invite unavailable. Ask for a new link.")
  const body = await readBody(c)
  const password = str(body, "password", { min: 8, max: 128, label: "Password" })
  const { invite: inv } = found
  const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, inv.email)).get()
  const markUsed = db.update(invite).set({ usedAt: new Date() }).where(and(eq(invite.id, inv.id), isNull(invite.usedAt)))
  const role = inv.role as Role

  if (existing) {
    // Existing account (member of another organization): confirm with the current password.
    const cred = await db
      .select({ password: account.password })
      .from(account)
      .where(and(eq(account.userId, existing.id), eq(account.providerId, "credential")))
      .get()
    if (!cred?.password || !(await verifyPassword({ hash: cred.password, password }))) fail(400, "Wrong password for this account.")
    await db.batch([
      markUsed,
      db.insert(member).values({ orgId: inv.orgId, userId: existing.id, role }).onConflictDoUpdate({ target: [member.orgId, member.userId], set: { role } }),
    ])
  } else {
    const name = str(body, "name", { min: 1, max: 80, label: "your name" })
    const userId = newId()
    const hash = await hashPassword(password)
    await db.batch([
      markUsed,
      db.insert(user).values({ id: userId, name, email: inv.email, emailVerified: true }),
      db.insert(account).values({ id: newId(), accountId: userId, providerId: "credential", userId, password: hash }),
      db.insert(member).values({ orgId: inv.orgId, userId, role }),
    ])
  }

  const auth = await getAuth(c.env, db)
  const cookies = auth ? await signInCookies(auth, inv.email, password, c.req.raw.headers) : []
  return withCookies(c.json({ ok: true, orgId: inv.orgId }), cookies)
})

// ---------------------------------------------------------------------------
// Organization-scoped API: /api/o/:orgId/...

const scoped = new Hono<AppEnv>()

scoped.use("*", async (c, next) => {
  const db = c.get("db")
  const current = await sessionUser(c, db)
  if (!current) fail(401, "Sign in first.")
  const orgId = c.req.param("orgId")
  if (!orgId) fail(404, "Not found.")
  const membership = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.orgId, orgId), eq(member.userId, current.id)))
    .get()
  if (!membership) fail(404, "Organization not found.")
  c.set("user", current)
  c.set("orgId", orgId)
  c.set("role", membership.role)
  await next()
})

scoped.route("/", org)
scoped.route("/", inputs)
scoped.route("/", products)
scoped.route("/", sales)
scoped.route("/", audit)

app.route("/o/:orgId", scoped)

app.all("*", (c) => c.json({ error: "Not found." }, 404))

export default app
