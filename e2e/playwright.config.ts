import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Use the pre-installed Chromium when present (sandbox); CI installs its own via `playwright install`.
const local = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath = process.env.CHROMIUM_PATH ?? (existsSync(local) ? local : undefined);
const launchOptions = executablePath ? { executablePath } : {};

export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:4173", trace: "off", launchOptions },
  webServer: {
    command: "npx serve ../apps/mobile/dist-web -l 4173 -s --no-clipboard",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 60_000
  },
  projects: [
    { name: "android-phone", use: { ...devices["Pixel 7"], launchOptions } },
    { name: "iphone-size", use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices["iPhone 14"].userAgent, launchOptions } },
    { name: "small-phone", use: { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, launchOptions } }
  ]
});
