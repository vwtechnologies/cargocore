import { test, expect, type Page } from "@playwright/test";

async function request(page: Page, path: string, body?: object) {
    return page.evaluate(
        async ({ path, body }) => {
            const token = decodeURIComponent(
                document.cookie
                    .split("; ")
                    .find((item) => item.startsWith("XSRF-TOKEN="))!
                    .slice(11),
            );
            const response = await fetch(`/api/v1/${path}`, {
                method: body ? "POST" : "GET",
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
        { path, body },
    );
}

test("usernames, emails and URLs become uppercase while typing and persist without changing passwords", async ({
    page,
}) => {
    await page.goto("/banks");
    const website = page.getByRole("textbox", { name: "Website", exact: true });
    await expect(
        page.getByRole("textbox", { name: "Bank Name", exact: true }),
    ).not.toHaveValue("");
    await page.keyboard.press("Control+e");
    await website.fill("https://Example.test/MixedPath");
    await expect(website).toHaveValue("HTTPS://EXAMPLE.TEST/MIXEDPATH");
    const bankSaved = page.waitForResponse(
        (response) =>
            /\/api\/v1\/banks\/\d+$/.test(response.url()) &&
            response.request().method() === "PUT",
    );
    await website.press("Control+s");
    const bankResponse = await bankSaved;
    expect(bankResponse.status()).toBe(200);
    expect((await bankResponse.json()).data.website).toBe(
        "HTTPS://EXAMPLE.TEST/MIXEDPATH",
    );
    await page.goto("/users");
    await expect(
        page.getByRole("textbox", { name: "FULL NAME", exact: true }),
    ).not.toHaveValue("");
    await page.keyboard.press("Control+n");
    await page
        .getByRole("textbox", { name: "FULL NAME", exact: true })
        .fill("Technical Case User");
    const username = page.getByRole("textbox", {
        name: "USERNAME",
        exact: true,
    });
    await username.fill("Technical.User");
    await expect(username).toHaveValue("TECHNICAL.USER");
    const email = page.getByRole("textbox", {
        name: "EMAIL ADDRESS",
        exact: true,
    });
    await email.fill("Technical.User@Example.test");
    await expect(email).toHaveValue("TECHNICAL.USER@EXAMPLE.TEST");
    await page
        .getByRole("combobox", { name: "USER ROLE", exact: true })
        .selectOption({ label: "USER" });
    const password = page.getByLabel("PASSWORD", { exact: false }).first();
    await password.fill("Assigned-Password-123");
    await expect(password).toHaveValue("Assigned-Password-123");
    await page
        .getByLabel("CONFIRM PASSWORD", { exact: true })
        .fill("Assigned-Password-123");
    const userSaved = page.waitForResponse(
        (response) =>
            response.url().endsWith("/api/v1/users") &&
            response.request().method() === "POST",
    );
    await email.press("Control+s");
    const response = await userSaved;
    expect(response.status()).toBe(201);
    const account = (await response.json()).data;
    expect(account.username).toBe("TECHNICAL.USER");
    expect(account.email).toBe("TECHNICAL.USER@EXAMPLE.TEST");
    await page.reload();
    await page
        .getByRole("cell", { name: "TECHNICAL.USER", exact: true })
        .click();
    await expect(email).toHaveValue("TECHNICAL.USER@EXAMPLE.TEST");
});

test("Super Admin manages named roles through the grouped permission form and keyboard shortcuts", async ({
    page,
}) => {
    await page.goto("/roles");
    await expect(
        page.getByRole("heading", { name: "Role Permissions", exact: true }),
    ).toBeVisible();
    const name = page.getByRole("textbox", { name: /ROLE NAME/ });
    await expect(name).toHaveValue("Super Admin");
    await expect(name).not.toBeEditable();
    const matrix = page.getByRole("table", {
        name: "Role permissions",
        exact: true,
    });
    await expect(
        matrix.getByRole("checkbox", {
            name: "Person Information: create",
            exact: true,
        }),
    ).toBeChecked();
    await page.keyboard.press("Control+n");
    await name.fill("MiXeD Keyboard Role");
    await expect(name).toHaveValue("MIXED KEYBOARD ROLE");
    await matrix
        .getByRole("checkbox", {
            name: "Company & Sub-Company: view",
            exact: true,
        })
        .check();
    await matrix
        .getByRole("checkbox", {
            name: "Person Information: view",
            exact: true,
        })
        .check();
    const saving = page.waitForResponse(
        (response) =>
            response.url().endsWith("/api/v1/roles") &&
            response.request().method() === "POST",
    );
    await name.press("Control+s");
    expect((await saving).status()).toBe(201);
    await expect(name).not.toBeEditable();
    await page.reload();
    await page
        .getByRole("cell", { name: "MIXED KEYBOARD ROLE", exact: true })
        .click();
    await expect(name).toHaveValue("MIXED KEYBOARD ROLE");
    await expect(
        matrix.getByRole("checkbox", {
            name: "Person Information: view",
            exact: true,
        }),
    ).toBeChecked();
    await page.getByRole("cell", { name: "USER", exact: true }).click();
    await expect(name).toHaveValue("USER");
    await expect(
        matrix.getByRole("checkbox", {
            name: "Person Information: delete",
            exact: true,
        }),
    ).toBeChecked();
    await expect(
        matrix.getByRole("checkbox", { name: "MARKA: create", exact: true }),
    ).toBeChecked();
    await expect(
        matrix.getByRole("checkbox", {
            name: "Company & Sub-Company: create",
            exact: true,
        }),
    ).not.toBeChecked();
    await expect(
        matrix.getByRole("checkbox", {
            name: "Employee Type: view",
            exact: true,
        }),
    ).not.toBeChecked();
    await expect(
        matrix.getByRole("checkbox", {
            name: "User Management: view",
            exact: true,
        }),
    ).not.toBeChecked();
    await page.screenshot({
        path: "test-results/roles-desktop.png",
        fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 740 });
    await matrix.scrollIntoViewIfNeeded();
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
    ).toBe(true);
    await expect(
        matrix.getByRole("checkbox", {
            name: "Person Information: create",
            exact: true,
        }),
    ).toBeEnabled();
    await page.screenshot({ path: "test-results/roles-mobile.png" });
});

test("USER sees all companies without portal grants and edits person information and MARKA without administration access", async ({
    page,
    browser,
}) => {
    await page.goto("/");
    const roles = await request(page, "roles");
    const role = roles.data.find(
        (item: { name: string }) => item.name === "USER",
    );
    const account = await request(page, "users", {
        name: "Business User",
        username: "business.user",
        password: "Assigned-password-123",
        password_confirmation: "Assigned-password-123",
        role_id: role.id,
        company_ids: [],
        status: true,
    });
    expect(account.data.username).toBe("BUSINESS.USER");
    const context = await browser.newContext({
        baseURL: "http://127.0.0.1:8012",
        storageState: { cookies: [], origins: [] },
    });
    try {
        const user = await context.newPage();
        await user.goto("/");
        await user
            .getByLabel("Username", { exact: true })
            .fill("business.user");
        await expect(user.getByLabel("Username", { exact: true })).toHaveValue(
            "BUSINESS.USER",
        );
        await user
            .getByLabel("Password", { exact: true })
            .fill("Assigned-password-123");
        await expect(user.getByLabel("Password", { exact: true })).toHaveValue(
            "Assigned-password-123",
        );
        await user
            .getByRole("button", { name: "Sign in", exact: true })
            .click();
        await expect(
            user.getByRole("heading", {
                name: /Good (morning|afternoon|evening), BUSINESS/i,
            }),
        ).toBeVisible();
        await expect(user.locator(".dash-card")).toHaveText([
            /Companies/,
            /Countries/,
            /Banks/,
            /Person/,
        ]);
        await expect(
            user.getByRole("region", { name: "Administration", exact: true }),
        ).toHaveCount(0);
        await expect(
            user.getByRole("button", { name: "Administration", exact: true }),
        ).not.toBeVisible();
        await user
            .getByRole("button", { name: "Master Data", exact: true })
            .click();
        const allowedLinks = [
            "Companies",
            "Countries",
            "Banks",
            "Person Information",
            "Marka",
        ];
        await expect(user.locator(".topbar-dropdown-popover a")).toHaveText(
            allowedLinks,
        );
        await user.setViewportSize({ width: 390, height: 844 });
        await user.getByRole("button", { name: "Open navigation" }).click();
        const navigation = user.getByRole("dialog", {
            name: "Navigation",
            exact: true,
        });
        await expect(navigation.getByRole("link")).toHaveText([
            "CargoCore",
            "Home",
            ...allowedLinks,
        ]);
        await expect(
            navigation.getByRole("heading", {
                name: "Administration",
                exact: true,
            }),
        ).not.toBeVisible();
        await user.keyboard.press("Escape");
        await user.setViewportSize({ width: 1440, height: 1100 });
        const companies = await request(
            user,
            "companies?context=management&per_page=100",
        );
        expect(companies.meta.total).toBe(24);
        const session = await request(user, "session");
        expect(session.portal_companies).toEqual([]);
        for (const path of [
            "business-types",
            "employee-types",
            "users",
            "roles",
            "audit",
        ]) {
            const response = await user.request.get(
                `/api/v1/${path}?context=management`,
            );
            expect(response.status()).toBe(403);
            await user.goto(`/${path}`);
            await expect(
                user.getByText(
                    "You do not have permission to view this page.",
                    { exact: true },
                ),
            ).toBeVisible();
        }
        await user.goto("/people");
        await expect(
            user.getByRole("textbox", { name: "Full name", exact: true }),
        ).not.toHaveValue("");
        await user.keyboard.press("Control+n");
        const fullName = user.getByRole("textbox", {
            name: "Full name",
            exact: true,
        });
        await fullName.fill("UnEvEn Person Name");
        await expect(fullName).toHaveValue("UNEVEN PERSON NAME");
        await user
            .getByRole("checkbox", { name: "Employee", exact: true })
            .check();
        const employeeTypes = await request(
            user,
            "employee-types?context=lookup",
        );
        await user
            .getByRole("button", { name: "Employee types", exact: true })
            .click();
        await user
            .locator(".reference-options")
            .getByRole("button", {
                name: employeeTypes.data[0].name,
                exact: true,
            })
            .click();
        await user.getByRole("button", { name: "Done", exact: true }).click();
        const saved = user.waitForResponse(
            (response) =>
                response.url().endsWith("/api/v1/people") &&
                response.request().method() === "POST",
        );
        await fullName.press("Control+s");
        const savedPerson = await saved;
        expect(savedPerson.status()).toBe(201);
        expect((await savedPerson.json()).data.is_employee).toBe(true);
        await expect(fullName).not.toBeEditable();
        await user.getByRole("tab", { name: /Company Associations/ }).click();
        await expect(
            user.getByRole("checkbox", {
                name: /^Assign Employee$/i,
                exact: true,
            }),
        ).toBeEnabled();
        await user
            .getByRole("checkbox", { name: /^Assign Employee$/i, exact: true })
            .check();
        const associationSaved = user.waitForResponse(
            (response) =>
                /company-roles\/\d+$/.test(response.url()) &&
                response.request().method() === "PUT",
        );
        await user.keyboard.press("Control+s");
        expect((await associationSaved).status()).toBe(200);
        await expect(
            user.getByRole("checkbox", {
                name: /^Assign Employee$/i,
                exact: true,
            }),
        ).toBeChecked();
        await user.goto("/markas");
        await expect(
            user.getByRole("button", { name: "Edit", exact: true }),
        ).toBeEnabled();
        await user.keyboard.press("Control+n");
        await user
            .getByRole("textbox", { name: /MARKA CODE/ })
            .fill("mArK-user");
        await user
            .getByRole("textbox", { name: /MARKA DESCRIPTION/ })
            .fill("uNeVeN Description");
        const creating = user.waitForResponse(
            (response) =>
                response.url().endsWith("/api/v1/markas") &&
                response.request().method() === "POST",
        );
        await user.keyboard.press("Control+s");
        expect((await creating).status()).toBe(201);
        await expect(
            user.getByRole("textbox", { name: /MARKA DESCRIPTION/ }),
        ).toHaveValue("UNEVEN DESCRIPTION");
    } finally {
        await context.close();
    }
});
