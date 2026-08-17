import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Worldling deliberately resets related game-state atoms when a city,
      // scene, or provider changes. These are controlled transition effects,
      // not external-store subscriptions.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "dist/**",
    "out/**",
    "build/**",
    "local-pronunciation/.venv/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
