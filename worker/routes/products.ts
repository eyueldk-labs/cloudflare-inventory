import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"
import { Hono } from "hono"
import { formatAmount, formatEtb, type CompositionLine, type HistoryEntry, type ProductPrice } from "../../shared/domain"
import { q, toInput, toProduct } from "../catalog"
import { fieldEdit, input, inputEntry, organization, pricingScheme, product, productEntry, productVersion, sale, voidLock } from "../db/schema"
import type { AppEnv, DB } from "../env"
import { arr, fail, int, newId, optInt, pastDate, readBody, requireRole, str, type Body } from "../lib"

export const products = new Hono<AppEnv>()

type Batch = [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]
type InputRow = typeof input.$inferSelect

async function getProduct(db: DB, orgId: string, id: string) {
  const row = await q.productsById(db, orgId, [id]).get()
  if (!row) fail(404, "Product not found.")
  return toProduct(row)
}

async function nameTaken(db: DB, orgId: string, name: string, exceptId?: string) {
  const rows = await db
    .select({ id: product.id })
    .from(product)
    .where(and(eq(product.orgId, orgId), eq(product.archived, false), sql`lower(${product.name}) = lower(${name})`))
  return rows.some((r) => r.id !== exceptId)
}

async function readComposition(db: DB, orgId: string, body: Body): Promise<CompositionLine[]> {
  const lines = arr(body, "lines").map((l) => ({ inputId: String(l.inputId ?? ""), amount: int(l, "amount", { min: 1, label: "an amount per unit" }) }))
  if (lines.length === 0) fail(400, "Add at least one material or packaging line.")
  const ids = new Set(lines.map((l) => l.inputId))
  if (ids.size !== lines.length) fail(400, "Each input can show only one time.")
  const found = await q.inputsById(db, orgId, [...ids])
  if (found.length !== ids.size || found.some((i) => i.archived)) fail(400, "Choose active inputs only.")
  return lines
}

async function readPrices(db: DB, orgId: string, body: Body): Promise<{ prices: ProductPrice[]; defaultSchemeId: string }> {
  const prices = arr(body, "prices").map((p) => ({ schemeId: String(p.schemeId ?? ""), amount: int(p, "amount", { min: 0, max: 1e12, label: "a price" }) }))
  if (prices.length === 0) fail(400, "Add at least one price.")
  const ids = new Set(prices.map((p) => p.schemeId))
  if (ids.size !== prices.length) fail(400, "Each price name can show only one time.")
  const schemes = await db
    .select({ id: pricingScheme.id })
    .from(pricingScheme)
    .where(and(eq(pricingScheme.orgId, orgId), inArray(pricingScheme.id, [...ids])))
  if (schemes.length !== ids.size) fail(400, "Choose a price name.")
  const defaultSchemeId = String(body.defaultSchemeId ?? "")
  if (!ids.has(defaultSchemeId)) fail(400, "Choose the default price.")
  return { prices, defaultSchemeId }
}

function sameLines(a: CompositionLine[], b: CompositionLine[]) {
  const key = (l: CompositionLine[]) => JSON.stringify([...l].sort((x, y) => x.inputId.localeCompare(y.inputId)))
  return key(a) === key(b)
}

/** Statements for one production run: take inputs, add units, write entries. CHECK constraints stop shortfalls. */
function produceStatements(
  db: DB,
  args: { orgId: string; productId: string; versionId: string; lines: CompositionLine[]; units: number; date: string; note: string; byName: string; correctsId?: string }
): { id: string; stmts: BatchItem<"sqlite">[] } {
  const id = newId()
  const stmts: BatchItem<"sqlite">[] = [
    db.insert(productEntry).values({
      id, orgId: args.orgId, productId: args.productId, date: args.date, type: "made", units: args.units, versionId: args.versionId,
      note: args.note, byName: args.byName, correctsId: args.correctsId ?? null,
    }),
  ]
  for (const line of args.lines) {
    const amount = line.amount * args.units
    if (!Number.isSafeInteger(amount)) fail(400, "The amount is too large.")
    stmts.push(
      db.update(input).set({ onHand: sql`${input.onHand} - ${amount}` }).where(eq(input.id, line.inputId)),
      db.insert(inputEntry).values({
        id: newId(), orgId: args.orgId, inputId: line.inputId, date: args.date, type: "used", amount: -amount, note: args.note,
        byName: args.byName, productEntryId: id,
      })
    )
  }
  stmts.push(db.update(product).set({ onHand: sql`${product.onHand} + ${args.units}` }).where(eq(product.id, args.productId)))
  return { id, stmts }
}

