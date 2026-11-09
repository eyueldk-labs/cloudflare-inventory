// Packs the built app (npm run build) into a deploy bundle for the one-click installer.
//
// Output: release/cloudflare-app.tar.gz
//   manifest.json   what to deploy (format below)
//   worker/...      Worker modules, paths relative to the main module
//   assets/...      static files served by Workers Static Assets
//
// manifest.json (format 1):
// {
//   "format": 1, "name", "version", "main_module", "compatibility_date", "compatibility_flags",
//   "modules": [{ "name", "type": "esm" | "commonjs" | "text" | "data" | "wasm" }],
//   "assets": { "config": { "not_found_handling", "run_worker_first", "html_handling"? } } | null,
//   "d1_databases": [{ "binding", "database_name" }],
//   "vars": { ... }
// }
import { execFileSync } from "node:child_process"
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { join, relative } from "node:path"

const root = new URL("..", import.meta.url).pathname
const workerDir = join(root, "dist", "cloudflare_inventory")
const assetsDir = join(root, "dist", "client")
const config = JSON.parse(readFileSync(join(workerDir, "wrangler.json"), "utf8"))
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
const version = process.env.BUNDLE_VERSION || pkg.version

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

const typeFor = (file) =>
  /\.(m?js)$/.test(file) ? "esm" : file.endsWith(".cjs") ? "commonjs" : file.endsWith(".wasm") ? "wasm" : file.endsWith(".txt") || file.endsWith(".html") ? "text" : "data"

const moduleFiles = walk(workerDir)
  .map((f) => relative(workerDir, f))
  .filter((f) => !f.endsWith(".map") && !f.startsWith(".vite/") && f !== "wrangler.json")
  .sort((a, b) => (a === config.main ? -1 : b === config.main ? 1 : a.localeCompare(b)))

const { directory: _dir, binding: _binding, ...assetConfig } = config.assets ?? {}
const manifest = {
  format: 1,
  name: config.name,
  version,
  main_module: config.main,
  compatibility_date: config.compatibility_date,
  compatibility_flags: config.compatibility_flags ?? [],
  modules: moduleFiles.map((name) => ({ name, type: typeFor(name) })),
  assets: config.assets ? { config: assetConfig } : null,
  d1_databases: (config.d1_databases ?? []).map((d) => ({ binding: d.binding, database_name: d.database_name })),
  vars: config.vars ?? {},
}

const out = join(root, "release")
const stage = join(out, "stage")
rmSync(out, { recursive: true, force: true })
mkdirSync(join(stage, "worker"), { recursive: true })
for (const file of moduleFiles) {
  mkdirSync(join(stage, "worker", file, ".."), { recursive: true })
  cpSync(join(workerDir, file), join(stage, "worker", file))
}
if (config.assets) cpSync(assetsDir, join(stage, "assets"), { recursive: true })
writeFileSync(join(stage, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n")
execFileSync("tar", ["-czf", join(out, "cloudflare-app.tar.gz"), "-C", stage, "."])
writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n")
rmSync(stage, { recursive: true, force: true })
console.log(`Bundle: release/cloudflare-app.tar.gz (${manifest.name}@${version}, ${manifest.modules.length} modules)`)
