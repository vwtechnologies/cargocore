import { useEffect, useState } from "react";
import {
    useLocation,
    useNavigate,
    useParams,
    useSearchParams,
} from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { MasterDetailShell } from "../components/MasterDetailShell";
import {
    BankAccountSummary,
    bankAccountCategories,
} from "../components/BankAccountSummary";
import { RecordForm } from "../components/RecordForm";
import { ErrorState, Loading, Modal, useDebounced } from "../components/ui";
import { Check, CreditCard, Pencil, Trash2 } from "../components/icons";
import { api, display, managementApi, params } from "../lib/api";
import { useDirty } from "../lib/dirty";
import { useSession } from "../lib/session";
import type { PageResult, RecordData } from "../lib/types";

const formId = "bank-account-form";

/** Filtered views over the single bank account register; every view opens the same record. */
export const bankAccountViews = [
    ["all", "All Accounts", null],
    ["our", "Our Accounts", "is_our_account"],
    ["cheque", "Cheque", "is_cheque"],
    ["beneficiary", "Beneficiary", "is_beneficiary"],
    ["employee", "Employee", "is_employee"],
    ["company", "Company", "is_company"],
    ["other", "Other", "is_other"],
] as const;

type AccountView = (typeof bankAccountViews)[number][0];

const listColumns = [
    { key: "account_title", label: "Account Title" },
    {
        key: "account_number",
        label: "Account Number",
        render: (item: RecordData) => (
            <span className="code-value">{display(item.account_number)}</span>
        ),
    },
];

const directoryColumns = [
    { key: "account_title", label: "Account Title" },
    { key: "account_number", label: "Account Number" },
    { key: "bank_name", label: "Bank" },
    { key: "branch_name", label: "Branch" },
    {
        key: "categories",
        label: "Categories",
        render: (item: RecordData) =>
            bankAccountCategories
                .filter(([key]) => item[key])
                .map(([, label]) => label)
                .join(", ") || "—",
    },
];