function shortfallMessage(lines: CompositionLine[], units: number, inputs: InputRow[]) {
  const byId = new Map(inputs.map((i) => [i.id, i]))
  const short = lines
    .map((l) => ({ i: byId.get(l.inputId), need: l.amount * units }))
    .filter((x) => x.i && x.need > x.i.onHand)
    .map((x) => `${x.i!.name}: ${formatAmount(x.need, x.i!.unit)} needed, ${formatAmount(x.i!.onHand, x.i!.unit)} on hand`)
  return short.length ? `Not enough stock. ${short.join("; ")}.` : null
}

async function readBack(db: DB, orgId: string, productIds: string[], inputIds: string[], stmts: BatchItem<"sqlite">[]) {
  const all = [...stmts, q.productsById(db, orgId, productIds), q.inputsById(db, orgId, inputIds)] as unknown as Batch
  const results = await db.batch(all)
  const productRows = results.at(-2) as Parameters<typeof toProduct>[0][]
  const inputRows = results.at(-1) as InputRow[]
  return { products: productRows.map(toProduct), inputs: inputRows.map(toInput) }
}

// New product (admin) with composition, named prices, and optional opening units.
products.post("/products", async (c) => {
  requireRole(c, "admin")
  const db = c.get("db")
  const orgId = c.get("orgId")
  const user = c.get("user")
  const body = await readBody(c)
  const name = str(body, "name", { min: 1, max: 80, label: "a name" })
  const lines = await readComposition(db, orgId, body)
  const { prices, defaultSchemeId } = await readPrices(db, orgId, body)
  const additionalCost = int(body, "additionalCost", { min: 0, max: 1e12, label: "an additional cost" })
  const lowLevel = optInt(body, "lowLevel", { min: 0, label: "a low level" })
  const openingUnits = optInt(body, "openingUnits", { min: 0, label: "opening units" }) ?? 0
  if (await nameTaken(db, orgId, name)) fail(409, "A product with this name already exists.")

  const id = newId()
  const versionId = newId()
  const stmts: BatchItem<"sqlite">[] = [
    db.update(organization).set({ proSeq: sql`${organization.proSeq} + 1` }).where(eq(organization.id, orgId)),
    db.insert(product).values({
      id, orgId, name, onHand: openingUnits, lowLevel, defaultSchemeId, prices, versionId,
      code: sql`(SELECT printf('PRO%05d', ${organization.proSeq}) FROM ${organization} WHERE ${organization.id} = ${orgId})`,
    }),
    db.insert(productVersion).values({ id: versionId, orgId, productId: id, version: 1, lines, additionalCost, byName: user.name }),
  ]
  if (openingUnits > 0) {
    stmts.push(
      db.insert(productEntry).values({
        id: newId(), orgId, productId: id, date: pastDate({ date: body.openingDate ?? new Date().toISOString().slice(0, 10) }),
        type: "adjusted", units: openingUnits, note: "Opening stock", byName: user.name,
      })
    )
  }
  const patch = await readBack(db, orgId, [id], [], stmts)
  return c.json({ id, patch: { products: patch.products } })
})

// Edit (admin). A composition or additional-cost change makes a new version; past runs keep theirs.
products.patch("/products/:id", async (c) => {
  requireRole(c, "admin")
  const db = c.get("db")
  const orgId = c.get("orgId")
  const user = c.get("user")
  const current = await getProduct(db, orgId, c.req.param("id"))
  const body = await readBody(c)
  const name = str(body, "name", { min: 1, max: 80, label: "a name" })
  const lines = await readComposition(db, orgId, body)
  const { prices, defaultSchemeId } = await readPrices(db, orgId, body)
  const additionalCost = int(body, "additionalCost", { min: 0, max: 1e12, label: "an additional cost" })
  const lowLevel = optInt(body, "lowLevel", { min: 0, label: "a low level" })
  if (name.toLowerCase() !== current.name.toLowerCase() && (await nameTaken(db, orgId, name, current.id))) {
    fail(409, "A product with this name already exists.")
  }

  const stmts: BatchItem<"sqlite">[] = []
  const base = { orgId, targetType: "product" as const, targetId: current.id, targetCode: current.code, targetName: name, byName: user.name }
  const edits: (typeof fieldEdit.$inferInsert)[] = []
  if (name !== current.name) edits.push({ ...base, id: newId(), field: "Name", oldValue: current.name, newValue: name })
  if (lowLevel !== current.lowLevel) {
    edits.push({ ...base, id: newId(), field: "Low level", oldValue: current.lowLevel === null ? "None" : `${current.lowLevel} pcs`, newValue: lowLevel === null ? "None" : `${lowLevel} pcs` })
  }
  const priceText = (list: ProductPrice[], def: string) =>
    list.map((p) => `${formatEtb(p.amount)}${p.schemeId === def ? " (default)" : ""}`).join(", ")
  if (JSON.stringify(prices) !== JSON.stringify(current.prices) || defaultSchemeId !== current.defaultSchemeId) {
    edits.push({ ...base, id: newId(), field: "Prices", oldValue: priceText(current.prices, current.defaultSchemeId), newValue: priceText(prices, defaultSchemeId) })
  }
  let versionId = current.versionId
  if (!sameLines(lines, current.lines) || additionalCost !== current.additionalCost) {
    versionId = newId()
    stmts.push(
      db.insert(productVersion).values({ id: versionId, orgId, productId: current.id, version: current.version + 1, lines, additionalCost, byName: user.name })
    )
  }
  stmts.push(db.update(product).set({ name, lowLevel, prices, defaultSchemeId, versionId }).where(eq(product.id, current.id)))
  if (edits.length) stmts.push(db.insert(fieldEdit).values(edits))
  const patch = await readBack(db, orgId, [current.id], [], stmts)
  return c.json({ patch: { products: patch.products } })
})

