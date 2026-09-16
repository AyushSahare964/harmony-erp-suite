import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Date format guard — billing, accounting and the finance libs must render
    // every user-facing date as DD/MM/YYYY through src/lib/utils/dateUtils.ts.
    // Hand-rolled toLocaleDateString calls are what caused six different date
    // formats to appear across the billing screens; this keeps them out.
    files: [
      "src/components/erp/billing/**/*.{ts,tsx}",
      "src/components/erp/accounting/**/*.{ts,tsx}",
      "src/lib/finance/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name=/^toLocale(Date|Time)String$/]",
          message:
            "Do not format dates inline. Use formatDisplayDate / formatDisplayDateTime / formatDisplayTime / formatDayMonth / formatExpiry from @/lib/utils/dateUtils so every date renders as DD/MM/YYYY.",
        },
      ],
    },
  },
  eslintPluginPrettier,
);
