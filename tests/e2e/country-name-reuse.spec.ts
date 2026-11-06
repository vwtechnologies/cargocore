import { test, expect } from "@playwright/test";

test("a deleted United Kingdom can be created again through the country form", async ({
    page,
}) => {
    await page.goto("/");
    const deletedId = await page.evaluate(async () => {
        const token = decodeURIComponent(
            document.cookie
                .split("; ")
                .find((cookie) => cookie.startsWith("XSRF-TOKEN="))!
                .slice(11),
        );
        const headers = {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-XSRF-TOKEN": token,
        };
        const created = await fetch("/api/v1/countries", {
            method: "POST",
            headers,
            body: JSON.stringify({
                name: "United Kingdom",
                short_name: "UK",
                display_sequence: 3,
                status: true,
            }),
        });
        if (!created.ok) throw new Error(await created.text());
        const country = (await created.json()).data;
        const removed = await fetch(`/api/v1/countries/${country.id}`, {
            method: "DELETE",
            headers,
            body: JSON.stringify({ version: country.version }),
        });
        if (!removed.ok) throw new Error(await removed.text());
        return country.id;
    });
    await page.goto("/countries");
    await expect(
        page.getByRole("button", { name: "United Kingdom", exact: true }),
    ).toHaveCount(0);
    await page
        .getByRole("button", { name: "Add record", exact: true })
        .first()
        .click();
    const form = page.getByRole("dialog", { name: "New country" });
    await form
        .getByLabel("Country Name", { exact: true })
        .fill("United Kingdom");
    await form.getByLabel("Short Name", { exact: true }).fill("UK");
    await form
        .getByRole("combobox", { name: "Display Order", exact: true })
        .selectOption("3");
    const saving = page.waitForResponse(
        (response) =>
            response.url().endsWith("/api/v1/countries") &&
            response.request().method() === "POST",
    );
    await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
    const saved = await saving;
    expect(saved.status()).toBe(201);
    const replacement = (await saved.json()).data;
    expect(replacement.id).not.toBe(deletedId);
    await expect(page.getByLabel("Country Name", { exact: true })).toHaveValue(
        "United Kingdom",
    );
    await expect(
        page.getByRole("button", { name: "United Kingdom", exact: true }),
    ).toBeVisible();
    await expect(
        page.getByText("The name has already been taken.", { exact: true }),
    ).toHaveCount(0);
    expect(
        (
            await page.request.get(
                `/api/v1/countries/${deletedId}?context=management`,
            )
        ).status(),
    ).toBe(404);
});
