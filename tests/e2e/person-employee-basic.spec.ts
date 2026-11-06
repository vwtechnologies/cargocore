import { expect, test, type Page } from "@playwright/test";

async function request(
    page: Page,
    path: string,
    method = "GET",
    body?: object,
) {
    return page.evaluate(
        async ({ path, method, body }) => {
            const token = decodeURIComponent(
                document.cookie
                    .split("; ")
                    .find((cookie) => cookie.startsWith("XSRF-TOKEN="))!
                    .slice(11),
            );
            const response = await fetch(`/api/v1/${path}`, {
                method,
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
        { path, method, body },
    );
}

test("Basic marks the current person as an employee and saves searchable active types with Save and Cancel", async ({
    page,
}) => {
    await page.goto("/people");
    await expect(page.getByLabel("Full name", { exact: true })).not.toHaveValue(
        "",
    );
    const active = (
        await request(page, "employee-types?context=lookup&per_page=100")
    ).data.slice(0, 2);
    await request(page, "employee-types", "POST", {
        name: "Inactive Basic Type",
        status: false,
    });
    await page.keyboard.press("Control+n");
    await page
        .getByLabel("Full name", { exact: true })
        .fill("Basic Employee Person");
    const employee = page.getByRole("checkbox", {
        name: "Employee",
        exact: true,
    });
    await expect(employee).not.toBeChecked();
    await employee.check();
    const selector = page.getByRole("button", {
        name: "Employee types",
        exact: true,
    });
    await selector.click();
    const search = page.getByRole("textbox", {
        name: "Search Employee types",
        exact: true,
    });
    await search.fill("Inactive Basic Type");
    await expect(
        page.getByText("No matching active records.", { exact: true }),
    ).toBeVisible();
    await expect(
        page
            .locator(".reference-options")
            .getByRole("button", { name: "INACTIVE BASIC TYPE", exact: true }),
    ).toHaveCount(0);
    for (const type of active) {
        await search.fill(type.name);
        await page
            .locator(".reference-options")
            .getByRole("button", { name: type.name, exact: true })
            .click();
    }
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(selector).toContainText("2 selected");
    const tags = page.getByRole("list", {
        name: "Selected Employee types",
        exact: true,
    });
    for (const type of active) {
        await expect(tags.getByText(type.name, { exact: true })).toBeVisible();
    }
    await tags
        .getByRole("button", { name: `Remove ${active[0].name}`, exact: true })
        .click();
    await expect(selector).toContainText("1 selected");
    await expect(tags.getByText(active[0].name, { exact: true })).toHaveCount(
        0,
    );
    await expect(tags.getByText(active[1].name, { exact: true })).toBeVisible();
    await expect(selector).toBeFocused();
    await selector.click();
    await search.fill(active[0].name);
    await page
        .locator(".reference-options")
        .getByRole("button", { name: active[0].name, exact: true })
        .click();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(tags.getByRole("listitem")).toHaveCount(2);
    const creation = page.waitForResponse(
        (response) =>
            response.url().endsWith("/api/v1/people") &&
            response.request().method() === "POST",
    );
    await page.keyboard.press("Control+s");
    const response = await creation;
    expect(response.status()).toBe(201);
    const person = (await response.json()).data;
    expect(person.is_employee).toBe(true);
    await expect(employee).toBeDisabled();
    for (const type of active)
        await expect(
            page
                .locator(".person-basic-form .value-chip")
                .filter({ hasText: type.name }),
        ).toBeVisible();
    expect(
        (
            await request(
                page,
                `people/${person.id}/associations?context=management`,
            )
        ).data,
    ).toEqual([]);
    let details = await request(page, `people/${person.id}/employee`);
    expect(details.eligible).toBe(true);
    expect(
        details.data.types.map((type: { id: number }) => type.id).sort(),
    ).toEqual(active.map((type: { id: number }) => type.id).sort());
    await page.reload();
    await expect(employee).toBeChecked();
    await page.keyboard.press("Control+e");
    await tags
        .getByRole("button", { name: `Remove ${active[0].name}`, exact: true })
        .click();
    await page
        .getByRole("button", { name: "Cancel", exact: true })
        .first()
        .click();
    await page.keyboard.press("Control+e");
    await expect(tags.getByText(active[0].name, { exact: true })).toBeVisible();
    await expect(tags.getByText(active[1].name, { exact: true })).toBeVisible();
    await tags
        .getByRole("button", { name: `Remove ${active[0].name}`, exact: true })
        .focus();
    await page.keyboard.press("Enter");
    const saveTypes = page.waitForResponse(
        (response) =>
            response.url().endsWith(`/api/v1/people/${person.id}`) &&
            response.request().method() === "PUT",
    );
    await page.keyboard.press("Control+s");
    expect((await saveTypes).status()).toBe(200);
    await page.reload();
    await expect(employee).toBeChecked();
    await page.keyboard.press("Control+e");
    await expect(tags.getByRole("listitem")).toHaveCount(1);
    await expect(tags.getByText(active[1].name, { exact: true })).toBeVisible();
    details = await request(page, `people/${person.id}/employee`);
    expect(details.data.types.map((type: { id: number }) => type.id)).toEqual([
        active[1].id,
    ]);
    await selector.click();
    await search.fill(active[0].name);
    await page
        .locator(".reference-options")
        .getByRole("button", { name: active[0].name, exact: true })
        .click();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    const restoreTypes = page.waitForResponse(
        (response) =>
            response.url().endsWith(`/api/v1/people/${person.id}`) &&
            response.request().method() === "PUT",
    );
    await page.keyboard.press("Control+s");
    expect((await restoreTypes).status()).toBe(200);
    await expect(selector).toHaveCount(0);
    await page.keyboard.press("Control+e");
    await employee.uncheck();
    await expect(selector).toHaveCount(0);
    await page
        .getByRole("button", { name: "Cancel", exact: true })
        .first()
        .click();
    await expect(employee).toBeChecked();
    await page.keyboard.press("Control+e");
    await employee.uncheck();
    const update = page.waitForResponse(
        (response) =>
            response.url().endsWith(`/api/v1/people/${person.id}`) &&
            response.request().method() === "PUT",
    );
    await page.keyboard.press("Control+s");
    expect((await update).status()).toBe(200);
    details = await request(page, `people/${person.id}/employee`);
    expect(details.eligible).toBe(false);
    expect(details.data.types).toHaveLength(2);
    await page.setViewportSize({ width: 390, height: 740 });
    await page.keyboard.press("Control+e");
    await employee.check();
    await selector.scrollIntoViewIfNeeded();
    await expect(tags.getByRole("listitem")).toHaveCount(2);
    for (const tag of await tags.getByRole("listitem").all()) {
        const bounds = await tag.boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
        const remove = await tag.getByRole("button").boundingBox();
        expect(remove!.width).toBeGreaterThanOrEqual(44);
        expect(remove!.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({
        path: "test-results/person-employee-tags-mobile.png",
    });
    await selector.click();
    await expect(search).toBeVisible();
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
        ),
    ).toBe(true);
    await page.screenshot({
        path: "test-results/person-basic-employee-mobile.png",
    });
});

test("stale employee types keep the Basic draft and require Reload and review", async ({
    page,
}) => {
    await page.goto("/people");
    const types = (
        await request(page, "employee-types?context=lookup&per_page=100")
    ).data.slice(0, 2);
    const person = (
        await request(page, "people", "POST", {
            name: "Stale Basic Employee",
            is_employee: true,
            employee: { type_ids: [types[0].id], version: 0 },
        })
    ).data;
    await page.goto(`/people/${person.id}`);
    await expect(
        page.getByRole("checkbox", { name: "Employee", exact: true }),
    ).toBeChecked();
    await page.keyboard.press("Control+e");
    const name = page.getByLabel("Full name", { exact: true });
    await name.fill("Unsaved Employee Draft");
    await page
        .getByRole("button", { name: "Employee types", exact: true })
        .click();
    await page
        .getByRole("textbox", { name: "Search Employee types", exact: true })
        .fill(types[1].name);
    await page
        .locator(".reference-options")
        .getByRole("button", { name: types[1].name, exact: true })
        .click();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await request(page, `people/${person.id}/employee`, "PUT", {
        type_ids: [types[0].id],
        salary: "12345.00",
        version: 1,
    });
    const saving = page.waitForResponse(
        (response) =>
            response.url().endsWith(`/api/v1/people/${person.id}`) &&
            response.request().method() === "PUT",
    );
    await page.keyboard.press("Control+s");
    expect((await saving).status()).toBe(409);
    await expect(name).toHaveValue("UNSAVED EMPLOYEE DRAFT");
    await expect(
        page.getByRole("button", { name: "Employee types", exact: true }),
    ).toContainText("2 selected");
    expect((await request(page, `people/${person.id}`)).data.name).toBe(
        "STALE BASIC EMPLOYEE",
    );
    await page
        .getByRole("button", { name: "Reload and review", exact: true })
        .click();
    await expect(name).toHaveValue("STALE BASIC EMPLOYEE");
    await expect(
        page.getByRole("button", { name: "Employee types", exact: true }),
    ).toContainText("1 selected");
    expect(
        (await request(page, `people/${person.id}/employee`)).data.salary,
    ).toBe("12345.00");
});
