import { test, expect } from "@playwright/test";

test("loading the first record does not close an open navigation drawer", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    let releaseRecords!: () => void;
    const recordsReady = new Promise<void>((resolve) => {
        releaseRecords = resolve;
    });
    await page.route("**/api/v1/banks?**", async (route) => {
        const response = await route.fetch();
        await recordsReady;
        await route.fulfill({ response });
    });
    await page.goto("/banks");
    await page.getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.getByRole("dialog", {
        name: "Navigation",
        exact: true,
    });
    await expect(drawer).toBeVisible();
    releaseRecords();
    await expect(page).toHaveURL(/\/banks\/\d+$/);
    await expect(drawer).toBeVisible();
    await drawer.getByRole("link", { name: "Banks", exact: true }).click();
    await expect(drawer).not.toBeVisible();
    await expect(page.locator("body")).not.toHaveAttribute(
        "data-scroll-locked",
    );
});

test("touch gestures scroll the drawer without moving the mobile page", async ({
    browser,
}) => {
    const context = await browser.newContext({
        baseURL: "http://127.0.0.1:8012",
        storageState: "test-results/auth.json",
        viewport: { width: 390, height: 568 },
        isMobile: true,
        hasTouch: true,
    });
    try {
        const page = await context.newPage();
        await page.goto("/banks");
        await expect(
            page.getByRole("textbox", { name: "Bank Name", exact: true }),
        ).not.toHaveValue("");
        await page.evaluate(() => window.scrollTo(0, 400));
        const position = await page.evaluate(() => window.scrollY);
        expect(position).toBeGreaterThan(0);
        await page.getByRole("button", { name: "Open navigation" }).tap();
        const drawer = page.getByRole("dialog", {
            name: "Navigation",
            exact: true,
        });
        await expect(drawer).toBeVisible();
        const device = await context.newCDPSession(page);
        async function swipe(x: number) {
            await device.send("Input.dispatchTouchEvent", {
                type: "touchStart",
                touchPoints: [{ x, y: 480 }],
            });
            for (const y of [430, 350, 250, 150]) {
                await device.send("Input.dispatchTouchEvent", {
                    type: "touchMove",
                    touchPoints: [{ x, y }],
                });
            }
            await device.send("Input.dispatchTouchEvent", {
                type: "touchEnd",
                touchPoints: [],
            });
        }
        await swipe(375);
        await expect(drawer).toBeVisible();
        expect(await page.evaluate(() => window.scrollY)).toBe(position);
        await swipe(160);
        await expect
            .poll(() =>
                drawer.locator("nav").evaluate((element) => element.scrollTop),
            )
            .toBeGreaterThan(0);
        expect(await page.evaluate(() => window.scrollY)).toBe(position);
        await drawer
            .getByRole("button", { name: "Close navigation", exact: true })
            .tap();
        await expect(drawer).not.toBeVisible();
        await swipe(180);
        await expect
            .poll(() => page.evaluate(() => window.scrollY))
            .toBeGreaterThan(position);
    } finally {
        await context.close();
    }
});

test("sidebar navigation preserves the existing unsaved-change confirmation", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/banks");
    const name = page.getByRole("textbox", { name: "Bank Name", exact: true });
    await expect(name).not.toHaveValue("");
    await page.keyboard.press("Control+e");
    await name.fill("Unsaved bank");
    const trigger = page.getByRole("button", { name: "Open navigation" });
    const drawer = page.getByRole("dialog", {
        name: "Navigation",
        exact: true,
    });
    await trigger.click();
    page.once("dialog", (dialog) => dialog.dismiss());
    await drawer.getByRole("link", { name: "Countries", exact: true }).click();
    await expect(drawer).not.toBeVisible();
    await expect(page).toHaveURL(/\/banks(?:\/\d+)?$/);
    await expect(name).toHaveValue("UNSAVED BANK");
    await expect(page.locator("body")).not.toHaveAttribute(
        "data-scroll-locked",
    );
    await trigger.click();
    page.once("dialog", (dialog) => dialog.accept());
    await drawer.getByRole("link", { name: "Countries", exact: true }).click();
    await expect(page).toHaveURL(/\/countries(?:\/\d+)?$/);
    await expect(drawer).not.toBeVisible();
    await expect(page.locator("body")).not.toHaveAttribute(
        "data-scroll-locked",
    );
});

