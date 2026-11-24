import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
    vi.resetModules();
    document.body.className = "";
});

afterEach(() => vi.unstubAllGlobals());

function deferredFetch() {
    let respond: (value: Response) => void = () => {};
    const fetchMock = vi.fn(
        () =>
            new Promise<Response>((resolve) => {
                respond = resolve;
            }),
    );
    vi.stubGlobal("fetch", fetchMock);
    return {
        fetchMock,
        respond: () => respond(Response.json({ data: { id: 7 } })),
    };
}

it("sends an identical write only once while it is in flight and locks the page until it settles", async () => {
    const { fetchMock, respond } = deferredFetch();
    const { api } = await import("../../resources/js/lib/api");
    const { isSaving } = await import("../../resources/js/lib/saving");
    const body = JSON.stringify({ name: "Twin" });

    const first = api("/api/v1/banks", { method: "POST", body });
    const second = api("/api/v1/banks", { method: "POST", body });

    expect(isSaving()).toBe(true);
    expect(document.body.classList.contains("is-saving")).toBe(true);
    respond();
    expect(await first).toEqual(await second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(isSaving()).toBe(false);
    expect(document.body.classList.contains("is-saving")).toBe(false);
});

it("still sends different writes and plain reads, and only writes lock the page", async () => {
    const fetchMock = vi.fn(async () => Response.json({ data: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await import("../../resources/js/lib/api");
    const { isSaving } = await import("../../resources/js/lib/saving");

    const read = api("/api/v1/banks");
    expect(isSaving()).toBe(false);
    await read;
    await Promise.all([
        api("/api/v1/banks", { method: "POST", body: '{"name":"A"}' }),
        api("/api/v1/banks", { method: "POST", body: '{"name":"B"}' }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
});

it("releases the lock after a failed save so the user can correct and retry", async () => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
            Response.json({ message: "Invalid" }, { status: 422 }),
        ),
    );
    const { api } = await import("../../resources/js/lib/api");
    const { isSaving } = await import("../../resources/js/lib/saving");

    await expect(
        api("/api/v1/banks", { method: "POST", body: "{}" }),
    ).rejects.toThrow("Invalid");
    expect(isSaving()).toBe(false);
    expect(document.body.classList.contains("is-saving")).toBe(false);
});

it("swallows Enter and the save shortcut while a save is running", async () => {
    const { respond } = deferredFetch();
    const { api } = await import("../../resources/js/lib/api");
    const button = document.createElement("button");
    document.body.append(button);
    const pending = api("/api/v1/banks", { method: "POST", body: "{}" });

    const enter = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
    });
    const shortcut = new KeyboardEvent("keydown", {
        key: "s",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
    });
    button.dispatchEvent(enter);
    button.dispatchEvent(shortcut);
    expect(enter.defaultPrevented).toBe(true);
    expect(shortcut.defaultPrevented).toBe(true);

    respond();
    await pending;
    const later = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
    });
    button.dispatchEvent(later);
    expect(later.defaultPrevented).toBe(false);
    button.remove();
});
