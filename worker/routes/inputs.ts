import { and, desc, eq, sql } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"
import { Hono } from "hono"
import { formatAmount, unitForKind, type HistoryEntry } from "../../shared/domain"
import { q, toInput } from "../catalog"
import { fieldEdit, input, inputEntry, organization, product, productEntry, productVersion, sale, voidLock } from "../db/schema"
import type { AppEnv, DB } from "../env"
import { fail, int, newId, oneOf, optInt, pastDate, readBody, requireRole, str, type Body } from "../lib"

export const inputs = new Hono<AppEnv>()

type Batch = [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]

async function getInput(db: DB, orgId: string, id: string) {
  const row = await db.select().from(input).where(and(eq(input.id, id), eq(input.orgId, orgId))).get()
  if (!row) fail(404, "Input not found.")
  return row
}

async function nameTaken(db: DB, orgId: string, name: string, exceptId?: string) {
  const rows = await db
    .select({ id: input.id })
    .from(input)
    .where(and(eq(input.orgId, orgId), eq(input.archived, false), sql`lower(${input.name}) = lower(${name})`))
  return rows.some((r) => r.id !== exceptId)
}

/**
 * Weighted-average cost update, computed in SQL so concurrent writes stay correct.
 * SET expressions all read the old row values.
 */
function stockStatement(db: DB, inputId: string, amount: number, unitCost: number) {
  return db
    .update(input)
    .set({
      unitCost: sql`CASE WHEN ${input.onHand} <= 0 THEN ${unitCost}
        ELSE CAST(ROUND((${input.onHand} * 1.0 * ${input.unitCost} + ${amount} * 1.0 * ${unitCost}) / (${input.onHand} + ${amount})) AS INTEGER) END`,
      onHand: sql`${input.onHand} + ${amount}`,
    })
    .where(eq(input.id, inputId))
}

function stockValues(body: Body, unit: "kg" | "pcs") {
  return {
    amount: int(body, "amount", { min: 1, label: unit === "kg" ? "an amount in kg" : "an amount in pcs" }),
    unitCost: int(body, "unitCost", { min: 0, max: 1e12, label: "a unit cost" }),
    date: pastDate(body),
    note: str(body, "note", { max: 300, label: "Note" }),
  }
}

// New material or packaging item, with an optional opening amount.
inputs.post("/inputs", async (c) => {
  requireRole(c, "contributor")
  const db = c.get("db")
  const orgId = c.get("orgId")
  const user = c.get("user")
  const body = await readBody(c)
  const kind = oneOf(body, "kind", ["material", "packaging"] as const, "a type")
  const unit = unitForKind(kind)
  const name = str(body, "name", { min: 1, max: 80, label: "a name" })
  const unitCost = int(body, "unitCost", { min: 0, max: 1e12, label: "a unit cost" })
  const lowLevel = optInt(body, "lowLevel", { min: 0, label: "a low level" })
  const opening = optInt(body, "openingAmount", { min: 1, label: "an opening amount" })
  const date = opening ? pastDate(body, "openingDate") : ""
  if (await nameTaken(db, orgId, name)) fail(409, "An input with this name already exists.")

  const id = newId()
  const seq = kind === "material" ? organization.matSeq : organization.pakSeq
  const prefix = kind === "material" ? "MAT" : "PAK"
  const stmts: Batch = [
    db.update(organization).set(kind === "material" ? { matSeq: sql`${organization.matSeq} + 1` } : { pakSeq: sql`${organization.pakSeq} + 1` }).where(eq(organization.id, orgId)),
    db.insert(input).values({
      id,
      orgId,
      code: sql`(SELECT printf('${sql.raw(prefix)}%05d', ${seq}) FROM ${organization} WHERE ${organization.id} = ${orgId})`,
      kind,
      name,
      unit,
      onHand: opening ?? 0,
      unitCost,
      lowLevel,
    }),
  ]
  if (opening) {
    stmts.push(
      db.insert(inputEntry).values({ id: newId(), orgId, inputId: id, date, type: "added", amount: opening, unitCost, note: "Opening stock", byName: user.name })
    )
  }
  stmts.push(q.inputsById(db, orgId, [id]))
  const results = await db.batch(stmts)
  const rows = results.at(-1) as (typeof input.$inferSelect)[]
  return c.json({ id, patch: { inputs: rows.map(toInput) } })
})

