import { test, expect } from "@playwright/test";

test("bank information, country-filtered branches, and linked officers persist on one page", async ({
    page,
}) => {
    test.setTimeout(60000);
    page.on("pageerror", (error) => {
        throw error;
    });
    await page.goto("/banks");
    const seed = await page.evaluate(async () => {
        const countries = (
            await (
                await fetch("/api/v1/countries?per_page=100", {
                    headers: { Accept: "application/json" },
                })
            ).json()
        ).data;
        const china = countries.find(
            (country: { name: string }) => country.name === "China",
        );
        const token = decodeURIComponent(
            document.cookie
                .split("; ")
                .find((cookie) => cookie.startsWith("XSRF-TOKEN="))!
                .slice(11),
        );
        const created = await fetch(`/api/v1/countries/${china.id}/cities`, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "X-XSRF-TOKEN": token,
            },
            body: JSON.stringify({
                name: "Bank Form China City",
                status: true,
            }),
        });
        if (!created.ok) throw new Error(await created.text());
        return { china, city: (await created.json()).data };
    });
    await expect(
        page.getByRole("heading", { name: "Bank Information", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^(New bank|Add record)$/ }).click();
    const bankForm = page.getByRole("dialog", { name: "New bank" });
    await bankForm
        .getByLabel("Bank Name", { exact: true })
        .fill("Bank Form Integration Bank");
    await bankForm.getByLabel("Short Name", { exact: true }).fill("BFIB");
    await bankForm.getByLabel("UAN", { exact: true }).fill("000400123");
    await bankForm.getByLabel("Helpline", { exact: true }).fill("00111888");
    await bankForm.getByLabel("E-Bank", { exact: true }).fill("EBANK-CHINA-07");
    await bankForm
        .getByLabel("Website", { exact: true })
        .fill("https://bank.example.test");
    await bankForm
        .getByRole("combobox", { name: "Bank Country", exact: true })
        .click();
    await page.getByRole("option", { name: /China/ }).click();
    await expect(bankForm.getByLabel(/Bank ID|SWIFT|BIC/)).toHaveCount(0);
    const fieldTops = await bankForm
        .locator(".bank-fields-grid > .company-field")
        .evaluateAll((fields) =>
            fields
                .slice(0, 3)
                .map((field) => field.getBoundingClientRect().top),
        );
    expect(Math.max(...fieldTops) - Math.min(...fieldTops)).toBeLessThan(2);
    const savingBank = page.waitForResponse(
        (response) =>
            response.url().endsWith("/api/v1/banks") &&
            response.request().method() === "POST",
    );
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    const bankResponse = await savingBank;
    expect(bankResponse.status()).toBe(201);
    const bank = (await bankResponse.json()).data;
    expect(bank.code).toMatch(/^BNK-/);
    await expect(page.getByText(bank.code, { exact: true })).toHaveCount(0);
    expect(bank).toMatchObject({
        uan: "000400123",
        help_line: "00111888",
        e_bank: "EBANK-CHINA-07",
        website: "https://bank.example.test",
        country_id: seed.china.id,
    });
    await expect(
        page.getByRole("region", { name: "Branches", exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole("region", { name: "Branch officers", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Add branch", exact: true }).click();
    const branchForm = page.getByRole("row", {
        name: "New branch",
        exact: true,
    });
    await branchForm
        .getByLabel("Branch Name", { exact: true })
        .fill("China Main Office");
    await branchForm.getByRole("button", { name: "City", exact: true }).click();
    await expect(
        branchForm
            .locator(".reference-options")
            .getByRole("button", { name: /Rawalpindi/ }),
    ).toHaveCount(0);
    await branchForm
        .locator(".reference-options")
        .getByRole("button", { name: /Bank Form China City/ })
        .click();
    await branchForm.getByLabel("Branch Code", { exact: true }).fill("0007");
    await branchForm.getByLabel("NIFT Code", { exact: true }).fill("0017");
    await branchForm
        .getByLabel("Branch Phone Numbers", { exact: true })
        .fill("000123, 000456");
    await expect(branchForm.getByLabel(/Branch ID/)).toHaveCount(0);
    const savingBranch = page.waitForResponse(
        (response) =>
            response.url().endsWith(`/api/v1/banks/${bank.id}/branches`) &&
            response.request().method() === "POST",
    );
    await page.keyboard.press("ControlOrMeta+s");
    const branchResponse = await savingBranch;
    expect(branchResponse.status()).toBe(201);
    const branch = (await branchResponse.json()).data;
    expect(branch).toMatchObject({
        bank_id: bank.id,
        city_id: seed.city.id,
        branch_code: "0007",
        nift_code: "0017",
        phone_numbers: ["000123", "000456"],
    });
    expect(branch.code).toMatch(/^BRN-/);
    await expect(page.getByText(branch.code, { exact: true })).toHaveCount(0);
    await page
        .getByRole("row", { name: "China Main Office", exact: true })
        .locator("td")
        .first()
        .click();
    await page
        .getByRole("button", { name: "Add officer", exact: true })
        .click();
    const officerForm = page.getByRole("row", {
        name: "New officer",
        exact: true,
    });
    await officerForm
        .getByRole("button", { name: "Enter a new person’s name", exact: true })
        .click();
    await officerForm
        .getByLabel("Officer Name", { exact: true })
        .fill("Bank Form Officer");
    await officerForm
        .getByLabel("Designation", { exact: true })
        .fill("Branch Manager");
    await officerForm
        .getByLabel("Officer Contact Number", { exact: true })
        .fill("000789");
    await officerForm
        .getByLabel("Officer Email Address", { exact: true })
        .fill("officer@example.test");
    const savingOfficer = page.waitForResponse(
        (response) =>
            response.url().endsWith(`/api/v1/banks/${bank.id}/officers`) &&
            response.request().method() === "POST",
    );
    await officerForm
        .getByRole("button", { name: "Save changes", exact: true })
        .focus();
    await page.keyboard.press("Enter");
    const officerResponse = await savingOfficer;
    expect(officerResponse.status()).toBe(201);
    const officer = (await officerResponse.json()).data;
    expect(officer).toMatchObject({
        bank_id: bank.id,
        bank_branch_id: branch.id,
        designation: "Branch Manager",
        contact_number: "000789",
        email: "officer@example.test",
    });
    await expect(
        page.getByText("Bank Form Officer", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("E-Bank", { exact: true })).toHaveValue(
        "EBANK-CHINA-07",
    );
    await expect(page.getByText("0017", { exact: true })).toBeVisible();
    await expect(
        page.getByText("Bank Form Officer", { exact: true }),
    ).toBeVisible();
    await page
        .getByRole("button", { name: "Edit China Main Office", exact: true })
        .click();
    const editingBranch = page.getByRole("row", {
        name: "China Main Office",
        exact: true,
    });
    await editingBranch.getByLabel("NIFT Code", { exact: true }).fill("");
    await editingBranch
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
    await expect(
        editingBranch.getByLabel("NIFT Code", { exact: true }),
    ).not.toBeVisible();
    const cleared = (
        await (
            await page.request.get(
                `/api/v1/banks/${bank.id}/branches/${branch.id}?context=management`,
            )
        ).json()
    ).data;
    expect(cleared.nift_code).toBeNull();
    expect(cleared.phone_numbers).toEqual(["000123", "000456"]);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByLabel("Helpline", { exact: true }).fill("");
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    await expect
        .poll(
            async () =>
                (
                    await (
                        await page.request.get(`/api/v1/banks/${bank.id}`)
                    ).json()
                ).data.help_line,
        )
        .toBeNull();
    await page.setViewportSize({ width: 390, height: 844 });
    await page
        .getByRole("button", { name: "Edit China Main Office", exact: true })
        .click();
    const mobile = page.getByRole("row", {
        name: "China Main Office",
        exact: true,
    });
    const layout = await mobile.evaluate((row) => ({
        height: row.getBoundingClientRect().height,
        spans: row.querySelectorAll("td[colspan]").length,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
    }));
    expect(layout.height).toBeLessThanOrEqual(50);
    expect(layout.spans).toBe(0);
    expect(layout.overflow).toBe(false);
    await page.screenshot({
        path: "test-results/bank-form-mobile.png",
        fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await mobile.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
        .getByRole("button", { name: "Delete Bank Form Officer", exact: true })
        .click();
    await page
        .getByRole("dialog", { name: "Delete officer?" })
        .getByRole("button", { name: "Delete record", exact: true })
        .click();
    await expect(
        page.getByText("Bank Form Officer", { exact: true }),
    ).toHaveCount(0);
    expect(
        (
            await page.request.get(`/api/v1/people/${officer.person_id}`)
        ).status(),
    ).toBe(200);
    await page
        .getByRole("button", { name: "Delete China Main Office", exact: true })
        .click();
    await page
        .getByRole("dialog", { name: "Delete branch?" })
        .getByRole("button", { name: "Delete record", exact: true })
        .click();
    await expect(
        page.getByText(
            "This record is referenced. Deactivate it to preserve its history.",
            { exact: true },
        ),
    ).toBeVisible();
    await page
        .getByRole("dialog", { name: "Delete branch?" })
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
    const retainedRow = page.getByRole("row", {
        name: "China Main Office",
        exact: true,
    });
    await retainedRow.locator("td").first().click();
    await retainedRow
        .getByRole("switch", { name: "Branch status", exact: true })
        .click();
    await retainedRow
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
    await expect(retainedRow.getByRole("switch")).toHaveCount(0);
    const retainedBranch = await (
        await page.request.get(
            `/api/v1/banks/${bank.id}/branches/${branch.id}?context=management`,
        )
    ).json();
    expect(retainedBranch.data.status).toBe(false);
});
