import { test, expect, type Page } from "@playwright/test";

async function scrollToActions(page: Page) {
    await page.evaluate(() =>
        window.scrollTo({ top: document.documentElement.scrollHeight }),
    );
    const actions = page.getByRole("group", {
        name: "Page actions",
        exact: true,
    });
    await expect(actions).toBeVisible();
    await expect(actions).toBeInViewport();
    await expect
        .poll(() =>
            actions.evaluate((element) =>
                Math.abs(
                    element.getBoundingClientRect().bottom - window.innerHeight,
                ),
            ),
        )
        .toBeLessThanOrEqual(1);
    return actions;
}

for (const path of [
    "companies",
    "countries",
    "banks",
    "employee-types",
    "business-types",
    "markas",
    "users",
    "people",
]) {
    test(`${path} exposes the current record actions after scrolling and hides them again at the top`, async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1440, height: 400 });
        await page.goto(`/${path}`);
        const top = page.locator("[data-page-actions]").first();
        if (path === "business-types") {
            await top
                .getByRole("button", { name: "Cancel", exact: true })
                .click();
        }
        await expect(
            top.getByRole("button", { name: "Edit", exact: true }),
        ).toBeEnabled();
        await page.evaluate(() => window.scrollTo({ top: 0 }));
        const bottom = page.getByRole("group", {
            name: "Page actions",
            exact: true,
        });
        await expect(bottom).toHaveCount(0);
        await scrollToActions(page);
        await expect(
            bottom.getByRole("button", { name: "Delete", exact: true }),
        ).toBeVisible();
        await bottom.getByRole("button", { name: "Edit", exact: true }).click();
        await scrollToActions(page);
        await expect(
            bottom.getByRole("button", { name: "Save record", exact: true }),
        ).toBeVisible();
        await bottom
            .getByRole("button", { name: "Cancel", exact: true })
            .click();
        await expect(
            bottom.getByRole("button", { name: "Edit", exact: true }),
        ).toBeEnabled();
        await page.evaluate(() => window.scrollTo({ top: 0 }));
        await expect(bottom).toHaveCount(0);
        await expect(
            top.getByRole("button", { name: "Edit", exact: true }),
        ).toBeInViewport();
    });
}

test("mobile bank actions create, cancel, save and open the existing delete confirmation without covering the last row", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 740 });
    await page.goto("/banks");
    const bankName = page.getByRole("textbox", { name: /^Bank Name/ });
    await expect(bankName).not.toHaveValue("");
    const original = await bankName.inputValue();
    const bottom = await scrollToActions(page);
    await bottom.getByRole("button", { name: "Edit", exact: true }).click();
    await bankName.fill(`${original} sticky actions`);
    await scrollToActions(page);
    const saving = page.waitForResponse(
        (response) =>
            response.request().method() === "PUT" &&
            /\/api\/v1\/banks\/\d+$/.test(response.url()),
    );
    await bottom
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    expect((await saving).status()).toBe(200);
    await expect(bankName).toHaveValue(
        `${original} sticky actions`.toUpperCase(),
    );
    await scrollToActions(page);
    await bottom.getByRole("button", { name: /new/i }).click();
    await expect(bankName).toBeEmpty();
    await scrollToActions(page);
    await bottom.getByRole("button", { name: "Cancel", exact: true }).click();
    await scrollToActions(page);
    await bottom.getByRole("button", { name: "Delete", exact: true }).click();
    const confirmation = page.getByRole("dialog", { name: /delete bank/i });
    await expect(confirmation).toBeVisible();
    await confirmation
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
    await scrollToActions(page);
    const geometry = await bottom.evaluate((element) => {
        const lastPanel = document.querySelector(
            ".bank-workspace .company-detail-panel > :last-child",
        );
        return {
            top: element.getBoundingClientRect().top,
            bottom: element.getBoundingClientRect().bottom,
            width: element.getBoundingClientRect().width,
            lastPanelBottom: lastPanel?.getBoundingClientRect().bottom,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            scrollWidth: document.documentElement.scrollWidth,
            buttons: Array.from(element.querySelectorAll("button")).map(
                (button) => ({
                    height: button.getBoundingClientRect().height,
                    left: button.getBoundingClientRect().left,
                    right: button.getBoundingClientRect().right,
                }),
            ),
        };
    });
    expect(geometry.bottom).toBe(geometry.viewportHeight);
    expect(geometry.width).toBe(geometry.viewportWidth);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.lastPanelBottom).toBeLessThanOrEqual(geometry.top);
    for (const button of geometry.buttons) {
        expect(button.height).toBeGreaterThanOrEqual(44);
        expect(button.left).toBeGreaterThanOrEqual(0);
        expect(button.right).toBeLessThanOrEqual(geometry.viewportWidth);
    }
    await page.screenshot({ path: "test-results/page-actions-mobile.png" });
    for (const viewport of [
        { width: 320, height: 568 },
        { width: 844, height: 390 },
    ]) {
        await page.setViewportSize(viewport);
        await scrollToActions(page);
        for (const button of await bottom.getByRole("button").all()) {
            await expect(button).toBeInViewport({ ratio: 1 });
            const bounds = await button.boundingBox();
            expect(bounds!.height).toBeGreaterThanOrEqual(44);
        }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await scrollToActions(page);
    await page.screenshot({ path: "test-results/page-actions-desktop.png" });
});

test("administration actions work at the bottom and pages without actions stay clear", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 500 });
    await page.goto("/roles");
    await expect(
        page.getByRole("button", { name: "New role", exact: true }),
    ).toBeEnabled();
    const bottom = await scrollToActions(page);
    await bottom.getByRole("button", { name: "New role", exact: true }).click();
    await expect(
        page.getByRole("textbox", { name: /ROLE NAME/ }),
    ).toBeEditable();
    await scrollToActions(page);
    await bottom.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.goto("/");
    await page.evaluate(() =>
        window.scrollTo({ top: document.documentElement.scrollHeight }),
    );
    await expect(
        page.getByRole("group", { name: "Page actions", exact: true }),
    ).toHaveCount(0);
});
