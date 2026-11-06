import { test, expect, type Page } from "@playwright/test";

async function request(
    page: Page,
    path: string,
    body?: object,
    method = "POST",
) {
    return page.evaluate(
        async ({ path, body, method }) => {
            const token = decodeURIComponent(
                document.cookie
                    .split("; ")
                    .find((item) => item.startsWith("XSRF-TOKEN="))!
                    .slice(11),
            );
            const response = await fetch(`/api/v1/${path}`, {
                method: body ? method : "GET",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    "X-XSRF-TOKEN": token,
                },
                body: body ? JSON.stringify(body) : undefined,
            });
            if (!response.ok) throw new Error(await response.text());
            return response.json();
        },
        { path, body, method },
    );
}

test.beforeEach(({ page }) => {
    page.on("pageerror", (error) => {
        throw error;
    });
});

test("personal details use the persistent people list, city selection, private images and deferred bank accounts", async ({
    page,
}) => {
    await page.goto("/people");
    await expect(
        page.getByRole("heading", { name: "Person Information", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "New person", exact: true }).click();
    await page
        .getByLabel("Full name", { exact: true })
        .fill("Workspace Personal Person");
    await page
        .getByLabel("Father / husband name", { exact: true })
        .fill("Father Name");
    await page.getByLabel("CNIC", { exact: true }).fill("42101-7654321-9");
    await page.getByLabel("Date of birth", { exact: true }).fill("1990-04-12");
    await expect(
        page.getByLabel("Gender", { exact: true }).locator("option"),
    ).toHaveText(["Select gender", "Male", "Female"]);
    await page.getByLabel("Gender", { exact: true }).selectOption("Female");
    await page.getByRole("button", { name: "Place", exact: true }).click();
    await page
        .getByRole("textbox", { name: "Search Place", exact: true })
        .fill("Rawalpindi");
    await page
        .locator(".reference-options")
        .getByRole("button", { name: "Rawalpindi", exact: true })
        .click();
    await page.getByLabel("NTN", { exact: true }).fill("NTN-001");
    await page.getByLabel("STRN", { exact: true }).fill("STRN-009");
    await page
        .getByLabel("Comments / notes", { exact: true })
        .fill("A reusable person record.\nSecond line.");
    const creation = page.waitForResponse(
        (response) =>
            response.request().method() === "POST" &&
            response.url().endsWith("/api/v1/people"),
    );
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    const response = await creation;
    expect(response.status()).toBe(201);
    const person = (await response.json()).data;
    expect(person.cnic).toBe("4210176543219");
    expect(person.city_id).toBeGreaterThan(0);
    await expect(page).toHaveURL(`/people/${person.id}`);
    await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
        "Workspace Personal Person",
    );
    await expect(
        page.getByRole("button", {
            name: "Workspace Personal Person",
            exact: true,
        }),
    ).toBeVisible();
    await expect(page.locator(".person-readonly-value")).toContainText(
        "Rawalpindi",
    );
    const image = await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 160;
        const context = canvas.getContext("2d")!;
        context.fillStyle = "#d5f5e5";
        context.fillRect(0, 0, 160, 160);
        context.fillStyle = "#005031";
        context.font = "bold 60px sans-serif";
        context.fillText("WP", 20, 100);
        return canvas.toDataURL("image/png").split(",")[1];
    });
    for (const kind of ["Profile picture", "Signature"]) {
        const upload = page.locator(".profile-upload").filter({
            has: page.getByRole("heading", { name: kind, exact: true }),
        });
        await upload
            .getByRole("button", { name: "Upload", exact: true })
            .click();
        const dialog = page.getByRole("dialog", {
            name: "Upload file",
            exact: true,
        });
        await dialog.locator("input[type=file]").setInputFiles({
            name: `${kind}.png`,
            mimeType: "image/png",
            buffer: Buffer.from(image, "base64"),
        });
        await dialog
            .getByRole("button", { name: "Save file", exact: true })
            .click();
        await expect(dialog).not.toBeVisible();
        await expect(
            upload.getByRole("img", { name: kind, exact: true }),
        ).toBeVisible();
    }
    const geometry = await page
        .locator(".person-basic-card")
        .evaluate((card) => {
            const name = card
                .querySelector<HTMLInputElement>("#person-name")!
                .getBoundingClientRect();
            const bounds = card.getBoundingClientRect();
            const signature = card
                .querySelector<HTMLElement>(".image-preview.signature")!
                .getBoundingClientRect();
            return {
                scroll: card.scrollLeft,
                inset: name.left - bounds.left,
                signatureRight: signature.right,
                cardRight: bounds.right,
            };
        });
    expect(geometry.scroll).toBe(0);
    expect(geometry.inset).toBeGreaterThanOrEqual(20);
    expect(geometry.signatureRight).toBeLessThan(geometry.cardRight);
    await page.screenshot({
        path: "test-results/person-personal-desktop.png",
        fullPage: true,
    });
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page
        .getByLabel("Full name", { exact: true })
        .fill("Unsaved workspace name");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("tab", { name: "Contacts", exact: true }).click();
    await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
        "Unsaved workspace name",
    );
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
        "Workspace Personal Person",
    );
    await page.getByRole("tab", { name: "Bank Accounts", exact: true }).click();
    await expect(
        page.getByRole("heading", { name: "Coming Soon", exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole("textbox", { name: "Account number" }),
    ).toHaveCount(0);
    await page
        .getByRole("tab", { name: "Personal Details", exact: true })
        .click();
    await page.reload();
    await expect(page.getByLabel("NTN", { exact: true })).toHaveValue(
        "NTN-001",
    );
    await expect(
        page.getByLabel("Comments / notes", { exact: true }),
    ).toHaveValue("A reusable person record.\nSecond line.");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
        ),
    ).toBe(true);
    await page.screenshot({
        path: "test-results/person-personal-mobile.png",
        fullPage: true,
    });
});

