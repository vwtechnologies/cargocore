import { test, expect, type Page } from "@playwright/test";

async function expectContainedTableText(page: Page) {
    const overflow = await page.locator("table").evaluateAll((tables) => {
        const failures: string[] = [];
        for (const table of tables) {
            for (const cell of table.querySelectorAll("th, td")) {
                const bounds = cell.getBoundingClientRect();
                if (!bounds.width || !bounds.height) continue;
                const walker = document.createTreeWalker(
                    cell,
                    NodeFilter.SHOW_TEXT,
                );
                while (walker.nextNode()) {
                    const node = walker.currentNode;
                    if (
                        !node.textContent?.trim() ||
                        node.parentElement?.closest("svg, .visually-hidden")
                    )
                        continue;
                    const range = document.createRange();
                    range.selectNodeContents(node);
                    for (const rect of range.getClientRects()) {
                        if (!rect.width || !rect.height) continue;
                        let left = rect.left,
                            right = rect.right;
                        for (
                            let ancestor = node.parentElement;
                            ancestor && ancestor !== cell;
                            ancestor = ancestor.parentElement
                        ) {
                            if (
                                ["hidden", "clip", "auto", "scroll"].includes(
                                    getComputedStyle(ancestor).overflowX,
                                )
                            ) {
                                const clip = ancestor.getBoundingClientRect();
                                left = Math.max(left, clip.left);
                                right = Math.min(right, clip.right);
                            }
                        }
                        if (
                            right > left &&
                            (left < bounds.left - 1 || right > bounds.right + 1)
                        )
                            failures.push(node.textContent.trim());
                    }
                }
            }
        }
        return failures;
    });
    expect(overflow, "Text must remain inside its own table cell").toEqual([]);
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
    test(`${path} keeps headings and values inside their columns at desktop and mobile widths`, async ({
        page,
    }) => {
        await page.goto(`/${path}`);
        await expect(
            page.locator(".company-master-table tbody tr").first(),
        ).toBeVisible();
        await expect(page.locator(".loading")).toHaveCount(0);
        if (path === "banks") {
            const branches = page.getByRole("grid", {
                name: "Branches",
                exact: true,
            });
            await expect(branches.locator("tbody tr").first()).toContainText(
                "Rawalpindi",
            );
            const officers = page.getByRole("grid", {
                name: "Officers",
                exact: true,
            });
            await expect(officers.locator("tbody tr").first()).toContainText(
                "Ahmed",
            );
            await branches
                .locator("tbody tr")
                .first()
                .locator("td")
                .nth(5)
                .evaluate((cell) => (cell.textContent = "ADDRESS".repeat(50)));
            await officers
                .locator("tbody tr")
                .first()
                .locator("td")
                .nth(4)
                .evaluate(
                    (cell) =>
                        (cell.textContent = `${"very.long.email.segment".repeat(8)}@example.test`),
                );
        }
        for (const viewport of [
            { width: 1920, height: 1080 },
            { width: 1280, height: 800 },
            { width: 390, height: 740 },
            { width: 320, height: 568 },
        ]) {
            await page.setViewportSize(viewport);
            await expectContainedTableText(page);
        }
        if (path === "banks") {
            await page.setViewportSize({ width: 1440, height: 1000 });
            await page
                .getByRole("grid", { name: "Branches", exact: true })
                .scrollIntoViewIfNeeded();
            await page.screenshot({
                path: "test-results/bank-text-layout.png",
            });
        }
    });
}
