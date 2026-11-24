import { expect, test, type Page } from "@playwright/test";

async function request(
    page: Page,
    path: string,
    method = "GET",
    body?: object,
) {
    return page.evaluate(
        async ({ path, method, body }) => {
            const token = (await (await fetch("/csrf-token")).json()).token;
            const response = await fetch(`/api/v1/${path}`, {
                method,
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    "X-CSRF-TOKEN": token,
                },
                body: body ? JSON.stringify(body) : undefined,
            });
            if (!response.ok) throw new Error(await response.text());
            return response.json();
        },
        { path, method, body },
    );
}

for (const width of [1440, 390]) {
    test(`company tabs save tax, repeatable contacts and linked owner at ${width}px`, async ({
        page,
    }) => {
        page.on("pageerror", (error) => {
            throw error;
        });
        await page.setViewportSize({ width, height: 950 });
        await page.goto("/companies");
        await page
            .getByRole("button", { name: "Add record", exact: true })
            .first()
            .click();
        const form = page.getByRole("dialog", { name: "New company" });
        await form
            .getByLabel("Company Name", { exact: true })
            .fill(`Tabbed Company ${width}`);
        await form.getByLabel("Short Name", { exact: true }).fill(`TC${width}`);
        await form.getByRole("tab", { name: "Tax & Registrations" }).click();
        await form.getByLabel("NTN", { exact: true }).fill(`NTN-${width}`);
        await form
            .getByLabel("WeBOC ID", { exact: true })
            .fill(`WEBOC-${width}`);
        const saved = page.waitForResponse(
            (response) =>
                response.url().endsWith("/api/v1/companies") &&
                response.request().method() === "POST",
        );
        await form
            .getByRole("button", { name: "Save record", exact: true })
            .click();
        const companyResponse = await saved;
        expect(companyResponse.status()).toBe(201);
        const company = (await companyResponse.json()).data;
        expect(company.ntn).toBe(`NTN-${width}`);
        await expect(page).toHaveURL(new RegExp(`/companies/${company.id}$`));
        await page.getByRole("tab", { name: "Contacts & Emails" }).click();
        const contacts = page.locator("section.related-inline-section").filter({
            has: page.getByRole("grid", {
                name: "Contact Numbers",
                exact: true,
            }),
        });
        await contacts
            .getByRole("button", { name: "Add Row", exact: true })
            .click();
        const row = contacts.locator("tr[data-editing]");
        await row
            .getByLabel("Title", { exact: true })
            .fill("Registered Office");
        await row.getByLabel("Number", { exact: true }).fill("+92 300 1234567");
        await row
            .getByRole("checkbox", { name: "Primary", exact: true })
            .check();
        await page.getByRole("tab", { name: "Addresses", exact: true }).click();
        await page.getByRole("tab", { name: "Contacts & Emails" }).click();
        await expect(row.getByLabel("Number", { exact: true })).toHaveValue(
            "+92 300 1234567",
        );
        await row
            .getByRole("button", { name: "Save changes", exact: true })
            .click();
        await expect(
            contacts.getByText("+92 300 1234567", { exact: true }),
        ).toBeVisible();
        await page
            .getByRole("tab", { name: "Owners / Representatives", exact: true })
            .click();
        const owners = page.locator("section.related-inline-section").filter({
            has: page.getByRole("grid", {
                name: "Owners / Representatives",
                exact: true,
            }),
        });
        const person = (
            await request(page, "people", "POST", {
                name: `Linked Owner ${width}`,
                cnic: `123451234${String(width).padStart(4, "0")}`,
            })
        ).data;
        await owners
            .getByRole("button", { name: "Add Row", exact: true })
            .click();
        const owner = owners.locator("tr[data-editing]");
        await owner
            .getByRole("button", { name: "Person", exact: true })
            .click();
        await page
            .getByRole("textbox", { name: "Search Person", exact: true })
            .fill(person.name);
        await page
            .getByRole("button", { name: person.name, exact: true })
            .click();
        await expect(owner.locator("td").nth(1)).toContainText(person.name);
        await expect(owner.locator("td").nth(2)).toContainText(person.cnic);
        await owner.getByLabel("Designation", { exact: true }).fill("Director");
        await owner.getByLabel("Ownership %", { exact: true }).fill("75.25");
        await owner
            .getByRole("button", { name: "Save changes", exact: true })
            .click();
        await expect(
            owners.getByText("DIRECTOR", { exact: true }),
        ).toBeVisible();
        const savedOwner = (
            await request(
                page,
                `companies/${company.id}/company-owners?context=management`,
            )
        ).data[0];
        expect(savedOwner.person_id).toBe(person.id);
        expect(savedOwner.ownership_percentage).toBe("75.25");
        if (width === 390) {
            const scrolling = await owners
                .locator(".editable-detail-scroll")
                .evaluate((node) => ({
                    total: node.scrollWidth,
                    visible: node.clientWidth,
                }));
            expect(scrolling.total).toBeGreaterThan(scrolling.visible);
            expect(
                await page.evaluate(
                    () =>
                        document.documentElement.scrollWidth <=
                        window.innerWidth + 1,
                ),
            ).toBe(true);
        }
        await page.reload();
        await page.getByRole("tab", { name: "Tax & Registrations" }).click();
        await expect(page.getByLabel("NTN", { exact: true })).toHaveValue(
            `NTN-${width}`,
        );
        await expect(page.getByLabel("WeBOC ID", { exact: true })).toHaveValue(
            `WEBOC-${width}`,
        );
        await page.screenshot({
            path: `test-results/company-tabs-${width}.png`,
            fullPage: true,
        });
    });
}

