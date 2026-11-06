import { chromium, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
export default async function setup() {
    // Validate the resolved database before the first destructive command.
    execFileSync(
        "php",
        [
            "-r",
            'require "vendor/autoload.php"; $app=require "bootstrap/app.php"; $app->loadEnvironmentFrom(".env.testing"); $app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap(); if (!$app->environment("testing") || Illuminate\\Support\\Facades\\DB::connection()->getDatabaseName() !== "cargocore_test") { fwrite(STDERR,"Refusing to reset a database outside the dedicated CargoCore test environment.\\n"); exit(1); }',
        ],
        { stdio: "pipe", env: { ...process.env, APP_ENV: "testing" } },
    );

    execFileSync(
        "php",
        [
            "artisan",
            "migrate:fresh",
            "--env=testing",
            "--force",
            "--no-interaction",
        ],
        { stdio: "pipe" },
    );
    execFileSync(
        "php",
        [
            "artisan",
            "db:seed",
            "--env=testing",
            "--class=E2ESeeder",
            "--force",
            "--no-interaction",
        ],
        { stdio: "pipe", env: process.env },
    );
    const browser = await chromium.launch();
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1100 },
    });
    await page.goto("http://127.0.0.1:8012");
    await page.getByLabel("Username", { exact: true }).fill("qa.admin");
    await page
        .getByLabel("Password", { exact: true })
        .fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
        page.getByRole("heading", {
            name: /Good (morning|afternoon|evening), QA/i,
        }),
    ).toBeVisible();
    mkdirSync("test-results", { recursive: true });
    await page.context().storageState({ path: "test-results/auth.json" });
    await page.screenshot({
        path: "test-results/dashboard-desktop.png",
        fullPage: true,
    });
    await browser.close();
}
