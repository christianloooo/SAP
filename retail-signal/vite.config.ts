import { defineConfig } from "vite";
import { marketPlugin } from "./server/market.mjs";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react(), marketPlugin()],
  build: { chunkSizeWarningLimit: 1800 },
});
