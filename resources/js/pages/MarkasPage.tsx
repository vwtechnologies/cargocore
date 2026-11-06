import { titleCaseLabel } from "../lib/labels";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MasterDetailShell } from "../components/MasterDetailShell";
import { ErrorState, Loading, Modal, useDebounced } from "../components/ui";
import { Check, History, Pencil, Tag, Trash2 } from "../components/icons";
import { api, managementApi, params } from "../lib/api";
import { useDirty, useDirtyForm } from "../lib/dirty";
import { useSession } from "../lib/session";
import { ApiError, type PageResult, type RecordData } from "../lib/types";

type Values = { code: string; description: string; status: boolean };
const values = (record?: RecordData): Values => ({
    code: String(record?.code ?? ""),
    description: String(record?.description ?? ""),
    status: record?.status !== false,
});
const columns = [
    { key: "code", label: "Marka Code" },
    { key: "description", label: "Marka Description" },
];

export function MarkasPage() {
    const { id } = useParams();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const cache = useQueryClient();
    const guard = useDirty();
    const { session } = useSession();
    const definition = session.entities.markas;
    const capabilities = definition.capabilities;
    const [search, setSearch] = useState("");
    const term = useDebounced(search);
    const [page, setPage] = useState(1);
    const [mode, setMode] = useState<"view" | "edit" | "create">("view");
    const [snapshot, setSnapshot] = useState<RecordData>();
    const [form, setForm] = useState<Values>(values());
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [conflict, setConflict] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [destination, setDestination] = useState<string | null>(null);
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(
        null,
    );
    const formRef = useRef<HTMLFormElement>(null);
    const codeRef = useRef<HTMLInputElement>(null);
    const list = useQuery({
        queryKey: ["marka-master", term, page],
        queryFn: () =>
            managementApi<PageResult>(
                `/api/v1/markas?${params({ search: term, page, per_page: 25 })}`,
            ),
    });
    const directory = useQuery({
        queryKey: ["marka-directory"],
        queryFn: () => managementApi<PageResult>("/api/v1/markas?per_page=100"),
    });
    const record = useQuery({
        queryKey: ["marka-record", id],
        queryFn: () =>
            managementApi<{ data: RecordData }>(`/api/v1/markas/${id}`),
        enabled: !!id && mode !== "create",
    });
    const dirty =
        mode !== "view" &&
        JSON.stringify(form) !==
            JSON.stringify(values(mode === "create" ? undefined : snapshot));
    useDirtyForm(dirty);
    function load(item: RecordData) {
        setSnapshot(item);
        setForm(values(item));
        setMode("view");
        setErrors({});
        setConflict(false);
    }
    useEffect(() => {
        if (!id && !destination && mode !== "create" && list.data?.data[0]) {
            navigate(`/markas/${list.data.data[0].id}`, { replace: true });
        }
    }, [id, mode, list.data, navigate, destination]);
    useEffect(() => {
        if (destination === pathname) setDestination(null);
        else if (destination && !dirty && !guard.dirty)
            navigate(destination, { replace: true });
    }, [destination, pathname, dirty, guard.dirty, navigate]);
    useEffect(() => {
        if (
            record.data &&
            String(record.data.data.id) === id &&
            String(snapshot?.id) !== id &&
            mode !== "create" &&
            !destination &&
            !dirty
        ) {
            load(record.data.data);
        }
    }, [record.data, id, snapshot?.id, mode, dirty, destination]);
    function attempt(action: () => void) {
        if (dirty) setPendingAction(() => action);
        else action();
    }
    function select(item: RecordData) {
        if (destination) return;
        if (snapshot?.id === item.id && mode !== "create") return;
        attempt(() => {
            guard.clear();
            setMode("view");
            setDestination(`/markas/${item.id}`);
        });
    }
    const save = useMutation({
        mutationFn: async () => {
            if (!formRef.current?.reportValidity())
                throw new Error("Please complete the required fields.");
            return api<{ data: RecordData }>(
                `/api/v1/markas${mode === "create" ? "" : `/${snapshot!.id}`}`,
                {
                    method: mode === "create" ? "POST" : "PUT",
                    body: JSON.stringify({
                        ...form,
                        code: form.code.trim(),
                        description: form.description.trim(),
                        ...(mode === "create"
                            ? {}
                            : { version: snapshot!.version }),
                    }),
                },
            );
        },
        onSuccess: (response) => {
            guard.clear();
            load(response.data);
            cache.setQueryData(
                ["marka-record", String(response.data.id)],
                response,
            );
            setDestination(`/markas/${response.data.id}`);
            toast.success("Marka saved successfully");
        },
        onError: (error) => {
            if (error instanceof ApiError) {
                setErrors(error.errors);
                setConflict(error.status === 409);
            }
            toast.error(error.message);
        },
    });
    const reload = useMutation({
        mutationFn: () =>
            managementApi<{ data: RecordData }>(
                `/api/v1/markas/${snapshot!.id}`,
            ),
        onSuccess: (response) => {
            load(response.data);
            setMode("edit");
        },
        onError: (error) => toast.error(error.message),
    });
    const remove = useMutation({
        mutationFn: () =>
            api(`/api/v1/markas/${snapshot!.id}`, {
                method: "DELETE",
                body: JSON.stringify({ version: snapshot!.version }),
            }),
        onSuccess: () => {
            guard.clear();
            setDeleting(false);
            setSnapshot(undefined);
            setForm(values());
            setMode("view");
            setDestination("/markas");
            toast.success("Marka deleted");
        },
        onError: (error) => toast.error(error.message),
    });
    function cancel() {
        guard.clear();
        setForm(values(snapshot));
        setMode("view");
        setErrors({});
        setConflict(false);
    }
    const busy =
        save.isPending || reload.isPending || remove.isPending || !!destination;
    const editable =
        (mode === "create"
            ? capabilities.create
            : mode === "edit" && capabilities.update) && !busy;
    return (
        <MasterDetailShell
            title="Marka"
            icon={<Tag size={22} />}
            isCreating={mode === "create"}
            isEditing={mode === "edit"}
            isSaving={busy}
            hasSelectedItem={!!snapshot}
            canCreate={capabilities.create && !busy}
            canUpdate={capabilities.update && !busy}
            canDelete={capabilities.delete && !busy}
            onStartCreate={() =>
                attempt(() => {
                    guard.clear();
                    setMode("create");
                    setForm(values());
                    setErrors({});
                    setConflict(false);
                    requestAnimationFrame(() => codeRef.current?.focus());
                })
            }
            onStartEdit={() => {
                if (snapshot) setMode("edit");
            }}
            onSave={() => {
                if (editable) save.mutate();
            }}
            onCancel={cancel}
            onDelete={() => attempt(() => setDeleting(true))}
            newAriaLabel="New Marka"
            listHeading="Marka"
            items={list.data?.data ?? []}
            columns={[
                {
                    ...columns[0],
                    render: (item) => (
                        <button
                            type="button"
                            className="company-row-btn"
                            aria-label={String(item.code)}
                            onClick={(event) => {
                                event.stopPropagation();
                                select(item);
                            }}
                        >
                            {String(item.code)}
                        </button>
                    ),
                },
                columns[1],
            ]}
            selectedId={mode === "create" ? null : (snapshot?.id ?? null)}
            onSelectItem={select}
            isLoading={list.isPending}
            search={search}
            searchAriaLabel="Search Marka"
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
            viewAllColumns={columns}
            onSelectFromViewAll={select}
            isDeleting={deleting}
            onCloseDelete={() => setDeleting(false)}
            onConfirmDelete={() => remove.mutate()}
            deleteTitle="Delete Marka?"
            deleteDescription={`Are you sure you want to delete ${snapshot?.code ?? "this Marka"}? Marka codes linked to people cannot be deleted.`}
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
                                ? "New Marka"
                                : String(snapshot?.code ?? "—")}
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
                        <form
                            ref={formRef}
                            onSubmit={(event) => {
                                event.preventDefault();
                                if (editable) save.mutate();
                            }}
                        >
                            <fieldset
                                className="inline-cell-fields"
                                disabled={busy}
                            >
                                <div className="marka-fields-grid">
                                    {(["code", "description"] as const).map(
                                        (key) => (
                                            <div
                                                className="company-field"
                                                key={key}
                                            >
                                                <label htmlFor={`marka-${key}`}>
                                                    Marka {titleCaseLabel(key)}{" "}
                                                    <span className="required-star">
                                                        *
                                                    </span>
                                                </label>
                                                <input
                                                    id={`marka-${key}`}
                                                    ref={
                                                        key === "code"
                                                            ? codeRef
                                                            : undefined
                                                    }
                                                    required
                                                    maxLength={
                                                        definition.fields[key]
                                                            .max
                                                    }
                                                    readOnly={
                                                        !editable ||
                                                        (key === "code" &&
                                                            mode !== "create")
                                                    }
                                                    value={form[key]}
                                                    onChange={(event) =>
                                                        setForm((current) => ({
                                                            ...current,
                                                            [key]: event.target
                                                                .value,
                                                        }))
                                                    }
                                                    aria-invalid={!!errors[key]}
                                                    aria-describedby={
                                                        errors[key]
                                                            ? `marka-${key}-error`
                                                            : undefined
                                                    }
                                                />
                                                {errors[key] && (
                                                    <span
                                                        className="field-error"
                                                        role="alert"
                                                        id={`marka-${key}-error`}
                                                    >
                                                        {errors[key].join(" ")}
                                                    </span>
                                                )}
                                            </div>
                                        ),
                                    )}
                                    <div className="company-toggle-row">
                                        <span className="company-toggle-label">
                                            Status
                                        </span>
                                        <div className="company-toggle-switch">
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-label="Marka status"
                                                aria-checked={form.status}
                                                disabled={!editable}
                                                className={`switch-track ${form.status ? "active" : ""} ${editable ? "interactive" : ""}`}
                                                onClick={() =>
                                                    setForm((current) => ({
                                                        ...current,
                                                        status: !current.status,
                                                    }))
                                                }
                                            >
                                                <span className="switch-knob" />
                                            </button>
                                            <span>
                                                {form.status
                                                    ? "Active"
                                                    : "Inactive"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </fieldset>
                        </form>
                        {conflict && (
                            <div className="notice" role="alert">
                                This record changed after editing began. Your
                                draft has been kept.{" "}
                                <button
                                    type="button"
                                    className="btn small"
                                    disabled={busy}
                                    onClick={() => reload.mutate()}
                                >
                                    <History size={14} /> Reload and review
                                </button>
                            </div>
                        )}
                        {save.error && <ErrorState error={save.error} />}
                        {!snapshot && mode !== "create" && (
                            <p>Select a Marka or create a new record.</p>
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
                            guard.clear();
                            setForm(values(snapshot));
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
                        onClick={async () => {
                            try {
                                await save.mutateAsync();
                                const action = pendingAction;
                                setPendingAction(null);
                                action?.();
                            } catch {
                                /* Validation remains visible in the form. */
                            }
                        }}
                    >
                        <Check className="mobile-action-icon" /> Save changes
                    </button>
                </div>
            </Modal>
        </MasterDetailShell>
    );
}
