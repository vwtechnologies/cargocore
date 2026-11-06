import React from "react";
import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
} from "@testing-library/react";
import {
    QueryClient,
    QueryClientProvider,
    focusManager,
    onlineManager,
} from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../resources/js/lib/api";
import { SessionProvider } from "../../resources/js/lib/session";
import { ApiError, type Session } from "../../resources/js/lib/types";

vi.mock("../../resources/js/lib/api", () => ({ api: vi.fn() }));

const authenticatedSession: Session = {
    user: { id: 1, name: "ALI", username: "ALI", role: "Admin" },
    permissions: [],
    companies: [],
    portal_companies: [],
    entities: {},
};

let client: QueryClient;

beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(api).mockReset();
    vi.stubGlobal("BroadcastChannel", undefined);
    focusManager.setFocused(true);
    onlineManager.setOnline(true);
    client = new QueryClient({
        defaultOptions: {
            queries: { retry: false, refetchInterval: 15000, gcTime: Infinity },
        },
    });
});

afterEach(() => {
    cleanup();
    client.clear();
    focusManager.setFocused(undefined);
    onlineManager.setOnline(true);
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

function renderSession() {
    render(
        <QueryClientProvider client={client}>
            <SessionProvider
                loading={<p>Loading session</p>}
                login={<input aria-label="Username" />}
            >
                <p>Signed in workspace</p>
            </SessionProvider>
        </QueryClientProvider>,
    );
}

async function advance(milliseconds: number) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(milliseconds);
    });
}

describe("login session stability", () => {
    it("preserves the idle login form without polling or checking again on focus and reconnect", async () => {
        vi.mocked(api).mockRejectedValue(new ApiError("Unauthenticated", 401));
        renderSession();
        await advance(1);
        const input = screen.getByRole("textbox", { name: "Username" });
        fireEvent.change(input, { target: { value: "ALI" } });

        await advance(120000);
        act(() => {
            focusManager.setFocused(false);
            focusManager.setFocused(true);
            onlineManager.setOnline(false);
            onlineManager.setOnline(true);
            window.dispatchEvent(new Event("cargocore-records-changed"));
        });
        await advance(1);

        expect(api).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("textbox", { name: "Username" })).toBe(input);
        expect(input).toHaveValue("ALI");
        expect(screen.queryByText("Loading session")).not.toBeInTheDocument();
    });

    it("can check the session after sign-in and keeps authenticated polling", async () => {
        vi.mocked(api).mockRejectedValueOnce(
            new ApiError("Unauthenticated", 401),
        );
        renderSession();
        await advance(1);
        expect(screen.getByRole("textbox", { name: "Username" })).toBeVisible();

        vi.mocked(api).mockResolvedValue(authenticatedSession);
        await act(async () => {
            await client.invalidateQueries({ queryKey: ["session"] });
        });
        await advance(1);
        expect(screen.getByText("Signed in workspace")).toBeVisible();

        await advance(15000);
        expect(api).toHaveBeenCalledTimes(3);
        expect(screen.getByText("Signed in workspace")).toBeVisible();
    });

    it("stops polling once an authenticated session expires", async () => {
        vi.mocked(api)
            .mockResolvedValueOnce(authenticatedSession)
            .mockRejectedValue(new ApiError("Unauthenticated", 401));
        renderSession();
        await advance(1);
        expect(screen.getByText("Signed in workspace")).toBeVisible();

        await advance(15001);
        const input = screen.getByRole("textbox", { name: "Username" });
        fireEvent.change(input, { target: { value: "ALI" } });
        await advance(60000);

        expect(api).toHaveBeenCalledTimes(2);
        expect(screen.getByRole("textbox", { name: "Username" })).toBe(input);
        expect(input).toHaveValue("ALI");
    });

    it("returns directly to a stable login form when another request reports session expiry", async () => {
        vi.mocked(api).mockResolvedValue(authenticatedSession);
        renderSession();
        await advance(1);
        client.setQueryData(["banks"], { data: [{ id: 1 }] });

        act(() => window.dispatchEvent(new Event("session-expired")));
        await advance(1);
        const input = screen.getByRole("textbox", { name: "Username" });
        fireEvent.change(input, { target: { value: "ALI" } });
        await advance(60000);

        expect(client.getQueryData(["banks"])).toBeUndefined();
        expect(api).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("textbox", { name: "Username" })).toBe(input);
        expect(input).toHaveValue("ALI");
    });
});