// Stock product: a production run. Blocked when any input is short.
products.post("/products/:id/produce", async (c) => {
  requireRole(c, "contributor")
  const db = c.get("db")
  const orgId = c.get("orgId")
  const current = await getProduct(db, orgId, c.req.param("id"))
  if (current.archived) fail(409, "This product is archived.")
  const body = await readBody(c)
  const units = int(body, "units", { min: 1, max: 10_000_000, label: "pieces to make" })
  const date = pastDate(body)
  const note = str(body, "note", { max: 300, label: "Note" })
  const inputIds = current.lines.map((l) => l.inputId)
  const short = shortfallMessage(current.lines, units, await q.inputsById(db, orgId, inputIds))
  if (short) fail(409, short)
  const { stmts } = produceStatements(db, { orgId, productId: current.id, versionId: current.versionId, lines: current.lines, units, date, note, byName: c.get("user").name })
  const patch = await readBack(db, orgId, [current.id], inputIds, stmts)
  return c.json({ patch })
})

products.post("/products/:id/adjust", async (c) => {
  requireRole(c, "admin")
  const db = c.get("db")
  const orgId = c.get("orgId")
  const current = await getProduct(db, orgId, c.req.param("id"))
  const body = await readBody(c)
  const counted = int(body, "counted", { min: 0, label: "the counted units" })
  const date = pastDate(body)
  const reason = str(body, "reason", { min: 1, max: 300, label: "a reason" })
  if (counted === current.onHand) fail(409, "The count matches on hand. Nothing to adjust.")
  const patch = await readBack(db, orgId, [current.id], [], [
    db.insert(productEntry).values({
      id: newId(), orgId, productId: current.id, date, type: "adjusted", note: reason, byName: c.get("user").name,
      units: sql`${counted} - (SELECT ${product.onHand} FROM ${product} WHERE ${product.id} = ${current.id})`,
    }),
    db.update(product).set({ onHand: counted }).where(eq(product.id, current.id)),
  ])
  return c.json({ patch: { products: patch.products } })
})

products.post("/products/:id/archive", async (c) => {
  requireRole(c, "admin")
  const db = c.get("db")
  const orgId = c.get("orgId")
  const current = await getProduct(db, orgId, c.req.param("id"))
  const reason = str(await readBody(c), "reason", { min: 1, max: 300, label: "a reason" })
  const patch = await readBack(db, orgId, [current.id], [], [
    db.update(product).set({ archived: true, archiveReason: reason }).where(eq(product.id, current.id)),
  ])
  return c.json({ patch: { products: patch.products } })
})

products.post("/products/:id/restore", async (c) => {
  requireRole(c, "admin")
  const db = c.get("db")
  const orgId = c.get("orgId")
  const current = await getProduct(db, orgId, c.req.param("id"))
  if (await nameTaken(db, orgId, current.name, current.id)) fail(409, "An active product has the same name. Rename it first.")
  const patch = await readBack(db, orgId, [current.id], [], [
    db.update(product).set({ archived: false, archiveReason: "" }).where(eq(product.id, current.id)),
  ])
  return c.json({ patch: { products: patch.products } })
})

