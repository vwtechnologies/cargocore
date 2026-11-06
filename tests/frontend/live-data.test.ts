import { afterEach, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { api } from "../../resources/js/lib/api";
import { subscribeToRecordChanges } from "../../resources/js/lib/live-data";

afterEach(() => vi.unstubAllGlobals());

it("refreshes mounted lists and removes cached unmounted lookups only after successful writes", async () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    let active = true;
    const observer = new QueryObserver(client, {
        queryKey: ["banks"],
        queryFn: async () => ({
            data: active ? [{ id: 1, name: "Bank" }] : [],
        }),
    });
    const stopObserver = observer.subscribe(() => {});
    await observer.refetch();
    client.setQueryData(["lookup", "countries"], { data: [{ id: 2 }] });
    const stopChanges = subscribeToRecordChanges(client);
    vi.stubGlobal(
        "fetch",
        vi
            .fn()
            .mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ data: { status: false } }),
            }),
    );
    active = false;
    await api("/api/v1/banks/1");
    expect(client.getQueryData(["lookup", "countries"])).toBeDefined();
    await api("/api/v1/banks/1", { method: "PUT" });
    await vi.waitFor(() =>
        expect(observer.getCurrentResult().data?.data).toEqual([]),
    );
    expect(client.getQueryData(["lookup", "countries"])).toBeUndefined();
    client.setQueryData(["lookup", "countries"], { data: [] });
    vi.stubGlobal(
        "fetch",
        vi
            .fn()
            .mockResolvedValue({
                ok: false,
                status: 422,
                json: async () => ({ message: "Invalid" }),
            }),
    );
    await expect(api("/api/v1/banks/1", { method: "PUT" })).rejects.toThrow(
        "Invalid",
    );
    expect(client.getQueryData(["lookup", "countries"])).toBeDefined();
    stopChanges();
    stopObserver();
    client.clear();
});
