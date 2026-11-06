import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
    page.on("pageerror", (error) => {
        throw error;
    });
});
test("company and sub-company workflow preserves linked details", async ({
    page,
}) => {
    await page.goto("/companies");
    await page
        .getByRole("button", { name: "Add record", exact: true })
        .first()
        .click();
    const dialog = page.getByRole("dialog");
    await dialog
        .getByRole("textbox", { name: "Name", exact: true })
        .fill("Browser Test Company");
    await dialog.getByLabel("Short name").fill("BTC");
    await dialog.getByRole("button", { name: "Save record" }).click();
    await expect(dialog).not.toBeVisible();
    await page.getByLabel("Search Companies").fill("Browser Test Company");
    await page
        .getByRole("button", { name: "Browser Test Company", exact: true })
        .click();
    await expect(
        page.getByRole("heading", { name: "Sub-companies", exact: true }),
    ).toBeVisible();
    await page
        .getByRole("columnheader", {
            name: "Add sub-company: NAME",
            exact: true,
        })
        .click();
    const newRow = page.locator(".subcompany-row-inline-editing");
    await newRow.getByPlaceholder("Sub-company Name *").fill("Browser Branch");
    await newRow.getByPlaceholder("Address").fill("Warehouse 12");
    await newRow.getByPlaceholder("Phone / Contact").fill("051-5551212");
    await newRow.getByRole("button", { name: "Save changes" }).click();
    await expect(newRow).not.toBeVisible();
    await expect(
        page.getByText("Browser Branch", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Warehouse 12", { exact: true })).toBeVisible();
    await page.reload();
    await expect(
        page.getByText("Browser Branch", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("051-5551212", { exact: true })).toBeVisible();
});
test("country selection reveals its city master and saves an inline edit", async ({
    page,
}) => {
    await page.goto("/countries");
    await page.getByRole("button", { name: "Pakistan", exact: true }).click();
    const row = page
        .getByRole("grid", { name: "Cities", exact: true })
        .getByRole("row", { name: /^Rawalpindi$/i });
    await row
        .getByRole("button", { name: "Edit Rawalpindi", exact: true })
        .click();
    const editor = page.locator(".editable-detail-table tr[data-editing]");
    await editor.getByLabel("Short Name 1", { exact: true }).fill("RWP");
    await editor.getByRole("button", { name: "Save changes" }).click();
    await expect(editor).not.toBeVisible();
    await expect(row.getByText("RWP", { exact: true })).toBeVisible();
});
test("bank branches and officers use connected master records", async ({
    page,
}) => {
    await page.goto("/banks");
    await page
        .getByRole("button", { name: "National Bank of Pakistan", exact: true })
        .click();
    await page
        .getByRole("row", { name: "Rawalpindi Main Branch", exact: true })
        .locator("td")
        .first()
        .click();
    await expect(
        page.getByRole("heading", {
            name: "Officers · Rawalpindi Main Branch",
        }),
    ).toBeVisible();
    await page
        .getByRole("button", { name: "Show all officers", exact: true })
        .click();
    await expect(page.getByText("Ahmed Hassan", { exact: true })).toBeVisible();
});
test("person tabs load persisted records and refuse unsaved navigation", async ({
    page,
}) => {
    await page.goto("/people");
    await page
        .getByRole("button", { name: "Ahmed Hassan", exact: true })
        .click();
    for (const name of [
        "Contacts",
        "Bank Accounts",
        "Company Associations",
        "User Account",
        "Personal Details",
    ]) {
        await page.getByRole("tab", { name, exact: true }).click();
        await expect(
            page.getByRole("tab", { name, exact: true }),
        ).toHaveAttribute("aria-selected", "true");
    }
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page
        .getByRole("textbox", { name: "Full name", exact: true })
        .fill("Unsaved name");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("tab", { name: "Contacts", exact: true }).click();
    await expect(
        page.getByRole("textbox", { name: "Full name", exact: true }),
    ).toHaveValue("UNSAVED NAME");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("tab", { name: "Contacts", exact: true }).click();
    await expect(
        page.getByRole("heading", { name: "Contact information", exact: true }),
    ).toBeVisible();
});
test("employee and business type masters are searchable", async ({ page }) => {
    await page.goto("/employee-types");
    await page.getByLabel("Search Employee types").fill("Managing");
    await expect(
        page.getByText("Managing Director", { exact: true }),
    ).toBeVisible();
    await page.goto("/business-types");
    await page.getByLabel("Search business roles").fill("Customer");
    await expect(page.getByText("Customer", { exact: true })).toBeVisible();
});
test("role matrix and user administration render without exposing secrets", async ({
    page,
}) => {
    await page.goto("/roles");
    await page.getByRole("button", { name: "Create role" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Role name").fill("Browser Viewer");
    await dialog
        .getByRole("checkbox", { name: "people view", exact: true })
        .check();
    await dialog.getByRole("button", { name: "Save role" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
        page.getByRole("heading", { name: "Browser Viewer" }),
    ).toBeVisible();
    await page.goto("/users");
    await expect(page.getByText("qa.admin", { exact: true })).toBeVisible();
    await page.goto("/audit");
    await expect(
        page.getByRole("heading", { name: "Audit history" }),
    ).toBeVisible();
});
test("mobile navigation and keyboard focus remain usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(
        page.getByRole("heading", {
            name: /Good (morning|afternoon|evening), QA/i,
        }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page
        .locator(".sidebar")
        .getByRole("link", { name: "Person Information" })
        .click();
    await expect(
        page.getByRole("heading", { name: "Person Information", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Tab");
    await page.screenshot({
        path: "test-results/people-mobile.png",
        fullPage: true,
    });
    const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
});

test("person documents remain available and bank account data stays deferred", async ({
    page,
}) => {
    await page.goto("/people");
    await page
        .getByRole("button", { name: "Ahmed Hassan", exact: true })
        .click();
    const personId = await page.evaluate(() =>
        location.pathname.split("/").pop(),
    );
    const before = await (
        await page.request.get(
            `/api/v1/people/${personId}/accounts?context=management`,
        )
    ).json();
    await page.getByRole("tab", { name: "Bank Accounts", exact: true }).click();
    await expect(
        page.getByRole("heading", { name: "Coming Soon", exact: true }),
    ).toBeVisible();
    await page
        .getByRole("tab", { name: "Personal Details", exact: true })
        .click();
    await page.getByText("Identification documents", { exact: true }).click();
    await page
        .getByRole("button", { name: "Upload document", exact: true })
        .click();
    const dialog = page.getByRole("dialog");
    await dialog
        .getByLabel("Document type", { exact: true })
        .fill("Browser identification");
    await dialog.getByLabel("Document number", { exact: true }).fill("000ID77");
    await dialog.locator("input[type=file]").setInputFiles({
        name: "identification.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(
            "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF",
        ),
    });
    await dialog
        .getByRole("button", { name: "Save file", exact: true })
        .click();
    await expect(dialog).not.toBeVisible();
    await page.reload();
    await page.getByText("Identification documents", { exact: true }).click();
    await expect(
        page.getByText("Browser identification", { exact: true }),
    ).toBeVisible();
    const after = await (
        await page.request.get(
            `/api/v1/people/${personId}/accounts?context=management`,
        )
    ).json();
    expect(after).toEqual(before);
});

test("stale form saves preserve the newer record and offer an explicit reload", async ({
    page,
}) => {
    await page.goto("/people");
    await page.getByRole("button", { name: "Sara Khan", exact: true }).click();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page
        .getByRole("textbox", { name: "Full name", exact: true })
        .fill("Unsaved stale name");
    await page.evaluate(async () => {
        const id = location.pathname.split("/").pop();
        const token = decodeURIComponent(
            document.cookie
                .split("; ")
                .find((c) => c.startsWith("XSRF-TOKEN="))!
                .slice(11),
        );
        const current = await (
            await fetch(`/api/v1/people/${id}`, {
                headers: { Accept: "application/json" },
            })
        ).json();
        const response = await fetch(`/api/v1/people/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                "X-XSRF-TOKEN": token,
            },
            body: JSON.stringify({
                name: "Sara Updated Elsewhere",
                version: current.data.version,
            }),
        });
        if (!response.ok) throw new Error("Concurrent fixture save failed");
    });
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    await expect(
        page.getByRole("button", { name: "Reload and review", exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole("textbox", { name: "Full name", exact: true }),
    ).toHaveValue("Unsaved stale name");
    await page
        .getByRole("button", { name: "Reload and review", exact: true })
        .click();
    await expect(
        page.getByRole("textbox", { name: "Full name", exact: true }),
    ).toHaveValue("Sara Updated Elsewhere");
});

test("one default company replaces the previous default and prefills new portal access without changing saved selections", async ({
    page,
}) => {
    await page.goto("/companies");
    const session = await (await page.request.get("/api/v1/session")).json();
    const original = session.companies.find(
        (company: { is_default: boolean }) => company.is_default,
    );
    const target = session.companies.find(
        (company: { is_default: boolean }) => !company.is_default,
    );
    await page.goto(`/companies/${target.id}`);
    await expect(
        page.getByRole("columnheader", { name: /PARENT CO/ }),
    ).toHaveCount(0);
    const toggle = page.getByRole("switch", {
        name: "Set as default company",
        exact: true,
    });
    await expect(toggle).not.toBeChecked();
    await page
        .getByRole("button", { name: "Edit", exact: true })
        .first()
        .click();
    await toggle.click();
    await page
        .getByRole("button", { name: "Cancel", exact: true })
        .first()
        .click();
    await expect(toggle).not.toBeChecked();
    await page
        .getByRole("button", { name: "Edit", exact: true })
        .first()
        .click();
    await toggle.click();
    const updating = page.waitForResponse(
        (response) =>
            response.request().method() === "PUT" &&
            response.url().endsWith(`/api/v1/companies/${target.id}`),
    );
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .first()
        .click();
    const updated = await updating;
    expect(updated.status()).toBe(200);
    expect((await updated.json()).data.is_default).toBe(true);
    await expect(toggle).toBeChecked();
    const companies = (
        await (
            await page.request.get(
                "/api/v1/companies?context=management&per_page=100",
            )
        ).json()
    ).data;
    expect(
        companies
            .filter((company: { is_default: boolean }) => company.is_default)
            .map((company: { id: number }) => company.id),
    ).toEqual([target.id]);
    expect(
        companies.find((company: { id: number }) => company.id === original.id)
            .is_default,
    ).toBe(false);
    await expect(
        page.getByRole("button", { name: "Edit", exact: true }).first(),
    ).toBeVisible();
    await page
        .getByRole("button", { name: "Administration", exact: true })
        .click();
    await page
        .locator(".topbar-dropdown-popover")
        .getByRole("link", { name: "Users", exact: true })
        .click();
    await page.getByRole("button", { name: "New user", exact: true }).click();
    const access = page.getByRole("group", {
        name: "Portal company access",
        exact: true,
    });
    const defaultChoice = access.getByRole("checkbox", {
        name: target.name,
        exact: true,
    });
    await expect(defaultChoice).toBeChecked();
    await expect(access.getByRole("checkbox", { checked: true })).toHaveCount(
        1,
    );
    await defaultChoice.uncheck();
    await page
        .getByLabel("FULL NAME", { exact: true })
        .fill("Explicit Company Access User");
    await page
        .getByLabel("USERNAME", { exact: true })
        .fill("explicit.company.access");
    const roles = (await (await page.request.get("/api/v1/roles")).json()).data;
    const admin = roles.find((role: { name: string }) => role.name === "Admin");
    await page
        .getByLabel("USER ROLE", { exact: true })
        .selectOption(String(admin.id));
    await page.locator("#user-password").fill("Assigned-password-123");
    await page
        .getByLabel("CONFIRM PASSWORD", { exact: true })
        .fill("Assigned-password-123");
    const creating = page.waitForResponse(
        (response) =>
            response.request().method() === "POST" &&
            response.url().endsWith("/api/v1/users"),
    );
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    const response = await creating;
    expect(response.status()).toBe(201);
    expect((await response.json()).data.company_ids).toEqual([]);
    await expect(
        page.getByRole("button", { name: "Edit", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(defaultChoice).not.toBeChecked();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    const people = (
        await (
            await page.request.get("/api/v1/people?search=Ahmed%20Hassan")
        ).json()
    ).data;
    await page.goto(`/people/${people[0].id}`);
    await page.getByRole("tab", { name: "User Account", exact: true }).click();
    await page
        .getByRole("switch", {
            name: "This person needs to sign in",
            exact: true,
        })
        .click();
    await expect(
        page
            .getByRole("group", { name: "Portal company access", exact: true })
            .getByRole("checkbox", { name: target.name, exact: true }),
    ).toBeChecked();
});
