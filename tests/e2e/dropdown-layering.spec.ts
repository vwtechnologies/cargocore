import { test, expect } from "@playwright/test";

for (const viewport of [
    { width: 1440, height: 1100 },
    { width: 1440, height: 500 },
    { width: 390, height: 844 },
]) {
    test(`bank country dropdown stays above the form sections at ${viewport.width}×${viewport.height}px`, async ({
        page,
    }) => {
        await page.setViewportSize(viewport);
        await page.goto("/banks");
        await page.getByRole("button", { name: "Edit", exact: true }).click();
        const country = page.getByRole("combobox", {
            name: "Bank Country",
            exact: true,
        });
        await country.scrollIntoViewIfNeeded();
        const card = page.getByRole("region", {
            name: "Bank information",
            exact: true,
        });
        const before = await card.evaluate((element) => ({
            top: element.getBoundingClientRect().top,
            height: element.getBoundingClientRect().height,
            scrollY: window.scrollY,
            overflow: getComputedStyle(element).overflow,
        }));
        await country.click();
        const search = page.getByPlaceholder("Search countries…", {
            exact: true,
        });
        await expect(search).toBeFocused();
        const china = page.getByRole("option", { name: /China/ });
        await expect(china).toBeVisible();
        const popover = page.locator(".searchable-select-popover");
        await expect(popover).toHaveJSProperty("popover", "manual");
        expect(
            await popover.evaluate((element) =>
                element.matches(":popover-open"),
            ),
        ).toBe(true);
        const after = await card.evaluate((element) => ({
            top: element.getBoundingClientRect().top,
            height: element.getBoundingClientRect().height,
            scrollY: window.scrollY,
            overflow: getComputedStyle(element).overflow,
        }));
        expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(1);
        expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1);
        expect(Math.abs(after.scrollY - before.scrollY)).toBeLessThanOrEqual(1);
        expect(after.overflow).toBe(before.overflow);
        const popoverBounds = await popover.boundingBox();
        expect(popoverBounds!.y).toBeGreaterThanOrEqual(0);
        expect(popoverBounds!.y + popoverBounds!.height).toBeLessThanOrEqual(
            viewport.height,
        );
        if (viewport.height === 500)
            await expect(popover).toHaveAttribute("data-placement", "above");
        const isUncovered = await china.evaluate((option) => {
            const bounds = option.getBoundingClientRect();
            const topElement = document.elementFromPoint(
                bounds.left + bounds.width / 2,
                bounds.top + bounds.height / 2,
            );
            return topElement !== null && option.contains(topElement);
        });
        expect(isUncovered).toBe(true);
        await page.screenshot({
            path: `test-results/bank-country-dropdown-${viewport.width}-${viewport.height}.png`,
            fullPage: true,
        });
        await china.click();
        await expect(country).toContainText("China");
        await expect(page.getByRole("listbox")).not.toBeVisible();
        await country.click();
        await expect(search).toBeFocused();
        await search.press("Escape");
        await expect(country).toBeFocused();
        await expect(page.getByRole("listbox")).not.toBeVisible();
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
    });
}

test("keyboard navigation scrolls long country menus without scrolling the form", async ({
    page,
}) => {
    await page.route(/\/api\/v1\/countries\?/, async (route) => {
        const response = await route.fetch();
        const result = await response.json();
        result.data.push(
            ...Array.from({ length: 30 }, (_, index) => ({
                id: 1000 + index,
                code: `DROPDOWN-${index + 1}`,
                short_name: `D${index + 1}`,
                name: `Dropdown country ${index + 1}`,
                status: true,
                version: 1,
                display_sequence: index + 3,
            })),
        );
        result.meta.total = result.data.length;
        await route.fulfill({ response, json: result });
    });
    await page.goto("/banks");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const country = page.getByRole("combobox", {
        name: "Bank Country",
        exact: true,
    });
    await country.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    await country.click();
    const search = page.getByPlaceholder("Search countries…", { exact: true });
    await expect(search).toBeFocused();
    await expect(page.getByRole("option")).toHaveCount(32);
    for (let index = 0; index < 32; index++) await search.press("ArrowDown");
    const list = page.getByRole("listbox");
    await expect
        .poll(() => list.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    const last = page.getByRole("option", { name: /Dropdown country 30/ });
    expect(
        await last.evaluate((option) => {
            const bounds = option.getBoundingClientRect();
            const topElement = document.elementFromPoint(
                bounds.left + bounds.width / 2,
                bounds.top + bounds.height / 2,
            );
            return topElement !== null && option.contains(topElement);
        }),
    ).toBe(true);
    await search.press("Escape");
    await expect(country).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
});
