import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/react") || id.includes("/node_modules/react-dom")) {
            return "react";
          }
          if (id.includes("/node_modules/three/")) {
            return "three";
          }
          if (id.includes("/node_modules/lucide-react/")) {
            return "icons";
          }
          if (
            id.includes("/node_modules/@codemirror/") ||
            id.includes("/node_modules/@lezer/") ||
            id.includes("/node_modules/@uiw/react-codemirror/")
          ) {
            return "codemirror";
          }
          if (id.includes("/packages/implicitjs/")) {
            if (
              id.includes("/lib/implicitCad/exportModel") ||
              id.includes("/lib/implicitCad/exporters") ||
              id.includes("/lib/implicitCad/mesh")
            ) {
              return "implicitjs-export";
            }
            if (
              id.includes("/lib/implicitCad/render") ||
              id.includes("/lib/implicitCad/snapshot") ||
              id.includes("/common/camera") ||
              id.includes("/common/renderOptions") ||
              id.includes("/common/themeSettings") ||
              id.includes("/lib/viewer/")
            ) {
              return "implicitjs-render";
            }
            return "implicitjs-core";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
  },
});
