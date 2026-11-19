import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${root}/src/` },
      { find: "server-only", replacement: `${root}/node_modules/server-only/empty.js` },
    ],
  },
  test: {
    environment: "node",
    // npm run test:db runs the tests that need a real database, one file at a time
    include: mode === "db" ? ["**/*.db.test.ts"] : ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", ...(mode === "db" ? [] : ["**/*.db.test.ts"])],
    fileParallelism: mode !== "db",
    env: { NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co" },
  },
}));
