import { test, expect } from "@playwright/test";

test("inserting shifts country orders and editing swaps them in both lists without refreshing", async ({
    page,
    context,
}) => {
    await page.goto("/countries");
    const initial = (
        await (
            await page.request.get(
                "/api/v1/countries?context=management&per_page=100",
            )
        ).json()
    ).data;
    const observer = await context.newPage();
    await observer.goto("/countries");
    await expect(
        observer.locator(".company-master-table tbody tr"),
    ).toHaveCount(initial.length);
    await page
        .getByRole("button", { name: "Add record", exact: true })
        .first()
        .click();
    const dialog = page.getByRole("dialog", { name: "New country" });
    await dialog
        .getByLabel("Country Name", { exact: true })
        .fill("First position country");
    await dialog.getByLabel("Short Name", { exact: true }).fill("FPC");
    await dialog.getByLabel("Display Order", { exact: true }).selectOption("1");
    const creation = page.waitForResponse(
        (response) =>
            response.url().endsWith("/api/v1/countries") &&
            response.request().method() === "POST",
    );
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    expect((await creation).status()).toBe(201);
    await expect(dialog).not.toBeVisible();
    const rows = page.locator(".company-master-table tbody tr");
    await expect(rows).toHaveCount(initial.length + 1);
    await expect(rows.first()).toContainText("First position country");
    for (let index = 0; index < initial.length + 1; index++) {
        await expect(rows.nth(index).locator("td").last()).toHaveText(
            String(index + 1),
        );
    }
    await expect(
        observer.locator(".company-master-table tbody tr").first(),
    ).toContainText("First position country");
    const last = initial[1];
    await rows.filter({ hasText: last.name }).click();
    await expect(page.getByLabel("Country Name", { exact: true })).toHaveValue(
        last.name,
    );
    await expect(page.getByLabel("Display Order", { exact: true })).toHaveValue(
        "3",
    );
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByLabel("Display Order", { exact: true }).selectOption("1");
    const update = page.waitForResponse(
        (response) =>
            response.url().endsWith(`/api/v1/countries/${last.id}`) &&
            response.request().method() === "PUT",
    );
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    expect((await update).status()).toBe(200);
    await expect(rows.nth(0)).toContainText(last.name);
    await expect(rows.nth(1)).toContainText(initial[0].name);
    await expect(rows.nth(2)).toContainText("First position country");
    for (let index = 0; index < 3; index++) {
        await expect(rows.nth(index).locator("td").last()).toHaveText(
            String(index + 1),
        );
    }
    await expect(
        observer.locator(".company-master-table tbody tr").first(),
    ).toContainText(last.name);
    await page
        .getByRole("button", { name: "View all countries", exact: true })
        .click();
    const directory = page.locator(".view-all-table tbody tr");
    await expect(directory.nth(0)).toContainText(last.name);
    await expect(directory.nth(1)).toContainText(initial[0].name);
    await expect(directory.nth(2)).toContainText("First position country");
    for (let index = 0; index < 3; index++) {
        await expect(directory.nth(index).locator("td").nth(2)).toHaveText(
            String(index + 1),
        );
    }
    await page.screenshot({ path: "test-results/country-display-order.png" });
    await observer.close();
});
