import { expect, test } from "@playwright/test";

test("a slow save shows the saving indicator, locks the page, and sends only one request", async ({
    page,
}) => {
    page.on("pageerror", (error) => {
        throw error;
    });
    let createRequests = 0;
    await page.route("**/api/v1/employee-types", async (route) => {
        if (route.request().method() !== "POST") {
            return route.continue();
        }
        createRequests++;
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return route.continue();
    });

    await page.goto("/employee-types");
    await page
        .getByRole("button", { name: /^(Add record|New employee type|New)$/ })
        .first()
        .click();
    const name = page.getByRole("textbox", { name: /^Employee Type/i });
    await name.fill(`Save Lock ${Date.now()}`);

    const save = page.getByRole("button", { name: /^Save( record)?$/ }).first();
    const created = page.waitForResponse(
        (response) =>
            response.url().endsWith("/api/v1/employee-types") &&
            response.request().method() === "POST",
    );
    await save.click();
    await expect(page.locator("body")).toHaveClass(/is-saving/);
    await expect(page.getByRole("status").getByText("Saving…")).toBeVisible();

    await save.click({ force: true });
    await save.dblclick({ force: true });
    await name.press("ControlOrMeta+s");
    await name.press("Enter");

    expect((await created).status()).toBe(201);
    await expect(page.locator("body")).not.toHaveClass(/is-saving/);
    await expect(page.getByRole("status").getByText("Saving…")).toHaveCount(0);
    expect(createRequests).toBe(1);
});
