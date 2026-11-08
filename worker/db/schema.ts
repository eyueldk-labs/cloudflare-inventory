import { sql } from "drizzle-orm"
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

const ts = (name: string) => integer(name, { mode: "timestamp_ms" })
const now = sql`(unixepoch() * 1000)`

// ---------------------------------------------------------------------------
// Better Auth tables

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: ts("created_at").notNull().default(now),
  updatedAt: ts("updated_at").notNull().default(now),
})

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: ts("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: ts("created_at").notNull().default(now),
    updatedAt: ts("updated_at").notNull().default(now),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)]
)

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: ts("created_at").notNull().default(now),
    updatedAt: ts("updated_at").notNull().default(now),
  },
  (t) => [index("account_user_idx").on(t.userId)]
)

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").notNull().default(now),
    updatedAt: ts("updated_at").notNull().default(now),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)]
)

export const rateLimit = sqliteTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: integer("last_request").notNull(),
})

// ---------------------------------------------------------------------------
// App

/** Instance settings: generated auth secret, owner user id. */
export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
})

export const organization = sqliteTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  contactName: text("contact_name").notNull().default(""),
  contactEmail: text("contact_email").notNull().default(""),
  contactPhone: text("contact_phone").notNull().default(""),
  invoiceAddress: text("invoice_address").notNull().default(""),
  /** Code counters. Numbers are never reused. */
  matSeq: integer("mat_seq").notNull().default(0),
  pakSeq: integer("pak_seq").notNull().default(0),
  proSeq: integer("pro_seq").notNull().default(0),
  salSeq: integer("sal_seq").notNull().default(0),
  createdAt: ts("created_at").notNull().default(now),
})

export const member = sqliteTable(
  "member",
  {
    orgId: text("org_id").notNull().references(() => organization.id),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["admin", "contributor", "viewer"] }).notNull(),
    createdAt: ts("created_at").notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] }), index("member_user_idx").on(t.userId)]
)

export const invite = sqliteTable(
  "invite",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull().references(() => organization.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: text("role", { enum: ["admin", "contributor", "viewer"] }).notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: ts("expires_at").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: ts("created_at").notNull().default(now),
    usedAt: ts("used_at"),
    revokedAt: ts("revoked_at"),
  },
  (t) => [index("invite_org_idx").on(t.orgId)]
)