test("sidebar matches the top bar menus and keeps navigation usable on small screens", async ({
    page,
}) => {
    await page.goto("/banks");
    await expect(
        page.getByRole("heading", { name: "Banks", exact: true }),
    ).toBeVisible();
    const menus = [];
    for (const name of ["Master Data", "Administration"]) {
        await page.getByRole("button", { name, exact: true }).click();
        menus.push(
            await page
                .locator(".topbar-dropdown-popover a")
                .evaluateAll((links) =>
                    links.map((link) => ({
                        label: link.textContent,
                        path: link.getAttribute("href"),
                        icon: link
                            .querySelector("svg")
                            ?.getAttribute("data-icon"),
                    })),
                ),
        );
    }
    const topbarBackground = await page
        .locator(".topbar-header")
        .evaluate((header) => getComputedStyle(header).backgroundColor);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.getByRole("dialog", {
        name: "Navigation",
        exact: true,
    });
    await expect(drawer).toBeVisible();
    expect(
        await drawer.evaluate(
            (element) => getComputedStyle(element).backgroundColor,
        ),
    ).toBe(topbarBackground);
    const links = await drawer
        .locator(".sidebar-group a")
        .evaluateAll((elements) =>
            elements.map((element) => ({
                label: element.textContent,
                path: element.getAttribute("href"),
                icon: element.querySelector("svg")?.getAttribute("data-icon"),
            })),
        );
    expect(links).toEqual(menus.flat());
    await expect(drawer.locator('a[href="/roles"]')).toHaveCount(1);
    await expect(
        drawer.getByRole("link", { name: "Banks", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
        drawer.getByText("QA Administrator", { exact: true }),
    ).toBeVisible();
    expect(
        await drawer
            .locator(".sidebar-link")
            .evaluateAll((elements) =>
                elements.every(
                    (element) =>
                        element.getBoundingClientRect().height >= 44 &&
                        parseFloat(getComputedStyle(element).fontSize) >= 13,
                ),
            ),
    ).toBe(true);
    await page.screenshot({
        path: "test-results/navigation-mobile.png",
        animations: "disabled",
    });
    await page.setViewportSize({ width: 320, height: 568 });
    await expect(
        drawer.getByRole("button", { name: "Close navigation", exact: true }),
    ).toBeVisible();
    expect(
        await drawer.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
        ),
    ).toBe(true);
    await drawer
        .getByRole("link", { name: "Audit history", exact: true })
        .scrollIntoViewIfNeeded();
    await expect(
        drawer.getByRole("link", { name: "Audit history", exact: true }),
    ).toBeInViewport();
    await expect(drawer.locator(".sidebar-user")).toBeInViewport();
    await page.screenshot({
        path: "test-results/navigation-small-mobile.png",
        animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
    await expect(
        page.getByRole("button", { name: "Open navigation" }),
    ).toBeFocused();
});

test("drawer scrolls independently, locks the page, and releases it after every dismissal", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 568 });
    await page.goto("/banks");
    await expect(
        page.getByRole("heading", { name: "Banks", exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole("textbox", { name: "Bank Name", exact: true }),
    ).not.toHaveValue("");
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(0);
    const pagePosition = await page.evaluate(() => window.scrollY);
    const trigger = page.getByRole("button", { name: "Open navigation" });
    await trigger.click();
    const drawer = page.getByRole("dialog", {
        name: "Navigation",
        exact: true,
    });
    await expect(drawer).toBeVisible();
    await expect(page.locator("body")).toHaveAttribute(
        "data-scroll-locked",
        "1",
    );
    await page.mouse.move(370, 250);
    await page.mouse.wheel(0, 500);
    await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBe(pagePosition);
    await page.mouse.move(180, 300);
    await page.mouse.wheel(0, 500);
    await expect
        .poll(() =>
            drawer.locator("nav").evaluate((element) => element.scrollTop),
        )
        .toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(pagePosition);
    // Keyboard focus remains inside the modal even after tabbing through all controls.
    for (let index = 0; index < 16; index++) await page.keyboard.press("Tab");
    expect(
        await drawer.evaluate((element) =>
            element.contains(document.activeElement),
        ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(page.locator("body")).not.toHaveAttribute(
        "data-scroll-locked",
    );
    expect(await page.evaluate(() => window.scrollY)).toBe(pagePosition);
    await page.mouse.move(180, 300);
    await page.mouse.wheel(0, 300);
    await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(pagePosition);

    await trigger.click();
    await expect(drawer).toBeVisible();
    await page.mouse.click(370, 250);
    await expect(drawer).not.toBeVisible();
    await expect(page.locator("body")).not.toHaveAttribute(
        "data-scroll-locked",
    );

    await trigger.click();
    await drawer
        .getByRole("link", { name: "Person Information", exact: true })
        .click();
    await expect(
        page.getByRole("heading", { name: "Person Information", exact: true }),
    ).toBeVisible();
    await expect(drawer).not.toBeVisible();
    await expect(page.locator("body")).not.toHaveAttribute(
        "data-scroll-locked",
    );

    await trigger.click();
    await expect(drawer).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(drawer).not.toBeVisible();
    await expect(page.locator("body")).not.toHaveAttribute(
        "data-scroll-locked",
    );
    await expect(
        page.getByRole("button", { name: "Master Data", exact: true }),
    ).toBeVisible();
    expect(
        await page
            .locator(".main-area")
            .evaluate((element) => getComputedStyle(element).marginLeft),
    ).toBe("0px");
    await page.setViewportSize({ width: 820, height: 800 });
    expect(
        await page
            .locator(".main-area")
            .evaluate((element) => getComputedStyle(element).marginLeft),
    ).toBe("0px");
});
