/**
 * Domain types and pure helpers shared by the Worker (API) and the SPA.
 *
 * Storage rules (no floating point in the database):
 * - Money is whole santim (1 ETB = 100 santim).
 * - Materials are stored in milligrams (kg with 6 decimals), packaging in pieces.
 * - Unit cost is santim per display unit (per kg, or per piece).
 */

export type Role = "admin" | "contributor" | "viewer"
export type InputKind = "material" | "packaging"
export type Unit = "kg" | "pcs"

export const MG_PER_KG = 1_000_000
export const MAX_AMOUNT = Number.MAX_SAFE_INTEGER

export const ROLES: Role[] = ["admin", "contributor", "viewer"]

export const ORG_ICONS = ["box", "flask", "leaf", "sun", "droplet", "sparkles", "store", "factory", "gem", "flower"] as const
export const ORG_COLORS = ["violet", "blue", "teal", "green", "amber", "orange", "rose", "pink", "slate", "indigo"] as const
export type OrgIcon = (typeof ORG_ICONS)[number]
export type OrgColor = (typeof ORG_COLORS)[number]

export type Org = {
  id: string
  name: string
  icon: OrgIcon
  color: OrgColor
  contactName: string
  contactEmail: string
  contactPhone: string
  invoiceAddress: string
}

export type OrgSummary = { id: string; name: string; icon: OrgIcon; color: OrgColor; role: Role }

export type Me = {
  user: { id: string; name: string; email: string } | null
  isOwner: boolean
  orgs: OrgSummary[]
  needsSetup: boolean
}

export type Input = {
  id: string
  code: string
  name: string
  kind: InputKind
  unit: Unit
  /** Base units: mg for kg, pieces for pcs. */
  onHand: number
  /** Santim per kg or per piece. Weighted average of purchases. */
  unitCost: number
  /** Base units. Null means no low-stock alert. */
  lowLevel: number | null
  archived: boolean
  archiveReason: string
}

export type CompositionLine = {
  inputId: string
  /** Base units per one unit of product. */
  amount: number
}

export type ProductPrice = { schemeId: string; amount: number }

export type Product = {
  id: string
  code: string
  name: string
  onHand: number
  lowLevel: number | null
  defaultSchemeId: string
  prices: ProductPrice[]
  versionId: string
  version: number
  lines: CompositionLine[]
  /** Extra santim per finished unit (labelling, handling). */
  additionalCost: number
  archived: boolean
  archiveReason: string
}

export type PricingScheme = { id: string; name: string }

export type Catalog = {
  org: Org
  inputs: Input[]
  products: Product[]
  schemes: PricingScheme[]
}

export type SaleLine = {
  productId: string
  productCode: string
  productName: string
  qty: number
  schemeId: string | null
  priceName: string
  unitPrice: number
  lineTotal: number
  /** Unit cost snapshot at save time (inputs + additional cost). */
  unitCost: number
}

export type Sale = {
  id: string
  code: string
  date: string
  buyerNote: string
  status: "sold" | "void"
  lines: SaleLine[]
  total: number
  cost: number
  qty: number
  byName: string
  createdAt: number
  voidReason: string
  voidByName: string
  voidedAt: number | null
  correctsId: string | null
}

export type HistoryEntry = {
  id: string
  kind: "entry" | "edit" | "version"
  date: string
  createdAt: number
  /** added | used | adjusted | made | sold | edit | version */
  type: string
  amount: number
  unitCost: number | null
  note: string
  byName: string
  voided: boolean
  voidReason: string
  voidByName: string
  voidedAt: number | null
  saleId: string | null
  saleCode: string | null
  field?: string
  oldValue?: string
  newValue?: string
  version?: number
}

export type AuditRow = {
  id: string
  date: string
  createdAt: number
  movement: string
  itemId: string | null
  itemType: "input" | "product" | "sale" | "scheme" | "org"
  itemCode: string
  itemName: string
  unit: Unit | null
  amount: number | null
  money: number | null
  detail: string
  byName: string
  voided: boolean
  voidReason: string
}

export type Member = { userId: string; name: string; email: string; role: Role; createdAt: number }
export type Invite = { id: string; name: string; email: string; role: Role; expiresAt: number; createdAt: number }

