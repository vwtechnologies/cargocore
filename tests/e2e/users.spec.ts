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

test("users link only available people, support explicit unlink and disable, and retain links after reload", async ({
    page,
}) => {
    page.on("pageerror", (error) => {
        throw error;
    });
    await page.goto("/users");
    const list = page.locator(".company-master-table");
    await expect(
        list.getByRole("columnheader", { name: "USER", exact: true }),
    ).toHaveCount(0);
    await expect(
        list.getByRole("columnheader", { name: "USERNAME", exact: true }),
    ).toBeVisible();
    await expect(
        page.getByText("TWO-FACTOR AUTHENTICATION", { exact: true }),
    ).toHaveCount(0);
    await page
        .getByRole("button", { name: "User profile menu", exact: true })
        .click();
    await expect(
        page.getByRole("link", { name: "Security settings", exact: true }),
    ).toHaveCount(0);
    await page
        .getByRole("button", { name: "User profile menu", exact: true })
        .click();
    const first = (await request(page, "people", { name: "User Link First" }))
        .data;
    const second = (await request(page, "people", { name: "User Link Second" }))
        .data;
    const occupied = (
        await request(page, "people", { name: "User Link Occupied" })
    ).data;
    await request(page, "people", {
        name: "User Link Inactive",
        status: false,
    });
    const roles = (await request(page, "roles")).data;
    const role = roles.find(
        (value: { name: string }) => value.name === "Admin",
    );
    await request(page, "users", {
        name: "Occupied account",
        username: "occupied.user",
        role_id: role.id,
        person_id: occupied.id,
        status: false,
        company_ids: [],
        password: "Temporary-password-123",
        password_confirmation: "Temporary-password-123",
    });
    await page.getByRole("button", { name: "New user", exact: true }).click();
    await page
        .getByLabel("FULL NAME", { exact: true })
        .fill("User Link Account");
    await page
        .getByLabel("USERNAME", { exact: true })
        .fill("user.link.account");
    await page
        .getByLabel("USER ROLE", { exact: true })
        .selectOption(String(role.id));
    await page.locator("#user-password").fill("Temporary-password-123");
    await page
        .getByLabel("CONFIRM PASSWORD", { exact: true })
        .fill("Temporary-password-123");
    await page
        .getByRole("switch", { name: "Person link", exact: true })
        .click();
    await page.getByRole("button", { name: "Link To", exact: true }).click();
    await page
        .getByRole("textbox", { name: "Search Link To", exact: true })
        .fill("User Link");
    const options = page.locator(".reference-options");
    await expect(
        options.getByRole("button", { name: first.name, exact: true }),
    ).toBeVisible();
    await expect(
        options.getByRole("button", { name: occupied.name, exact: true }),
    ).toHaveCount(0);
    await expect(
        options.getByRole("button", {
            name: "User Link Inactive",
            exact: true,
        }),
    ).toHaveCount(0);
    await options
        .getByRole("button", { name: first.name, exact: true })
        .click();
    const createdResponse = page.waitForResponse(
        (response) =>
            response.request().method() === "POST" &&
            response.url().endsWith("/api/v1/users"),
    );
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    const user = (await (await createdResponse).json()).data;
    expect(user.person_id).toBe(first.id);
    await expect(
        page.getByRole("textbox", { name: "Link To", exact: true }),
    ).toHaveValue(first.name);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page
        .getByRole("button", { name: "Unlink person", exact: true })
        .click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(
        page.getByRole("textbox", { name: "Link To", exact: true }),
    ).toHaveValue(first.name);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page
        .getByRole("button", { name: "Unlink person", exact: true })
        .click();
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    await expect(
        page.getByRole("textbox", { name: "Link To", exact: true }),
    ).toHaveValue("Not linked");
    const unlinked = (
        await request(page, `users?id=${user.id}&context=management`)
    ).data[0];
    expect(unlinked.person_id).toBeNull();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page
        .getByRole("switch", { name: "Person link", exact: true })
        .click();
    await page.getByRole("button", { name: "Link To", exact: true }).click();
    await page
        .getByRole("textbox", { name: "Search Link To", exact: true })
        .fill(second.name);
    await options
        .getByRole("button", { name: second.name, exact: true })
        .click();
    await page
        .getByRole("switch", { name: "Account status", exact: true })
        .click();
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    await expect(
        page.getByRole("textbox", { name: "Link To", exact: true }),
    ).toHaveValue(second.name);
    await expect(
        page.getByRole("switch", { name: "Account status", exact: true }),
    ).not.toBeChecked();
    await page.reload();
    await page
        .getByRole("button", { name: user.username, exact: true })
        .click();
    await expect(
        page.getByRole("textbox", { name: "Link To", exact: true }),
    ).toHaveValue(second.name);
    await expect(
        page.getByRole("switch", { name: "Account status", exact: true }),
    ).not.toBeChecked();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    const persisted = (
        await request(page, `users?id=${user.id}&context=management`)
    ).data[0];
    expect(persisted.person_id).toBe(second.id);
    expect(persisted.status).toBe(false);
    expect(persisted.password).toBeUndefined();
    await page.screenshot({
        path: "test-results/users-desktop.png",
        fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
        ),
    ).toBe(false);
    await page.screenshot({
        path: "test-results/users-mobile.png",
        fullPage: true,
    });
});

