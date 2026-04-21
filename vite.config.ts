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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("mapbox-gl")) {
            return "mapbox";
          }
        },
      },
    },
  },
  // Worker configuration for Mapbox
  worker: {
    format: "es",
  },
}));
