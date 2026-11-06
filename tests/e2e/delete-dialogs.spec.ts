import { test, expect } from "@playwright/test";

for (const path of ["companies", "banks", "countries"]) {
    test(`${path} uses the shared ERP delete dialog and cancels safely`, async ({
        page,
    }) => {
        await page.goto(`/${path}`);
        const deleteButton = page
            .getByRole("button", { name: "Delete", exact: true })
            .first();
        await expect(deleteButton).toBeEnabled();
        const headerColor = await page
            .locator(".company-card-header")
            .first()
            .evaluate((element) => getComputedStyle(element).backgroundColor);
        const deletes: string[] = [];
        page.on("request", (request) => {
            if (request.method() === "DELETE") deletes.push(request.url());
        });
        await deleteButton.click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(dialog.locator(".modal-head")).toHaveCSS(
            "background-color",
            headerColor,
        );
        await expect(dialog.getByRole("heading")).toHaveCSS(
            "color",
            "rgb(255, 255, 255)",
        );
        await expect(
            dialog.getByRole("button", { name: "Delete record", exact: true }),
        ).toBeEnabled();
        await expect(
            dialog.getByRole("button", { name: "Cancel", exact: true }),
        ).toBeVisible();
        if (path === "countries") {
            await page.screenshot({
                path: "test-results/country-delete-desktop.png",
            });
            await page.setViewportSize({ width: 390, height: 844 });
            await expect(dialog).toBeVisible();
            const fits = await dialog.evaluate((element) => {
                const bounds = element.getBoundingClientRect();
                return (
                    bounds.left >= 0 &&
                    bounds.right <= window.innerWidth &&
                    element.scrollWidth <= element.clientWidth
                );
            });
            expect(fits).toBe(true);
            await page.screenshot({
                path: "test-results/country-delete-mobile.png",
            });
        }
        await dialog
            .getByRole("button", { name: "Cancel", exact: true })
            .click();
        await expect(dialog).not.toBeVisible();
        await expect(deleteButton).toBeFocused();
        await deleteButton.click();
        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();
        expect(deletes).toEqual([]);
    });
}