products.get("/products/:id/history", async (c) => {
  const db = c.get("db")
  const orgId = c.get("orgId")
  const id = c.req.param("id")
  const [entries, versions, edits] = await db.batch([
    db
      .select({ e: productEntry, saleCode: sale.code, version: productVersion.version })
      .from(productEntry)
      .leftJoin(sale, eq(sale.id, productEntry.saleId))
      .leftJoin(productVersion, eq(productVersion.id, productEntry.versionId))
      .where(and(eq(productEntry.productId, id), eq(productEntry.orgId, orgId)))
      .orderBy(desc(productEntry.createdAt))
      .limit(500),
    db.select().from(productVersion).where(and(eq(productVersion.productId, id), eq(productVersion.orgId, orgId))).orderBy(desc(productVersion.version)),
    db.select().from(fieldEdit).where(and(eq(fieldEdit.targetId, id), eq(fieldEdit.orgId, orgId))).orderBy(desc(fieldEdit.createdAt)).limit(200),
  ])
  const day = (d: Date) => d.toISOString().slice(0, 10)
  const blank = { unitCost: null, voided: false, voidReason: "", voidByName: "", voidedAt: null, saleId: null, saleCode: null }
  const history: HistoryEntry[] = [
    ...entries.map(({ e, saleCode, version }) => ({
      id: e.id, kind: "entry" as const, date: e.date, createdAt: e.createdAt.getTime(), type: e.type, amount: e.units, unitCost: null,
      note: e.note, byName: e.byName, voided: !!e.voidedAt, voidReason: e.voidReason, voidByName: e.voidByName,
      voidedAt: e.voidedAt?.getTime() ?? null, saleId: e.saleId, saleCode, version: version ?? undefined,
    })),
    ...versions.map((v) => ({
      ...blank, id: v.id, kind: "version" as const, date: day(v.createdAt), createdAt: v.createdAt.getTime(), type: "version",
      amount: 0, note: v.version === 1 ? "Composition created" : "Composition changed", byName: v.byName, version: v.version,
    })),
    ...edits.map((f) => ({
      ...blank, id: f.id, kind: "edit" as const, date: day(f.createdAt), createdAt: f.createdAt.getTime(), type: "edit", amount: 0,
      note: "", byName: f.byName, field: f.field, oldValue: f.oldValue, newValue: f.newValue,
    })),
  ].sort((a, b) => b.createdAt - a.createdAt)
  // Version lines for showing what each run used.
  return c.json({ history, versions: versions.map((v) => ({ id: v.id, version: v.version, lines: v.lines, additionalCost: v.additionalCost })) })
})

/**
 * Correct a production run or a count adjustment: void it (reason required) and optionally save a
 * replacement run in the same batch. Inputs go back and units go away. Refused when the units are
 * already sold (the product CHECK constraint fails and nothing is saved).
 */
products.post("/product-entries/:id/void", async (c) => {
  requireRole(c, "admin")
  const db = c.get("db")
  const orgId = c.get("orgId")
  const user = c.get("user")
  const body = await readBody(c)
  const reason = str(body, "reason", { min: 1, max: 300, label: "a reason" })
  const entry = await db.select().from(productEntry).where(and(eq(productEntry.id, c.req.param("id")), eq(productEntry.orgId, orgId))).get()
  if (!entry) fail(404, "Entry not found.")
  if (entry.voidedAt) fail(409, "This entry is already void.")
  if (entry.type === "sold") fail(409, "This entry comes from a sale. Correct or void the sale instead.")
  const current = await getProduct(db, orgId, entry.productId)
  const rep = body.replacement && typeof body.replacement === "object" ? (body.replacement as Body) : null
  if (rep && entry.type !== "made") fail(400, "Only production runs can be corrected with new values.")

  const used = entry.type === "made"
    ? await db.select().from(inputEntry).where(and(eq(inputEntry.productEntryId, entry.id), isNull(inputEntry.voidedAt)))
    : []
  if (entry.units > current.onHand) fail(409, "These units are already sold. Adjust the count instead.")

  const stmts: BatchItem<"sqlite">[] = [
    db.insert(voidLock).values({ id: entry.id }),
    db.update(productEntry).set({ voidedAt: new Date(), voidReason: reason, voidByName: user.name }).where(eq(productEntry.id, entry.id)),
    db.update(product).set({ onHand: sql`${product.onHand} - ${entry.units}` }).where(eq(product.id, current.id)),
  ]
  for (const u of used) {
    stmts.push(db.update(input).set({ onHand: sql`${input.onHand} - ${u.amount}` }).where(eq(input.id, u.inputId)))
  }
  if (used.length) {
    stmts.push(db.update(inputEntry).set({ voidedAt: new Date(), voidReason: reason, voidByName: user.name }).where(eq(inputEntry.productEntryId, entry.id)))
  }
  const inputIds = new Set([...used.map((u) => u.inputId), ...current.lines.map((l) => l.inputId)])
  if (rep) {
    const units = int(rep, "units", { min: 1, max: 10_000_000, label: "pieces to make" })
    const date = pastDate(rep)
    const note = str(rep, "note", { max: 300, label: "Note" })
    stmts.push(
      ...produceStatements(db, { orgId, productId: current.id, versionId: current.versionId, lines: current.lines, units, date, note, byName: user.name, correctsId: entry.id }).stmts
    )
  }
  const patch = await readBack(db, orgId, [current.id], [...inputIds], stmts)
  return c.json({ patch })
})