test("bank account addresses follow the legal company and clear when it changes", async ({
    page,
}) => {
    await page.goto("/people");
    const first = (
        await request(page, "companies", "POST", {
            name: "Account Legal Holder",
        })
    ).data;
    const second = (
        await request(page, "companies", "POST", { name: "Other Legal Holder" })
    ).data;
    const country = (await request(page, "countries?per_page=1")).data[0];
    await request(page, `companies/${first.id}/company-addresses`, "POST", {
        title: "Bank Letters",
        address_line_1: "10 Local Road",
        country_id: country.id,
        is_primary: true,
    });
    await request(page, `companies/${second.id}/company-addresses`, "POST", {
        title: "Other Address",
        address_line_1: "20 Other Road",
        country_id: country.id,
    });
    const person = (
        await request(page, "people", "POST", {
            name: "Account Address Person",
        })
    ).data;
    await page.goto(`/people/${person.id}`);
    await page.getByRole("tab", { name: "Bank Accounts", exact: true }).click();
    const section = page.locator("section.related-inline-section");
    await section.getByRole("button", { name: "Add Row", exact: true }).click();
    const row = section.locator("tr[data-editing]");
    await row
        .getByRole("button", { name: "Legal Account Company", exact: true })
        .click();
    await page
        .getByRole("textbox", {
            name: "Search Legal Account Company",
            exact: true,
        })
        .fill(first.name);
    await page.getByRole("button", { name: first.name, exact: true }).click();
    await row
        .getByRole("button", { name: "Company Address", exact: true })
        .click();
    await expect(
        page.getByRole("button", {
            name: "OTHER ADDRESS — 20 OTHER ROAD",
            exact: true,
        }),
    ).toHaveCount(0);
    await page
        .getByRole("button", {
            name: "BANK LETTERS — 10 LOCAL ROAD",
            exact: true,
        })
        .click();
    await expect(
        row.getByRole("button", { name: "Company Address", exact: true }),
    ).toContainText("BANK LETTERS");
    await row
        .getByRole("button", { name: "Legal Account Company", exact: true })
        .click();
    await page
        .getByRole("textbox", {
            name: "Search Legal Account Company",
            exact: true,
        })
        .fill(second.name);
    await page.getByRole("button", { name: second.name, exact: true }).click();
    await expect(
        row.getByRole("button", { name: "Company Address", exact: true }),
    ).toHaveText(/Select/);
    await row.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("company profile lists its bank accounts with the address used for banking", async ({
    page,
}) => {
    await page.goto("/companies");
    const stamp = Date.now();
    const company = (
        await request(page, "companies", "POST", {
            name: `Banked Company ${stamp}`,
        })
    ).data;
    const city = (await request(page, "cities?per_page=1")).data[0];
    const address = (
        await request(
            page,
            `companies/${company.id}/company-addresses`,
            "POST",
            {
                title: "Registered Address (NTN)",
                address_line_1: "1 Registered Road",
                country_id: city.country_id,
            },
        )
    ).data;
    const bank = (
        await request(page, "banks", "POST", {
            name: `Profile Bank ${stamp}`,
            country_id: city.country_id,
        })
    ).data;
    const branch = (
        await request(page, `banks/${bank.id}/branches`, "POST", {
            name: "Profile Branch",
            city_id: city.id,
        })
    ).data;
    await request(page, "bank-accounts", "POST", {
        account_title: "Company Operating",
        account_number: `${stamp}`,
        bank_id: bank.id,
        country_id: city.country_id,
        city_id: city.id,
        bank_branch_id: branch.id,
        company_id: company.id,
        company_address_id: address.id,
        is_our_account: true,
        is_cheque: true,
    });
    await page.goto(`/companies/${company.id}`);
    await page.getByRole("tab", { name: "Bank Accounts", exact: true }).click();
    const accounts = page.getByRole("region", {
        name: "Company bank accounts",
    });
    const row = accounts.getByRole("row", { name: /COMPANY OPERATING/ });
    await expect(row).toContainText("REGISTERED ADDRESS (NTN)");
    await expect(row).toContainText("1 REGISTERED ROAD");
    await expect(row).toContainText("Our Account");
    await expect(row).toContainText("Cheque");
});
