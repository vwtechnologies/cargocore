import { test, expect } from "@playwright/test";

test("employee types use only name and status through create, edit, lists, and delete", async ({
    page,
}) => {
    await page.goto("/employee-types");
    await expect(page.locator(".company-master-table th")).toHaveText([
        "EMPLOYEE TYPE",
        "STATUS",
    ]);
    await page
        .getByRole("button", { name: /^(Add record|New employee type)$/ })
        .click();
    const form = page.getByRole("dialog", {
        name: "New employee type",
        exact: true,
    });
    await expect(form.locator("input")).toHaveCount(1);
    await expect(form.locator("textarea")).toHaveCount(0);
    const name = page.getByRole("textbox", { name: /^Employee Type/i });
    await expect(name).toBeFocused();
    await name.fill("Browser Dispatch Supervisor");
    const creation = page.waitForResponse(
        (response) =>
            response.url().endsWith("/api/v1/employee-types") &&
            response.request().method() === "POST",
    );
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    const createdResponse = await creation;
    expect(createdResponse.status()).toBe(201);
    expect(
        Object.keys(createdResponse.request().postDataJSON()).sort(),
    ).toEqual(["name", "status"]);
    const record = (await createdResponse.json()).data;
    expect(record.code).toMatch(/^EMP-[0-9]+$/);
    await expect(form).not.toBeVisible();
    await expect(name).toHaveValue("Browser Dispatch Supervisor");
    await expect(page.getByText(record.code, { exact: true })).toHaveCount(0);
    await page.reload();
    await expect(name).toHaveValue("Browser Dispatch Supervisor");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await name.fill("Browser Warehouse Supervisor");
    await page
        .getByRole("switch", { name: "Employee type status", exact: true })
        .click();
    const updating = page.waitForResponse(
        (response) =>
            response.url().endsWith(`/api/v1/employee-types/${record.id}`) &&
            response.request().method() === "PUT",
    );
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    expect((await updating).status()).toBe(200);
    await expect(
        page.getByRole("button", {
            name: "Browser Warehouse Supervisor",
            exact: true,
        }),
    ).toBeVisible();
    expect(
        (
            await page.request.get(`/api/v1/employee-types/${record.id}`)
        ).status(),
    ).toBe(404);
    await page
        .getByRole("button", { name: "View all employee types", exact: true })
        .click();
    const directory = page.locator(".view-all-table");
    await expect(directory.locator("th")).toHaveText([
        "EMPLOYEE TYPE",
        "STATUS",
    ]);
    await expect(
        directory.getByText("Browser Warehouse Supervisor", { exact: true }),
    ).toBeVisible();
    await expect(directory.getByText(record.code, { exact: true })).toHaveCount(
        0,
    );
    await page.keyboard.press("Escape");
    await page.screenshot({
        path: "test-results/employee-types-desktop.png",
        fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
        await page
            .locator(".company-master-table")
            .evaluate(
                (table) =>
                    table.getBoundingClientRect().width <=
                    table.parentElement!.clientWidth + 1,
            ),
    ).toBe(true);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page
        .getByRole("switch", { name: "Employee type status", exact: true })
        .click();
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    await expect(
        page.getByRole("switch", { name: "Employee type status", exact: true }),
    ).toBeDisabled();
    await expect(
        page.getByRole("switch", { name: "Employee type status", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
        ),
    ).toBe(false);
    await page.screenshot({
        path: "test-results/employee-types-mobile.png",
        fullPage: true,
    });
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    const deletion = page.getByRole("dialog");
    await expect(deletion.getByText(record.code, { exact: false })).toHaveCount(
        0,
    );
    const deleting = page.waitForResponse(
        (response) =>
            response.url().endsWith(`/api/v1/employee-types/${record.id}`) &&
            response.request().method() === "DELETE",
    );
    await deletion
        .getByRole("button", { name: "Delete record", exact: true })
        .click();
    expect((await deleting).status()).toBe(204);
    await expect(deletion).not.toBeVisible();
    await expect(
        page.getByRole("button", {
            name: "Browser Warehouse Supervisor",
            exact: true,
        }),
    ).toHaveCount(0);
});

test("person employee classifications show names without internal type codes", async ({
    page,
}) => {
    const people = (
        await (
            await page.request.get("/api/v1/people?search=Usman%20Ali")
        ).json()
    ).data;
    await page.goto(`/people/${people[0].id}`);
    await page
        .getByRole("tab", { name: "Company Associations", exact: true })
        .click();
    await page
        .getByRole("button", { name: "Edit details", exact: true })
        .click();
    await page.locator("#employee-types").click();
    const options = page.locator(".reference-options");
    await expect(
        options.getByRole("button", { name: "Managing Director", exact: true }),
    ).toBeVisible();
    await expect(options.locator("small")).toHaveCount(0);
    await page.screenshot({
        path: "test-results/employee-classification-names.png",
    });
});
