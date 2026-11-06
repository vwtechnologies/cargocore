import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
    page.on("pageerror", (error) => {
        throw error;
    });
});

test("bank links to country, city dropdown is filtered, Enter advances focus, and Ctrl+S saves", async ({
    page,
}) => {
    await page.goto("/banks");

    // 1. Verify Bank shows Country and country is Pakistan
    await page
        .getByRole("button", { name: "National Bank of Pakistan", exact: true })
        .click();
    await expect(
        page.getByRole("combobox", { name: "Bank Country" }),
    ).toContainText("Pakistan");

    // 2. Click Add branch and verify city dropdown shows cities
    await page.getByRole("button", { name: "Add branch", exact: true }).click();
    const citySelect = page.getByRole("button", { name: "City", exact: true });
    await expect(citySelect).toBeVisible();

    // Click to open SearchableSelect
    await citySelect.click();
    const popover = page.locator(".reference-popover");
    await expect(popover).toBeVisible();

    // Search for "Karachi" in the searchable select
    const searchInput = popover.getByPlaceholder("Search records…");
    await searchInput.fill("Karachi");
    await expect(
        popover.getByRole("button", { name: "Karachi", exact: true }),
    ).toBeVisible();

    // Select Karachi
    await popover.getByRole("button", { name: "Karachi", exact: true }).click();
    await expect(citySelect).toContainText("Karachi");

    // Fill branch fields
    await page.getByLabel("Branch Code", { exact: true }).fill("9988");
    await page
        .getByLabel("Branch Name", { exact: true })
        .fill("Clifton Beach Branch");

    // 3. Test Enter key navigation advances focus
    await page.getByLabel("Branch Code", { exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("NIFT Code", { exact: true })).toBeFocused();

    // 4. Test Ctrl+S saves the active branch
    await page.keyboard.press("ControlOrMeta+s");
    await expect(
        page.getByText("Clifton Beach Branch", { exact: true }),
    ).toBeVisible();

    // 5. Test Ctrl+S on Bank Form
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByLabel("E-Bank", { exact: true }).fill("NBP-EBANK-TEST");
    await page.keyboard.press("ControlOrMeta+s");
    await expect(page.getByLabel("E-Bank", { exact: true })).toHaveValue(
        "NBP-EBANK-TEST",
    );
});
