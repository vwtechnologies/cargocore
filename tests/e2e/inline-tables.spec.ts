import { test, expect } from "@playwright/test";

test("cities edit in their cells, retain drafts across arrow navigation, and create beneath headers", async ({
    page,
}) => {
    page.on("pageerror", (error) => {
        throw error;
    });
    await page.goto("/countries");
    await page.getByRole("button", { name: "Pakistan", exact: true }).click();
    const grid = page.getByRole("grid", { name: "Cities", exact: true });
    const first = grid.getByRole("row", { name: /^Rawalpindi$/i, exact: true });
    const second = grid.getByRole("row", { name: /^Islamabad$/i, exact: true });
    const before = (await first.boundingBox())!.height;
    await first.locator("td").first().click();
    await expect(first.getByLabel("City Name", { exact: true })).toBeFocused();
    expect((await first.boundingBox())!.height).toBeLessThanOrEqual(before + 2);
    await expect(first.locator("td[colspan]")).toHaveCount(0);
    await expect(first.locator("td")).toHaveCount(5);
    await first.getByLabel("Short Name 1", { exact: true }).fill("RWP-DRAFT");
    await first.getByLabel("Short Name 1", { exact: true }).press("ArrowDown");
    await expect(
        second.getByLabel("Short Name 1", { exact: true }),
    ).toBeFocused();
    await second.getByLabel("Short Name 1", { exact: true }).fill("ISB-DRAFT");
    await second.getByLabel("Short Name 1", { exact: true }).press("ArrowUp");
    await expect(first.getByLabel("Short Name 1", { exact: true })).toHaveValue(
        "RWP-DRAFT",
    );
    await first
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
    await expect(first.locator("input")).toHaveCount(0);
    await expect(first).toContainText("RWP-DRAFT");
    await second.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(second).toContainText("ISB");
    await expect(second).not.toContainText("ISB-DRAFT");
    await grid.getByRole("columnheader", { name: /City Name/i }).click();
    const createdRow = grid.getByRole("row", { name: "New city", exact: true });
    await expect(grid.locator("tbody tr").first()).toHaveAttribute(
        "data-row-key",
        "new",
    );
    await expect(
        createdRow.getByLabel("City Name", { exact: true }),
    ).toBeFocused();
    await createdRow
        .getByLabel("City Name", { exact: true })
        .fill("Inline Header City");
    await createdRow
        .getByLabel("City Name", { exact: true })
        .press("ArrowRight");
    await expect(
        createdRow.getByLabel("Short Name 1", { exact: true }),
    ).toBeFocused();
    await createdRow.getByLabel("Short Name 1", { exact: true }).fill("IHC");
    await createdRow.getByRole("switch", { name: "City Status" }).click();
    await createdRow
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
    const saved = grid.getByRole("row", {
        name: "INLINE HEADER CITY",
        exact: true,
    });
    await expect(saved).toContainText("IHC");
    await expect(saved).toContainText("Inactive");
    const remove = saved.getByRole("button", {
        name: "Remove INLINE HEADER CITY",
        exact: true,
    });
    await expect(remove.locator("svg")).toHaveAttribute("data-prefix", "fas");
    await expect(remove).toHaveCSS("color", "rgb(163, 76, 76)");
    await page.screenshot({
        path: "test-results/cities-inline-table.png",
        fullPage: true,
    });
    await remove.click();
    await page
        .getByRole("dialog", { name: "Delete City", exact: true })
        .getByRole("button", { name: "Delete record", exact: true })
        .click();
    await expect(saved).not.toBeVisible();
});

