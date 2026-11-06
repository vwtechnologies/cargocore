import { titleCaseLabel } from "../lib/labels";
import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type FormEvent,
    type ReactNode,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Landmark, Plus } from "../components/icons";
import { toast } from "sonner";
import {
    EditableDetailTable,
    InlineStatus,
    type DetailColumn,
    type DetailTableHandle,
} from "../components/EditableDetailTable";
import { api, managementApi, params } from "../lib/api";
import { useDirty, useDirtyForm } from "../lib/dirty";
import { useSession } from "../lib/session";
import { ApiError, type PageResult, type RecordData } from "../lib/types";
import {
    MasterDetailShell,
    type MasterColumn,
    type ViewAllColumn,
} from "../components/MasterDetailShell";
import { ReferenceSelect } from "../components/ReferenceSelect";
import {
    Badge,
    Confirm,
    ErrorState,
    Loading,
    Pagination,
    SearchableSelect,
    useDebounced,
} from "../components/ui";

type BankValues = {
    name: string;
    short_name: string;
    country_id: number | null;
    uan: string;
    help_line: string;
    e_bank: string;
    website: string;
    address: string;
    status: boolean;
};
type BranchValues = {
    name: string;
    city_id: number | null;
    branch_code: string;
    nift_code: string;
    phones: string;
    address: string;
    status: boolean;
};
type OfficerValues = {
    person_id: number | null;
    new_person: boolean;
    name: string;
    bank_branch_id: number | null;
    designation: string;
    contact_number: string;
    email: string;
    status: boolean;
};
type Editor<T> = { record?: RecordData; values: T; original: T };
const bankValues = (record?: RecordData): BankValues => ({
    name: String(record?.name ?? ""),
    short_name: String(record?.short_name ?? ""),
    country_id: record?.country_id ? Number(record.country_id) : null,
    uan: String(record?.uan ?? ""),
    help_line: String(record?.help_line ?? ""),
    e_bank: String(record?.e_bank ?? ""),
    website: String(record?.website ?? ""),
    address: String(record?.address ?? ""),
    status: record?.status ?? true,
});
const branchValues = (record?: RecordData): BranchValues => ({
    name: String(record?.name ?? ""),
    city_id: record?.city_id ? Number(record.city_id) : null,
    branch_code: String(record?.branch_code ?? ""),
    nift_code: String(record?.nift_code ?? ""),
    phones: Array.isArray(record?.phone_numbers)
        ? record.phone_numbers.join(", ")
        : "",
    address: String(record?.address ?? ""),
    status: record?.status ?? true,
});
const officerValues = (record?: RecordData): OfficerValues => ({
    person_id: record?.person_id ? Number(record.person_id) : null,
    new_person: false,
    name: "",
    bank_branch_id: record?.bank_branch_id
        ? Number(record.bank_branch_id)
        : null,
    designation: String(record?.designation ?? ""),
    contact_number: String(record?.contact_number ?? ""),
    email: String(record?.email ?? ""),
    status: record?.status ?? true,
});
function editor<T>(values: T, record?: RecordData): Editor<T> {
    return { values, original: values, record };
}
function changed<T>(value: Editor<T> | null) {
    return (
        !!value &&
        JSON.stringify(value.values) !== JSON.stringify(value.original)
    );
}
function Field({
    label,
    htmlFor,
    required,
    error,
    children,
}: {
    label: string;
    htmlFor?: string;
    required?: boolean;
    error?: string[];
    children: ReactNode;
}) {
    return (
        <div className="company-field">
            <label htmlFor={htmlFor}>
                {label}
                {required && (
                    <span className="req-star" aria-hidden="true">
                        {" "}
                        *
                    </span>
                )}
            </label>
            {children}
            {error && (
                <p className="field-error" role="alert">
                    {error.join(" ")}
                </p>
            )}
        </div>
    );
}
function Status({
    value,
    onChange,
    disabled = false,
    label,
}: {
    value: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    label: string;
}) {
    return (
        <div className="company-field">
            <span className="company-toggle-label">Status</span>
            <div className="company-toggle-switch">
                <button
                    type="button"
                    role="switch"
                    aria-label={label}
                    aria-checked={value}
                    disabled={disabled}
                    className={`switch-track ${value ? "active" : ""} ${!disabled ? "interactive" : ""}`}
                    onClick={() => onChange(!value)}
                >
                    <span className="switch-knob" />
                </button>
                <span className="switch-text">
                    {value ? "Active" : "Inactive"}
                </span>
            </div>
        </div>
    );
}
function MutationError({ error }: { error: Error | null }) {
    return error ? (
        <p className="bank-form-error" role="alert">
            {error.message}
        </p>
    ) : null;
}

