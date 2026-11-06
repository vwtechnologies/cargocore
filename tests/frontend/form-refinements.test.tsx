import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { RecordForm } from "../../resources/js/components/RecordForm";
import { RepeatableValues } from "../../resources/js/components/RepeatableValues";
import { titleCaseLabel } from "../../resources/js/lib/labels";

vi.mock("../../resources/js/lib/dirty", () => ({
    useDirtyForm: () => {},
    useDirty: () => ({ clear: vi.fn(), discard: () => true }),
}));
vi.mock("../../resources/js/lib/session", () => ({
    useSession: () => ({
        refresh: vi.fn(),
        session: {
            entities: {
                accounts: {
                    label: "Bank Accounts",
                    capabilities: { view: true, create: true, update: true, delete: true },
                    fields: {
                        country_id: {
                            label: "Country",
                            type: "reference",
                            entity: "countries",
                        },
                        bank_id: {
                            label: "Bank",
                            type: "reference",
                            entity: "banks",
                        },
                        city_id: {
                            label: "City",
                            type: "reference",
                            entity: "cities",
                            depends: "country_id",
                        },
                        bank_branch_id: {
                            label: "Branch",
                            type: "reference",
                            entity: "branches",
                            depends: "city_id",
                        },
                    },
                },
            },
        },
    }),
}));
vi.mock("../../resources/js/components/ReferenceSelect", () => ({
    ReferenceSelect: ({
        label,
        value,
        onChange,
    }: {
        label: string;
        value: unknown;
        onChange: (value: number | null) => void;
    }) => (
        <select
            aria-label={label}
            value={String(value ?? "")}
            onChange={(event) =>
                onChange(event.target.value ? Number(event.target.value) : null)
            }
        >
            <option value="">Choose</option>
            {[1, 2, 3, 4, 5].map((id) => (
                <option key={id} value={id}>
                    {label} {id}
                </option>
            ))}
        </select>
    ),
}));

afterEach(cleanup);

it("uses Title Case for UI labels while keeping identifier abbreviations readable", () => {
    expect(titleCaseLabel("BANK NAME")).toBe("Bank Name");
    expect(titleCaseLabel("account number")).toBe("Account Number");
    expect(titleCaseLabel("IBAN / CNIC / NIFT CODE")).toBe(
        "IBAN / CNIC / NIFT Code",
    );
});

it("adds and removes repeatable rows without changing the remaining values", () => {
    function Example() {
        const [values, setValues] = React.useState(["I1l", "SECOND"]);
        return (
            <RepeatableValues
                label="Contact"
                values={values}
                onChange={setValues}
            />
        );
    }
    render(<Example />);
    fireEvent.click(screen.getByRole("button", { name: "Add Row" }));
    expect(screen.getAllByRole("textbox")).toHaveLength(3);
    fireEvent.click(
        screen.getByRole("button", { name: "Remove Contact Row 2" }),
    );
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(screen.getByLabelText("Contact 1")).toHaveValue("I1l");
});

it("clears dependent account selections and hides the branch until its parents apply", () => {
    const client = new QueryClient();
    render(
        <QueryClientProvider client={client}>
            <RecordForm
                entity="accounts"
                record={{
                    id: 1,
                    version: 1,
                    status: true,
                    country_id: 1,
                    bank_id: 2,
                    city_id: 3,
                    bank_branch_id: 4,
                }}
                onDone={() => {}}
            />
        </QueryClientProvider>,
    );
    expect(screen.getByLabelText("Branch")).toHaveValue("4");
    fireEvent.change(screen.getByLabelText("Country"), {
        target: { value: "2" },
    });
    expect(screen.getByLabelText("City")).toHaveValue("");
    expect(screen.getByLabelText("Bank")).toHaveValue("");
    expect(screen.queryByLabelText("Branch")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "3" } });
    expect(screen.queryByLabelText("Branch")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Bank"), { target: { value: "5" } });
    expect(screen.getByLabelText("Branch")).toHaveValue("");
    client.clear();
});
