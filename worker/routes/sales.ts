import { and, desc, eq, gte, lt, sql } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"
import { Hono } from "hono"
import { productUnitCost, type SaleLine } from "../../shared/domain"
import { q, toInput, toProduct, toSale } from "../catalog"
import { organization, product, productEntry, sale, voidLock } from "../db/schema"
import type { AppEnv, DB } from "../env"
import { arr, fail, int, monthRange, newId, pastDate, readBody, requireRole, str, type Body } from "../lib"

export const sales = new Hono<AppEnv>()

type Batch = [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]

sales.get("/sales", async (c) => {
  const db = c.get("db")
  const { from, to } = monthRange(c.req.query("month"))
  const rows = await db
    .select()
    .from(sale)
    .where(and(eq(sale.orgId, c.get("orgId")), gte(sale.date, from), lt(sale.date, to)))
    .orderBy(desc(sale.date), desc(sale.createdAt))
  return c.json({ sales: rows.map(toSale) })
})

sales.get("/sales/:id", async (c) => {
  const db = c.get("db")
  const row = await q.saleById(db, c.get("orgId"), c.req.param("id")).get()
  if (!row) fail(404, "Sale not found.")
  return c.json({ sale: toSale(row) })
})

/**
 * Validates sale lines against current products and snapshots price, name, and unit cost.
 * `keep` lets a correction keep the old snapshot for a line whose product and price did not change.
 */
async function buildSale(db: DB, orgId: string, body: Body, keep: SaleLine[] = []) {
  const date = pastDate(body)
  const buyerNote = str(body, "buyerNote", { max: 300, label: "Buyer note" })
  const raw = arr(body, "lines")
  if (raw.length === 0) fail(400, "Add at least one line.")
  if (raw.length > 100) fail(400, "A sale can have at most 100 lines.")
  const productIds = [...new Set(raw.map((l) => String(l.productId ?? "")))]
  const [productRows, inputRows, schemeRows] = await db.batch([q.productsById(db, orgId, productIds), q.inputs(db, orgId), q.schemes(db, orgId)])
  const schemeNames = new Map(schemeRows.map((r) => [r.id, r.name]))
  const productsById = new Map(productRows.map((r) => [r.p.id, toProduct(r)]))
  const inputsById = new Map(inputRows.map((r) => [r.id, toInput(r)]))

  const lines: SaleLine[] = raw.map((l, index) => {
    const p = productsById.get(String(l.productId ?? ""))
    if (!p) fail(400, `Line ${index + 1}: choose a product.`)
    const qty = int(l, "qty", { min: 1, max: 10_000_000, label: `a quantity on line ${index + 1}` })
    const schemeId = typeof l.schemeId === "string" && l.schemeId ? l.schemeId : null
    let unitPrice: number
    let priceName: string
    if (schemeId) {
      const price = p.prices.find((x) => x.schemeId === schemeId)
      if (!price) fail(400, `Line ${index + 1}: choose a price.`)
      unitPrice = price.amount
      priceName = schemeNames.get(schemeId) ?? "Price"
    } else {
      unitPrice = int(l, "unitPrice", { min: 0, max: 1e12, label: `a price on line ${index + 1}` })
      priceName = "Custom"
    }
    const old = keep.find((k) => k.productId === p.id && k.schemeId === schemeId && k.unitPrice === unitPrice)
    const unitCost = old ? old.unitCost : productUnitCost(p.lines, p.additionalCost, inputsById)
    const lineTotal = unitPrice * qty
    if (!Number.isSafeInteger(lineTotal)) fail(400, `Line ${index + 1}: the total is too large.`)
    return {
      productId: p.id, productCode: p.code, productName: old?.productName ?? p.name, qty, schemeId, priceName: old?.priceName ?? priceName,
      unitPrice, lineTotal, unitCost,
    }
  })

  // Repeated products share stock across their lines.
  const qtyByProduct = new Map<string, number>()
  for (const line of lines) qtyByProduct.set(line.productId, (qtyByProduct.get(line.productId) ?? 0) + line.qty)
  return { date, buyerNote, lines, qtyByProduct, productsById }
}

