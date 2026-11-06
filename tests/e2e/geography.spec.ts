import { test, expect } from "@playwright/test";

test("country fields share one desktop row and city fields persist with responsive wrapping", async ({
    page,
}) => {
    page.on("pageerror", (error) => {
        throw error;
    });
    await page.goto("/countries");
    await expect(
        page.getByRole("combobox", { name: "Display Order", exact: true }),
    ).toBeDisabled();
    await page
        .getByRole("button", { name: "Add record", exact: true })
        .first()
        .click();
    const countryCard = page.getByRole("dialog", { name: "New country" });
    await expect(
        countryCard.getByRole("combobox", {
            name: "Display Order",
            exact: true,
        }),
    ).toBeEnabled();
    await expect(
        countryCard.getByLabel("Country Name", { exact: true }),
    ).toBeVisible();
    await expect(
        countryCard.getByLabel("Short Name", { exact: true }),
    ).toBeVisible();
    await expect(
        countryCard.getByLabel("Display Order", { exact: true }),
    ).toBeVisible();
    await expect(
        countryCard.getByLabel(/Country ID|Currency|Dial Code|ISO Code/),
    ).toHaveCount(0);
    await countryCard
        .getByLabel("Country Name", { exact: true })
        .fill("Geography Browser Country");
    await countryCard.getByLabel("Short Name", { exact: true }).fill("GBC");
    await countryCard
        .getByRole("combobox", { name: "Display Order", exact: true })
        .selectOption("2");
    const desktopBoxes = await countryCard
        .locator(".country-primary-fields > .company-field")
        .evaluateAll((inputs) =>
            inputs.map((input) => ({
                top: input.getBoundingClientRect().top,
                width: input.getBoundingClientRect().width,
            })),
        );
    expect(desktopBoxes).toHaveLength(4);
    expect(
        Math.max(...desktopBoxes.map((box) => box.top)) -
            Math.min(...desktopBoxes.map((box) => box.top)),
    ).toBeLessThan(2);
    const savedCountry = page.waitForResponse(
        (response) =>
            response.url().endsWith("/api/v1/countries") &&
            response.request().method() === "POST",
    );
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    const country = (await (await savedCountry).json()).data;
    expect(country.code).toMatch(/^CTY-/);
    await expect(page.getByLabel("Country Name", { exact: true })).toHaveValue(
        "Geography Browser Country",
    );
    await page
        .getByRole("button", { name: "Add record", exact: true })
        .last()
        .click();
    const editor = page.locator(".editable-detail-table tr[data-editing]");
    await expect(editor.getByLabel(/City Code/)).toHaveCount(0);
    await editor.getByLabel("City Name", { exact: true }).fill("River City");
    await editor.getByLabel("Short Name 1", { exact: true }).fill("RC");
    await editor.getByLabel("Short Name 2", { exact: true }).fill("RIVER");
    const savedCity = page.waitForResponse(
        (response) =>
            response.url().endsWith(`/api/v1/countries/${country.id}/cities`) &&
            response.request().method() === "POST",
    );
    await editor
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
    const city = (await (await savedCity).json()).data;
    expect(city.code).toMatch(/^CIT-/);
    expect(city.country_id).toBe(country.id);
    expect(city.status).toBe(true);
    const cityRow = page
        .getByRole("grid", { name: "Cities", exact: true })
        .getByRole("row", { name: "River City", exact: true });
    await expect(cityRow.getByText("RC", { exact: true })).toBeVisible();
    await expect(cityRow.getByText("RIVER", { exact: true })).toBeVisible();
    await expect(cityRow.getByText("Active", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Display Order", { exact: true })).toHaveValue(
        "2",
    );
    await cityRow
        .getByRole("button", { name: "Edit River City", exact: true })
        .click();
    await editor.getByLabel("Short Name 1", { exact: true }).fill("");
    await editor.getByLabel("Short Name 2", { exact: true }).fill("");
    await page.setViewportSize({ width: 390, height: 844 });
    await editor
        .getByLabel("City Name", { exact: true })
        .scrollIntoViewIfNeeded();
    const wrapped = await editor.evaluate((element) => ({
        height: element.getBoundingClientRect().height,
        spans: element.querySelectorAll("td[colspan]").length,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
    }));
    expect(wrapped.height).toBeLessThanOrEqual(50);
    expect(wrapped.spans).toBe(0);
    expect(wrapped.overflow).toBe(false);
    await page.screenshot({
        path: "test-results/geography-mobile.png",
        fullPage: true,
    });
    await editor
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
    await expect(editor).not.toBeVisible();
    await expect(cityRow.getByText("Active", { exact: true })).toBeVisible();
    const persistedCity = await (
        await page.request.get(
            `/api/v1/countries/${country.id}/cities/${city.id}`,
        )
    ).json();
    expect(persistedCity.data.short_name_1).toBeNull();
    expect(persistedCity.data.short_name_2).toBeNull();
    expect(persistedCity.data.code).toBe(city.code);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page
        .getByRole("combobox", { name: "Display Order", exact: true })
        .selectOption("1");
    await page
        .getByRole("switch", { name: "Country status", exact: true })
        .click();
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    await expect(page).toHaveURL(new RegExp(`/countries/${country.id}$`));
    await expect(page.getByLabel("Country Name", { exact: true })).toHaveValue(
        "Geography Browser Country",
    );
    await expect(
        page.getByRole("switch", { name: "Country status", exact: true }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
        (await page.request.get(`/api/v1/countries/${country.id}`)).status(),
    ).toBe(404);
    await page.reload();
    await expect(page.getByLabel("Country Name", { exact: true })).toHaveValue(
        "Geography Browser Country",
    );
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page
        .getByRole("switch", { name: "Country status", exact: true })
        .click();
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    await expect(
        page.getByRole("switch", { name: "Country status", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await expect
        .poll(async () =>
            (
                await page.request.get(`/api/v1/countries/${country.id}`)
            ).status(),
        )
        .toBe(200);
});
