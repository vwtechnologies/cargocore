import { test, expect, type Page } from "@playwright/test";

async function request(page: Page, path: string, body: object) {
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

for (const [path, label] of [
    ["companies", /^Name$/],
    ["countries", /^Country Name$/],
    ["banks", /^Bank Name/],
    ["employee-types", /^EMPLOYEE TYPE/],
    ["business-types", /^BUSINESS ROLE/],
    ["markas", /^MARKA DESCRIPTION/],
    ["users", /^FULL NAME$/],
    ["people", /^Full name$/],
] as const) {
    test(`${path} supports Edit and New shortcuts without resetting an active edit`, async ({
        page,
    }) => {
        page.on("dialog", (dialog) => dialog.accept());
        await page.goto(`/${path}`);
        const field = page.getByRole("textbox", { name: label });
        await expect(field).not.toHaveValue("");
        const original = await field.inputValue();
        await page.getByRole("heading", { level: 1 }).click();
        await page.keyboard.press("Control+e");
        await expect(field).toBeEditable();
        await field.fill(`${original} keyboard draft`);
        await field.press("Control+e");
        await expect(field).toHaveValue(
            `${original} keyboard draft`.toUpperCase(),
        );
        await page
            .getByRole("button", { name: "Cancel", exact: true })
            .first()
            .click();
        await expect(field).toHaveValue(original);
        await page.keyboard.press("Control+n");
        await expect(field).toBeEditable();
        await expect(field).toHaveValue("");
        await page
            .getByRole("button", { name: "Cancel", exact: true })
            .first()
            .click();
    });
}

test("New preserves an unsaved draft until the user resolves the existing confirmation", async ({
    page,
}) => {
    await page.goto("/employee-types");
    const name = page.getByRole("textbox", { name: /^EMPLOYEE TYPE/ });
    await expect(name).not.toHaveValue("");
    await page.keyboard.press("Control+e");
    await name.fill("Keep this employee type draft");
    await name.press("Control+n");
    const dialog = page.getByRole("dialog", { name: /unsaved changes/i });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Control+e");
    await dialog.getByRole("button", { name: /keep editing/i }).click();
    await expect(name).toHaveValue("KEEP THIS EMPLOYEE TYPE DRAFT");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.keyboard.press("Meta+n");
    await name.fill("Shortcut-created employee type");
    const saving = page.waitForResponse(
        (response) =>
            response.request().method() === "POST" &&
            response.url().endsWith("/api/v1/employee-types"),
    );
    await name.press("Meta+s");
    expect((await saving).status()).toBe(201);
    await expect(name).toHaveValue("SHORTCUT-CREATED EMPLOYEE TYPE");
    await expect(
        page.getByRole("button", { name: "Edit", exact: true }),
    ).toBeVisible();
});

test("focused detail tables handle New, Edit and Save without changing the parent or discarding another row", async ({
    page,
}) => {
    await page.goto("/countries");
    await page.getByRole("button", { name: "Pakistan", exact: true }).click();
    const grid = page.getByRole("grid", { name: "Cities", exact: true });
    const first = grid.getByRole("row", { name: /^Rawalpindi$/i, exact: true });
    await first.locator("td").first().click();
    const short = first.getByLabel("Short Name 1", { exact: true });
    await short.fill("KEEP-DRAFT");
    await short.press("Control+n");
    const created = grid.getByRole("row", { name: "New city", exact: true });
    await expect(first).toContainText("KEEP-DRAFT");
    const name = created.getByLabel("City Name", { exact: true });
    await expect(name).toBeFocused();
    await name.fill("Shortcut-created city");
    const saving = page.waitForResponse(
        (response) =>
            response.request().method() === "POST" &&
            /\/cities$/.test(response.url()),
    );
    await name.press("Control+s");
    expect((await saving).status()).toBe(201);
    await expect(
        grid.getByRole("row", { name: "SHORTCUT-CREATED CITY", exact: true }),
    ).toBeVisible();
    await expect(
        page.getByLabel("Country Name", { exact: true }),
    ).not.toBeEditable();
    await first.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
        .locator("[data-detail-record-region]")
        .filter({ has: grid })
        .getByRole("button", { name: "Add record", exact: true })
        .focus();
    await page.keyboard.press("Control+e");
    await expect(short).toBeEditable();
    await expect(short).not.toHaveValue("KEEP-DRAFT");
    await first.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("role administration uses the same New, Edit and Save shortcuts", async ({
    page,
}) => {
    await page.goto("/roles");
    await expect(
        page.getByRole("heading", { name: "Role Permissions", exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole("button", { name: "New role", exact: true }),
    ).toBeEnabled();
    await page.keyboard.press("Control+n");
    const name = page.getByRole("textbox", { name: /ROLE NAME/ });
    await name.fill("Shortcut custom role");
    await name.press("Control+s");
    await expect(name).toHaveValue("SHORTCUT CUSTOM ROLE");
    await expect(name).not.toBeEditable();
    await page.keyboard.press("Control+e");
    await expect(name).toBeEditable();
    await page
        .getByRole("button", { name: "Cancel", exact: true })
        .first()
        .click();
});

test("shortcuts cannot bypass view-only permissions", async ({
    page,
    browser,
}) => {
    await page.goto("/");
    const role = await request(page, "roles", {
        name: "Shortcut reader",
        permissions: ["employee-types.view"],
        status: true,
    });
    await request(page, "users", {
        name: "Shortcut Reader",
        username: "shortcut.reader",
        role_id: role.id,
        company_ids: [],
        status: true,
        password: "Assigned-password-123",
        password_confirmation: "Assigned-password-123",
    });
    const context = await browser.newContext({
        baseURL: "http://127.0.0.1:8012",
        storageState: { cookies: [], origins: [] },
    });
    try {
        const viewer = await context.newPage();
        await viewer.goto("/");
        await viewer
            .getByLabel("Username", { exact: true })
            .fill("shortcut.reader");
        await viewer
            .getByLabel("Password", { exact: true })
            .fill("Assigned-password-123");
        await viewer
            .getByRole("button", { name: "Sign in", exact: true })
            .click();
        await expect(
            viewer.getByRole("heading", {
                name: /Good (morning|afternoon|evening), SHORTCUT/i,
            }),
        ).toBeVisible();
        await viewer.goto("/employee-types");
        const name = viewer.getByRole("textbox", { name: /^EMPLOYEE TYPE/ });
        await expect(name).not.toHaveValue("");
        const original = await name.inputValue();
        const writes: string[] = [];
        viewer.on("request", (request) => {
            if (
                ["POST", "PUT"].includes(request.method()) &&
                request.url().includes("/api/v1/employee-types")
            )
                writes.push(request.url());
        });
        await name.press("Control+e");
        await expect(name).not.toBeEditable();
        await name.press("Control+n");
        await name.press("Control+s");
        await expect(name).toHaveValue(original);
        await expect(
            viewer.getByRole("button", { name: "Save record", exact: true }),
        ).toHaveCount(0);
        expect(writes).toEqual([]);
    } finally {
        await context.close();
    }
});
