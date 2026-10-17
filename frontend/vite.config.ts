import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => ({
  base: `${(process.env.APP_BASE_PATH ?? loadEnv(mode, "..", "").APP_BASE_PATH ?? "").replace(/\/+$/, "")}/`,
  envDir: "..",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/health": "http://localhost:4000",
      "/auth": "http://localhost:4000",
      "/orders": "http://localhost:4000",
      "/inventory": "http://localhost:4000",
      "/menu": "http://localhost:4000",
      "/workflows": "http://localhost:4000",
      "/agent": "http://localhost:4000",
      "/config": "http://localhost:4000"
    }
  }
}));