test("user edits retain drafts on conflicts and explicitly reload before saving", async ({
    page,
}) => {
    await page.goto("/users");
    const roles = (await request(page, "roles")).data;
    const role = roles.find(
        (value: { name: string }) => value.name === "Admin",
    );
    const user = (
        await request(page, "users", {
            name: "Stale User Account",
            username: "stale.user.account",
            role_id: role.id,
            status: true,
            company_ids: [],
            password: "Temporary-password-123",
            password_confirmation: "Temporary-password-123",
        })
    ).data;
    await page.reload();
    await page
        .getByRole("button", { name: user.username, exact: true })
        .click();
    const navigation = page.getByLabel("User Management Table Navigation", {
        exact: true,
    });
    await navigation.focus();
    await navigation.press("ArrowUp");
    await expect(page.getByLabel("FULL NAME", { exact: true })).not.toHaveValue(
        user.name,
    );
    await navigation.press("ArrowDown");
    await expect(page.getByLabel("FULL NAME", { exact: true })).toHaveValue(
        user.name,
    );
    await navigation.press("Enter");
    await page
        .getByLabel("FULL NAME", { exact: true })
        .fill("Unsaved user draft");
    await request(
        page,
        `users/${user.id}`,
        {
            name: "Server Updated Account",
            username: user.username,
            role_id: role.id,
            status: true,
            company_ids: [],
            version: user.version,
        },
        "PUT",
    );
    const conflict = page.waitForResponse(
        (response) =>
            response.request().method() === "PUT" &&
            response.url().endsWith(`/api/v1/users/${user.id}`),
    );
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    expect((await conflict).status()).toBe(409);
    await expect(page.getByLabel("FULL NAME", { exact: true })).toHaveValue(
        "UNSAVED USER DRAFT",
    );
    await page
        .getByRole("button", { name: "Reload and review", exact: true })
        .click();
    await expect(page.getByLabel("FULL NAME", { exact: true })).toHaveValue(
        "SERVER UPDATED ACCOUNT",
    );
    await page
        .getByLabel("FULL NAME", { exact: true })
        .fill("Reviewed User Account");
    await page
        .getByLabel("FULL NAME", { exact: true })
        .press("ControlOrMeta+s");
    await expect(page.getByLabel("FULL NAME", { exact: true })).toHaveAttribute(
        "readonly",
        "",
    );
    expect(
        (await request(page, `users?id=${user.id}&context=management`)).data[0]
            .name,
    ).toBe("REVIEWED USER ACCOUNT");
});

