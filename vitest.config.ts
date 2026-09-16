import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Tests run in plain Node, not Next.js's server-component bundler,
      // so the "react-server" export condition that normally resolves
      // this to a no-op never applies — alias it directly instead of
      // letting its default export throw on import.
      "server-only": path.resolve(__dirname, "./node_modules/server-only/empty.js"),
    },
  },
});
