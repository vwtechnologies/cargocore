import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EditableDetailTable } from "../../resources/js/components/EditableDetailTable";
import { DirtyProvider } from "../../resources/js/lib/dirty";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

it("lets a view-only user select and navigate linked rows without exposing editing or issuing saves", () => {
    vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    const client = new QueryClient();
    const onSelect = vi.fn();
    const onSave = vi.fn();
    render(
        <QueryClientProvider client={client}>
            <DirtyProvider>
                <EditableDetailTable
                    title="Branches"
                    singular="Branch"
                    rows={[
                        { id: 1, name: "Main branch", version: 1 },
                        { id: 2, name: "City branch", version: 1 },
                    ]}
                    columns={[
                        {
                            key: "name",
                            label: "BRANCH NAME",
                            render: (_record, value) => value.name,
                            editor: (value) => (
                                <input
                                    aria-label="Branch name"
                                    value={value.name}
                                    readOnly
                                />
                            ),
                        },
                    ]}
                    values={(record) => ({ name: String(record?.name ?? "") })}
                    onSelect={onSelect}
                    onSave={onSave}
                    onReload={vi.fn()}
                    canCreate={false}
                    canUpdate={false}
                    canDelete={false}
                />
            </DirtyProvider>
        </QueryClientProvider>,
    );
    const main = screen.getByRole("cell", { name: "Main branch" });
    fireEvent.pointerDown(main);
    expect(onSelect).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: 1 }),
    );
    expect(main).toHaveFocus();
    fireEvent.keyDown(main, { key: "ArrowDown" });
    const city = screen.getByRole("cell", { name: "City branch" });
    expect(city).toHaveFocus();
    expect(onSelect).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: 2 }),
    );
    fireEvent.keyDown(city, { key: "s", ctrlKey: true });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
        screen.queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();
    expect(
        screen.getByRole("button", { name: "Add branch: Branch Name" }),
    ).toBeDisabled();
    client.clear();
});