// Edit name and low level. On hand and cost are never typed: they come from entries.
inputs.patch("/inputs/:id", async (c) => {
  requireRole(c, "admin")
  const db = c.get("db")
  const orgId = c.get("orgId")
  const user = c.get("user")
  const current = await getInput(db, orgId, c.req.param("id"))
  const body = await readBody(c)
  const name = str(body, "name", { min: 1, max: 80, label: "a name" })
  const lowLevel = optInt(body, "lowLevel", { min: 0, label: "a low level" })
  if (name.toLowerCase() !== current.name.toLowerCase() && (await nameTaken(db, orgId, name, current.id))) {
    fail(409, "An input with this name already exists.")
  }
  const edits = []
  const base = { orgId, targetType: "input" as const, targetId: current.id, targetCode: current.code, targetName: name, byName: user.name }
  if (name !== current.name) edits.push({ ...base, id: newId(), field: "Name", oldValue: current.name, newValue: name })
  if (lowLevel !== current.lowLevel) {
    const show = (v: number | null) => (v === null ? "None" : formatAmount(v, current.unit))
    edits.push({ ...base, id: newId(), field: "Low level", oldValue: show(current.lowLevel), newValue: show(lowLevel) })
  }
  if (edits.length === 0) return c.json({ patch: { inputs: [toInput(current)] } })
  const [, , rows] = await db.batch([
    db.update(input).set({ name, lowLevel }).where(eq(input.id, current.id)),
    db.insert(fieldEdit).values(edits),
    q.inputsById(db, orgId, [current.id]),
  ])
  return c.json({ patch: { inputs: rows.map(toInput) } })
})

// Stock material / Stock packaging: add an amount to an existing item.
inputs.post("/inputs/:id/stock", async (c) => {
  requireRole(c, "contributor")
  const db = c.get("db")
  const orgId = c.get("orgId")
  const current = await getInput(db, orgId, c.req.param("id"))
  if (current.archived) fail(409, "This input is archived.")
  const v = stockValues(await readBody(c), current.unit)
  const [, , rows] = await db.batch([
    stockStatement(db, current.id, v.amount, v.unitCost),
    db.insert(inputEntry).values({ id: newId(), orgId, inputId: current.id, type: "added", byName: c.get("user").name, ...v }),
    q.inputsById(db, orgId, [current.id]),
  ])
  return c.json({ patch: { inputs: rows.map(toInput) } })
})

// Adjust count: set on hand after a physical count. The difference is saved as an entry.
inputs.post("/inputs/:id/adjust", async (c) => {
  requireRole(c, "admin")
  const db = c.get("db")
  const orgId = c.get("orgId")
  const current = await getInput(db, orgId, c.req.param("id"))
  const body = await readBody(c)
  const counted = int(body, "counted", { min: 0, label: "the counted amount" })
  const date = pastDate(body)
  const reason = str(body, "reason", { min: 1, max: 300, label: "a reason" })
  if (counted === current.onHand) fail(409, "The count matches on hand. Nothing to adjust.")
  const [, , rows] = await db.batch([
    db.insert(inputEntry).values({
      id: newId(),
      orgId,
      inputId: current.id,
      date,
      type: "adjusted",
      amount: sql`${counted} - (SELECT ${input.onHand} FROM ${input} WHERE ${input.id} = ${current.id})`,
      note: reason,
      byName: c.get("user").name,
    }),
    db.update(input).set({ onHand: counted }).where(eq(input.id, current.id)),
    q.inputsById(db, orgId, [current.id]),
  ])
  return c.json({ patch: { inputs: rows.map(toInput) } })
})

inputs.post("/inputs/:id/archive", async (c) => {
  requireRole(c, "admin")
  const db = c.get("db")
  const orgId = c.get("orgId")
  const current = await getInput(db, orgId, c.req.param("id"))
  const reason = str(await readBody(c), "reason", { min: 1, max: 300, label: "a reason" })
  const users = await db
    .select({ name: product.name })
    .from(product)
    .innerJoin(productVersion, eq(productVersion.id, product.versionId))
    .where(
      and(
        eq(product.orgId, orgId),
        eq(product.archived, false),
        sql`EXISTS (SELECT 1 FROM json_each(${productVersion.lines}) WHERE json_extract(value, '$.inputId') = ${current.id})`
      )
    )
  if (users.length > 0) fail(409, `Used by ${users.map((u) => u.name).join(", ")}. Change those products first.`)
  const [, rows] = await db.batch([
    db.update(input).set({ archived: true, archiveReason: reason }).where(eq(input.id, current.id)),
    q.inputsById(db, orgId, [current.id]),
  ])
  return c.json({ patch: { inputs: rows.map(toInput) } })
})

inputs.post("/inputs/:id/restore", async (c) => {
  requireRole(c, "admin")
  const db = c.get("db")
  const orgId = c.get("orgId")
  const current = await getInput(db, orgId, c.req.param("id"))
  if (await nameTaken(db, orgId, current.name, current.id)) fail(409, "An active input has the same name. Rename it first.")
  const [, rows] = await db.batch([
    db.update(input).set({ archived: false, archiveReason: "" }).where(eq(input.id, current.id)),
    q.inputsById(db, orgId, [current.id]),
  ])
  return c.json({ patch: { inputs: rows.map(toInput) } })
})

