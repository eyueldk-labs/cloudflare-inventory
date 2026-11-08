import { and, eq, inArray } from "drizzle-orm"
import type { Input, Org, Product, PricingScheme, Sale } from "../shared/domain"
import { input, organization, pricingScheme, product, productVersion, sale } from "./db/schema"
import type { DB } from "./env"

/** Query builders used inside D1 batches so writes and read-backs share one round trip. */
export const q = {
  org: (db: DB, orgId: string) => db.select().from(organization).where(eq(organization.id, orgId)),
  inputs: (db: DB, orgId: string) => db.select().from(input).where(eq(input.orgId, orgId)),
  inputsById: (db: DB, orgId: string, ids: string[]) =>
    db.select().from(input).where(and(eq(input.orgId, orgId), inArray(input.id, ids.length ? ids : [""]))),
  products: (db: DB, orgId: string) => productSelect(db).where(eq(product.orgId, orgId)),
  productsById: (db: DB, orgId: string, ids: string[]) =>
    productSelect(db).where(and(eq(product.orgId, orgId), inArray(product.id, ids.length ? ids : [""]))),
  schemes: (db: DB, orgId: string) => db.select().from(pricingScheme).where(eq(pricingScheme.orgId, orgId)),
  saleById: (db: DB, orgId: string, id: string) => db.select().from(sale).where(and(eq(sale.orgId, orgId), eq(sale.id, id))),
}

function productSelect(db: DB) {
  return db
    .select({ p: product, v: { version: productVersion.version, lines: productVersion.lines, additionalCost: productVersion.additionalCost } })
    .from(product)
    .innerJoin(productVersion, eq(productVersion.id, product.versionId))
}

type InputRow = typeof input.$inferSelect
type ProductRow = { p: typeof product.$inferSelect; v: { version: number; lines: { inputId: string; amount: number }[]; additionalCost: number } }

export function toInput(r: InputRow): Input {
  return {
    id: r.id, code: r.code, name: r.name, kind: r.kind, unit: r.unit, onHand: r.onHand, unitCost: r.unitCost,
    lowLevel: r.lowLevel, archived: r.archived, archiveReason: r.archiveReason,
  }
}

export function toProduct({ p, v }: ProductRow): Product {
  return {
    id: p.id, code: p.code, name: p.name, onHand: p.onHand, lowLevel: p.lowLevel, defaultSchemeId: p.defaultSchemeId,
    prices: p.prices, versionId: p.versionId, version: v.version, lines: v.lines, additionalCost: v.additionalCost,
    archived: p.archived, archiveReason: p.archiveReason,
  }
}

export function toScheme(r: typeof pricingScheme.$inferSelect): PricingScheme {
  return { id: r.id, name: r.name }
}

export function toOrg(r: typeof organization.$inferSelect): Org {
  return {
    id: r.id, name: r.name, icon: r.icon as Org["icon"], color: r.color as Org["color"], contactName: r.contactName,
    contactEmail: r.contactEmail, contactPhone: r.contactPhone, invoiceAddress: r.invoiceAddress,
  }
}

export function toSale(r: typeof sale.$inferSelect): Sale {
  return {
    id: r.id, code: r.code, date: r.date, buyerNote: r.buyerNote, status: r.status, lines: r.lines, total: r.total,
    cost: r.cost, qty: r.qty, byName: r.byName, createdAt: r.createdAt.getTime(), voidReason: r.voidReason,
    voidByName: r.voidByName, voidedAt: r.voidedAt?.getTime() ?? null, correctsId: r.correctsId,
  }
}

/** Partial catalog returned by mutations so the client can patch its cache without refetching. */
export type CatalogPatch = { inputs?: Input[]; products?: Product[]; schemes?: PricingScheme[]; org?: Org }
