import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5185",
    channel: process.env.ADMIN_TEST_BROWSER || "msedge",
    headless: true,
    serviceWorkers: "block",
    trace: "off",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5185 --strictPort",
    url: "http://127.0.0.1:5185",
    reuseExistingServer: false,
    env: { VITE_BASE_API_URL: "http://127.0.0.1:5185/api" },
  },
});
