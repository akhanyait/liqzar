import React from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

// Error boundary for the entire app
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[LIQZAR] App Error:", error);
    console.error("[LIQZAR] Error Info:", errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 20,
            fontFamily: "system-ui",
            background: "#1a1a1a",
            color: "#fff",
            minHeight: "100vh",
          }}
        >
          <h1 style={{ color: "#ff6b6b" }}>Something went wrong</h1>
          <pre
            style={{
              background: "#2a2a2a",
              padding: 15,
              borderRadius: 8,
              overflow: "auto",
              fontSize: 12,
            }}
          >
            {this.state.error?.message}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20,
              padding: "10px 20px",
              background: "#4a9eff",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

try {
  const root = document.getElementById("root");
  if (!root) {
    throw new Error("Root element not found");
  }
  createRoot(root).render(
    <React.StrictMode>
      <HelmetProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </HelmetProvider>
    </React.StrictMode>,
  );
} catch (error) {
  console.error("[LIQZAR] Fatal error:", error);
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: system-ui; background: #1a1a1a; color: #fff; min-height: 100vh;">
      <h1 style="color: #ff6b6b;">Fatal Error</h1>
      <pre style="background: #2a2a2a; padding: 15px; border-radius: 8px; overflow: auto;">${error}</pre>
    </div>
  `;
}
