import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MasterDetailShell } from "../components/MasterDetailShell";
import { ErrorState, Loading, Modal, useDebounced } from "../components/ui";
import { Check, History, Pencil, Plus, Tag, Trash2 } from "../components/icons";
import { api, managementApi, params } from "../lib/api";
import { useDirty, useDirtyForm } from "../lib/dirty";
import { useSession } from "../lib/session";
import { ApiError, type PageResult, type RecordData } from "../lib/types";

type Values = { name: string; status: boolean };
const values = (record?: RecordData): Values => ({
    name: String(record?.name ?? ""),
    status: record?.status !== false,
});

export function BusinessTypesPage() {
    const title = "Business Roles";
    const singular = "Business Role";
    const base = "/business-types";
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const cache = useQueryClient();
    const guard = useDirty();
    const { session } = useSession();
    const definition = session.entities["business-types"];
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
    const [destination, setDestination] = useState<{
        path: string;
        replace?: boolean;
    } | null>(null);
    const [pendingNavigation, setPendingNavigation] = useState<
        (() => void) | null
    >(null);
    const formRef = useRef<HTMLFormElement>(null);
    const nameRef = useRef<HTMLInputElement>(null);
    const list = useQuery({
        queryKey: ["business-role-list", term, page],
        queryFn: () =>
            managementApi<PageResult>(
                `/api/v1/business-types?${params({ search: term, page, per_page: 25 })}`,
            ),
    });
    const directory = useQuery({
        queryKey: ["business-role-directory"],
        queryFn: () =>
            managementApi<PageResult>("/api/v1/business-types?per_page=100"),
    });
    const record = useQuery({
        queryKey: ["business-role-record", id],
        queryFn: () =>
            managementApi<{ data: RecordData }>(`/api/v1/business-types/${id}`),
        enabled: !!id && mode !== "create",
    });
    const dirty =
        mode !== "view" &&
        JSON.stringify(form) !==
            JSON.stringify(values(mode === "create" ? undefined : snapshot));
    useDirtyForm(dirty);

    function load(item: RecordData, editing = capabilities.update) {
        setSnapshot(item);
        setForm(values(item));
        setMode(editing ? "edit" : "view");
        setErrors({});
        setConflict(false);
    }
    useEffect(() => {
        if (!id && !destination && mode !== "create" && list.data?.data[0])
            navigate(`${base}/${list.data.data[0].id}`, { replace: true });
    }, [id, mode, list.data, base, navigate, destination]);
    useEffect(() => {
        if (
            record.data &&
            !destination &&
            mode !== "create" &&
            String(record.data.data.id) === id &&
            String(snapshot?.id) !== id
        )
            load(record.data.data);
    }, [record.data, id, mode, snapshot?.id, destination]);
    useEffect(() => {
        if (!destination) return;
        if (location.pathname === destination.path) {
            setDestination(null);
        } else if (!dirty && !guard.dirty) {
            navigate(destination.path, { replace: destination.replace });
        }
    }, [destination, dirty, guard.dirty, navigate, location.pathname]);

    function attempt(action: () => void) {
        if (dirty) setPendingNavigation(() => action);
        else action();
    }
    function select(item: RecordData) {
        if (snapshot?.id === item.id && mode !== "create") {
            if (mode === "view" && capabilities.update) load(item);
            return;
        }
        attempt(() => {
            guard.clear();
            load(item);
            setDestination({ path: `${base}/${item.id}` });
        });
    }
    const save = useMutation({
        mutationFn: async () => {
            if (!formRef.current?.reportValidity())
                throw new Error("Please complete the required fields.");
            const response = await api<{ data: RecordData }>(
                `/api/v1/business-types${mode === "create" ? "" : `/${snapshot!.id}`}`,
                {
                    method: mode === "create" ? "POST" : "PUT",
                    body: JSON.stringify({
                        ...form,
                        name: form.name.trim(),
                        ...(mode === "create"
                            ? {}
                            : { version: snapshot!.version }),
                    }),
                },
            );
            return response;
        },
        onSuccess: (response) => {
            guard.clear();
            load(response.data, false);
            cache.setQueryData(
                ["business-role-record", String(response.data.id)],
                response,
            );
            setDestination({
                path: `${base}/${response.data.id}`,
                replace: true,
            });
            toast.success(`${singular} saved successfully`);
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
                `/api/v1/business-types/${snapshot!.id}`,
            ),
        onSuccess: (response) => {
            load(response.data);
            cache.setQueryData(
                ["business-role-record", String(response.data.id)],
                response,
            );
        },
        onError: (error) => toast.error(error.message),
    });
    const remove = useMutation({
        mutationFn: () =>
            api(`/api/v1/business-types/${snapshot!.id}`, {
                method: "DELETE",
                body: JSON.stringify({ version: snapshot!.version }),
            }),
        onSuccess: () => {
            guard.clear();
            setDeleting(false);
            setSnapshot(undefined);
            setMode("view");
            setDestination({ path: base, replace: true });
            toast.success(`${singular} deleted successfully`);
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
    const busy = save.isPending || reload.isPending || remove.isPending;
    const editable =
        (mode === "create"
            ? capabilities.create
            : mode === "edit" && capabilities.update) && !busy;
    return (
        <MasterDetailShell
            title={title}
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
                    requestAnimationFrame(() => nameRef.current?.focus());
                })
            }
            onStartEdit={() => {
                if (snapshot) {
                    load(snapshot);
                    nameRef.current?.focus();
                }
            }}
            onSave={() => {
                if (editable) save.mutate();
            }}
            onCancel={cancel}
            onDelete={() => attempt(() => setDeleting(true))}
            newAriaLabel={`New ${singular.toLowerCase()}`}
            items={list.data?.data ?? []}
            columns={[
                {
                    key: "name",
                    label: "BUSINESS ROLE",
                },
            ]}
            selectedId={mode === "create" ? null : (snapshot?.id ?? null)}
            onSelectItem={select}
            isLoading={list.isPending}
            search={search}
            searchAriaLabel={`Search ${title.toLowerCase()}`}
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
            viewAllColumns={[
                {
                    key: "name",
                    label: "BUSINESS ROLE",
                },
            ]}
            onSelectFromViewAll={select}
            isDeleting={deleting}
            onCloseDelete={() => setDeleting(false)}
            onConfirmDelete={() => remove.mutate()}
            deleteTitle={`Delete ${singular}?`}
            deleteDescription={`Are you sure you want to delete ${snapshot?.name ?? "this record"}? Referenced and system-required records cannot be deleted.`}
            isDeletingBusy={remove.isPending}
        >
            {list.error ? (
                <ErrorState error={list.error} />
            ) : mode !== "create" && record.error ? (
                <ErrorState error={record.error} />
            ) : !snapshot &&
              mode !== "create" &&
              (list.isPending || (record.isPending && !!id)) ? (
                <Loading />
            ) : (
                <section className="company-card">
                    <div className="company-card-header">
                        <h2 className="company-card-title">
                            {mode === "create"
                                ? `New ${singular}`
                                : String(snapshot?.name ?? "—")}
                        </h2>
                        <span className="company-editing-badge">
                            {mode === "create" ? (
                                <Plus size={13} />
                            ) : (
                                <Pencil size={13} />
                            )}
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
                                <div className="country-fields-grid employee-type-fields">
                                    <div className="company-field">
                                        <label htmlFor="business-type-name">
                                            {singular.toUpperCase()}{" "}
                                            <span className="required-star">
                                                *
                                            </span>
                                        </label>
                                        <input
                                            ref={nameRef}
                                            id="business-type-name"
                                            required
                                            maxLength={
                                                definition.fields.name.max ??
                                                255
                                            }
                                            readOnly={!editable}
                                            value={form.name}
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    name: event.target.value,
                                                }))
                                            }
                                            aria-invalid={!!errors.name}
                                            aria-describedby={
                                                errors.name
                                                    ? "business-name-error"
                                                    : undefined
                                            }
                                        />
                                        {errors.name && (
                                            <span
                                                id="business-name-error"
                                                className="field-error"
                                                role="alert"
                                            >
                                                {errors.name.join(" ")}
                                            </span>
                                        )}
                                    </div>
                                    <div className="company-toggle-row">
                                        <span className="company-toggle-label">
                                            STATUS
                                        </span>
                                        <div className="company-toggle-switch">
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-label={`${singular} status`}
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
                                    <History size={14} />
                                    Reload and review
                                </button>
                            </div>
                        )}
                        {!snapshot && mode !== "create" && (
                            <p>
                                Select a record or create a new{" "}
                                {singular.toLowerCase()}.
                            </p>
                        )}
                    </div>
                </section>
            )}
            <Modal
                open={!!pendingNavigation}
                onClose={() => setPendingNavigation(null)}
                title="Unsaved changes"
                description="Save or discard your changes before continuing."
            >
                <div className="modal-actions">
                    <button
                        type="button"
                        className="btn"
                        onClick={() => setPendingNavigation(null)}
                    >
                        <Pencil className="mobile-action-icon" /> Keep editing
                    </button>
                    <button
                        type="button"
                        className="btn danger"
                        onClick={() => {
                            const action = pendingNavigation;
                            setPendingNavigation(null);
                            guard.clear();
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
                                const action = pendingNavigation;
                                setPendingNavigation(null);
                                action?.();
                            } catch {
                                /* The save mutation displays the validation error. */
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
