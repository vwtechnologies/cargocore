import { expect, test, type Locator } from "@playwright/test";

async function expectIconOnly(button: Locator) {
    await expect(button).toBeVisible();
    await expect(button).toHaveAccessibleName(/\S+/);
    const metrics = await button.evaluate((element) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let textWidth = 0;
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (!node.textContent?.trim() || node.parentElement?.closest("svg"))
                continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            textWidth += [...range.getClientRects()].reduce(
                (total, rect) => total + rect.width,
                0,
            );
        }
        const bounds = element.getBoundingClientRect();
        const icon = element.querySelector("svg")!.getBoundingClientRect();
        return {
            textWidth,
            width: bounds.width,
            height: bounds.height,
            iconWidth: icon.width,
            iconHeight: icon.height,
        };
    });
    expect(metrics.textWidth).toBeLessThanOrEqual(1);
    expect(metrics.width).toBeGreaterThanOrEqual(44);
    expect(metrics.height).toBeGreaterThanOrEqual(44);
    expect(metrics.iconWidth).toBeGreaterThanOrEqual(16);
    expect(metrics.iconHeight).toBeGreaterThanOrEqual(16);
}

for (const path of [
    "companies",
    "countries",
    "banks",
    "employee-types",
    "business-types",
    "markas",
    "users",
    "roles",
    "people",
]) {
    test(`${path} uses accessible icon-only mobile actions and keeps desktop labels`, async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 740 });
        await page.goto(`/${path}`);
        await expect(
            page.locator(".company-master-table tbody tr").first(),
        ).toBeVisible();
        await expect(
            page.locator(".company-detail-panel input").first(),
        ).not.toHaveValue("");
        const top = page.locator("[data-page-actions]").first();
        const cancel = top.getByRole("button", { name: "Cancel", exact: true });
        if (await cancel.isVisible()) await cancel.click();
        for (const button of await top.getByRole("button").all())
            await expectIconOnly(button);
        await expectIconOnly(
            page.getByRole("link", { name: "Back", exact: true }),
        );
        await expectIconOnly(
            page.locator(".company-list-panel .company-view-all-btn"),
        );
        const edit = top.getByRole("button", { name: "Edit", exact: true });
        if (await edit.isEnabled()) {
            await edit.click();
            await expectIconOnly(
                top.getByRole("button", { name: "Save record", exact: true }),
            );
            await expectIconOnly(cancel);
            await cancel.click();
        }
        if (path === "banks") {
            await page.screenshot({
                path: "test-results/banks-mobile-action-icons.png",
            });
            const branch = page.getByRole("button", {
                name: "Add branch",
                exact: true,
            });
            await expectIconOnly(branch);
        }
        await page.evaluate(() =>
            window.scrollTo(0, document.documentElement.scrollHeight),
        );
        const bottom = page.getByRole("group", {
            name: "Page actions",
            exact: true,
        });
        await expect(bottom).toBeVisible();
        for (const button of await bottom.getByRole("button").all())
            await expectIconOnly(button);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.setViewportSize({ width: 1440, height: 1000 });
        const font = await top
            .locator("button span")
            .first()
            .evaluate((element) =>
                Number.parseFloat(getComputedStyle(element).fontSize),
            );
        expect(font).toBeGreaterThanOrEqual(12);
        await expect(edit).toContainText("Edit");
    });
}
