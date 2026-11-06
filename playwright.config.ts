import { defineConfig } from "@playwright/test";
import { randomBytes } from "node:crypto";
process.env.E2E_PASSWORD ??= `QA-${randomBytes(24).toString("hex")}9`;
export default defineConfig({
    testDir: "tests/e2e",
    fullyParallel: false,
    workers: 1,
    timeout: 45000,
    expect: { timeout: 10000 },
    retries: 0,
    globalSetup: "./tests/e2e/setup.ts",
    use: {
        baseURL: "http://127.0.0.1:8012",
        storageState: "test-results/auth.json",
        viewport: { width: 1440, height: 1100 },
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
    },
    webServer: {
        command: "php artisan serve --env=testing --host=127.0.0.1 --port=8012",
        url: "http://127.0.0.1:8012/up",
        reuseExistingServer: false,
        timeout: 60000,
    },
    reporter: [["list"]],
});