test("branches and officers use compact rows while preserving their links and full fields", async ({
    page,
}) => {
    page.on("pageerror", (error) => {
        throw error;
    });
    await page.goto("/banks");
    const grid = page.getByRole("grid", { name: "Branches", exact: true });
    const first = grid.getByRole("row", {
        name: "Rawalpindi Main Branch",
        exact: true,
    });
    const second = grid.getByRole("row", {
        name: "Islamabad Main Branch",
        exact: true,
    });
    const before = (await first.boundingBox())!.height;
    await first.locator("td").first().click();
    const name = first.getByLabel("Branch Name", { exact: true });
    await expect(name).toBeFocused();
    expect((await first.boundingBox())!.height).toBeLessThanOrEqual(before + 2);
    await name.fill("Rawalpindi branch draft");
    await name.press("ArrowDown");
    await expect(
        second.getByLabel("Branch Name", { exact: true }),
    ).toBeFocused();
    await second.getByLabel("Branch Name", { exact: true }).press("ArrowUp");
    await expect(name).toHaveValue("RAWALPINDI BRANCH DRAFT");
    await first.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(first).toContainText("Rawalpindi Main Branch");
    await grid.getByRole("columnheader", { name: /Branch Name/i }).click();
    const row = grid.getByRole("row", { name: "New branch", exact: true });
    await expect(row.locator("td[colspan]")).toHaveCount(0);
    await expect(row.locator("td")).toHaveCount(8);
    await row
        .getByLabel("Branch Name", { exact: true })
        .fill("Inline Karachi Branch");
    await row.getByRole("button", { name: "City", exact: true }).click();
    await row
        .locator(".reference-options")
        .getByRole("button", { name: "Karachi", exact: true })
        .click();
    await row.getByLabel("Branch Code", { exact: true }).fill("0099");
    await row.getByLabel("NIFT Code", { exact: true }).fill("0019");
    await row
        .getByLabel("Branch Phone Numbers", { exact: true })
        .fill("000123, 000456");
    await row
        .getByLabel("Branch Address", { exact: true })
        .fill("Harbour Road");
    const creating = page.waitForResponse(
        (response) =>
            response.request().method() === "POST" &&
            /\/branches$/.test(response.url()),
    );
    await row
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
    const response = await creating;
    expect(response.status()).toBe(201);
    const branch = (await response.json()).data;
    expect(branch.phone_numbers).toEqual(["000123", "000456"]);
    expect(branch.address).toBe("HARBOUR ROAD");
    const officers = page.getByRole("grid", { name: "Officers", exact: true });
    await officers.getByRole("columnheader", { name: /Officer Name/i }).click();
    const officer = officers.getByRole("row", {
        name: "New officer",
        exact: true,
    });
    await officer
        .getByRole("button", { name: "Enter a new person’s name", exact: true })
        .click();
    await officer
        .getByLabel("Officer Name", { exact: true })
        .fill("Inline Branch Officer");
    await officer
        .getByLabel("Designation", { exact: true })
        .fill("Relationship Manager");
    await officer
        .getByLabel("Officer Contact Number", { exact: true })
        .fill("03001234567");
    await officer
        .getByLabel("Officer Email Address", { exact: true })
        .fill("inline@example.test");
    const assigning = page.waitForResponse(
        (response) =>
            response.request().method() === "POST" &&
            /\/officers$/.test(response.url()),
    );
    await officer
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
    const assignment = (await (await assigning).json()).data;
    expect(assignment.bank_branch_id).toBe(branch.id);
    expect(assignment.person_id).toBeGreaterThan(0);
    await expect(
        officers.getByRole("row", {
            name: "INLINE BRANCH OFFICER",
            exact: true,
        }),
    ).toContainText("RELATIONSHIP MANAGER");
    await page.setViewportSize({ width: 390, height: 844 });
    await grid
        .getByRole("row", { name: "INLINE KARACHI BRANCH", exact: true })
        .locator("td")
        .first()
        .click();
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
        ),
    ).toBe(false);
    await page.screenshot({
        path: "test-results/branches-inline-mobile.png",
        fullPage: true,
    });
});

