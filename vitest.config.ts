import { defineConfig } from "vitest/config"

// Separate from vite.config.ts so unit tests do not start the Workers runtime.
export default defineConfig({ test: { include: ["shared/**/*.test.ts"] } })
