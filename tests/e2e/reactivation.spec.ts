import { test, expect } from "@playwright/test";

for (const entity of ["people", "companies", "employee-types"] as const) {
    test(`inactive ${entity} remain in their own master and can be re-enabled`, async ({
        page,
    }) => {
        await page.goto("/");
        const record = await page.evaluate(async (entity) => {
            const token = decodeURIComponent(
                document.cookie
                    .split("; ")
                    .find((cookie) => cookie.startsWith("XSRF-TOKEN="))!
                    .slice(11),
            );
            const response = await fetch(`/api/v1/${entity}`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    "X-XSRF-TOKEN": token,
                },
                body: JSON.stringify({
                    name: `Inactive ${entity} browser record`,
                    status: false,
                }),
            });
            if (!response.ok) throw new Error(await response.text());
            return (await response.json()).data;
        }, entity);
        expect(
            (await page.request.get(`/api/v1/${entity}/${record.id}`)).status(),
        ).toBe(404);
        await page.goto(`/${entity}`);
        if (entity === "people") {
            await page
                .getByLabel("Search people", { exact: true })
                .fill(record.name);
        }
        const listRecord = page.getByRole("button", {
            name: record.name,
            exact: true,
        });
        await expect(listRecord).toBeVisible();
        await listRecord.click();
        await page.getByRole("button", { name: "Edit", exact: true }).click();
        if (entity === "people") {
            await page
                .getByRole("switch", { name: "Person status", exact: true })
                .click();
            await expect(
                page.getByRole("switch", {
                    name: "Person status",
                    exact: true,
                }),
            ).toHaveAttribute("aria-checked", "true");
        } else {
            await page.getByRole("switch").click();
        }
        await page
            .getByRole("button", {
                name: "Save record",
                exact: true,
            })
            .first()
            .click();
        await expect
            .poll(async () =>
                (
                    await page.request.get(`/api/v1/${entity}/${record.id}`)
                ).status(),
            )
            .toBe(200);
        await expect(page).toHaveURL(new RegExp(`/${entity}/${record.id}`));
    });
}

test("a disabled bank branch stays in its bank workspace and can be enabled again", async ({
    page,
}) => {
    const banks = await (
        await page.request.get(
            "/api/v1/banks?search=National%20Bank%20of%20Pakistan",
        )
    ).json();
    const bank = banks.data[0];
    const branches = await (
        await page.request.get(`/api/v1/banks/${bank.id}/branches`)
    ).json();
    const branch = branches.data[0];
    await page.goto(`/banks/${bank.id}`);
    const row = page.getByRole("row", {
        name: String(branch.name),
        exact: true,
    });
    await row.locator("td").first().click();
    await row
        .getByRole("switch", { name: "Branch status", exact: true })
        .click();
    await row
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
    await expect(row.getByRole("switch")).toHaveCount(0);
    expect(
        (await page.request.get(`/api/v1/branches/${branch.id}`)).status(),
    ).toBe(404);
    await row.locator("td").first().click();
    await row
        .getByRole("switch", { name: "Branch status", exact: true })
        .click();
    await row
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
    await expect(row.getByRole("switch")).toHaveCount(0);
    expect(
        (await page.request.get(`/api/v1/branches/${branch.id}`)).status(),
    ).toBe(200);
});
