import { test, expect } from "@playwright/test";

test("country deactivation refreshes an open place selector across tabs without discarding a personal draft", async ({
    page,
    context,
}) => {
    await page.goto("/countries");
    const countries = (
        await (await page.request.get("/api/v1/countries?per_page=100")).json()
    ).data;
    const pakistan = countries.find(
        (country: { name: string }) => country.name === "Pakistan",
    );
    const people = (
        await (
            await page.request.get("/api/v1/people?search=Ahmed%20Hassan")
        ).json()
    ).data;
    const observer = await context.newPage();
    await observer.goto(`/people/${people[0].id}`);
    await observer.getByRole("button", { name: "Edit", exact: true }).click();
    await observer
        .getByLabel("Full name", { exact: true })
        .fill("Unsaved personal name");
    await observer.getByRole("button", { name: "Place", exact: true }).click();
    const options = observer.locator(".reference-options");
    await options
        .getByRole("button", { name: "Rawalpindi", exact: true })
        .click();
    await observer.getByRole("button", { name: "Place", exact: true }).click();
    let loads = 0;
    observer.on("request", (request) => {
        if (
            request.isNavigationRequest() &&
            request.resourceType() === "document"
        )
            loads++;
    });
    await page.goto(`/countries/${pakistan.id}`);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page
        .getByRole("switch", { name: "Country status", exact: true })
        .click();
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    await expect(
        options.getByRole("button", { name: "Rawalpindi", exact: true }),
    ).toHaveCount(0);
    await expect(
        observer.getByRole("button", { name: "Place", exact: true }),
    ).not.toContainText("Rawalpindi");
    await expect(observer.getByLabel("Full name", { exact: true })).toHaveValue(
        "Unsaved personal name",
    );
    await expect(
        page.getByRole("button", { name: "Pakistan", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page
        .getByRole("switch", { name: "Country status", exact: true })
        .click();
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    await expect(
        options.getByRole("button", { name: "Rawalpindi", exact: true }),
    ).toBeVisible();
    expect(loads).toBe(0);
    await observer.close();
});