test("contact records use the shared row editor and preserve saved values on cancel", async ({
    page,
}) => {
    const people = (
        await (
            await page.request.get("/api/v1/people?search=Ahmed%20Hassan")
        ).json()
    ).data;
    await page.goto(`/people/${people[0].id}`);
    await page.getByRole("tab", { name: "Contacts", exact: true }).click();
    const grid = page.getByRole("grid", {
        name: "Contact Information",
        exact: true,
    });
    await expect(grid.getByRole("columnheader", { name: /LABEL/ })).toHaveCount(
        0,
    );
    await grid
        .getByRole("columnheader", {
            name: "Add contact: Address",
            exact: true,
        })
        .click();
    const row = grid.getByRole("row", { name: "New contact", exact: true });
    await expect(row.getByLabel("Label", { exact: true })).toHaveCount(0);
    await expect(row.getByLabel("Address", { exact: true })).toBeFocused();
    await row
        .getByLabel("Address", { exact: true })
        .fill("Inline Contact Office");
    await row.getByLabel("Phone Number", { exact: true }).fill("051100100");
    await row.getByLabel("Mobile Number", { exact: true }).fill("0300000000");
    await row
        .getByLabel("Email Address", { exact: true })
        .fill("inline-contact@example.test");
    await expect(row.getByLabel("Email Address", { exact: true })).toHaveValue(
        "INLINE-CONTACT@EXAMPLE.TEST",
    );
    await row
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
    const saved = grid.getByRole("row", {
        name: "INLINE CONTACT OFFICE",
        exact: true,
    });
    await expect(saved).toContainText("051100100");
    await saved.locator('td[data-column="phone"]').click();
    await saved.getByLabel("Phone Number", { exact: true }).fill("UNSAVED");
    await saved.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(saved.getByLabel("Phone Number", { exact: true })).toHaveCount(
        0,
    );
    await expect(saved).toContainText("051100100");
    await expect(saved).not.toContainText("UNSAVED");
    await saved.locator('td[data-column="phone"]').click();
    await saved.getByLabel("Phone Number", { exact: true }).fill("051222000");
    await saved
        .getByLabel("Phone Number", { exact: true })
        .press("ControlOrMeta+s");
    await expect(saved.locator("input")).toHaveCount(0);
    await expect(saved).toContainText("051222000");
    await page.reload();
    await page.getByRole("tab", { name: "Contacts", exact: true }).click();
    await expect(saved).toContainText("051222000");
    await expect(saved).toContainText("INLINE-CONTACT@EXAMPLE.TEST");
    await page.screenshot({
        path: "test-results/contact-inline-table.png",
        fullPage: true,
    });
});

test("stale row edits keep their draft and explicitly reload the newest version", async ({
    page,
}) => {
    await page.goto("/countries");
    await page.getByRole("button", { name: "Pakistan", exact: true }).click();
    const row = page
        .getByRole("grid", { name: "Cities", exact: true })
        .getByRole("row", { name: /^Rawalpindi$/i, exact: true });
    const cityId = await row.getAttribute("data-row-key");
    await row.locator("td").first().click();
    await row
        .getByLabel("City Name", { exact: true })
        .fill("Unsaved stale city");
    await page.evaluate(async (cityId) => {
        const countryId = location.pathname.split("/").pop();
        const endpoint = `/api/v1/countries/${countryId}/cities/${cityId}`;
        const token = decodeURIComponent(
            document.cookie
                .split("; ")
                .find((cookie) => cookie.startsWith("XSRF-TOKEN="))!
                .slice(11),
        );
        const record = (
            await (
                await fetch(`${endpoint}?context=management`, {
                    headers: { Accept: "application/json" },
                })
            ).json()
        ).data;
        const response = await fetch(endpoint, {
            method: "PUT",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "X-XSRF-TOKEN": token,
            },
            body: JSON.stringify({ ...record, short_name_2: "LATEST" }),
        });
        if (!response.ok) throw new Error(await response.text());
    }, cityId);
    await row
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
    await expect(
        row.getByRole("button", { name: "Reload and review", exact: true }),
    ).toBeVisible();
    await expect(row.getByLabel("City Name", { exact: true })).toHaveValue(
        "UNSAVED STALE CITY",
    );
    await row
        .getByRole("button", { name: "Reload and review", exact: true })
        .click();
    await expect(row.getByLabel("City Name", { exact: true })).toHaveValue(
        "RAWALPINDI",
    );
    await expect(row.getByLabel("Short Name 2", { exact: true })).toHaveValue(
        "LATEST",
    );
    await expect(
        row.getByRole("button", { name: "Save changes", exact: true }),
    ).toBeEnabled();
    await row.getByLabel("Short Name 1", { exact: true }).fill("REVIEWED");
    await expect(row.getByLabel("Short Name 1", { exact: true })).toHaveValue(
        "REVIEWED",
    );
    await row
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
    await expect(row.locator("input")).toHaveCount(0);
    await expect(row).toContainText("REVIEWED");
    await expect(row).toContainText("LATEST");
});
