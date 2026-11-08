import type { DrizzleD1Database } from "drizzle-orm/d1"
import type { Role } from "../shared/domain"
import type * as schema from "./db/schema"

export type Env = {
  DB: D1Database
  /** Optional. When unset, a secret is generated on first setup and kept in D1. */
  BETTER_AUTH_SECRET?: string
}

export type DB = DrizzleD1Database<typeof schema>

export type SessionUser = { id: string; name: string; email: string }

export type AppEnv = {
  Bindings: Env
  Variables: {
    db: DB
    user: SessionUser
    orgId: string
    role: Role
  }
}
