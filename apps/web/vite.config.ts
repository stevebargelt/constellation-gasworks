import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, "../../"),
  resolve: {
    alias: {
      "@constellation/api": path.resolve(__dirname, "../../packages/api/src"),
      "@constellation/hooks": path.resolve(__dirname, "../../packages/hooks/src"),
      "@constellation/types": path.resolve(__dirname, "../../packages/types/src"),
      "@constellation/utils": path.resolve(__dirname, "../../packages/utils/src"),
      "@constellation/theme": path.resolve(__dirname, "../../packages/theme/src"),
    },
  },
});
