// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Externalize mongoose + its CJS transitive deps so Vite/Nitro never tries to bundle them.
  // Without this Vite's module runner wraps CJS default exports and breaks named imports.
  vite: {
    resolve: {
      dedupe: ["react", "react-dom", "framer-motion"],
    },
    ssr: {
      external: ["mongoose", "mongodb", "bson", "bcrypt", "tr46", "whatwg-url", "punycode"],
    },
    optimizeDeps: {
      include: ["framer-motion"],
      exclude: ["mongoose", "mongodb", "bson", "bcrypt"],
    },
  },
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ["/", "/login", "/m/dashboard", "/m/patients", "/m/appointments", "/m/opd", "/m/billing", "/m/inventory", "/m/pharmacy", "/m/lab", "/m/boarding", "/m/settings"],
      failOnError: false,
    },
    cloudflare: { nodeCompat: true },
    ...( {
      externals: {
        external: ["mongoose", "mongodb", "bson", "tr46", "whatwg-url", "bcrypt"],
      },
      rollupConfig: {
        external: ["mongoose", "mongodb", "bson", "tr46", "whatwg-url", "punycode", "bcrypt"],
      },
    } as Record<string, unknown> ),
  },
});
