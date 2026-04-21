import { defineConfig } from "vitest/config";
import path from "path";

// Minimal config for running the regression test suite.
// Does NOT require @vitejs/plugin-react-swc (tests are pure TS, no JSX).
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["apps/mobile/src/__tests__/regression.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