test("client Admin sees owner-created business data while developer login accounts and roles stay protected", async ({
    browser,
}) => {
    test.setTimeout(60000);
    const ownerContext = await browser.newContext({
        baseURL: "http://127.0.0.1:8012",
        storageState: { cookies: [], origins: [] },
    });
    const page = await ownerContext.newPage();
    await page.goto("/");
    await page.getByLabel("Username", { exact: true }).fill("qa.admin");
    await page
        .getByLabel("Password", { exact: true })
        .fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
        page.getByRole("heading", {
            name: /Good (morning|afternoon|evening), QA/i,
        }),
    ).toBeVisible();
    await page.goto("/users");
    const session = await request(page, "session");
    const roles = (await request(page, "roles")).data;
    const ownerRole = roles.find(
        (role: { name: string }) => role.name === "Super Admin",
    );
    const adminRole = roles.find(
        (role: { name: string }) => role.name === "Admin",
    );
    const company = session.companies[0];
    const person = (
        await request(page, "people", { name: "Private Developer Identity" })
    ).data;
    const owner = (
        await request(page, "users", {
            name: "PRIVATE DEVELOPER ACCOUNT",
            username: "private.developer",
            person_id: person.id,
            role_id: ownerRole.id,
            company_ids: [],
            status: true,
            password: "Assigned-password-123",
            password_confirmation: "Assigned-password-123",
        })
    ).data;
    const subordinateRole = (
        await request(page, "roles", {
            name: "CLIENT DATA ENTRY",
            permissions: ["people.view"],
            status: true,
        })
    ).data;
    await request(page, "users", {
        name: "CLIENT STAFF ACCOUNT",
        username: "client.staff",
        role_id: subordinateRole.id,
        company_ids: [company.id],
        status: true,
        password: "Assigned-password-123",
        password_confirmation: "Assigned-password-123",
    });
    await request(page, "users", {
        name: "CLIENT ADMINISTRATOR",
        username: "client.admin",
        role_id: adminRole.id,
        company_ids: [company.id],
        status: true,
        password: "Assigned-password-123",
        password_confirmation: "Assigned-password-123",
    });
    const context = await browser.newContext({
        storageState: { cookies: [], origins: [] },
    });
    const client = await context.newPage();
    await client.goto("http://127.0.0.1:8012/");
    await client.getByLabel("Username", { exact: true }).fill("client.admin");
    await client
        .getByLabel("Password", { exact: true })
        .fill("Assigned-password-123");
    await client.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
        client.getByRole("heading", {
            name: /Good (morning|afternoon|evening), Client/i,
            exact: true,
        }),
    ).toBeVisible();
    await expect(
        client.getByRole("button", { name: "User profile menu", exact: true }),
    ).toContainText("Admin");
    await expect(client.locator(".dash-welcome-company")).toContainText(
        company.name,
    );
    await expect(client.locator(".dash-welcome-role")).toHaveText("Admin");
    await expect(
        client.locator(".dash-card").getByText("Users", { exact: true }),
    ).toBeVisible();

    await expect(
        client.getByRole("link", { name: "Roles", exact: true }),
    ).toHaveCount(0);
    await expect(
        client.getByRole("link", { name: "Permissions", exact: true }),
    ).toHaveCount(0);
    await client
        .getByRole("button", { name: "Administration", exact: true })
        .click();
    await expect(
        client.getByRole("link", { name: "Roles", exact: true }),
    ).toHaveCount(0);
    await client.goto("http://127.0.0.1:8012/users");
    await expect(
        client.getByRole("button", {
            name: "CLIENT.STAFF",
            exact: true,
        }),
    ).toBeVisible();
    await expect(
        client.getByText("PRIVATE DEVELOPER ACCOUNT", { exact: true }),
    ).toHaveCount(0);
    await expect(
        client.getByText("QA Administrator", { exact: true }),
    ).toHaveCount(0);
    const accounts = await request(client, "users?context=management");
    expect(
        accounts.data.some((user: { id: number }) => user.id === owner.id),
    ).toBe(false);
    expect(JSON.stringify(accounts)).not.toContain("Super Admin");
    expect(
        (await client.request.get("/api/v1/roles?context=management")).status(),
    ).toBe(403);
    const availableRoles = await request(client, "roles");
    expect(JSON.stringify(availableRoles)).not.toContain("Super Admin");
    await client.getByRole("button", { name: "New user", exact: true }).click();
    await expect(
        client
            .getByLabel("USER ROLE", { exact: true })
            .getByRole("option", { name: "Super Admin", exact: true }),
    ).toHaveCount(0);
    await expect(
        client
            .getByLabel("USER ROLE", { exact: true })
            .getByRole("option", { name: "CLIENT DATA ENTRY", exact: true }),
    ).toBeAttached();
    await expect(
        client
            .getByLabel("USER ROLE", { exact: true })
            .getByRole("option", { name: "Admin", exact: true }),
    ).toBeAttached();
    await client
        .getByRole("switch", { name: "Person link", exact: true })
        .click();
    await client.getByRole("button", { name: "Link To", exact: true }).click();
    await client
        .getByRole("textbox", { name: "Search Link To", exact: true })
        .fill(person.name);
    await expect(
        client
            .locator(".reference-options")
            .getByRole("button", { name: person.name, exact: true }),
    ).toHaveCount(0);
    expect(
        (
            await client.request.get(
                `/api/v1/people/${person.id}?context=management`,
            )
        ).status(),
    ).toBe(200);
    expect(
        (
            await client.request.get(`/api/v1/people/${person.id}/user-account`)
        ).status(),
    ).toBe(404);
    expect(
        (
            await client.request.get(
                `/api/v1/users/linkable-people?user_id=${owner.id}`,
            )
        ).status(),
    ).toBe(404);
    await client.getByRole("button", { name: "Done", exact: true }).click();
    client.once("dialog", (dialog) => dialog.accept());
    await client.getByRole("button", { name: "Cancel", exact: true }).click();
    await client.goto(`http://127.0.0.1:8012/people/${person.id}`);
    await expect(client.getByLabel("Full name", { exact: true })).toHaveValue(
        person.name,
    );
    await client
        .getByRole("tab", { name: "User Account", exact: true })
        .click();
    await expect(
        client.getByText("Account is unavailable.", { exact: true }),
    ).toBeVisible();
    await expect(client.getByLabel("USERNAME", { exact: true })).toHaveCount(0);
    await client.goto("http://127.0.0.1:8012/audit");
    await expect(
        client.getByText("You do not have permission to view this page.", {
            exact: true,
        }),
    ).toBeVisible();
    expect((await client.request.get("/api/v1/audit")).status()).toBe(403);
    await expect(
        client.getByText("PRIVATE DEVELOPER ACCOUNT", { exact: true }),
    ).toHaveCount(0);
    await expect(client.getByText("Super Admin", { exact: true })).toHaveCount(
        0,
    );
    await client.screenshot({
        path: "test-results/client-admin-private-owner.png",
        fullPage: true,
    });
    await context.close();
    await page.reload();
    await page
        .getByRole("textbox", { name: "Search users", exact: true })
        .fill(owner.name);
    await expect(
        page.getByRole("button", { name: owner.username, exact: true }),
    ).toBeVisible();
    await page.evaluate(async () => {
        const token = decodeURIComponent(
            document.cookie
                .split("; ")
                .find((cookie) => cookie.startsWith("XSRF-TOKEN="))!
                .slice(11),
        );
        const response = await fetch("/logout", {
            method: "POST",
            headers: { Accept: "application/json", "X-XSRF-TOKEN": token },
        });
        if (!response.ok)
            throw new Error("Could not expire the owner session.");
        window.dispatchEvent(new Event("session-expired"));
    });
    await expect(
        page.getByRole("heading", { name: "Sign in", exact: true }),
    ).toBeVisible();
    let releaseUsers: (() => void) | undefined;
    const pendingUsers = new Promise<void>((resolve) => {
        releaseUsers = resolve;
    });
    await page.route("**/api/v1/users?*", async (route) => {
        await pendingUsers;
        await route.continue();
    });
    try {
        await page.getByLabel("Username", { exact: true }).fill("client.admin");
        await page
            .getByLabel("Password", { exact: true })
            .fill("Assigned-password-123");
        await page
            .getByRole("button", { name: "Sign in", exact: true })
            .click();
        await expect(
            page.getByRole("button", {
                name: "User profile menu",
                exact: true,
            }),
        ).toContainText("CLIENT ADMINISTRATOR");
        await expect(
            page.getByRole("heading", { name: "User Management", exact: true }),
        ).toBeVisible();
        await expect(page.getByText(owner.name, { exact: true })).toHaveCount(
            0,
        );
        await expect(
            page.getByText("QA Administrator", { exact: true }),
        ).toHaveCount(0);
        await expect(
            page.getByText("Super Admin", { exact: true }),
        ).toHaveCount(0);
    } finally {
        releaseUsers?.();
    }
    await expect(
        page.getByRole("button", { name: "CLIENT.STAFF", exact: true }),
    ).toBeVisible();
    await ownerContext.close();
});

