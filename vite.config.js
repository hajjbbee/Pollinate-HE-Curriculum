import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/", // ← this line is the fix
  build: {
    outDir: "dist",
    assetsDir: "public/assets",
  },
});
