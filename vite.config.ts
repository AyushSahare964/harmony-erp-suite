// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Vercel runs real Node.js — mongoose, bcrypt, mongodb driver work natively.
  // Externalize them from the SSR bundle so Node.js require() loads them at runtime.
  vite: {
    resolve: {
      dedupe: ["react", "react-dom", "framer-motion"],
    },
    ssr: {
      external: ["mongoose", "mongodb", "bson", "tr46", "whatwg-url", "punycode"],
    },
    optimizeDeps: {
      include: ["framer-motion"],
      exclude: ["mongoose", "mongodb", "bson"],
    },
  },
  nitro: {
    // Target Vercel (real Node.js serverless functions)
    preset: "vercel",
  },
});