test("company role checkboxes retain per-company amounts, list matching people and configure one global employee profile", async ({
    page,
}) => {
    await page.goto("/people");
    const person = (
        await request(page, "people", {
            name: "Workspace Association Person",
            status: true,
        })
    ).data;
    const companies = (await request(page, "session")).companies;
    await page.goto(`/people/${person.id}`);
    await page
        .getByRole("tab", { name: "Company Associations", exact: true })
        .click();
    await page
        .getByRole("option", { name: new RegExp(companies[0].name) })
        .click();
    await page
        .getByRole("checkbox", { name: "Assign Customer", exact: true })
        .check();
    await page
        .getByLabel("Opening amount for Customer", { exact: true })
        .fill("1200.25");
    await page
        .getByRole("checkbox", { name: "Assign Employee", exact: true })
        .check();
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    await expect(
        page.getByRole("checkbox", { name: "Assign Employee", exact: true }),
    ).toBeChecked();
    await page
        .getByRole("button", {
            name: `View all Customer for ${companies[0].name}`,
            exact: true,
        })
        .click();
    const modal = page.getByRole("dialog");
    await expect(
        modal.getByText("Workspace Association Person", { exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page
        .getByRole("button", { name: "Add details", exact: true })
        .click();
    await page.getByLabel("Joining date", { exact: true }).fill("2026-02-10");
    await page.getByLabel("Salary (PKR)", { exact: true }).fill("70000.50");
    await page.getByLabel("Employee types", { exact: true }).click();
    await page
        .locator(".reference-options")
        .getByRole("button", { name: "Managing Director", exact: true })
        .click();
    await page
        .locator(".reference-options")
        .getByRole("button", { name: "Consultant", exact: true })
        .click();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await page
        .getByRole("button", { name: "Save details", exact: true })
        .click();
    await expect(page.getByText("70,000.50", { exact: false })).toBeVisible();
    await page
        .getByRole("option", { name: new RegExp(companies[1].name) })
        .click();
    await page
        .getByRole("checkbox", { name: "Assign Customer", exact: true })
        .check();
    await page
        .getByLabel("Opening amount for Customer", { exact: true })
        .fill("-20.50");
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    await page
        .getByRole("option", { name: new RegExp(companies[0].name) })
        .click();
    await expect(
        page.getByLabel("Opening amount for Customer", { exact: true }),
    ).toHaveValue("1200.25");
    await page.screenshot({
        path: "test-results/person-associations-desktop.png",
        fullPage: true,
    });
    await page
        .getByRole("checkbox", { name: "Assign Customer", exact: true })
        .uncheck();
    await page
        .getByRole("checkbox", { name: "Assign Employee", exact: true })
        .uncheck();
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    await expect(
        page.getByRole("checkbox", { name: "Assign Employee", exact: true }),
    ).not.toBeChecked();
    const association = await request(
        page,
        `people/${person.id}/company-roles/${companies[0].id}`,
    );
    expect(association.data.status).toBe(false);
    const employee = await request(
        page,
        `people/${person.id}/employee?context=management`,
    );
    expect(employee.data.salary).toBe("70000.50");
    expect(employee.data.types).toHaveLength(2);
    const identity = (
        await request(page, `people/${person.id}?context=management`)
    ).data;
    expect(identity.joining_date).toBe("2026-02-10");
    const other = await request(
        page,
        `people/${person.id}/company-roles/${companies[1].id}`,
    );
    expect(other.classifications[0].opening_balance).toBe("-20.50");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
        ),
    ).toBe(true);
});

test("a linked user can sign in and sees only the portal companies assigned in the person form", async ({
    page,
    browser,
}) => {
    await page.goto("/people");
    const person = (
        await request(page, "people", {
            name: "Workspace Portal Person",
            status: true,
        })
    ).data;
    const role = (
        await request(page, "roles", {
            name: "Workspace Customer",
            permissions: ["companies.view"],
            status: true,
        })
    ).data;
    const companies = (await request(page, "session")).companies;
    await page.goto(`/people/${person.id}`);
    await page.getByRole("tab", { name: "User Account", exact: true }).click();
    await expect(page.getByLabel("USERNAME", { exact: false })).toHaveCount(0);
    await page
        .getByRole("switch", {
            name: "This person needs to sign in",
            exact: true,
        })
        .click();
    await page
        .getByLabel("USERNAME", { exact: false })
        .fill("workspace.portal");
    await page
        .getByLabel("USER ROLE", { exact: false })
        .selectOption(String(role.id));
    await page
        .getByLabel("PASSWORD", { exact: false })
        .first()
        .fill("TemporaryPassword123");
    await page
        .getByLabel("CONFIRM PASSWORD", { exact: true })
        .fill("TemporaryPassword123");
    const portalAccess = page.getByRole("group", {
        name: "Portal company access",
        exact: true,
    });
    const defaultCompany = companies.find(
        (company: { is_default: boolean }) => company.is_default,
    )!;
    await expect(
        portalAccess.getByRole("checkbox", {
            name: defaultCompany.name,
            exact: true,
        }),
    ).toBeChecked();
    await portalAccess
        .getByRole("checkbox", { name: defaultCompany.name, exact: true })
        .uncheck();
    await page
        .getByRole("group", { name: "Portal company access", exact: true })
        .getByRole("checkbox", { name: companies[1].name, exact: true })
        .check();
    const saving = page.waitForResponse(
        (response) =>
            response.request().method() === "POST" &&
            response.url().endsWith("/api/v1/users"),
    );
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    const response = await saving;
    expect(response.status()).toBe(201);
    const user = (await response.json()).data;
    expect(user.person_id).toBe(person.id);
    expect(user.company_ids).toEqual([companies[1].id]);
    expect(user.password).toBeUndefined();
    await expect(page.locator("input[type=password]")).toHaveCount(0);
    await page.screenshot({
        path: "test-results/person-account-desktop.png",
        fullPage: true,
    });
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const portalContext = await browser.newContext({
        storageState: { cookies: [], origins: [] },
    });
    const portal = await portalContext.newPage();
    await portal.goto("http://127.0.0.1:8012/");
    await portal
        .getByLabel("Username", { exact: true })
        .fill("workspace.portal");
    await portal
        .getByLabel("Password", { exact: true })
        .fill("TemporaryPassword123");
    await portal.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
        portal.getByRole("heading", {
            name: /Good (morning|afternoon|evening), Workspace/i,
            exact: true,
        }),
    ).toBeVisible();
    await expect(
        portal.getByLabel("Authenticator code", { exact: true }),
    ).toHaveCount(0);
    await expect(
        portal.getByLabel("New password", { exact: true }),
    ).toHaveCount(0);
    await expect(
        portal.getByRole("region", { name: "Your companies", exact: true }),
    ).toHaveCount(0);
    await portal
        .getByRole("button", { name: "Current company", exact: true })
        .click();
    const companySwitcher = portal.locator(".topbar-dropdown-popover");
    await expect(
        companySwitcher.getByRole("button", {
            name: companies[1].name,
            exact: true,
        }),
    ).toBeVisible();
    await expect(
        companySwitcher.getByRole("button", {
            name: companies[0].name,
            exact: true,
        }),
    ).toHaveCount(0);
    await expect(companySwitcher.getByRole("button")).toHaveCount(1);
    await page
        .getByRole("switch", {
            name: "This person needs to sign in",
            exact: true,
        })
        .click();
    const disabled = page.waitForResponse(
        (response) =>
            response.request().method() === "PUT" &&
            response.url().endsWith(`/api/v1/users/${user.id}`),
    );
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    expect((await disabled).status()).toBe(200);
    expect(
        (
            await portal.request.get("http://127.0.0.1:8012/api/v1/session")
        ).status(),
    ).toBe(401);
    await portal.reload();
    await expect(
        portal.getByRole("heading", { name: "Sign in", exact: true }),
    ).toBeVisible();
    await portalContext.close();
});
