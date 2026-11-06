import { test, expect, type Page } from "@playwright/test";

async function createRecord(page: Page, path: string, body: object) {
    return page.evaluate(
        async ({ path, body }) => {
            const token = decodeURIComponent(
                document.cookie
                    .split("; ")
                    .find((item) => item.startsWith("XSRF-TOKEN="))!
                    .slice(11),
            );
            const response = await fetch(`/api/v1/${path}`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    "X-XSRF-TOKEN": token,
                },
                body: JSON.stringify(body),
            });
            if (!response.ok) throw new Error(await response.text());
            return (await response.json()).data;
        },
        { path, body },
    );
}

test("Marka uses the shared master layout and persists manual codes, descriptions and status", async ({
    page,
}) => {
    await page.goto("/markas");
    await expect(
        page.getByRole("heading", { name: "Marka", exact: true }),
    ).toBeVisible();
    const code = page.getByLabel("MARKA CODE", { exact: false });
    const description = page.getByLabel("MARKA DESCRIPTION", { exact: false });
    await expect(code).toHaveValue("UTE-RWP");
    await expect(description).not.toBeEditable();
    const navigation = page.getByLabel("Marka Table Navigation", {
        exact: true,
    });
    await navigation.focus();
    await page.keyboard.press("ArrowDown");
    await expect(code).toHaveValue("KLT-ISB");
    await page.getByRole("button", { name: "New Marka", exact: true }).click();
    await code.fill("BROWSER-MARKA");
    await description.fill("Manually entered package mark");
    const creating = page.waitForResponse(
        (response) =>
            response.request().method() === "POST" &&
            response.url().endsWith("/api/v1/markas"),
    );
    await description.press("ControlOrMeta+s");
    const response = await creating;
    expect(response.status()).toBe(201);
    const marka = (await response.json()).data;
    expect(marka.code).toBe("BROWSER-MARKA");
    await expect(page).toHaveURL(`/markas/${marka.id}`);
    await expect(
        page.getByRole("button", { name: "Edit", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await description.fill("Cancelled description");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(description).toHaveValue("Manually entered package mark");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page
        .getByRole("switch", { name: "Marka status", exact: true })
        .click();
    await description.fill("Saved inactive mark");
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    const row = page.locator(".company-master-table tr").filter({
        has: page.getByRole("button", {
            name: "BROWSER-MARKA",
            exact: true,
        }),
    });
    await expect(
        row.getByRole("img", { name: "Inactive", exact: true }),
    ).toBeVisible();
    expect(
        (
            await (
                await page.request.get(
                    `/api/v1/markas?id=${marka.id}&context=lookup`,
                )
            ).json()
        ).data,
    ).toEqual([]);
    await page
        .getByLabel("Search Marka", { exact: true })
        .fill("Saved inactive");
    await expect(row).toBeVisible();
    await page.reload();
    await expect(description).toHaveValue("Saved inactive mark");
    await page.screenshot({
        path: "test-results/marka-desktop.png",
        fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
        ),
    ).toBe(true);
    await page.screenshot({
        path: "test-results/marka-mobile.png",
        fullPage: true,
    });
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    const dialog = page.getByRole("dialog", {
        name: "Delete Marka?",
        exact: true,
    });
    await dialog
        .getByRole("button", { name: "Delete record", exact: true })
        .click();
    await expect(dialog).not.toBeVisible();
    expect(
        (
            await page.request.get(
                `/api/v1/markas/${marka.id}?context=management`,
            )
        ).status(),
    ).toBe(404);
});

test("the person Marka tab links multiple existing codes through compact editable rows", async ({
    page,
}) => {
    await page.goto("/people");
    const person = await createRecord(page, "people", {
        name: "Person with multiple marks",
        status: true,
    });
    const first = await createRecord(page, "markas", {
        code: "PERSON-MARK-A",
        description: "First person package mark",
        status: true,
    });
    const second = await createRecord(page, "markas", {
        code: "PERSON-MARK-B",
        description: "Second person package mark",
        status: true,
    });
    await createRecord(page, "markas", {
        code: "PERSON-MARK-HIDDEN",
        description: "Inactive mark",
        status: false,
    });
    await page.goto(`/people/${person.id}`);
    await page.getByRole("tab", { name: "Marka", exact: true }).click();
    const grid = page.getByRole("grid", { name: "Marka", exact: true });
    for (const marka of [first, second]) {
        await grid
            .getByRole("button", { name: "Add marka: MARKA CODE", exact: true })
            .click();
        const row = grid.getByRole("row", { name: "New marka", exact: true });
        await row
            .getByRole("button", { name: "Marka code", exact: true })
            .click();
        const search = page.getByRole("textbox", {
            name: "Search Marka code",
            exact: true,
        });
        await search.fill("PERSON-MARK");
        const options = page.locator(".reference-options");
        await expect(
            options.getByRole("button", {
                name: "PERSON-MARK-HIDDEN",
                exact: true,
            }),
        ).toHaveCount(0);
        await options
            .getByRole("button", { name: marka.code, exact: true })
            .click();
        await expect(row).toContainText(marka.description);
        await row
            .getByRole("button", { name: "Save changes", exact: true })
            .click();
        await expect(
            grid.getByRole("row", { name: marka.code, exact: true }),
        ).toBeVisible();
    }
    await page.reload();
    await page.getByRole("tab", { name: "Marka", exact: true }).click();
    const firstRow = grid.getByRole("row", { name: first.code, exact: true });
    await expect(firstRow).toContainText(first.description);
    await expect(
        grid.getByRole("row", { name: second.code, exact: true }),
    ).toContainText(second.description);
    await firstRow.locator("td").first().click();
    await firstRow.getByRole("switch", { name: "Status", exact: true }).click();
    await firstRow.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(firstRow.getByText("Active", { exact: true })).toBeVisible();
    const assignments = (
        await (
            await page.request.get(`/api/v1/people/${person.id}/person-markas`)
        ).json()
    ).data;
    expect(
        assignments.map((item: { marka_id: number }) => item.marka_id),
    ).toEqual([first.id, second.id]);
    await firstRow
        .getByRole("button", { name: `Delete ${first.code}`, exact: true })
        .click();
    await page
        .getByRole("dialog", { name: "Delete marka?", exact: true })
        .getByRole("button", { name: "Delete record", exact: true })
        .click();
    await expect(firstRow).not.toBeVisible();
    expect(
        (await page.request.get(`/api/v1/markas/${first.id}`)).status(),
    ).toBe(200);
});
