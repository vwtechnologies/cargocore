import { test, expect } from "@playwright/test";

const title = "Business Roles";
const singular = "Business Role";
const base = "/business-types";
test(`${title} use the shared master layout, keyboard selection, and persisted name/status fields`, async ({
    page,
}) => {
    page.on("pageerror", (error) => {
        throw error;
    });
    await page.goto(base);
    await expect(
        page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    const name = page.getByRole("textbox", {
        name: new RegExp(`^${singular} \\*`, "i"),
    });
    await expect(name).toHaveValue("Carry");
    await expect(name).toBeEditable();
    const table = page.getByLabel(`${title} Table Navigation`, {
        exact: true,
    });
    await table.focus();
    await page.keyboard.press("ArrowDown");
    await expect(name).toHaveValue("Small Sale");
    await page.keyboard.press("ArrowUp");
    await expect(name).toHaveValue("Carry");
    await name.fill("Unsaved carry draft");
    await table.focus();
    await page.keyboard.press("ArrowDown");
    const prompt = page.getByRole("dialog", {
        name: "Unsaved changes",
        exact: true,
    });
    await expect(prompt).toBeVisible();
    await prompt
        .getByRole("button", { name: "Keep editing", exact: true })
        .click();
    await expect(name).toHaveValue("Unsaved carry draft");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(name).toHaveValue("Carry");
    await page
        .getByRole("button", {
            name: `New ${singular.toLowerCase()}`,
            exact: true,
        })
        .click();
    const recordName = `Browser ${singular}`;
    await name.fill(recordName);
    const creation = page.waitForResponse(
        (r) =>
            r.request().method() === "POST" &&
            r.url().endsWith("/api/v1/business-types"),
    );
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    const response = await creation;
    expect(response.status()).toBe(201);
    expect(response.request().postDataJSON()).toEqual({
        name: recordName,
        status: true,
    });
    const created = (await response.json()).data;
    expect(created.code).toMatch(/^BUS-/);
    expect(created.is_employee).toBe(false);
    await expect(page).toHaveURL(`${base}/${created.id}`);
    await page.getByRole("button", { name: recordName, exact: true }).click();
    await expect(name).toBeEditable();
    await page
        .getByRole("switch", { name: `${singular} status`, exact: true })
        .click();
    await name.press("ControlOrMeta+s");
    const row = page.locator(".company-master-table tr").filter({
        has: page.getByRole("button", {
            name: recordName,
            exact: true,
        }),
    });
    await expect(
        row.getByRole("img", { name: "Inactive", exact: true }),
    ).toBeVisible();
    await expect(row.locator(".record-status-icon")).toHaveCSS(
        "color",
        "rgb(220, 38, 38)",
    );
    const lookups = await (
        await page.request.get(
            `/api/v1/business-types?id=${created.id}&context=lookup`,
        )
    ).json();
    expect(lookups.data).toEqual([]);
    await page.reload();
    await expect(name).toHaveValue(recordName);
    await expect(
        page.getByRole("switch", {
            name: `${singular} status`,
            exact: true,
        }),
    ).toHaveAttribute("aria-checked", "false");
    await page
        .getByRole("switch", { name: `${singular} status`, exact: true })
        .click();
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    await expect(
        row.getByRole("img", { name: "Active", exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
        ),
    ).toBe(true);
    await page.screenshot({
        path: "test-results/business-roles-mobile.png",
        fullPage: true,
    });
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    const deletion = page.getByRole("dialog", {
        name: `Delete ${singular}?`,
        exact: true,
    });
    await deletion
        .getByRole("button", { name: "Delete record", exact: true })
        .click();
    await expect(deletion).not.toBeVisible();
    await expect(
        page.getByRole("button", { name: recordName, exact: true }),
    ).toHaveCount(0);
});

test("dashboard and navigation keep Business Role as the only role master", async ({
    page,
}) => {
    await page.goto("/");
    await expect(
        page.getByRole("link", { name: "Bank Account", exact: true }),
    ).toHaveCount(0);
    await expect(
        page.getByRole("link", { name: "Classifications", exact: true }),
    ).toHaveCount(0);
    await expect(
        page.getByRole("link", { name: "Business Role", exact: true }),
    ).toHaveAttribute("href", "/business-types");
    await page
        .getByRole("button", { name: "Master Data", exact: true })
        .click();
    await expect(
        page.getByRole("link", { name: "Classifications", exact: true }),
    ).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page
        .getByRole("button", { name: "Open navigation", exact: true })
        .click();
    await expect(
        page
            .locator(".sidebar")
            .getByRole("link", { name: "Classifications", exact: true }),
    ).toHaveCount(0);
    await expect(
        page
            .locator(".sidebar")
            .getByRole("link", { name: "Business Roles", exact: true }),
    ).toHaveAttribute("href", "/business-types");
    await page.goto("/classifications");
    await expect(page).toHaveURL(/\/business-types\/\d+$/);
    const id = page.url().split("/").pop();
    await page.goto(`/classifications/${id}`);
    await expect(page).toHaveURL(`/business-types/${id}`);
    await expect(
        page.getByRole("heading", { name: "Business Roles", exact: true }),
    ).toBeVisible();
});
