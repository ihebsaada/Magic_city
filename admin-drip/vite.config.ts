import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const value = process.env.VITE_BASE_API_URL || env.VITE_BASE_API_URL;
  if (command === "build") {
    let url: URL;
    try {
      url = new URL(value || "");
    } catch {
      throw new Error("VITE_BASE_API_URL is required for a build");
    }
    if (
      url.protocol !== "https:" ||
      url.pathname !== "/api" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error("VITE_BASE_API_URL must be an HTTPS URL ending in /api");
  }
  return {
    server: {
      host: "::",
      port: 8050,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(
      Boolean,
    ),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
