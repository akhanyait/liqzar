import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Force development React build so act() and hooks-in-tests work.
    env: { NODE_ENV: "development" },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("development"),
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
