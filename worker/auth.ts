import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { betterAuth } from "better-auth/minimal"
import { eq } from "drizzle-orm"
import * as schema from "./db/schema"
import type { DB, Env } from "./env"

/**
 * Better Auth, created once per isolate.
 *
 * The signing secret comes from BETTER_AUTH_SECRET if set. Otherwise it is generated during
 * first-run setup and stored in D1, so a fresh deploy needs no configuration at all.
 */
function createAuth(db: DB, secret: string) {
  return betterAuth({
    secret,
    basePath: "/api/auth",
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        rateLimit: schema.rateLimit,
      },
    }),
    // Same-origin SPA: the request origin is the only trusted origin.
    trustedOrigins: (request) => (request ? [new URL(request.url).origin] : []),
    emailAndPassword: {
      enabled: true,
      // Private app: accounts come only from first-run setup and invite links.
      disableSignUp: true,
      minPasswordLength: 8,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      // Signed session cookie: most requests verify the session without a D1 read.
      cookieCache: { enabled: true, maxAge: 10 * 60 },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 30,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/change-password": { window: 60, max: 5 },
        "/get-session": false,
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    telemetry: { enabled: false },
  })
}

export type Auth = ReturnType<typeof createAuth>

let cache: { secret: string; auth: Auth } | null = null

export async function loadSecret(env: Env, db: DB): Promise<string | null> {
  if (env.BETTER_AUTH_SECRET) return env.BETTER_AUTH_SECRET
  if (cache) return cache.secret
  const row = await db.select({ value: schema.meta.value }).from(schema.meta).where(eq(schema.meta.key, "auth_secret")).get()
  return row?.value ?? null
}

/** Returns null before first-run setup (no secret yet). */
export async function getAuth(env: Env, db: DB): Promise<Auth | null> {
  const secret = await loadSecret(env, db)
  if (!secret) return null
  if (cache?.secret !== secret) cache = { secret, auth: createAuth(db, secret) }
  return cache.auth
}

/** Signs a user in and returns the Set-Cookie headers to forward. */
export async function signInCookies(auth: Auth, emailAddress: string, password: string, headers: Headers): Promise<string[]> {
  const response = await auth.api.signInEmail({ body: { email: emailAddress, password }, headers, asResponse: true })
  if (!response.ok) return []
  return response.headers.getSetCookie()
}
