import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  environments: {
    // Minify the Worker: smaller script = faster cold starts.
    cloudflare_inventory: { build: { minify: true } },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (/react-dom|scheduler/.test(id)) return "react"
            if (/@tanstack/.test(id)) return "tanstack"
            if (/@base-ui/.test(id)) return "ui"
          }
        },
      },
    },
  },
})
