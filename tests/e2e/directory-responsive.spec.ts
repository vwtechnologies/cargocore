import { expect, test } from "@playwright/test";

for (const path of ["people", "companies", "banks"]) {
    test(`${path} directory stays readable at narrow mobile widths without close icons or helper text`, async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 740 });
        await page.goto(`/${path}`);
        await expect(
            page.locator(".company-master-table tbody tr").first(),
        ).toBeVisible();
        await page.locator(".company-list-panel .company-view-all-btn").click();
        const dialog = page.getByRole("dialog");
        const close = dialog.getByRole("button", {
            name: "Close directory",
            exact: true,
        });
        await expect(close).toHaveText("Close");
        await expect(
            close.locator('svg[data-icon="arrow-left"]'),
        ).toBeVisible();
        await expect(close.locator('svg[data-icon="xmark"]')).toHaveCount(0);
        await expect(
            dialog.locator(
                ".view-all-modal-subtitle, .view-all-shortcuts, kbd",
            ),
        ).toHaveCount(0);
        const row = dialog.locator(".view-all-row").first();
        await expect(row).toBeVisible();
        const fields = await row.locator("td").count();
        for (const viewport of [
            { width: 320, height: 640 },
            { width: 390, height: 740 },
        ]) {
            await page.setViewportSize(viewport);
            const layout = await row.evaluate((element) => {
                const primary = element.querySelector<HTMLElement>(
                    ".view-all-primary-cell",
                )!;
                const cells = [...element.querySelectorAll<HTMLElement>("td")];
                const panel = element.closest(".view-all-modal-box")!;
                const status = element
                    .querySelector<HTMLElement>(".record-status-icon")!
                    .getBoundingClientRect();
                const card = element.getBoundingClientRect();
                return {
                    statusContained:
                        status.left >= card.left &&
                        status.right <= card.right &&
                        status.top >= card.top &&
                        status.bottom <= card.bottom,
                    columns: getComputedStyle(element).display,
                    nameWidth: primary.getBoundingClientRect().width,
                    nameFont: Number.parseFloat(
                        getComputedStyle(primary).fontSize,
                    ),
                    horizontalOverflow: panel.scrollWidth > panel.clientWidth,
                    cells: cells.filter(
                        (cell) => cell.getBoundingClientRect().width > 0,
                    ).length,
                    metadataWidths: cells
                        .filter(
                            (cell) =>
                                !cell.matches(
                                    ".view-all-primary-cell, .view-all-status-cell",
                                ),
                        )
                        .map((cell) => cell.getBoundingClientRect().width),
                    badgeLines: element.querySelector(".view-all-current")
                        ? getComputedStyle(
                              element.querySelector(".view-all-current")!,
                          ).whiteSpace
                        : "nowrap",
                };
            });
            expect(layout.columns).toBe("grid");
            expect(layout.nameWidth).toBeGreaterThan(190);
            expect(layout.nameFont).toBeGreaterThanOrEqual(14);
            expect(layout.horizontalOverflow).toBe(false);
            expect(layout.statusContained).toBe(true);
            expect(layout.cells).toBe(fields);
            expect(layout.metadataWidths.every((width) => width >= 85)).toBe(
                true,
            );
            expect(layout.badgeLines).toBe("nowrap");
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth,
                ),
            ).toBe(true);
            await page.screenshot({
                path: `test-results/${path}-directory-${viewport.width}.png`,
            });
        }
        const search = dialog.getByRole("textbox");
        await search.fill("No Such Directory Record");
        await expect(dialog.locator(".view-all-empty-row")).toBeVisible();
        await expect(dialog.locator(".view-all-footer")).toHaveCount(0);
        await close.click();
        await expect(dialog).toHaveCount(0);
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.locator(".company-list-panel .company-view-all-btn").click();
        await expect(close).toBeVisible();
        await expect(close.locator("svg")).toBeHidden();
        expect(
            await row.evaluate((element) => getComputedStyle(element).display),
        ).toBe("table-row");
        await expect(
            dialog.locator(
                ".view-all-modal-subtitle, .view-all-shortcuts, kbd",
            ),
        ).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(
            page.locator(".company-list-panel .company-view-all-btn"),
        ).toBeFocused();
    });
}

test("directory scrolling, search, focus and keyboard selection remain usable on mobile", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 740 });
    await page.goto("/people");
    await expect(page.getByLabel("Full name", { exact: true })).not.toHaveValue(
        "",
    );
    const initialUrl = page.url();
    await page.locator(".company-list-panel .company-view-all-btn").click();
    const dialog = page.getByRole("dialog", {
        name: "All Person Information Directory",
        exact: true,
    });
    const search = dialog.getByRole("textbox");
    await expect(search).toBeFocused();
    await search.press("Control+n");
    await expect(dialog).toBeVisible();
    await expect(
        page.getByLabel("Full name", { exact: true }),
    ).not.toBeEditable();
    const records = dialog.getByRole("region", {
        name: "Directory records",
        exact: true,
    });
    const initialScroll = await page.evaluate(() => scrollY);
    await records.evaluate((element) =>
        element.scrollTo(0, element.scrollHeight),
    );
    await expect(dialog.locator(".view-all-row").last()).toBeInViewport();
    await expect(dialog.getByRole("heading")).toBeInViewport();
    await expect(dialog.locator(".view-all-footer")).toHaveCount(0);
    expect(await page.evaluate(() => scrollY)).toBe(initialScroll);
    await dialog
        .getByRole("button", { name: "Close directory", exact: true })
        .focus();
    await page.keyboard.press("Shift+Tab");
    await expect(records).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
        dialog.getByRole("button", { name: "Close directory", exact: true }),
    ).toBeFocused();
    await search.focus();
    await search.fill("Sara Khan");
    await expect(dialog.locator(".view-all-row")).toHaveCount(1);
    await search.press("Enter");
    await expect(dialog).toHaveCount(0);
    await expect(page).not.toHaveURL(initialUrl);
    await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
        "Sara Khan",
    );
});
