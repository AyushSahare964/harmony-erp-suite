/**
 * Standalone Vitest config for pure unit tests (the finance tax engine).
 *
 * Deliberately does NOT extend vite.config.ts — that one loads the Lovable
 * TanStack Start plugin chain, which spins up a router/nitro build the unit
 * tests have no use for. All we need here is the "@" path alias.
 */
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Scoped to src/lib so it does not pick up
    // src/components/erp/clinical/prescription/__tests__/catalogueFilter.test.ts,
    // which is a hand-rolled assertion helper rather than a vitest suite.
    include: ["src/lib/**/__tests__/**/*.test.ts", "src/lib/**/*.test.ts"],
    reporters: "dot",
  },
});