export const pricingScheme = sqliteTable(
  "pricing_scheme",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull().references(() => organization.id),
    name: text("name").notNull(),
    createdAt: ts("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("pricing_scheme_name_uq").on(t.orgId, sql`lower(${t.name})`)]
)

export const input = sqliteTable(
  "input",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull().references(() => organization.id),
    code: text("code").notNull(),
    kind: text("kind", { enum: ["material", "packaging"] }).notNull(),
    name: text("name").notNull(),
    unit: text("unit", { enum: ["kg", "pcs"] }).notNull(),
    onHand: integer("on_hand").notNull().default(0),
    unitCost: integer("unit_cost").notNull().default(0),
    lowLevel: integer("low_level"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    archiveReason: text("archive_reason").notNull().default(""),
    createdAt: ts("created_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("input_code_uq").on(t.orgId, t.code),
    // Any write that would take stock below zero fails and rolls back its whole batch.
    check("input_on_hand_ok", sql`${t.onHand} >= 0`),
    check("input_cost_ok", sql`${t.unitCost} >= 0`),
  ]
)

export const inputEntry = sqliteTable(
  "input_entry",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    inputId: text("input_id").notNull().references(() => input.id),
    date: text("date").notNull(),
    type: text("type", { enum: ["added", "used", "adjusted"] }).notNull(),
    amount: integer("amount").notNull(),
    unitCost: integer("unit_cost"),
    note: text("note").notNull().default(""),
    byName: text("by_name").notNull(),
    productEntryId: text("product_entry_id"),
    correctsId: text("corrects_id"),
    voidedAt: ts("voided_at"),
    voidReason: text("void_reason").notNull().default(""),
    voidByName: text("void_by_name").notNull().default(""),
    createdAt: ts("created_at").notNull().default(now),
  },
  (t) => [
    index("input_entry_input_idx").on(t.inputId, t.createdAt),
    index("input_entry_org_date_idx").on(t.orgId, t.date),
    index("input_entry_production_idx").on(t.productEntryId),
  ]
)

export const product = sqliteTable(
  "product",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull().references(() => organization.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    onHand: integer("on_hand").notNull().default(0),
    lowLevel: integer("low_level"),
    defaultSchemeId: text("default_scheme_id").notNull(),
    /** JSON: [{ schemeId, amount }] — one row instead of a join table. */
    prices: text("prices", { mode: "json" }).$type<{ schemeId: string; amount: number }[]>().notNull(),
    versionId: text("version_id").notNull(),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    archiveReason: text("archive_reason").notNull().default(""),
    createdAt: ts("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("product_code_uq").on(t.orgId, t.code), check("product_on_hand_ok", sql`${t.onHand} >= 0`)]
)

export const productVersion = sqliteTable(
  "product_version",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    productId: text("product_id").notNull(),
    version: integer("version").notNull(),
    /** JSON: [{ inputId, amount }] per one unit. */
    lines: text("lines", { mode: "json" }).$type<{ inputId: string; amount: number }[]>().notNull(),
    additionalCost: integer("additional_cost").notNull().default(0),
    byName: text("by_name").notNull(),
    createdAt: ts("created_at").notNull().default(now),
  },
  (t) => [index("product_version_product_idx").on(t.productId), index("product_version_org_idx").on(t.orgId, t.createdAt)]
)

export const productEntry = sqliteTable(
  "product_entry",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    productId: text("product_id").notNull().references(() => product.id),
    date: text("date").notNull(),
    type: text("type", { enum: ["made", "sold", "adjusted"] }).notNull(),
    units: integer("units").notNull(),
    versionId: text("version_id"),
    saleId: text("sale_id"),
    note: text("note").notNull().default(""),
    byName: text("by_name").notNull(),
    correctsId: text("corrects_id"),
    voidedAt: ts("voided_at"),
    voidReason: text("void_reason").notNull().default(""),
    voidByName: text("void_by_name").notNull().default(""),
    createdAt: ts("created_at").notNull().default(now),
  },
  (t) => [
    index("product_entry_product_idx").on(t.productId, t.createdAt),
    index("product_entry_org_date_idx").on(t.orgId, t.date),
    index("product_entry_sale_idx").on(t.saleId),
  ]
)

export const sale = sqliteTable(
  "sale",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull().references(() => organization.id),
    code: text("code").notNull(),
    date: text("date").notNull(),
    buyerNote: text("buyer_note").notNull().default(""),
    status: text("status", { enum: ["sold", "void"] }).notNull(),
    /** JSON line snapshots (name, price, unit cost). One row per sale. */
    lines: text("lines", { mode: "json" }).$type<import("../../shared/domain").SaleLine[]>().notNull(),
    total: integer("total").notNull(),
    cost: integer("cost").notNull(),
    qty: integer("qty").notNull(),
    byName: text("by_name").notNull(),
    correctsId: text("corrects_id"),
    voidedAt: ts("voided_at"),
    voidReason: text("void_reason").notNull().default(""),
    voidByName: text("void_by_name").notNull().default(""),
    createdAt: ts("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("sale_code_uq").on(t.orgId, t.code), index("sale_org_date_idx").on(t.orgId, t.date)]
)

/** Logged edits: field, old → new, who, when. */
export const fieldEdit = sqliteTable(
  "field_edit",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    targetType: text("target_type", { enum: ["input", "product", "scheme", "org"] }).notNull(),
    targetId: text("target_id").notNull(),
    targetCode: text("target_code").notNull().default(""),
    targetName: text("target_name").notNull(),
    field: text("field").notNull(),
    oldValue: text("old_value").notNull(),
    newValue: text("new_value").notNull(),
    byName: text("by_name").notNull(),
    createdAt: ts("created_at").notNull().default(now),
  },
  (t) => [index("field_edit_target_idx").on(t.targetId), index("field_edit_org_idx").on(t.orgId, t.createdAt)]
)

/** One row per voided entry. A second void of the same entry fails and rolls back its batch. */
export const voidLock = sqliteTable("void_lock", {
  id: text("id").primaryKey(),
})