export function BanksPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const cache = useQueryClient();
    const guard = useDirty();
    const { session } = useSession();
    const can = (entity: string, action: "create" | "update" | "delete") =>
        session.entities[entity]?.capabilities[action] === true;
    const [search, setSearch] = useState("");
    const term = useDebounced(search);
    const [page, setPage] = useState(1);
    const [bankEditor, setBankEditor] = useState<Editor<BankValues> | null>(
        null,
    );
    const branchTable = useRef<DetailTableHandle>(null);
    const officerTable = useRef<DetailTableHandle>(null);
    const activeTable = useRef<{ current: DetailTableHandle | null } | null>(
        null,
    );
    const [deleting, setDeleting] = useState<{
        entity: "banks" | "branches" | "officers";
        record: RecordData;
    } | null>(null);
    const [branchSearch, setBranchSearch] = useState("");
    const branchTerm = useDebounced(branchSearch);
    const [branchPage, setBranchPage] = useState(1);
    const [officerSearch, setOfficerSearch] = useState("");
    const officerTerm = useDebounced(officerSearch);
    const [officerPage, setOfficerPage] = useState(1);
    const [selectedBranch, setSelectedBranch] = useState<RecordData | null>(
        null,
    );
    const bankForm = useRef<HTMLFormElement>(null);
    const bankNameInput = useRef<HTMLInputElement>(null);
    const creating = bankEditor !== null && !bankEditor.record;
    const editing = !!bankEditor?.record;
    useDirtyForm(changed(bankEditor));

    const banksQuery = useQuery({
        queryKey: ["banks", term, page],
        queryFn: () =>
            managementApi<PageResult>(
                `/api/v1/banks?${params({ search: term, page, per_page: 25 })}`,
            ),
    });
    const directory = useQuery({
        queryKey: ["all-banks-directory"],
        queryFn: () => managementApi<PageResult>("/api/v1/banks?per_page=100"),
    });
    const banks = banksQuery.data?.data ?? [];
    const selectedId = id ? Number(id) : banks[0]?.id;
    const bankQuery = useQuery({
        queryKey: ["bank-detail", selectedId],
        queryFn: () =>
            managementApi<{ data: RecordData }>(`/api/v1/banks/${selectedId}`),
        enabled: !!selectedId && !creating,
    });
    const bank = bankQuery.isError
        ? undefined
        : (bankQuery.data?.data ??
          banks.find((record) => record.id === selectedId));
    const values = bankEditor?.values ?? bankValues(bank);
    const countries = useQuery({
        queryKey: ["all-countries-lookup"],
        queryFn: () => api<PageResult>("/api/v1/countries?per_page=100"),
    });
    const countryOptions = useMemo(
        () =>
            (countries.data?.data ?? []).map((country) => ({
                value: country.id,
                label: String(country.name),
                code: String(country.short_name ?? ""),
            })),
        [countries.data],
    );
    const countryId = bank?.country_id ? Number(bank.country_id) : null;
    const branchesQuery = useQuery({
        queryKey: ["bank-branches", selectedId, branchTerm, branchPage],
        queryFn: () =>
            managementApi<PageResult>(
                `/api/v1/banks/${selectedId}/branches?${params({ search: branchTerm, page: branchPage, per_page: 10 })}`,
            ),
        enabled: !!selectedId && !creating,
    });
    const officersQuery = useQuery({
        queryKey: [
            "bank-officers",
            selectedId,
            officerTerm,
            officerPage,
            selectedBranch?.id,
        ],
        queryFn: () =>
            managementApi<PageResult>(
                `/api/v1/banks/${selectedId}/officers?${params({ search: officerTerm, page: officerPage, per_page: 10, bank_branch_id: selectedBranch?.id })}`,
            ),
        enabled: !!selectedId && !creating,
    });
    const branches = branchesQuery.data?.data ?? [];
    const officers = officersQuery.data?.data ?? [];
    useEffect(() => {
        if (!id && bank && !creating)
            navigate(`/banks/${bank.id}`, { replace: true });
    }, [id, bank, creating, navigate]);
    useEffect(() => {
        if (
            bankQuery.error instanceof ApiError &&
            bankQuery.error.status === 404
        )
            navigate("/banks", { replace: true });
    }, [bankQuery.error, navigate]);
    useEffect(() => {
        setSelectedBranch(null);
        setBranchSearch("");
        setOfficerSearch("");
        setBranchPage(1);
        setOfficerPage(1);
    }, [selectedId]);
    useEffect(() => {
        if (bankEditor) bankNameInput.current?.focus();
    }, [creating, editing]);

    function clearEditors() {
        setBankEditor(null);
        branchTable.current?.reset();
        officerTable.current?.reset();
    }
    function proceed(action: () => void) {
        if (guard.discard()) {
            clearEditors();
            action();
        }
    }
    function selectBank(record: RecordData) {
        proceed(() => navigate(`/banks/${record.id}`));
    }
    function startBank(record?: RecordData) {
        if (!can("banks", record ? "update" : "create")) return;
        proceed(() => {
            saveBank.reset();
            setBankEditor(editor(bankValues(record), record));
        });
    }
    const saveBank = useMutation({
        mutationFn: () => {
            if (!bankEditor) throw new Error("Open a bank for editing first.");
            if (!bankEditor.values.country_id)
                throw new Error("Select a country for this bank.");
            return api<{ data: RecordData }>(
                `/api/v1/banks${bankEditor.record ? `/${bankEditor.record.id}` : ""}`,
                {
                    method: bankEditor.record ? "PUT" : "POST",
                    body: JSON.stringify({
                        ...bankEditor.values,
                        ...(bankEditor.record
                            ? { version: bankEditor.record.version }
                            : {}),
                    }),
                },
            );
        },
        onSuccess: ({ data }) => {
            cache.setQueryData(["bank-detail", data.id], { data });
            setBankEditor(null);
            guard.clear();
            navigate(`/banks/${data.id}`);
            toast.success(
                creating
                    ? "Bank created successfully"
                    : "Bank updated successfully",
            );
        },
        onError: (error) => toast.error(error.message),
    });
    const remove = useMutation({
        mutationFn: () => {
            if (!deleting) throw new Error("Select a record to delete.");
            const path =
                deleting.entity === "banks"
                    ? `/api/v1/banks/${deleting.record.id}`
                    : `/api/v1/banks/${selectedId}/${deleting.entity}/${deleting.record.id}`;
            return api(path, {
                method: "DELETE",
                body: JSON.stringify({ version: deleting.record.version }),
            });
        },
        onSuccess: async () => {
            await cache.invalidateQueries();
            if (deleting?.entity === "banks") {
                clearEditors();
                navigate("/banks");
            }
            if (
                deleting?.entity === "branches" &&
                selectedBranch?.id === deleting.record.id
            )
                setSelectedBranch(null);
            setDeleting(null);
            toast.success("Record deleted successfully");
        },
        onError: (error) => toast.error(error.message),
    });
    function startBranch(record?: RecordData) {
        if (record) branchTable.current?.edit(record);
        else branchTable.current?.create();
    }
    function startOfficer(record?: RecordData) {
        if (record) officerTable.current?.edit(record);
        else officerTable.current?.create();
    }
    const bankErrors =
        saveBank.error instanceof ApiError ? saveBank.error.errors : {};
    function changeBank(key: keyof BankValues, value: unknown) {
        setBankEditor((current) =>
            current
                ? { ...current, values: { ...current.values, [key]: value } }
                : null,
        );
    }
    function submit(event: FormEvent, save: () => void) {
        event.preventDefault();
        save();
    }
    const columns: MasterColumn<RecordData>[] = [
        {
            key: "short_name",
            label: "S. Name",
            width: "84px",
            className: "bank-short-name-cell",
            render: (record) => String(record.short_name || "—"),
        },
        {
            key: "name",
            label: "Bank Name",
            render: (record) => (
                <button
                    type="button"
                    className="company-row-btn"
                    aria-label={String(record.name)}
                    onClick={(event) => {
                        event.stopPropagation();
                        selectBank(record);
                    }}
                >
                    {String(record.name)}
                </button>
            ),
        },
    ];
    const directoryColumns: ViewAllColumn<RecordData>[] = [
        { key: "name", label: "Bank Name" },
        { key: "short_name", label: "S. Name" },
        { key: "country_name", label: "Country" },
        { key: "status", label: "Status" },
    ];
    const locked = !!bankEditor || bank?.status === false;
    const branchPagination = branchesQuery.data?.meta;
    const officerPagination = officersQuery.data?.meta;

    function textColumn<T extends object>(
        key: keyof T & string,
        label: string,
        width = "130px",
        type = "text",
        required = false,
    ): DetailColumn<T> {
        return {
            key,
            label: titleCaseLabel(label),
            width,
            render: (_record, value) => String(value[key] || "—"),
            editor: (value, change) => (
                <input
                    aria-label={label}
                    type={type}
                    required={required}
                    value={String(value[key] ?? "")}
                    maxLength={
                        key === "address"
                            ? 2000
                            : key === "name" ||
                                key === "designation" ||
                                key === "email"
                              ? 255
                              : key === "phones"
                                ? 1500
                                : 50
                    }
                    onChange={(event) => change(key, event.target.value)}
                />
            ),
        };
    }
    const branchColumns: DetailColumn<BranchValues>[] = [
        textColumn("name", "Branch Name", "190px", "text", true),
        {
            key: "city_id",
            label: "City",
            width: "160px",
            render: (record, value) =>
                value.city_id === record.city_id ? (
                    String(record.city_name ?? "—")
                ) : (
                    <ReferenceSelect
                        label="City"
                        entity="cities"
                        readOnly
                        showCode={false}
                        value={value.city_id}
                        filters={{ country_id: countryId }}
                        onChange={() => {}}
                    />
                ),
            editor: (value, change) => (
                <ReferenceSelect
                    label="City"
                    entity="cities"
                    showCode={false}
                    value={value.city_id}
                    filters={{ country_id: countryId }}
                    disabled={!countryId}
                    onChange={(id) => change("city_id", id)}
                />
            ),
        },
        textColumn("branch_code", "Branch Code", "110px"),
        textColumn("nift_code", "NIFT Code", "110px"),
        textColumn("phones", "Branch Phone Numbers", "160px"),
        textColumn("address", "Branch Address", "170px"),
        {
            key: "status",
            label: "Status",
            width: "100px",
            render: (_record, value) => <Badge active={value.status} />,
            editor: (value, change) => (
                <InlineStatus
                    label="Branch Status"
                    value={value.status}
                    onChange={(status) => change("status", status)}
                />
            ),
        },
    ];
    const officerColumns: DetailColumn<OfficerValues>[] = [
        {
            key: "person_id",
            label: "Officer Name",
            width: "230px",
            render: (record, value) =>
                value.new_person ? (
                    value.name || "New person"
                ) : value.person_id === record.person_id ? (
                    String(record.person_name ?? "—")
                ) : (
                    <ReferenceSelect
                        label="Officer Name"
                        entity="people"
                        readOnly
                        showCode={false}
                        value={value.person_id}
                        onChange={() => {}}
                    />
                ),
            editor: (value, change) => (
                <div className="inline-person-cell">
                    {value.new_person ? (
                        <input
                            aria-label="Officer Name"
                            required
                            value={value.name}
                            maxLength={255}
                            onChange={(event) =>
                                change("name", event.target.value)
                            }
                        />
                    ) : (
                        <ReferenceSelect
                            label="Officer Name"
                            entity="people"
                            showCode={false}
                            value={value.person_id}
                            onChange={(person) => change("person_id", person)}
                        />
                    )}
                    {can("people", "create") && (
                        <button
                            type="button"
                            className="icon-action-btn"
                            aria-label={
                                value.new_person
                                    ? "Select an existing person"
                                    : "Enter a new person’s name"
                            }
                            title={
                                value.new_person
                                    ? "Select existing person"
                                    : "Create person"
                            }
                            onClick={() => {
                                change("new_person", !value.new_person);
                                change("person_id", null);
                                change("name", "");
                            }}
                        >
                            <Plus size={13} />
                        </button>
                    )}
                </div>
            ),
        },
        {
            key: "bank_branch_id",
            label: "Branch",
            width: "170px",
            render: (record, value) =>
                !value.bank_branch_id ? (
                    "Bank-wide"
                ) : value.bank_branch_id === record.bank_branch_id ? (
                    String(record.branch_name ?? "—")
                ) : (
                    <ReferenceSelect
                        label="Officer Branch"
                        entity="branches"
                        readOnly
                        showCode={false}
                        filters={{ bank_id: selectedId }}
                        value={value.bank_branch_id}
                        onChange={() => {}}
                    />
                ),
            editor: (value, change) => (
                <ReferenceSelect
                    label="Officer Branch"
                    entity="branches"
                    showCode={false}
                    filters={{ bank_id: selectedId }}
                    value={value.bank_branch_id}
                    onChange={(branch) => change("bank_branch_id", branch)}
                />
            ),
        },
        textColumn("designation", "Designation", "160px", "text", true),
        textColumn("contact_number", "Officer Contact Number", "145px", "tel"),
        textColumn("email", "Officer Email Address", "210px", "email"),
        {
            key: "status",
            label: "Status",
            width: "100px",
            render: (_record, value) => <Badge active={value.status} />,
            editor: (value, change) => (
                <InlineStatus
                    label="Officer Status"
                    value={value.status}
                    onChange={(status) => change("status", status)}
                />
            ),
        },
    ];

    return (
        <div className="bank-workspace">
            <MasterDetailShell
                title="Banks"
                icon={<Landmark size={22} />}
                isEditing={editing}
                isCreating={creating}
                isSaving={saveBank.isPending}
                hasSelectedItem={!!bank}
                canCreate={can("banks", "create")}
                canUpdate={can("banks", "update")}
                canDelete={can("banks", "delete")}
                onStartCreate={() => startBank()}
                onStartEdit={() => bank && startBank(bank)}
                onSave={() => bankForm.current?.requestSubmit()}
                onSaveShortcut={() => {
                    if (bankEditor) bankForm.current?.requestSubmit();
                    else activeTable.current?.current?.saveActive();
                }}
                onCancel={() => proceed(() => {})}
                onDelete={() =>
                    bank && setDeleting({ entity: "banks", record: bank })
                }
                newAriaLabel={id ? "New bank" : "Add record"}
                listHeading="Banks"
                items={banks}
                columns={columns}
                selectedId={creating ? null : (selectedId ?? null)}
                onSelectItem={selectBank}
                isLoading={banksQuery.isPending}
                search={search}
                onSearchChange={(value) => {
                    setSearch(value);
                    setPage(1);
                }}
                searchAriaLabel="Search banks"
                searchPlaceholder="Search banks…"
                page={page}
                lastPage={banksQuery.data?.meta.last_page ?? 1}
                totalRecords={banksQuery.data?.meta.total ?? 0}
                onPageChange={setPage}
                viewAllItems={directory.data?.data ?? banks}
                viewAllColumns={directoryColumns}
                onSelectFromViewAll={selectBank}
            >
                {banksQuery.error ? (
                    <ErrorState error={banksQuery.error} />
                ) : bankQuery.isPending && !creating && !bank ? (
                    <Loading />
                ) : bankQuery.error && !creating ? (
                    <ErrorState error={bankQuery.error} />
                ) : bank || creating ? (
                    <>
                        <section
                            className="company-card"
                            aria-label={
                                creating ? "New bank" : "Bank information"
                            }
                            {...(creating ? { role: "dialog" } : {})}
                        >
                            <div className="company-card-header">
                                <h2 className="company-card-title">
                                    {creating ? "New Bank" : "Bank Information"}
                                </h2>
                                <span
                                    className={
                                        bankEditor
                                            ? "company-editing-badge"
                                            : "company-card-badge"
                                    }
                                >
                                    {creating
                                        ? "Creating"
                                        : editing
                                          ? "Editing"
                                          : "Read only"}
                                </span>
                            </div>
                            <form
                                ref={bankForm}
                                className="company-card-body"
                                onSubmit={(event) =>
                                    submit(event, () => {
                                        if (bankEditor) saveBank.mutate();
                                    })
                                }
                            >
                                <div className="bank-fields-grid">
                                    {(
                                        [
                                            ["name", "Bank Name", "text", 255],
                                            [
                                                "short_name",
                                                "Short Name",
                                                "text",
                                                50,
                                            ],
                                            ["uan", "UAN", "tel", 50],
                                            [
                                                "help_line",
                                                "Helpline",
                                                "tel",
                                                50,
                                            ],
                                            ["e_bank", "E-Bank", "text", 255],
                                            ["website", "Website", "url", 255],
                                        ] as const
                                    ).map(([key, label, type, maxLength]) => (
                                        <Field
                                            key={key}
                                            label={label}
                                            htmlFor={`bank-${key}`}
                                            required={key === "name"}
                                            error={bankErrors[key]}
                                        >
                                            <input
                                                ref={
                                                    key === "name"
                                                        ? bankNameInput
                                                        : undefined
                                                }
                                                id={`bank-${key}`}
                                                aria-label={label}
                                                type={type}
                                                maxLength={maxLength}
                                                value={values[key]}
                                                readOnly={!bankEditor}
                                                required={key === "name"}
                                                placeholder={
                                                    key === "website"
                                                        ? "https://example.com"
                                                        : undefined
                                                }
                                                aria-invalid={!!bankErrors[key]}
                                                onChange={(event) =>
                                                    changeBank(
                                                        key,
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </Field>
                                    ))}
                                    <Field
                                        label="Country"
                                        htmlFor="bank-country"
                                        required
                                        error={bankErrors.country_id}
                                    >
                                        <SearchableSelect
                                            id="bank-country"
                                            ariaLabel="Bank Country"
                                            placeholder="Select country"
                                            searchPlaceholder="Search countries…"
                                            value={values.country_id}
                                            options={countryOptions}
                                            readOnly={!bankEditor}
                                            onChange={(value) =>
                                                changeBank(
                                                    "country_id",
                                                    value
                                                        ? Number(value)
                                                        : null,
                                                )
                                            }
                                        />
                                    </Field>
                                    <Field
                                        label="Address"
                                        htmlFor="bank-address"
                                        error={bankErrors.address}
                                    >
                                        <input
                                            id="bank-address"
                                            aria-label="Bank Address"
                                            maxLength={5000}
                                            value={values.address}
                                            readOnly={!bankEditor}
                                            onChange={(event) =>
                                                changeBank(
                                                    "address",
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </Field>
                                    <Status
                                        label="Bank Status"
                                        value={values.status}
                                        disabled={!bankEditor}
                                        onChange={(value) =>
                                            changeBank("status", value)
                                        }
                                    />
                                </div>
                                {bankEditor && (
                                    <MutationError error={saveBank.error} />
                                )}
                            </form>
                        </section>
                        {creating ? (
                            <p className="notice">
                                Save the bank to add its branches and officers.
                            </p>
                        ) : (
                            <>
                                <section
                                    className="company-card"
                                    aria-label="Branches"
                                    data-detail-record-region
                                >
                                    <div className="company-card-header">
                                        <div className="company-card-header-left">
                                            <h3 className="company-card-title">
                                                Branches
                                            </h3>
                                        </div>
                                        {can("branches", "create") && (
                                            <button
                                                type="button"
                                                className="btn-subcompany-add"
                                                aria-label="Add branch"
                                                disabled={locked || !countryId}
                                                onClick={() => startBranch()}
                                            >
                                                <Plus size={15} />
                                                Add branch
                                            </button>
                                        )}
                                    </div>
                                    {!countryId && (
                                        <p className="notice">
                                            Select and save a country in Bank
                                            Information before adding branches.
                                        </p>
                                    )}
                                    <div className="bank-table-toolbar">
                                        <input
                                            aria-label="Search branches"
                                            placeholder="Search branches…"
                                            value={branchSearch}
                                            onChange={(event) => {
                                                setBranchSearch(
                                                    event.target.value,
                                                );
                                                setBranchPage(1);
                                            }}
                                        />
                                        <span>
                                            Select a branch to see its officers
                                            below.
                                        </span>
                                    </div>
                                    {branchesQuery.error ? (
                                        <ErrorState
                                            error={branchesQuery.error}
                                        />
                                    ) : (
                                        <EditableDetailTable<BranchValues>
                                            key={selectedId}
                                            controllerRef={branchTable}
                                            title="Branches"
                                            singular="Branch"
                                            rows={branches}
                                            columns={branchColumns}
                                            values={branchValues}
                                            loading={branchesQuery.isPending}
                                            disabled={locked}
                                            canCreate={
                                                can("branches", "create") &&
                                                !!countryId
                                            }
                                            canUpdate={can(
                                                "branches",
                                                "update",
                                            )}
                                            canDelete={can(
                                                "branches",
                                                "delete",
                                            )}
                                            onReload={async (record) =>
                                                (
                                                    await managementApi<{
                                                        data: RecordData;
                                                    }>(
                                                        `/api/v1/banks/${selectedId}/branches/${record.id}`,
                                                    )
                                                ).data
                                            }
                                            onDelete={(record) =>
                                                setDeleting({
                                                    entity: "branches",
                                                    record,
                                                })
                                            }
                                            onActive={() => {
                                                activeTable.current =
                                                    branchTable;
                                            }}
                                            onSelect={(record) => {
                                                setSelectedBranch(record);
                                                setOfficerPage(1);
                                            }}
                                            selectedId={selectedBranch?.id}
                                            onSaved={(record) => {
                                                setSelectedBranch(record);
                                                setOfficerPage(1);
                                            }}
                                            onSave={async (
                                                value,
                                                record,
                                                patch,
                                            ) => {
                                                const { phones, ...fields } =
                                                    value;
                                                const response = await api<{
                                                    data: RecordData;
                                                }>(
                                                    `/api/v1/banks/${selectedId}/branches${record ? `/${record.id}` : ""}`,
                                                    {
                                                        method: record
                                                            ? "PUT"
                                                            : "POST",
                                                        body: JSON.stringify({
                                                            ...fields,
                                                            country_id:
                                                                countryId,
                                                            phone_numbers:
                                                                phones
                                                                    .split(
                                                                        /[,;\n]/,
                                                                    )
                                                                    .map(
                                                                        (
                                                                            phone,
                                                                        ) =>
                                                                            phone.trim(),
                                                                    )
                                                                    .filter(
                                                                        Boolean,
                                                                    ),
                                                            ...(record
                                                                ? {
                                                                      version:
                                                                          record.version,
                                                                  }
                                                                : {}),
                                                        }),
                                                    },
                                                );
                                                return response.data;
                                            }}
                                        />
                                    )}
                                    {branchPagination && (
                                        <Pagination
                                            page={branchPage}
                                            last={branchPagination.last_page}
                                            total={branchPagination.total}
                                            onChange={setBranchPage}
                                        />
                                    )}
                                </section>
                                <section
                                    className="company-card"
                                    aria-label="Branch officers"
                                    data-detail-record-region
                                >
                                    <div className="company-card-header">
                                        <div className="company-card-header-left">
                                            <h3 className="company-card-title">
                                                {selectedBranch
                                                    ? `Officers · ${selectedBranch.name}`
                                                    : "Branch Officers"}
                                            </h3>
                                        </div>
                                        <div className="bank-row-actions">
                                            {selectedBranch && (
                                                <button
                                                    className="btn-subcompany-add"
                                                    onClick={() =>
                                                        proceed(() => {
                                                            setSelectedBranch(
                                                                null,
                                                            );
                                                            setOfficerPage(1);
                                                        })
                                                    }
                                                >
                                                    <Eye className="mobile-action-icon" />{" "}
                                                    Show all officers
                                                </button>
                                            )}
                                            {can("officers", "create") && (
                                                <button
                                                    type="button"
                                                    className="btn-subcompany-add"
                                                    aria-label="Add officer"
                                                    disabled={locked}
                                                    onClick={() =>
                                                        startOfficer()
                                                    }
                                                >
                                                    <Plus size={15} />
                                                    Add officer
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="bank-table-toolbar">
                                        <input
                                            aria-label="Search officers"
                                            placeholder="Search officers…"
                                            value={officerSearch}
                                            onChange={(event) => {
                                                setOfficerSearch(
                                                    event.target.value,
                                                );
                                                setOfficerPage(1);
                                            }}
                                        />
                                    </div>
                                    {officersQuery.error ? (
                                        <ErrorState
                                            error={officersQuery.error}
                                        />
                                    ) : (
                                        <EditableDetailTable<OfficerValues>
                                            key={selectedId}
                                            controllerRef={officerTable}
                                            title="Officers"
                                            singular="Officer"
                                            rows={officers}
                                            columns={officerColumns}
                                            values={(record) => {
                                                const value =
                                                    officerValues(record);
                                                if (!record)
                                                    value.bank_branch_id =
                                                        selectedBranch?.id ??
                                                        null;
                                                return value;
                                            }}
                                            loading={officersQuery.isPending}
                                            disabled={locked}
                                            canCreate={can(
                                                "officers",
                                                "create",
                                            )}
                                            canUpdate={can(
                                                "officers",
                                                "update",
                                            )}
                                            canDelete={can(
                                                "officers",
                                                "delete",
                                            )}
                                            onReload={async (record) =>
                                                (
                                                    await managementApi<{
                                                        data: RecordData;
                                                    }>(
                                                        `/api/v1/banks/${selectedId}/officers/${record.id}`,
                                                    )
                                                ).data
                                            }
                                            onDelete={(record) =>
                                                setDeleting({
                                                    entity: "officers",
                                                    record,
                                                })
                                            }
                                            onActive={() => {
                                                activeTable.current =
                                                    officerTable;
                                            }}

                                            onSave={async (
                                                value,
                                                record,
                                                patch,
                                            ) => {
                                                let personId = value.person_id;
                                                if (value.new_person) {
                                                    if (!value.name.trim())
                                                        throw new Error(
                                                            "Officer name is required.",
                                                        );
                                                    const person = await api<{
                                                        data: RecordData;
                                                    }>("/api/v1/people", {
                                                        method: "POST",
                                                        body: JSON.stringify({
                                                            name: value.name.trim(),
                                                            status: true,
                                                        }),
                                                    });
                                                    personId = person.data.id;
                                                    patch({
                                                        person_id: personId,
                                                        new_person: false,
                                                        name: "",
                                                    });
                                                }
                                                if (!personId)
                                                    throw new Error(
                                                        "Select a person or enter a new officer name.",
                                                    );
                                                const response = await api<{
                                                    data: RecordData;
                                                }>(
                                                    `/api/v1/banks/${selectedId}/officers${record ? `/${record.id}` : ""}`,
                                                    {
                                                        method: record
                                                            ? "PUT"
                                                            : "POST",
                                                        body: JSON.stringify({
                                                            person_id: personId,
                                                            bank_branch_id:
                                                                value.bank_branch_id,
                                                            designation:
                                                                value.designation,
                                                            contact_number:
                                                                value.contact_number,
                                                            email:
                                                                value.email ||
                                                                null,
                                                            status: value.status,
                                                            ...(record
                                                                ? {
                                                                      version:
                                                                          record.version,
                                                                  }
                                                                : {}),
                                                        }),
                                                    },
                                                );
                                                return response.data;
                                            }}
                                        />
                                    )}
                                    {officerPagination && (
                                        <Pagination
                                            page={officerPage}
                                            last={officerPagination.last_page}
                                            total={officerPagination.total}
                                            onChange={setOfficerPage}
                                        />
                                    )}
                                </section>
                            </>
                        )}
                    </>
                ) : (
                    <p className="notice">
                        Select a bank or create your first bank.
                    </p>
                )}
                <Confirm
                    open={!!deleting}
                    title={`Delete ${deleting?.entity === "banks" ? "bank" : deleting?.entity === "branches" ? "branch" : "officer"}?`}
                    description="This record will be deleted if no dependent records prevent removal."
                    busy={remove.isPending}
                    onClose={() => setDeleting(null)}
                    onConfirm={() => remove.mutate()}
                />
            </MasterDetailShell>
        </div>
    );
}