test("the workspace switcher follows portal grants for Super Admin and drops inactive selections without reload", async ({
    page,
    browser,
}) => {
    test.setTimeout(60000);
    await page.goto("/users");
    const session = await request(page, "session");
    expect(session.portal_companies).toEqual([]);
    await expect(
        page.getByRole("button", { name: "Current company", exact: true }),
    ).toContainText("No portal company access");
    const assigned = session.companies
        .filter((company: { is_default: boolean }) => !company.is_default)
        .slice(0, 2);
    const roles = (await request(page, "roles")).data;
    const role = roles.find(
        (item: { name: string }) => item.name === "Super Admin",
    );
    await request(page, "users", {
        name: "Scoped Workspace Owner",
        username: "scoped.workspace.owner",
        role_id: role.id,
        company_ids: assigned.map((company: { id: number }) => company.id),
        status: true,
        password: "Assigned-password-123",
        password_confirmation: "Assigned-password-123",
    });
    const context = await browser.newContext({
        storageState: { cookies: [], origins: [] },
    });
    const portal = await context.newPage();
    let deactivated = false;
    try {
        await portal.goto("http://127.0.0.1:8012/");
        await portal
            .getByLabel("Username", { exact: true })
            .fill("scoped.workspace.owner");
        await portal
            .getByLabel("Password", { exact: true })
            .fill("Assigned-password-123");
        await portal
            .getByRole("button", { name: "Sign in", exact: true })
            .click();
        const current = portal.getByRole("button", {
            name: "Current company",
            exact: true,
        });
        await expect(current).toContainText(assigned[0].name);
        await current.click();
        const switcher = portal.locator(".topbar-dropdown-popover");
        await expect(switcher.getByRole("button")).toHaveCount(2);
        for (const company of session.companies.filter(
            (item: { id: number }) =>
                !assigned.some(
                    (allowed: { id: number }) => allowed.id === item.id,
                ),
        )) {
            await expect(
                switcher.getByRole("button", {
                    name: company.name,
                    exact: true,
                }),
            ).toHaveCount(0);
        }
        await switcher
            .getByRole("button", { name: assigned[1].name, exact: true })
            .click();
        await expect(current).toContainText(assigned[1].name);
        const company = (
            await request(
                page,
                `companies/${assigned[1].id}?context=management`,
            )
        ).data;
        await request(
            page,
            `companies/${company.id}`,
            { name: company.name, status: false, version: company.version },
            "PUT",
        );
        deactivated = true;
        await expect(current).toContainText(assigned[0].name, {
            timeout: 20000,
        });
        await current.click();
        await expect(switcher.getByRole("button")).toHaveCount(1);
        await expect(
            switcher.getByRole("button", {
                name: assigned[1].name,
                exact: true,
            }),
        ).toHaveCount(0);
    } finally {
        await context.close();
        if (deactivated) {
            const latest = (
                await request(
                    page,
                    `companies/${assigned[1].id}?context=management`,
                )
            ).data;
            await request(
                page,
                `companies/${latest.id}`,
                { name: latest.name, status: true, version: latest.version },
                "PUT",
            );
        }
    }
});