// ---------------------------------------------------------------------------
// Units

export function unitForKind(kind: InputKind): Unit {
  return kind === "packaging" ? "pcs" : "kg"
}

/** Parses user text into base units without floating point. Null when invalid. */
export function parseAmount(text: string, unit: Unit, { allowZero = false } = {}): number | null {
  const value = text.trim().replace(/,/g, "")
  if (unit === "pcs") {
    if (!/^\d+$/.test(value)) return null
    const n = Number(value)
    if (!Number.isSafeInteger(n) || (!allowZero && n === 0)) return null
    return n
  }
  const match = /^(\d*)(?:\.(\d{0,6}))?$/.exec(value)
  if (!match || (match[1] === "" && !match[2])) return null
  const whole = match[1] === "" ? 0 : Number(match[1])
  const frac = Number((match[2] ?? "").padEnd(6, "0"))
  const mg = whole * MG_PER_KG + frac
  if (!Number.isSafeInteger(mg) || (!allowZero && mg === 0)) return null
  return mg
}

/** Base units to an editable string (no unit suffix, no grouping). */
export function amountToInput(base: number, unit: Unit): string {
  if (unit === "pcs") return String(base)
  const sign = base < 0 ? "-" : ""
  const abs = Math.abs(base)
  const whole = Math.floor(abs / MG_PER_KG)
  const frac = String(abs % MG_PER_KG).padStart(6, "0").replace(/0+$/, "")
  return frac ? `${sign}${whole}.${frac}` : `${sign}${whole}`
}

export function formatAmount(base: number, unit: Unit): string {
  if (unit === "pcs") return `${base.toLocaleString("en-US")} pcs`
  const sign = base < 0 ? "-" : ""
  const abs = Math.abs(base)
  const whole = Math.floor(abs / MG_PER_KG)
  const frac = String(abs % MG_PER_KG).padStart(6, "0").replace(/0+$/, "")
  return `${sign}${whole.toLocaleString("en-US")}${frac ? `.${frac}` : ""} kg`
}

export function formatSignedAmount(base: number, unit: Unit): string {
  return base > 0 ? `+${formatAmount(base, unit)}` : formatAmount(base, unit)
}

/** "0.0003 kg = 0.3 g" for small kg values. */
export function gramsNote(base: number, unit: Unit): string | null {
  if (unit !== "kg" || base <= 0 || base >= MG_PER_KG) return null
  const grams = base / 1000
  return `${amountToInput(base, "kg")} kg = ${grams.toLocaleString("en-US", { maximumFractionDigits: 3 })} g`
}

// ---------------------------------------------------------------------------
// Money

export function parseMoney(text: string, { allowZero = true } = {}): number | null {
  const value = text.trim().replace(/,/g, "")
  const match = /^(\d*)(?:\.(\d{0,2}))?$/.exec(value)
  if (!match || (match[1] === "" && !match[2])) return null
  const santim = (match[1] === "" ? 0 : Number(match[1])) * 100 + Number((match[2] ?? "").padEnd(2, "0"))
  if (!Number.isSafeInteger(santim) || santim > 100_000_000_000_000) return null
  if (!allowZero && santim === 0) return null
  return santim
}

export function moneyToInput(santim: number): string {
  return (santim / 100).toFixed(2)
}

export function formatEtb(santim: number): string {
  return `${(santim / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`
}

// ---------------------------------------------------------------------------
// Cost

function perUnitDivisor(unit: Unit) {
  return unit === "kg" ? MG_PER_KG : 1
}

/** Santim value of a base-unit amount at a unit cost. */
export function valueOf(amount: number, unitCost: number, unit: Unit): number {
  return Math.round((amount * unitCost) / perUnitDivisor(unit))
}

/** Unit cost of one product unit from its composition and current input costs. */
export function productUnitCost(
  lines: CompositionLine[],
  additionalCost: number,
  inputsById: Map<string, Pick<Input, "unit" | "unitCost">>
): number {
  let total = 0
  for (const line of lines) {
    const input = inputsById.get(line.inputId)
    if (!input) continue
    total += (line.amount * input.unitCost) / perUnitDivisor(input.unit)
  }
  return Math.round(total) + additionalCost
}

