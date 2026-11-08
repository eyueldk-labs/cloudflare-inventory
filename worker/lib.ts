import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import { isISODate, todayISO, type Role } from "../shared/domain"
import type { AppEnv } from "./env"

export const newId = () => crypto.randomUUID()

export function fail(status: ContentfulStatusCode, message: string): never {
  throw new HTTPException(status, { message })
}

const RANK: Record<Role, number> = { viewer: 0, contributor: 1, admin: 2 }

export function requireRole(c: Context<AppEnv>, min: Role) {
  if (RANK[c.get("role")] < RANK[min]) fail(403, "You do not have permission to do this.")
}

/** Turns D1 constraint errors into user-facing messages. */
export function friendlyDbError(error: unknown): string | null {
  const text = String((error as { message?: string })?.message ?? error) + String((error as { cause?: unknown })?.cause ?? "")
  if (text.includes("input_on_hand_ok")) return "Not enough stock of an input. Nothing was saved."
  if (text.includes("product_on_hand_ok")) return "Not enough units of a product. Nothing was saved."
  if (text.includes("void_lock")) return "This entry is already void."
  if (text.includes("pricing_scheme_name_uq")) return "A price with this name already exists."
  if (text.includes("UNIQUE constraint failed: meta.key")) return "Setup is already complete."
  return null
}

// ---------------------------------------------------------------------------
// Minimal body validation (keeps the Worker bundle small; no schema library)

export type Body = Record<string, unknown>

export async function readBody(c: Context<AppEnv>): Promise<Body> {
  try {
    const body = await c.req.json()
    return body && typeof body === "object" ? (body as Body) : {}
  } catch {
    return {}
  }
}

export function str(body: Body, key: string, { min = 0, max = 200, label = key } = {}): string {
  const value = body[key]
  const text = typeof value === "string" ? value.trim() : ""
  if (text.length < min) fail(400, min <= 1 ? `Enter ${label}.` : `${label} needs at least ${min} characters.`)
  if (text.length > max) fail(400, `${label} can have at most ${max} characters.`)
  return text
}

export function int(body: Body, key: string, { min = 0, max = Number.MAX_SAFE_INTEGER, label = key } = {}): number {
  const value = body[key]
  if (typeof value !== "number" || !Number.isSafeInteger(value)) fail(400, `Enter ${label}.`)
  if (value < min) fail(400, `${label} must be at least ${min}.`)
  if (value > max) fail(400, `${label} is too large.`)
  return value
}

export function optInt(body: Body, key: string, opts: { min?: number; max?: number; label?: string } = {}): number | null {
  const value = body[key]
  if (value === null || value === undefined || value === "") return null
  return int(body, key, opts)
}

export function oneOf<T extends string>(body: Body, key: string, values: readonly T[], label = key): T {
  const value = body[key]
  if (typeof value !== "string" || !values.includes(value as T)) fail(400, `Choose ${label}.`)
  return value as T
}

export function arr(body: Body, key: string): Body[] {
  const value = body[key]
  if (!Array.isArray(value)) fail(400, `Missing ${key}.`)
  return value.filter((item): item is Body => !!item && typeof item === "object")
}

/** A past or present date. One extra day is allowed for time zones ahead of UTC. */
export function pastDate(body: Body, key = "date"): string {
  const value = body[key]
  if (typeof value !== "string" || !isISODate(value)) fail(400, "Enter a valid date.")
  const tomorrow = todayISO(new Date(Date.now() + 86_400_000))
  if (value > tomorrow) fail(400, "The date cannot be in the future.")
  return value
}

export function email(body: Body, key = "email"): string {
  const value = str(body, key, { min: 3, max: 254, label: "an email" }).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) fail(400, "Enter a valid email.")
  return value
}

export function monthRange(month: string | undefined): { from: string; to: string; fromMs: number; toMs: number } {
  const key = month && /^\d{4}-\d{2}$/.test(month) ? month : todayISO().slice(0, 7)
  const [y, m] = key.split("-").map(Number) as [number, number]
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`
  return {
    from: `${key}-01`,
    to: `${next}-01`,
    fromMs: Date.UTC(y, m - 1, 1),
    toMs: Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1),
  }
}
