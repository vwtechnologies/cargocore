import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { money } from "../../resources/js/lib/api";
describe("PKR presentation", () => {
    it("preserves fixed-precision amounts beyond the JavaScript safe-integer range", () => {
        expect(money("99999999999999999.99")).toBe(
            "PKR 99,999,999,999,999,999.99",
        );
        expect(money("-0.05")).toBe("PKR -0.05");
        expect(money(null)).toBe("—");
    });
});

describe("CSRF session recovery", () => {
    beforeEach(() => {
        vi.resetModules();
        document.cookie = "XSRF-TOKEN=; Max-Age=0; path=/";
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("uses the refreshed session token instead of a conflicting XSRF cookie", async () => {
        document.cookie = "XSRF-TOKEN=stale-cookie; path=/";
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                Response.json({ token: "current-session-token" }),
            )
            .mockResolvedValueOnce(Response.json({ success: true }));
        vi.stubGlobal("fetch", fetchMock);
        const { api, csrf } = await import("../../resources/js/lib/api");

        await csrf();
        await api("/login", {
            method: "POST",
            body: JSON.stringify({ username: "ALI" }),
        });

        expect(fetchMock.mock.calls[0]).toEqual([
            "/csrf-token",
            expect.objectContaining({
                cache: "no-store",
                credentials: "same-origin",
            }),
        ]);
        const headers = fetchMock.mock.calls[1][1].headers as Headers;
        expect(headers.get("X-CSRF-TOKEN")).toBe("current-session-token");
        expect(headers.has("X-XSRF-TOKEN")).toBe(false);
    });

    it("refreshes an expired session and retries the rejected request once", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                Response.json(
                    { message: "CSRF token mismatch." },
                    { status: 419 },
                ),
            )
            .mockResolvedValueOnce(Response.json({ token: "refreshed-token" }))
            .mockResolvedValueOnce(Response.json({ success: true }));
        vi.stubGlobal("fetch", fetchMock);
        const { api } = await import("../../resources/js/lib/api");
        const body = JSON.stringify({
            username: "ALI",
            password: "test-password",
        });

        await expect(api("/login", { method: "POST", body })).resolves.toEqual({
            success: true,
        });

        expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
            "/login",
            "/csrf-token",
            "/login",
        ]);
        expect(fetchMock.mock.calls[2][1].body).toBe(body);
        expect(
            (fetchMock.mock.calls[2][1].headers as Headers).get("X-CSRF-TOKEN"),
        ).toBe("refreshed-token");
    });

    it("stops after a second CSRF rejection", async () => {
        const rejection = () =>
            Response.json({ message: "CSRF token mismatch." }, { status: 419 });
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(rejection())
            .mockResolvedValueOnce(Response.json({ token: "refreshed-token" }))
            .mockResolvedValueOnce(rejection());
        vi.stubGlobal("fetch", fetchMock);
        const { api } = await import("../../resources/js/lib/api");

        await expect(
            api("/login", { method: "POST", body: "{}" }),
        ).rejects.toMatchObject({ status: 419 });
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("does not retry incorrect passwords or other validation failures", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                Response.json(
                    { message: "Incorrect password" },
                    { status: 422 },
                ),
            );
        vi.stubGlobal("fetch", fetchMock);
        const { api } = await import("../../resources/js/lib/api");

        await expect(
            api("/login", { method: "POST", body: "{}" }),
        ).rejects.toMatchObject({ status: 422 });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("does not retry a write if the token refresh fails", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                Response.json(
                    { message: "CSRF token mismatch." },
                    { status: 419 },
                ),
            )
            .mockResolvedValueOnce(
                Response.json(
                    { message: "Server unavailable" },
                    { status: 503 },
                ),
            );
        vi.stubGlobal("fetch", fetchMock);
        const { api } = await import("../../resources/js/lib/api");

        await expect(
            api("/login", { method: "POST", body: "{}" }),
        ).rejects.toMatchObject({ status: 503 });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
