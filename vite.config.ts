import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * @vitejs/plugin-react v6 dropped automatic React Refresh preamble injection
 * into transformIndexHtml. This micro-plugin re-adds it in dev (serve) mode so
 * $RefreshReg$ / $RefreshSig$ are defined before any component module runs.
 */
function reactRefreshPreamble(): Plugin {
  return {
    name: "react-refresh-preamble",
    apply: "serve",
    transformIndexHtml(html) {
      const preamble = `<script type="module">
      import RefreshRuntime from "/@react-refresh"
      RefreshRuntime.injectIntoGlobalHook(window)
      window.$RefreshReg$ = () => {}
      window.$RefreshSig$ = () => (type) => type
      window.__vite_plugin_react_preamble_installed__ = true
    </script>`;
      return html.replace("</head>", `${preamble}\n  </head>`);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Allow tunnelled dev access (cloudflared / ngrok / localtunnel) so Ozow
    // sandbox redirects resolve. Tighten in production.
    allowedHosts: [".trycloudflare.com", ".ngrok-free.app", ".ngrok.app", "localhost"],
  },
  plugins: [reactRefreshPreamble(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Optimize Mapbox GL JS for Capacitor iOS
  optimizeDeps: {
    include: ["mapbox-gl"],
  },
  build: {
    // Bump the chunk-warning threshold from default 500 KB to 600 KB so
    // legitimate (now-split) chunks don't trigger noise. Real budgets are
    // enforced by tests/e2e/perf-budget.spec.ts.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split large always-used libraries into their own chunks. Before
        // this, the main `index.js` chunk was 535 KB (Recharts + framer +
        // helmet + radix in one bundle). Splitting lets the browser cache
        // each library independently across deploys.
        manualChunks(id) {
          if (id.includes("mapbox-gl")) return "mapbox";
          if (
            id.includes("node_modules/recharts") ||
            id.includes("node_modules/d3-")
          ) {
            return "charts";
          }
          if (id.includes("node_modules/framer-motion")) return "framer";
          if (id.includes("node_modules/react-helmet-async")) return "helmet";
          if (id.includes("node_modules/@radix-ui")) return "radix";
          if (
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react/") ||
            id.includes("node_modules/scheduler")
          ) {
            return "react";
          }
          if (id.includes("node_modules/@supabase")) return "supabase";
        },
      },
    },
  },
  // Worker configuration for Mapbox
  worker: {
    format: "es",
  },
}));