export type Need = { inputId: string; needed: number; onHand: number; short: number }

/** Inputs needed to make `units` of a product, with shortfalls. */
export function productionNeeds(
  lines: CompositionLine[],
  units: number,
  inputsById: Map<string, Pick<Input, "onHand">>
): Need[] {
  return lines.map((line) => {
    const needed = line.amount * units
    const onHand = inputsById.get(line.inputId)?.onHand ?? 0
    return { inputId: line.inputId, needed, onHand, short: Math.max(0, needed - onHand) }
  })
}

export function priceFor(product: Pick<Product, "prices" | "defaultSchemeId">, schemeId?: string | null): number {
  const id = schemeId ?? product.defaultSchemeId
  return product.prices.find((p) => p.schemeId === id)?.amount ?? product.prices[0]?.amount ?? 0
}

// ---------------------------------------------------------------------------
// Alerts (derived from current data on the client; no storage, no requests)

export type AlertLevel = "error" | "warning"
export type Alert = {
  id: string
  level: AlertLevel
  title: string
  itemType: "input" | "product"
  itemId: string
  itemName: string
  itemCode: string
  detail: string
  action: "stock-input" | "stock-product"
}

export function alertsFor(catalog: Pick<Catalog, "inputs" | "products">): Alert[] {
  const alerts: Alert[] = []
  const inputs = new Map(catalog.inputs.map((i) => [i.id, i]))
  for (const input of catalog.inputs) {
    if (input.archived) continue
    if (input.onHand <= 0) {
      alerts.push({
        id: `out-${input.id}`, level: "error", title: "Out of stock", itemType: "input", itemId: input.id,
        itemName: input.name, itemCode: input.code, detail: `On hand is ${formatAmount(0, input.unit)}.`, action: "stock-input",
      })
    } else if (input.lowLevel !== null && input.onHand <= input.lowLevel) {
      alerts.push({
        id: `low-${input.id}`, level: "warning", title: "Low stock", itemType: "input", itemId: input.id,
        itemName: input.name, itemCode: input.code,
        detail: `${formatAmount(input.onHand, input.unit)} on hand. Low level is ${formatAmount(input.lowLevel, input.unit)}.`,
        action: "stock-input",
      })
    }
  }
  for (const product of catalog.products) {
    if (product.archived) continue
    const short = productionNeeds(product.lines, 1, inputs).filter((n) => n.short > 0)
    if (product.onHand <= 0) {
      alerts.push({
        id: `pout-${product.id}`, level: "error", title: "Out of stock", itemType: "product", itemId: product.id,
        itemName: product.name, itemCode: product.code, detail: "No units on hand.", action: "stock-product",
      })
    } else if (product.lowLevel !== null && product.onHand <= product.lowLevel) {
      alerts.push({
        id: `plow-${product.id}`, level: "warning", title: "Low stock", itemType: "product", itemId: product.id,
        itemName: product.name, itemCode: product.code,
        detail: `${formatAmount(product.onHand, "pcs")} on hand. Low level is ${formatAmount(product.lowLevel, "pcs")}.`,
        action: "stock-product",
      })
    }
    if (short.length > 0) {
      const names = short.map((n) => inputs.get(n.inputId)?.name ?? "Unknown").join(", ")
      alerts.push({
        id: `cant-${product.id}`, level: "error", title: "Cannot be made", itemType: "product", itemId: product.id,
        itemName: product.name, itemCode: product.code, detail: `Not enough ${names} for one unit.`, action: "stock-input",
      })
    }
  }
  return alerts
}

// ---------------------------------------------------------------------------
// Dates

export function todayISO(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function monthKey(date = new Date()): string {
  return todayISO(date).slice(0, 7)
}

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  const month = MONTHS[(m ?? 0) - 1]
  return y && month && d ? `${month} ${d}, ${y}` : iso
}

export function formatMonth(key: string): string {
  const [y, m] = key.split("-").map(Number)
  const month = MONTHS[(m ?? 0) - 1]
  return y && month ? `${month} ${y}` : key
}

export function codeNumber(code: string): number {
  return Number(code.replace(/^\D+/, "")) || 0
}