export function BankAccountsPage() {
    const { id } = useParams();
    const { pathname } = useLocation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const guard = useDirty();
    const { session } = useSession();
    const capabilities = session.entities["bank-accounts"].capabilities;
    const [view, setView] = useState<AccountView>(
        () =>
            bankAccountViews.find(
                ([key, , flag]) =>
                    searchParams.get("view") === key ||
                    (!!flag && searchParams.get(flag) === "1"),
            )?.[0] ?? "all",
    );
    const flag = bankAccountViews.find(([key]) => key === view)?.[2] ?? null;
    const [search, setSearch] = useState("");
    const term = useDebounced(search);
    const [page, setPage] = useState(1);
    const [mode, setMode] = useState<"view" | "edit" | "create">("view");
    const [snapshot, setSnapshot] = useState<RecordData>();
    const [dirty, setDirty] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [destination, setDestination] = useState<string | null>(null);
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(
        null,
    );
    const [saveThen, setSaveThen] = useState<(() => void) | null>(null);
    const filters = flag ? { [flag]: 1 } : {};
    const query = view === "all" ? "" : `?view=${view}`;
    const list = useQuery({
        queryKey: ["bank-account-master", view, term, page],
        queryFn: () =>
            managementApi<PageResult>(
                `/api/v1/bank-accounts?${params({ ...filters, search: term, page, per_page: 25, sort: "account_title" })}`,
            ),
    });
    const directory = useQuery({
        queryKey: ["bank-account-directory", view],
        queryFn: () =>
            managementApi<PageResult>(
                `/api/v1/bank-accounts?${params({ ...filters, per_page: 100, sort: "account_title" })}`,
            ),
    });
    const record = useQuery({
        queryKey: ["bank-account-record", id],
        queryFn: () =>
            managementApi<{ data: RecordData }>(`/api/v1/bank-accounts/${id}`),
        enabled: !!id && mode !== "create",
    });
    function load(item: RecordData) {
        setSnapshot(item);
        setMode("view");
        setDirty(false);
    }
    useEffect(() => {
        if (!id && !destination && mode !== "create" && list.data?.data[0]) {
            navigate(`/bank-accounts/${list.data.data[0].id}${query}`, {
                replace: true,
            });
        }
    }, [id, mode, list.data, navigate, destination, query]);
    useEffect(() => {
        if (destination === pathname) {
            setDestination(null);
        } else if (destination && !dirty && !guard.dirty) {
            navigate(destination, { replace: true });
        }
    }, [destination, pathname, dirty, guard.dirty, navigate]);
    useEffect(() => {
        if (
            record.data &&
            String(record.data.data.id) === id &&
            mode === "view" &&
            !destination &&
            (String(snapshot?.id) !== id ||
                record.data.data.version !== snapshot?.version)
        ) {
            load(record.data.data);
        }
    }, [record.data, id, snapshot?.id, snapshot?.version, mode, destination]);
    function attempt(action: () => void) {
        if (dirty) {
            setPendingAction(() => action);
        } else {
            action();
        }
    }
    function discard() {
        guard.clear();
        setDirty(false);
        setMode("view");
    }
    function select(item: RecordData) {
        if (destination || (snapshot?.id === item.id && mode !== "create")) {
            return;
        }
        attempt(() => {
            discard();
            setDestination(`/bank-accounts/${item.id}`);
        });
    }
    function changeView(next: AccountView) {
        attempt(() => {
            discard();
            setView(next);
            setPage(1);
            setSnapshot(undefined);
            navigate(`/bank-accounts${next === "all" ? "" : `?view=${next}`}`);
        });
    }
    function submit(then?: () => void) {
        setSaveThen(() => then ?? null);
        (
            document.getElementById(formId) as HTMLFormElement | null
        )?.requestSubmit();
    }
    function saved(savedRecord?: RecordData) {
        guard.clear();
        setDirty(false);
        if (savedRecord) {
            load(savedRecord);
            setDestination(`/bank-accounts/${savedRecord.id}`);
        } else {
            setMode("view");
        }
        saveThen?.();
        setSaveThen(null);
    }
    const remove = useMutation({
        mutationFn: () =>
            api(`/api/v1/bank-accounts/${snapshot!.id}`, {
                method: "DELETE",
                body: JSON.stringify({ version: snapshot!.version }),
            }),
        onSuccess: () => {
            guard.clear();
            setDeleting(false);
            setSnapshot(undefined);
            setMode("view");
            setDestination("/bank-accounts");
            void list.refetch();
            void directory.refetch();
            toast.success("Bank account deleted");
        },
        onError: (error) => toast.error(error.message),
    });
    const busy = remove.isPending || !!destination;
    const editing = mode !== "view";
    return (
        <MasterDetailShell
            title="Bank Accounts"
            icon={<CreditCard size={22} />}
            isCreating={mode === "create"}
            isEditing={mode === "edit"}
            isSaving={busy}
            hasSelectedItem={!!snapshot}
            canCreate={capabilities.create && !busy}
            canUpdate={capabilities.update && !busy}
            canDelete={capabilities.delete && !busy}
            onStartCreate={() =>
                attempt(() => {
                    discard();
                    setMode("create");
                })
            }
            onStartEdit={() => {
                if (snapshot) {
                    setMode("edit");
                }
            }}
            onSave={() => submit()}
            onCancel={discard}
            onDelete={() => attempt(() => setDeleting(true))}
            newAriaLabel="New Bank Account"
            listHeading="Bank Accounts"
            listFilters={
                <div
                    className="bank-account-view-chips"
                    role="group"
                    aria-label="Bank account views"
                >
                    {bankAccountViews.map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            aria-pressed={view === key}
                            className={view === key ? "current" : ""}
                            onClick={() => changeView(key)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            }
            items={list.data?.data ?? []}
            columns={[
                {
                    ...listColumns[0],
                    render: (item) => (
                        <button
                            type="button"
                            className="company-row-btn"
                            aria-label={display(item.account_title)}
                            onClick={(event) => {
                                event.stopPropagation();
                                select(item);
                            }}
                        >
                            {display(item.account_title)}
                        </button>
                    ),
                },
                listColumns[1],
            ]}
            selectedId={mode === "create" ? null : (snapshot?.id ?? null)}
            onSelectItem={select}
            isLoading={list.isPending}
            emptyText="No bank accounts found"
            search={search}
            searchAriaLabel="Search bank accounts"
            onSearchChange={(value) =>
                attempt(() => {
                    setSearch(value);
                    setPage(1);
                })
            }
            page={page}
            lastPage={list.data?.meta.last_page ?? 1}
            totalRecords={list.data?.meta.total ?? 0}
            onPageChange={(value) => attempt(() => setPage(value))}
            viewAllItems={directory.data?.data}
            viewAllColumns={directoryColumns}
            onSelectFromViewAll={select}
            isDeleting={deleting}
            onCloseDelete={() => setDeleting(false)}
            onConfirmDelete={() => remove.mutate()}
            deleteTitle="Delete Bank Account?"
            deleteDescription={`Are you sure you want to delete ${display(snapshot?.account_title) || "this bank account"}? It is removed from every view and from the linked person or company.`}
            isDeletingBusy={remove.isPending}
        >
            {list.error ? (
                <ErrorState error={list.error} />
            ) : record.error && mode !== "create" ? (
                <ErrorState error={record.error} />
            ) : !snapshot &&
              mode !== "create" &&
              (list.isPending || (!!id && record.isPending)) ? (
                <Loading />
            ) : (
                <section className="company-card">
                    <div className="company-card-header">
                        <h2 className="company-card-title">
                            {mode === "create"
                                ? "New Bank Account"
                                : display(snapshot?.account_title)}
                        </h2>
                        <span className="company-editing-badge">
                            {mode === "create"
                                ? "Creating"
                                : mode === "edit"
                                  ? "Editing"
                                  : "Read only"}
                        </span>
                    </div>
                    <div className="company-card-body">
                        {editing ? (
                            <RecordForm
                                key={`${mode}-${snapshot?.id ?? "new"}`}
                                entity="bank-accounts"
                                record={mode === "edit" ? snapshot : undefined}
                                defaults={
                                    mode === "create" && flag
                                        ? { [flag]: true }
                                        : {}
                                }
                                formId={formId}
                                hideActions
                                onDirty={setDirty}
                                onDone={(wasSaved, savedRecord) => {
                                    if (wasSaved) {
                                        saved(savedRecord);
                                    } else {
                                        discard();
                                    }
                                }}
                            />
                        ) : snapshot ? (
                            <BankAccountSummary record={snapshot} />
                        ) : (
                            <p className="muted">
                                Select a bank account or create a new record.
                            </p>
                        )}
                    </div>
                </section>
            )}
            <Modal
                open={!!pendingAction}
                onClose={() => setPendingAction(null)}
                title="Unsaved Changes"
                description="Save or discard your changes before continuing."
            >
                <div className="modal-actions">
                    <button
                        type="button"
                        className="btn"
                        onClick={() => setPendingAction(null)}
                    >
                        <Pencil className="mobile-action-icon" /> Keep editing
                    </button>
                    <button
                        type="button"
                        className="btn danger"
                        onClick={() => {
                            const action = pendingAction;
                            setPendingAction(null);
                            discard();
                            action?.();
                        }}
                    >
                        <Trash2 className="mobile-action-icon" /> Discard
                        changes
                    </button>
                    <button
                        type="button"
                        className="btn primary"
                        disabled={busy}
                        onClick={() => {
                            const action = pendingAction;
                            setPendingAction(null);
                            submit(action ?? undefined);
                        }}
                    >
                        <Check className="mobile-action-icon" /> Save changes
                    </button>
                </div>
            </Modal>
        </MasterDetailShell>
    );
}
