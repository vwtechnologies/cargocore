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
    test(`bank accounts open from the dashboard and edit inline in the master-detail layout at ${width}px`, async ({
        page,
    }) => {
        page.on("pageerror", (error) => {
            throw error;
        });
        await page.setViewportSize({ width, height: 950 });
        await page.goto("/");
        const stamp = `${Date.now()}`.slice(-8);
        const city = (await request(page, "cities?per_page=1")).data[0];
        const bank = (
            await request(page, "banks", "POST", {
                name: `Register Bank ${stamp}`,
                country_id: city.country_id,
            })
        ).data;
        const branch = (
            await request(page, `banks/${bank.id}/branches`, "POST", {
                name: "Register Branch",
                city_id: city.id,
            })
        ).data;
        await request(page, "bank-accounts", "POST", {
            account_title: `Cheque Account ${stamp}`,
            account_number: stamp,
            bank_id: bank.id,
            country_id: city.country_id,
            city_id: city.id,
            bank_branch_id: branch.id,
            is_cheque: true,
        });

        await page.goto("/");
        await page
            .getByRole("link", { name: "Bank Accounts", exact: true })
            .click();
        await expect(page).toHaveURL(/\/bank-accounts(\/\d+)?$/);
        await expect(
            page.getByRole("heading", { name: "Bank Accounts", level: 1 }),
        ).toBeVisible();

        const views = page.getByRole("group", { name: "Bank account views" });
        await views
            .getByRole("button", { name: "Cheque", exact: true })
            .click();
        await page
            .getByRole("button", { name: `CHEQUE ACCOUNT ${stamp}` })
            .click();
        await expect(
            page.getByRole("heading", { name: `CHEQUE ACCOUNT ${stamp}` }),
        ).toBeVisible();
        await expect(page.locator(".bank-account-summary")).toContainText(
            "Cheque",
        );

        await page
            .getByRole("button", { name: "Edit", exact: true })
            .locator("visible=true")
            .first()
            .click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await page
            .locator("#field-bank-accounts-account_title")
            .fill(`Renamed Account ${stamp}`);
        await page
            .getByRole("button", { name: "Save record" })
            .locator("visible=true")
            .first()
            .click();
        await expect(
            page.getByRole("heading", { name: `RENAMED ACCOUNT ${stamp}` }),
        ).toBeVisible();
        await expect(page.locator(".bank-account-summary")).toBeVisible();

        await views
            .getByRole("button", { name: "Beneficiary", exact: true })
            .click();
        await expect(
            page.getByRole("button", { name: `RENAMED ACCOUNT ${stamp}` }),
        ).toHaveCount(0);
    });
}
