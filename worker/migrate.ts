/**
 * Applies pending SQL migrations from /migrations at runtime, once per isolate.
 *
 * A fresh deploy needs no manual migration step: the first request creates the schema, and a
 * later deploy with new migration files upgrades it. Uses Wrangler's `d1_migrations` table, so
 * `wrangler d1 migrations apply` and this code never apply the same file twice.
 * Cost: two tiny queries when an isolate starts; nothing on later requests.
 */
const files = import.meta.glob("../migrations/*.sql", { query: "?raw", import: "default", eager: true }) as Record<string, string>

const migrations = Object.entries(files)
  .map(([path, sql]) => ({ name: path.split("/").pop()!, sql }))
  .sort((a, b) => a.name.localeCompare(b.name))

let ready: Promise<void> | null = null

export function ensureMigrated(db: D1Database): Promise<void> {
  ready ??= migrate(db).catch((error) => {
    ready = null // Retry on the next request.
    throw error
  })
  return ready
}

async function migrate(db: D1Database) {
  await db.exec(
    "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)"
  )
  const { results } = await db.prepare("SELECT name FROM d1_migrations").all<{ name: string }>()
  const applied = new Set(results.map((r) => r.name))
  for (const migration of migrations) {
    if (applied.has(migration.name)) continue
    const statements = migration.sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => db.prepare(s))
    try {
      // The name row goes first: if another isolate is applying the same file, the UNIQUE
      // constraint fails and this whole batch rolls back.
      await db.batch([db.prepare("INSERT INTO d1_migrations (name) VALUES (?)").bind(migration.name), ...statements])
    } catch (error) {
      const again = await db.prepare("SELECT 1 FROM d1_migrations WHERE name = ?").bind(migration.name).first()
      if (again) continue
      // Another tool (for example an installer) already applied this file without recording it here.
      if (/already exists/i.test(String((error as Error)?.message ?? error))) {
        await db.prepare("INSERT OR IGNORE INTO d1_migrations (name) VALUES (?)").bind(migration.name).run()
        continue
      }
      throw error
    }
  }
}
