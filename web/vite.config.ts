import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Match the backend's CLIENT_URL / CORS origin (http://localhost:3000).
    port: 3000,
    proxy: {
      // Proxy API calls to the NestJS backend during development so the
      // browser talks to the same origin and cookies (access_token) flow.
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
