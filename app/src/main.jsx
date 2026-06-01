import React from "react";
import { Analytics } from "@vercel/analytics/react";
import { createRoot } from "react-dom/client";

import App from "./App.jsx";
import "./styles.css";

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const message = this.state.error instanceof Error
        ? this.state.error.message
        : String(this.state.error || "Unknown error");
      return (
        <main className="root-error-shell">
          <section className="root-error-panel">
            <strong>Preview failed</strong>
            <p>The workbench recovered from a rendering error.</p>
            <pre>{message}</pre>
            <button type="button" onClick={() => window.location.reload()}>Reload</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
      <Analytics />
    </RootErrorBoundary>
  </React.StrictMode>
);
