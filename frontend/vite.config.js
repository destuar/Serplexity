import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8001",
        changeOrigin: true,
      },
    },
  },
  build: {
    assetsInlineLimit: 0, // Don't inline any assets
    rollupOptions: {
      manualChunks(id) {
        if (id.includes("node_modules")) {
          if (id.includes("recharts")) return "recharts";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("react-router")) return "router";
          if (id.includes("/react-dom") || id.includes("/react/"))
            return "react-vendor";
          return "vendor";
        }
      },
      output: {
        assetFileNames: (assetInfo) => {
          // Keep SVG files in assets folder with clean names
          if (assetInfo.name?.endsWith(".svg")) {
            return "assets/[name][extname]"; // Remove hash for easier debugging
          }
          return "assets/[name].[hash][extname]";
        },
      },
    },
    // Force copy public files
    copyPublicDir: true,
    chunkSizeWarningLimit: 1600,
  },
  assetsInclude: ["**/*.svg"], // Ensure SVGs are treated as assets
  publicDir: "public", // Explicitly set public directory
  resolve: {
    alias: {
      // Workaround for property-information expecting ./lib/aria.js
      "property-information/lib/aria.js":
        "property-information/lib/util/aria.js",
    },
  },
});
