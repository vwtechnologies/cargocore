import { test, expect } from "@playwright/test";

test("dashboard shows the current workspace, no record totals, reference hover and responsive cards", async ({
    page,
}) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.clock.setFixedTime(new Date("2026-11-06T08:00:00"));
    await page.goto("/");
    await expect(
        page.getByRole("heading", { name: "Good morning, QA", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".dash-welcome-date")).toHaveText(
        "Friday, November 6, 2026",
    );
    const session = await (await page.request.get("/api/v1/session")).json();
    expect(session.portal_companies).toEqual([]);
    await expect(page.locator(".dash-welcome-company")).toHaveText(
        "Your workspace is ready.",
    );
    await expect(page.locator(".dash-welcome-role")).toHaveText("Super Admin");
    const master = page.getByRole("region", {
        name: "Master Data",
        exact: true,
    });
    await expect(master.getByRole("link")).toHaveCount(6);
    const admin = page.getByRole("region", {
        name: "Administration",
        exact: true,
    });
    await expect(admin.getByRole("link")).toHaveCount(3);
    await expect(master.getByRole("link")).toHaveText([
        "Companies",
        "Countries",
        "Banks",
        "Employee Types",
        "Person",
        "Business Role",
    ]);
    await expect(admin.getByRole("link")).toHaveText([
        "Users",
        "Roles",
        "Permissions",
    ]);
    await expect(
        page.getByRole("link", { name: "Permissions", exact: true }),
    ).toHaveAttribute("href", "/roles");
    const company = master.getByRole("link", {
        name: "Companies",
        exact: true,
    });
    const before = await company
        .locator(".dash-card-icon")
        .evaluate((element) => getComputedStyle(element).backgroundColor);
    await page.mouse.move(0, 0);
    await page.screenshot({
        path: "test-results/dashboard-reference-desktop.png",
        animations: "disabled",
    });
    await company.hover();
    await expect
        .poll(() =>
            company
                .locator(".dash-card-arrow")
                .evaluate((element) => getComputedStyle(element).opacity),
        )
        .toBe("1");
    expect(
        await company
            .locator(".dash-card-icon")
            .evaluate((element) => getComputedStyle(element).backgroundColor),
    ).not.toBe(before);
    expect(
        await company.evaluate(
            (element) => getComputedStyle(element, "::before").opacity,
        ),
    ).toBe("1");
    await company.screenshot({
        path: "test-results/dashboard-card-hover.png",
        animations: "disabled",
    });
    await page.mouse.move(0, 0);
    await company.focus();
    await expect(company).toBeFocused();
    await expect
        .poll(() =>
            company
                .locator(".dash-card-arrow")
                .evaluate((element) => getComputedStyle(element).opacity),
        )
        .toBe("1");
    const rowTops = await master
        .getByRole("link")
        .evaluateAll((links) =>
            links.map((link) => link.getBoundingClientRect().top),
        );
    expect(new Set(rowTops).size).toBe(1);
    for (const width of [820, 390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBe(true);
        for (const card of await page.locator(".dash-card").all()) {
            const bounds = await card.boundingBox();
            expect(bounds!.x).toBeGreaterThanOrEqual(0);
            expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
        }
        if (width === 390)
            await page.screenshot({
                path: "test-results/dashboard-reference-mobile.png",
                fullPage: true,
                animations: "disabled",
            });
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
        await company.evaluate(
            (element) => getComputedStyle(element).transitionDuration,
        ),
    ).toBe("0s");
    await company.press("Enter");
    await expect(
        page.getByRole("heading", { name: "Companies", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
});
