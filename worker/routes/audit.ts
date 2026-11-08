import { and, eq, gte, lt, ne } from "drizzle-orm"
import { Hono } from "hono"
import type { AuditRow } from "../../shared/domain"
import { fieldEdit, input, inputEntry, product, productEntry, productVersion, sale } from "../db/schema"
import type { AppEnv } from "../env"
import { monthRange } from "../lib"

export const audit = new Hono<AppEnv>()

const MOVEMENT: Record<string, string> = {
  added: "Stock added",
  used: "Used in production",
  adjusted: "Count adjusted",
  made: "Stock product",
}

/** Every movement in one month: five indexed queries in a single D1 round trip. */
audit.get("/audit", async (c) => {
  const db = c.get("db")
  const orgId = c.get("orgId")
  const { from, to, fromMs, toMs } = monthRange(c.req.query("month"))
  const [inputRows, productRows, saleRows, editRows, versionRows] = await db.batch([
    db
      .select({ e: inputEntry, code: input.code, name: input.name, unit: input.unit })
      .from(inputEntry)
      .innerJoin(input, eq(input.id, inputEntry.inputId))
      .where(and(eq(inputEntry.orgId, orgId), gte(inputEntry.date, from), lt(inputEntry.date, to))),
    db
      .select({ e: productEntry, code: product.code, name: product.name })
      .from(productEntry)
      .innerJoin(product, eq(product.id, productEntry.productId))
      .where(and(eq(productEntry.orgId, orgId), gte(productEntry.date, from), lt(productEntry.date, to), ne(productEntry.type, "sold"))),
    db.select().from(sale).where(and(eq(sale.orgId, orgId), gte(sale.date, from), lt(sale.date, to))),
    db
      .select()
      .from(fieldEdit)
      .where(and(eq(fieldEdit.orgId, orgId), gte(fieldEdit.createdAt, new Date(fromMs)), lt(fieldEdit.createdAt, new Date(toMs)))),
    db
      .select({ v: productVersion, code: product.code, name: product.name })
      .from(productVersion)
      .innerJoin(product, eq(product.id, productVersion.productId))
      .where(and(eq(productVersion.orgId, orgId), gte(productVersion.createdAt, new Date(fromMs)), lt(productVersion.createdAt, new Date(toMs)))),
  ])

  const day = (d: Date) => d.toISOString().slice(0, 10)
  const rows: AuditRow[] = [
    ...inputRows.map(({ e, code, name, unit }) => ({
      id: e.id, date: e.date, createdAt: e.createdAt.getTime(), movement: MOVEMENT[e.type] ?? e.type, itemId: e.inputId,
      itemType: "input" as const, itemCode: code, itemName: name, unit, amount: e.amount,
      money: e.type === "added" && e.unitCost !== null ? Math.round((e.amount * e.unitCost) / (unit === "kg" ? 1_000_000 : 1)) : null,
      detail: e.note, byName: e.byName, voided: !!e.voidedAt, voidReason: e.voidReason,
    })),
    ...productRows.map(({ e, code, name }) => ({
      id: e.id, date: e.date, createdAt: e.createdAt.getTime(), movement: MOVEMENT[e.type] ?? e.type, itemId: e.productId,
      itemType: "product" as const, itemCode: code, itemName: name, unit: "pcs" as const, amount: e.units, money: null,
      detail: e.note, byName: e.byName, voided: !!e.voidedAt, voidReason: e.voidReason,
    })),
    ...saleRows.map((s) => ({
      id: s.id, date: s.date, createdAt: s.createdAt.getTime(), movement: s.correctsId ? "Sale (correction)" : "Sale", itemId: s.id,
      itemType: "sale" as const, itemCode: s.code,
      itemName: s.lines.length > 1 ? `${s.lines[0]?.productName} +${s.lines.length - 1} more` : (s.lines[0]?.productName ?? ""),
      unit: "pcs" as const, amount: -s.qty, money: s.total, detail: s.buyerNote, byName: s.byName, voided: s.status === "void", voidReason: s.voidReason,
    })),
    ...editRows.map((f) => ({
      id: f.id, date: day(f.createdAt), createdAt: f.createdAt.getTime(), movement: `Edit: ${f.field}`, itemId: f.targetId,
      itemType: f.targetType, itemCode: f.targetCode, itemName: f.targetName, unit: null, amount: null, money: null,
      detail: `${f.oldValue} → ${f.newValue}`, byName: f.byName, voided: false, voidReason: "",
    })),
    ...versionRows.map(({ v, code, name }) => ({
      id: v.id, date: day(v.createdAt), createdAt: v.createdAt.getTime(), movement: v.version === 1 ? "Product created" : "Composition changed",
      itemId: v.productId, itemType: "product" as const, itemCode: code, itemName: name, unit: null, amount: null, money: null,
      detail: `Version ${v.version}`, byName: v.byName, voided: false, voidReason: "",
    })),
  ].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
  return c.json({ rows })
})