function saleStatements(
  db: DB,
  orgId: string,
  byName: string,
  built: Awaited<ReturnType<typeof buildSale>>,
  correctsId: string | null,
  returned: Map<string, number> = new Map()
) {
  for (const [productId, qty] of built.qtyByProduct) {
    const p = built.productsById.get(productId)!
    const available = p.onHand + (returned.get(productId) ?? 0)
    if (qty > available) fail(409, `Not enough ${p.name}: ${qty} pcs needed, ${available} pcs on hand.`)
  }
  const id = newId()
  const total = built.lines.reduce((s, l) => s + l.lineTotal, 0)
  const cost = built.lines.reduce((s, l) => s + l.unitCost * l.qty, 0)
  const qty = built.lines.reduce((s, l) => s + l.qty, 0)
  const stmts: BatchItem<"sqlite">[] = [
    db.update(organization).set({ salSeq: sql`${organization.salSeq} + 1` }).where(eq(organization.id, orgId)),
    db.insert(sale).values({
      id, orgId, date: built.date, buyerNote: built.buyerNote, status: "sold", lines: built.lines, total, cost, qty, byName, correctsId,
      code: sql`(SELECT printf('SAL%05d', ${organization.salSeq}) FROM ${organization} WHERE ${organization.id} = ${orgId})`,
    }),
  ]
  for (const [productId, units] of built.qtyByProduct) {
    stmts.push(
      db.update(product).set({ onHand: sql`${product.onHand} - ${units}` }).where(eq(product.id, productId)),
      db.insert(productEntry).values({ id: newId(), orgId, productId, date: built.date, type: "sold", units: -units, saleId: id, byName })
    )
  }
  return { id, stmts }
}

/** Void statements: units go back, product entries are voided, the sale stays with status Void. */
function voidStatements(db: DB, existing: typeof sale.$inferSelect, reason: string, byName: string) {
  const back = new Map<string, number>()
  for (const line of existing.lines) back.set(line.productId, (back.get(line.productId) ?? 0) + line.qty)
  const stmts: BatchItem<"sqlite">[] = [
    db.insert(voidLock).values({ id: existing.id }),
    db.update(sale).set({ status: "void", voidedAt: new Date(), voidReason: reason, voidByName: byName }).where(eq(sale.id, existing.id)),
    db.update(productEntry).set({ voidedAt: new Date(), voidReason: reason, voidByName: byName }).where(eq(productEntry.saleId, existing.id)),
  ]
  for (const [productId, units] of back) {
    stmts.push(db.update(product).set({ onHand: sql`${product.onHand} + ${units}` }).where(eq(product.id, productId)))
  }
  return { stmts, back }
}

async function finish(db: DB, orgId: string, saleIds: string[], productIds: string[], stmts: BatchItem<"sqlite">[]) {
  const reads = saleIds.map((id) => q.saleById(db, orgId, id))
  const results = await db.batch([...stmts, ...reads, q.productsById(db, orgId, productIds)] as unknown as Batch)
  const saleRows = results.slice(results.length - 1 - reads.length, -1) as (typeof sale.$inferSelect)[][]
  const productRows = results.at(-1) as Parameters<typeof toProduct>[0][]
  return { sales: saleRows.map((r) => toSale(r[0]!)), patch: { products: productRows.map(toProduct) } }
}

async function getSale(db: DB, orgId: string, id: string) {
  const row = await q.saleById(db, orgId, id).get()
  if (!row) fail(404, "Sale not found.")
  return row
}

// Record sale: one invoice with lines. Blocked when a product does not have enough units.
sales.post("/sales", async (c) => {
  requireRole(c, "contributor")
  const db = c.get("db")
  const orgId = c.get("orgId")
  const built = await buildSale(db, orgId, await readBody(c))
  const { id, stmts } = saleStatements(db, orgId, c.get("user").name, built, null)
  const result = await finish(db, orgId, [id], [...built.qtyByProduct.keys()], stmts)
  return c.json({ sale: result.sales[0], patch: result.patch })
})

sales.post("/sales/:id/void", async (c) => {
  requireRole(c, "admin")
  const db = c.get("db")
  const orgId = c.get("orgId")
  const existing = await getSale(db, orgId, c.req.param("id"))
  if (existing.status === "void") fail(409, "This sale is already void.")
  const reason = str(await readBody(c), "reason", { min: 1, max: 300, label: "a reason" })
  const { stmts, back } = voidStatements(db, existing, reason, c.get("user").name)
  const result = await finish(db, orgId, [existing.id], [...back.keys()], stmts)
  return c.json({ sale: result.sales[0], patch: result.patch })
})

// Correct: void the sale and record the corrected copy in one atomic batch.
sales.post("/sales/:id/correct", async (c) => {
  requireRole(c, "admin")
  const db = c.get("db")
  const orgId = c.get("orgId")
  const user = c.get("user")
  const existing = await getSale(db, orgId, c.req.param("id"))
  if (existing.status === "void") fail(409, "This sale is already void.")
  const body = await readBody(c)
  const reason = str(body, "reason", { min: 1, max: 300, label: "a reason" })
  const built = await buildSale(db, orgId, body, existing.lines)
  const voided = voidStatements(db, existing, reason, user.name)
  const created = saleStatements(db, orgId, user.name, built, existing.id, voided.back)
  const productIds = [...new Set([...voided.back.keys(), ...built.qtyByProduct.keys()])]
  const result = await finish(db, orgId, [existing.id, created.id], productIds, [...voided.stmts, ...created.stmts])
  return c.json({ sale: result.sales[1], voided: result.sales[0], patch: result.patch })
})
