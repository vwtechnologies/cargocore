import React, { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReferenceSelect } from "../../resources/js/components/ReferenceSelect";

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

it("removes a selected bank when its country changes, without restoring it from an unfiltered record cache", async () => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const requests: string[] = [];
    vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
            requests.push(url);
            const country = new URL(url, "http://localhost").searchParams.get(
                "country_id",
            );
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    data:
                        country === "1"
                            ? [
                                  {
                                      id: 9,
                                      name: "China Bank",
                                      status: true,
                                      version: 1,
                                  },
                              ]
                            : [],
                    meta: { total: country === "1" ? 1 : 0 },
                }),
            };
        }),
    );
    client.setQueryData(["record", "banks", 9], {
        data: { id: 9, name: "China Bank", status: true },
    });
    function Selection({ country }: { country: number }) {
        const [value, setValue] = useState<unknown>(9);
        return (
            <>
                <ReferenceSelect
                    entity="banks"
                    value={value}
                    onChange={setValue}
                    filters={{ country_id: country }}
                    label="Bank"
                />
                <output data-testid="selection">{String(value)}</output>
            </>
        );
    }
    const { rerender } = render(
        <QueryClientProvider client={client}>
            <Selection country={1} />
        </QueryClientProvider>,
    );
    await vi.waitFor(() =>
        expect(screen.getByRole("button", { name: "Bank" })).toHaveTextContent(
            "China Bank",
        ),
    );
    rerender(
        <QueryClientProvider client={client}>
            <Selection country={2} />
        </QueryClientProvider>,
    );
    await vi.waitFor(() =>
        expect(screen.getByTestId("selection")).toHaveTextContent("null"),
    );
    expect(screen.getByRole("button", { name: "Bank" })).not.toHaveTextContent(
        "China Bank",
    );
    expect(
        requests.some(
            (url) => url.includes("country_id=2") && url.includes("id=9"),
        ),
    ).toBe(true);
    expect(requests.some((url) => url.endsWith("/banks/9"))).toBe(false);
    client.clear();
});
