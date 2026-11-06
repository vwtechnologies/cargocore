import { expect, test, type Page } from "@playwright/test";

async function passRecordList(page: Page) {
    await page.evaluate(() => {
        const list = document.querySelector(".company-list-panel")!;
        const header = document.querySelector(".topbar-header")!;
        window.scrollBy(
            0,
            list.getBoundingClientRect().bottom -
                header.getBoundingClientRect().bottom +
                20,
        );
    });
    const bar = page.getByRole("region", {
        name: "Record browser",
        exact: true,
    });
    await expect(bar).toBeVisible();
    await expect(bar).toBeInViewport();
    await expect
        .poll(() =>
            bar.evaluate((element) =>
                Math.abs(
                    element.getBoundingClientRect().top -
                        document
                            .querySelector(".topbar-header")!
                            .getBoundingClientRect().bottom,
                ),
            ),
        )
        .toBeLessThanOrEqual(1);
    return bar;
}

for (const [path, title] of [
    ["companies", "Companies"],
    ["countries", "Countries"],
    ["banks", "Banks"],
    ["employee-types", "Employee Types"],
    ["business-types", "Business Roles"],
    ["markas", "Marka"],
    ["users", "User Management"],
    ["roles", "Role Permissions"],
    ["people", "Person Information"],
] as const) {
    test(`${path} shows its mobile record browser after the list and opens the existing directory`, async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 320 });
        await page.goto(`/${path}`);
        await expect(
            page.locator(".company-master-table tbody tr").first(),
        ).toBeVisible();
        const bar = page.getByRole("region", {
            name: "Record browser",
            exact: true,
        });
        await expect(bar).toBeHidden();
        await passRecordList(page);
        await expect(bar).toContainText(`All ${title}`);
        const viewAll = bar.getByRole("button", {
            name: `View all ${title.toLowerCase()}`,
            exact: true,
        });
        await expect(viewAll.locator('svg[data-icon="eye"]')).toBeVisible();
        await viewAll.click();
        const directory = page.locator(".view-all-modal-box");
        await expect(directory).toBeVisible();
        await expect(
            directory.getByRole("heading", {
                name: `All ${title} Directory`,
                exact: true,
            }),
        ).toBeVisible();
        await directory.locator(".view-all-close-btn").click();
        await expect(directory).toHaveCount(0);
        await page.evaluate(() => window.scrollTo(0, 0));
        await expect(bar).toBeHidden();
        await page.setViewportSize({ width: 1440, height: 400 });
        await page.evaluate(() =>
            window.scrollTo(0, document.documentElement.scrollHeight),
        );
        await expect(bar).toBeHidden();
    });
}

test("the portrait record browser keeps unsaved person edits until a directory selection is confirmed", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 740 });
    await page.goto("/people");
    const name = page.getByLabel("Full name", { exact: true });
    await expect(name).not.toHaveValue("");
    const original = await name.inputValue();
    const originalUrl = page.url();
    await page.keyboard.press("Control+e");
    await name.fill("Keep My Mobile Draft");
    const bar = await passRecordList(page);
    await page.screenshot({ path: "test-results/mobile-record-browser.png" });
    await bar
        .getByRole("button", {
            name: "View all person information",
            exact: true,
        })
        .click();
    const directory = page.locator(".view-all-modal-box");
    const alternative = directory
        .locator("tbody tr")
        .filter({ hasNotText: original })
        .first();
    page.once("dialog", (dialog) => dialog.dismiss());
    await alternative.click();
    await expect(name).toHaveValue("KEEP MY MOBILE DRAFT");
    await expect(page).toHaveURL(originalUrl);
    await passRecordList(page);
    await bar
        .getByRole("button", {
            name: "View all person information",
            exact: true,
        })
        .click();
    page.once("dialog", (dialog) => dialog.accept());
    await alternative.click();
    await expect(name).not.toHaveValue("KEEP MY MOBILE DRAFT");
    await expect(page).not.toHaveURL(originalUrl);
});
