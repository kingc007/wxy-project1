import { defineConfig } from "@playwright/test";

// E2E_BASE_URL: reuse an already-running dev server (next dev allows one per directory). Otherwise start one offline.
const external = process.env.E2E_BASE_URL;
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  use: { baseURL: external ?? "http://localhost:3101" },
  webServer: external
    ? undefined
    : {
        command: "npm run dev -- -p 3101",
        url: "http://localhost:3101",
        reuseExistingServer: true,
        env: { SOURCE_MODE: "offline" },
      },
});