inputs.get("/inputs/:id/history", async (c) => {
  const db = c.get("db")
  const orgId = c.get("orgId")
  const id = c.req.param("id")
  const [entries, edits] = await db.batch([
    db
      .select({ e: inputEntry, saleId: productEntry.saleId, saleCode: sale.code, productName: product.name })
      .from(inputEntry)
      .leftJoin(productEntry, eq(productEntry.id, inputEntry.productEntryId))
      .leftJoin(product, eq(product.id, productEntry.productId))
      .leftJoin(sale, eq(sale.id, productEntry.saleId))
      .where(and(eq(inputEntry.inputId, id), eq(inputEntry.orgId, orgId)))
      .orderBy(desc(inputEntry.createdAt))
      .limit(500),
    db.select().from(fieldEdit).where(and(eq(fieldEdit.targetId, id), eq(fieldEdit.orgId, orgId))).orderBy(desc(fieldEdit.createdAt)).limit(200),
  ])
  const history: HistoryEntry[] = [
    ...entries.map(({ e, productName }) => ({
      id: e.id, kind: "entry" as const, date: e.date, createdAt: e.createdAt.getTime(), type: e.type, amount: e.amount,
      unitCost: e.unitCost, note: e.type === "used" && productName ? `Stock product: ${productName}${e.note ? ` — ${e.note}` : ""}` : e.note,
      byName: e.byName, voided: !!e.voidedAt, voidReason: e.voidReason, voidByName: e.voidByName,
      voidedAt: e.voidedAt?.getTime() ?? null, saleId: null, saleCode: null,
    })),
    ...edits.map((f) => ({
      id: f.id, kind: "edit" as const, date: new Date(f.createdAt).toISOString().slice(0, 10), createdAt: f.createdAt.getTime(),
      type: "edit", amount: 0, unitCost: null, note: "", byName: f.byName, voided: false, voidReason: "", voidByName: "",
      voidedAt: null, saleId: null, saleCode: null, field: f.field, oldValue: f.oldValue, newValue: f.newValue,
    })),
  ].sort((a, b) => b.createdAt - a.createdAt)
  return c.json({ history })
})

/**
 * Correct a stock entry: void it (reason required) and, optionally, save a replacement in the
 * same atomic batch. Entries made by Stock product are corrected from the product instead.
 */
inputs.post("/input-entries/:id/void", async (c) => {
  requireRole(c, "admin")
  const db = c.get("db")
  const orgId = c.get("orgId")
  const user = c.get("user")
  const body = await readBody(c)
  const reason = str(body, "reason", { min: 1, max: 300, label: "a reason" })
  const entry = await db.select().from(inputEntry).where(and(eq(inputEntry.id, c.req.param("id")), eq(inputEntry.orgId, orgId))).get()
  if (!entry) fail(404, "Entry not found.")
  if (entry.voidedAt) fail(409, "This entry is already void.")
  if (entry.type === "used") fail(409, "This entry comes from Stock product. Correct the production run on the product.")
  const current = await getInput(db, orgId, entry.inputId)
  const replacement = body.replacement && typeof body.replacement === "object" ? stockValues(body.replacement as Body, current.unit) : null
  if (replacement && entry.type !== "added") fail(400, "Only stock entries can be corrected with a new amount.")

  const amt = entry.amount
  const cost = entry.unitCost ?? 0
  const stmts: Batch = [
    db.insert(voidLock).values({ id: entry.id }),
    db.update(inputEntry).set({ voidedAt: new Date(), voidReason: reason, voidByName: user.name }).where(eq(inputEntry.id, entry.id)),
    db
      .update(input)
      .set(
        entry.type === "added"
          ? {
              // Reverse this purchase's effect on the weighted average.
              unitCost: sql`CASE WHEN ${input.onHand} - ${amt} <= 0 THEN ${input.unitCost}
                ELSE MAX(0, CAST(ROUND((${input.onHand} * 1.0 * ${input.unitCost} - ${amt} * 1.0 * ${cost}) / (${input.onHand} - ${amt})) AS INTEGER)) END`,
              onHand: sql`${input.onHand} - ${amt}`,
            }
          : { onHand: sql`${input.onHand} - ${amt}` }
      )
      .where(eq(input.id, current.id)),
  ]
  if (replacement) {
    stmts.push(
      stockStatement(db, current.id, replacement.amount, replacement.unitCost),
      db.insert(inputEntry).values({ id: newId(), orgId, inputId: current.id, type: "added", byName: user.name, correctsId: entry.id, ...replacement })
    )
  }
  stmts.push(q.inputsById(db, orgId, [current.id]))
  const results = await db.batch(stmts)
  const rows = results.at(-1) as (typeof input.$inferSelect)[]
  return c.json({ patch: { inputs: rows.map(toInput) } })
})
