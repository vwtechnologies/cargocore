import { useEffect, useRef, useState, type RefObject } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Pencil, Plus, History, X } from "../components/icons";
import {
    MasterDetailShell,
    type MasterColumn,
} from "../components/MasterDetailShell";
import { ReferenceSelect } from "../components/ReferenceSelect";
import { ErrorState, Empty, Loading, useDebounced } from "../components/ui";
import { api, managementApi, params } from "../lib/api";
import { useDirty, useDirtyForm } from "../lib/dirty";
import { defaultCompanyIds, useSession } from "../lib/session";
import { ApiError, type RecordData, type PageResult } from "../lib/types";

export function UsersPage() {
    const { session } = useSession();
    const guard = useDirty();
    const cache = useQueryClient();
    const [url] = useSearchParams();
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const term = useDebounced(search);
    const [selected, setSelected] = useState<RecordData | null>(null);
    const [editing, setEditing] = useState(false);
    const [creating, setCreating] = useState(false);
    const [saving, setSaving] = useState(false);
    const form = useRef<HTMLFormElement>(null);
    const query = useQuery({
        queryKey: ["users", page, term, url.get("person_id")],
        queryFn: () =>
            managementApi<PageResult>(
                `/api/v1/users?${params({ page, search: term, person_id: url.get("person_id") })}`,
            ),
    });
    useEffect(() => {
        if (editing || creating || !query.data) return;
        setSelected((current) => {
            if (!current) return query.data.data[0] ?? null;
            const latest = query.data.data.find(
                (record) => record.id === current.id,
            );
            return latest && latest.version >= current.version
                ? latest
                : current;
        });
    }, [query.data, editing, creating]);
    function change(action: () => void) {
        if (!saving && guard.discard()) action();
    }
    function select(record: RecordData) {
        if (selected?.id === record.id && !creating) return;
        change(() => {
            setSelected(record);
            setCreating(false);
            setEditing(false);
        });
    }
    const columns: MasterColumn[] = [
        {
            key: "username",
            label: "Username",
            render: (record) => (
                <button
                    type="button"
                    className="company-row-btn"
                    onClick={(event) => {
                        event.stopPropagation();
                        select(record);
                    }}
                >
                    {String(record.username ?? "—")}
                </button>
            ),
        },
        { key: "role_name", label: "User Role" },
    ];
    return (
        <div className="users-workspace">
            <MasterDetailShell
                title="User Management"
                icon={<Users size={22} />}
                isEditing={editing}
                isCreating={creating}
                isSaving={saving}
                hasSelectedItem={!!selected}
                canCreate={session.permissions.includes("users.create")}
                canUpdate={session.permissions.includes("users.update")}
                canDelete={false}
                onStartCreate={() =>
                    change(() => {
                        setCreating(true);
                        setEditing(false);
                    })
                }
                onStartEdit={() => {
                    if (session.permissions.includes("users.update"))
                        setEditing(true);
                }}
                onSave={() => form.current?.requestSubmit()}
                onCancel={() =>
                    change(() => {
                        setCreating(false);
                        setEditing(false);
                    })
                }
                onDelete={() => {}}
                newAriaLabel="New user"
                newButtonLabel="New user"
                listHeading="Users"
                items={query.data?.data ?? []}
                columns={columns}
                selectedId={creating ? null : (selected?.id ?? null)}
                onSelectItem={select}
                isLoading={query.isPending}
                search={search}
                onSearchChange={(value) =>
                    change(() => {
                        setSearch(value);
                        setPage(1);
                    })
                }
                searchAriaLabel="Search users"
                page={page}
                lastPage={query.data?.meta.last_page ?? 1}
                totalRecords={query.data?.meta.total ?? 0}
                onPageChange={(value) => change(() => setPage(value))}
            >
                {query.error && <ErrorState error={query.error} />}
                {creating || selected ? (
                    <UserForm
                        key={creating ? "new" : selected!.id}
                        record={creating ? undefined : selected!}
                        personId={creating ? url.get("person_id") : null}
                        editing={creating || editing}
                        formRef={form}
                        onSavingChange={setSaving}
                        onSaved={(record) => {
                            setSelected(record);
                            setCreating(false);
                            setEditing(false);
                            guard.clear();
                            void cache.invalidateQueries();
                        }}
                    />
                ) : query.isPending ? (
                    <Loading />
                ) : (
                    <Empty title="Select A User Or Create An Account" />
                )}
            </MasterDetailShell>
        </div>
    );
}

type Values = {
    name: string;
    username: string;
    email: string;
    person_id: number | null;
    role_id: string;
    company_ids: number[];
    status: boolean;
    password: string;
    password_confirmation: string;
};
function UserForm({
    record,
    personId,
    editing,
    formRef,
    onSavingChange,
    onSaved,
}: {
    record?: RecordData;
    personId: string | null;
    editing: boolean;
    formRef: RefObject<HTMLFormElement | null>;
    onSavingChange: (value: boolean) => void;
    onSaved: (record: RecordData) => void;
}) {
    const { session } = useSession();
    const canLink = session.permissions.includes("people.view");
    const roles = useQuery({
        queryKey: ["user-form-roles"],
        queryFn: () => api<{ data: RecordData[] }>("/api/v1/roles"),
    });
    function defaults(source?: RecordData): Values {
        return {
            name: String(source?.name ?? ""),
            username: String(source?.username ?? ""),
            email: String(source?.email ?? ""),
            person_id: source?.person_id
                ? Number(source.person_id)
                : personId
                  ? Number(personId)
                  : null,
            role_id: String(source?.role_id ?? ""),
            company_ids: (
                (source?.company_ids ??
                    (source
                        ? []
                        : defaultCompanyIds(session.companies))) as number[]
            ).filter((id) =>
                session.companies.some((company) => company.id === id),
            ),
            status: source?.status !== false,
            password: "",
            password_confirmation: "",
        };
    }
    const [snapshot, setSnapshot] = useState(record);
    const [values, setValues] = useState<Values>(() => defaults(record));
    const [linkEnabled, setLinkEnabled] = useState(!!values.person_id);
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [conflict, setConflict] = useState(false);
    useEffect(() => {
        if (editing) return;
        setSnapshot(record);
        setValues(defaults(record));
        setLinkEnabled(!!record?.person_id);
        setErrors({});
        setConflict(false);
    }, [record, editing]);
    useDirtyForm(
        editing &&
            (JSON.stringify(values) !== JSON.stringify(defaults(snapshot)) ||
                linkEnabled !== !!defaults(snapshot).person_id),
    );
    const update = <K extends keyof Values>(key: K, value: Values[K]) =>
        setValues((previous) => ({ ...previous, [key]: value }));
    const save = useMutation({
        mutationFn: async () => {
            if (linkEnabled && !values.person_id) {
                throw new ApiError(
                    "Select a person or turn off the person link.",
                    422,
                    { person_id: ["Select a person to link."] },
                );
            }
            return api<{ data: RecordData }>(
                `/api/v1/users${snapshot ? `/${snapshot.id}` : ""}`,
                {
                    method: snapshot ? "PUT" : "POST",
                    body: JSON.stringify({
                        ...values,
                        person_id: linkEnabled ? values.person_id : null,
                        role_id: Number(values.role_id),
                        email: values.email || null,
                        password: values.password || null,
                        password_confirmation:
                            values.password_confirmation || null,
                        ...(snapshot ? { version: snapshot.version } : {}),
                    }),
                },
            );
        },
        onSuccess: (response) => {
            setValues(defaults(response.data));
            setSnapshot(response.data);
            setErrors({});
            setConflict(false);
            toast.success(snapshot ? "User updated" : "User created");
            onSaved(response.data);
        },
        onError: (error) => {
            if (error instanceof ApiError) {
                setErrors(error.errors);
                setConflict(error.status === 409);
            }
            toast.error(error.message);
        },
    });
    useEffect(() => {
        onSavingChange(save.isPending);
        return () => onSavingChange(false);
    }, [save.isPending, onSavingChange]);
    const reload = useMutation({
        mutationFn: async () => {
            const response = await managementApi<PageResult>(
                `/api/v1/users?${params({ id: snapshot?.id })}`,
            );
            const latest = response.data.find(
                (user) => user.id === snapshot?.id,
            );
            if (!latest)
                throw new Error("This account is no longer available.");
            return latest;
        },
        onSuccess: (latest) => {
            setSnapshot(latest);
            setValues(defaults(latest));
            setLinkEnabled(!!latest.person_id);
            setErrors({});
            setConflict(false);
        },
        onError: (error) => toast.error(error.message),
    });
    const error = (key: string) =>
        errors[key] && (
            <span role="alert" className="field-error">
                {errors[key].join(" ")}
            </span>
        );
    function toggle(
        label: string,
        checked: boolean,
        onChange: () => void,
        disabled = false,
    ) {
        return (
            <div className="company-toggle-switch">
                <button
                    type="button"
                    role="switch"
                    aria-label={label}
                    aria-checked={checked}
                    disabled={!editing || disabled || save.isPending}
                    className={`switch-track ${checked ? "active" : ""} ${editing ? "interactive" : ""}`}
                    onClick={onChange}
                >
                    <span className="switch-knob" />
                </button>
                <span className="switch-text">
                    {checked ? "Active" : "Inactive"}
                </span>
            </div>
        );
    }
    return (
        <section className="company-card">
            <div className="company-card-header">
                <h2 className="company-card-title">
                    {snapshot ? String(snapshot.name ?? "—") : "New User"}
                </h2>
                <span
                    className={
                        editing
                            ? "company-editing-badge"
                            : "company-sub-count-badge"
                    }
                >
                    {editing ? (
                        <>
                            {snapshot ? (
                                <Pencil size={13} />
                            ) : (
                                <Plus size={13} />
                            )}{" "}
                            {snapshot ? "Editing" : "Creating"}
                        </>
                    ) : (
                        "Read only"
                    )}
                </span>
            </div>
            <div className="company-card-body">
                <form
                    ref={formRef}
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (editing && !save.isPending) save.mutate();
                    }}
                >
                    <fieldset
                        disabled={save.isPending}
                        className="person-form-fieldset"
                    >
                        <div className="country-fields-grid">
                            {(
                                [
                                    ["name", "Full Name"],
                                    ["username", "Username"],
                                    ["email", "Email Address"],
                                ] as const
                            ).map(([key, label]) => (
                                <div className="company-field" key={key}>
                                    <label htmlFor={`user-${key}`}>
                                        {label}
                                        {key !== "email" && (
                                            <span className="required-star">
                                                {" "}
                                                *
                                            </span>
                                        )}
                                    </label>
                                    <input
                                        id={`user-${key}`}
                                        aria-label={label}
                                        readOnly={!editing}
                                        type={
                                            key === "email" ? "email" : "text"
                                        }
                                        required={key !== "email"}
                                        value={values[key]}
                                        autoComplete={
                                            key === "username"
                                                ? "off"
                                                : undefined
                                        }
                                        maxLength={
                                            key === "username" ? 80 : 255
                                        }
                                        onChange={(event) =>
                                            update(key, event.target.value)
                                        }
                                        aria-invalid={!!errors[key]}
                                    />
                                    {error(key)}
                                </div>
                            ))}
                            <div className="company-field">
                                <label htmlFor="user-role">
                                    User Role{" "}
                                    <span className="required-star">*</span>
                                </label>
                                <select
                                    id="user-role"
                                    aria-label="User Role"
                                    required
                                    value={values.role_id}
                                    disabled={!editing}
                                    onChange={(event) =>
                                        update("role_id", event.target.value)
                                    }
                                >
                                    <option value="">Select a role</option>
                                    {roles.data?.data.map((role) => (
                                        <option key={role.id} value={role.id}>
                                            {role.name}
                                        </option>
                                    ))}
                                    {snapshot &&
                                        !roles.data?.data.some(
                                            (role) =>
                                                String(role.id) ===
                                                values.role_id,
                                        ) && (
                                            <option value={values.role_id}>
                                                {String(
                                                    snapshot.role_name ??
                                                        "Unavailable",
                                                )}
                                            </option>
                                        )}
                                </select>
                                {roles.error && (
                                    <ErrorState error={roles.error} />
                                )}
                                {error("role_id")}
                            </div>
                            <div className="company-field">
                                <label>Account Status</label>
                                {toggle("Account status", values.status, () =>
                                    update("status", !values.status),
                                )}
                                {error("status")}
                            </div>
                            <div className="company-field">
                                <label>Person Link</label>
                                {toggle(
                                    "Person link",
                                    linkEnabled,
                                    () => {
                                        setLinkEnabled(!linkEnabled);
                                        if (linkEnabled)
                                            update("person_id", null);
                                    },
                                    !canLink,
                                )}
                            </div>
                            <div className="company-field">
                                <label htmlFor="user-person">Link To</label>
                                {editing && canLink ? (
                                    <ReferenceSelect
                                        id="user-person"
                                        label="Link To"
                                        entity="people"
                                        lookupPath="/api/v1/users/linkable-people"
                                        filters={
                                            snapshot
                                                ? { user_id: snapshot.id }
                                                : {}
                                        }
                                        value={values.person_id}
                                        disabled={!linkEnabled}
                                        clearUnavailable={false}
                                        showCode={false}
                                        onChange={(value) =>
                                            update(
                                                "person_id",
                                                value ? Number(value) : null,
                                            )
                                        }
                                    />
                                ) : (
                                    <input
                                        id="user-person"
                                        aria-label="Link To"
                                        readOnly
                                        value={
                                            snapshot?.person_id
                                                ? String(
                                                      snapshot.person_name ??
                                                          "Linked person",
                                                  )
                                                : "Not linked"
                                        }
                                    />
                                )}
                                {error("person_id")}
                            </div>
                            <div className="company-field">
                                <label>Link Action</label>
                                <button
                                    type="button"
                                    className="btn secondary"
                                    disabled={
                                        !editing ||
                                        !canLink ||
                                        !values.person_id
                                    }
                                    onClick={() => {
                                        update("person_id", null);
                                        setLinkEnabled(false);
                                    }}
                                >
                                    <X className="mobile-action-icon" /> Unlink
                                    person
                                </button>
                            </div>
                            {editing && (
                                <>
                                    <div className="company-field">
                                        <label htmlFor="user-password">
                                            {snapshot
                                                ? "NEW PASSWORD (OPTIONAL)"
                                                : "PASSWORD *"}
                                        </label>
                                        <input
                                            id="user-password"
                                            type="password"
                                            autoComplete="new-password"
                                            minLength={12}
                                            required={!snapshot}
                                            value={values.password}
                                            onChange={(event) =>
                                                update(
                                                    "password",
                                                    event.target.value,
                                                )
                                            }
                                            placeholder={
                                                snapshot
                                                    ? "Leave blank to keep the current password"
                                                    : "At least 12 characters, letters and numbers"
                                            }
                                        />
                                        {error("password")}
                                    </div>
                                    <div className="company-field">
                                        <label htmlFor="user-confirm">
                                            Confirm Password
                                        </label>
                                        <input
                                            id="user-confirm"
                                            type="password"
                                            autoComplete="new-password"
                                            required={
                                                !snapshot || !!values.password
                                            }
                                            value={values.password_confirmation}
                                            onChange={(event) =>
                                                update(
                                                    "password_confirmation",
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="company-field user-company-access">
                            <label>Portal Company Access</label>
                            <div
                                className="person-portal-companies"
                                role="group"
                                aria-label="Portal company access"
                            >
                                {session.companies.map((company) => (
                                    <label key={company.id}>
                                        <input
                                            type="checkbox"
                                            disabled={!editing}
                                            checked={values.company_ids.includes(
                                                company.id,
                                            )}
                                            onChange={(event) =>
                                                update(
                                                    "company_ids",
                                                    event.target.checked
                                                        ? [
                                                              ...values.company_ids,
                                                              company.id,
                                                          ]
                                                        : values.company_ids.filter(
                                                              (id) =>
                                                                  id !==
                                                                  company.id,
                                                          ),
                                                )
                                            }
                                        />
                                        {company.name}
                                    </label>
                                ))}
                            </div>
                            {error("company_ids")}
                        </div>
                    </fieldset>
                    {conflict && (
                        <div className="notice" role="alert">
                            This account changed after editing began. Your draft
                            has been kept.{" "}
                            <button
                                className="btn small"
                                type="button"
                                disabled={reload.isPending}
                                onClick={() => reload.mutate()}
                            >
                                <History size={14} />
                                Reload and review
                            </button>
                        </div>
                    )}
                    {save.error && <ErrorState error={save.error} />}
                    {editing && (
                        <small className="muted">
                            Save applies link and account changes. Unlinking
                            keeps the account; an inactive account cannot sign
                            in. Passwords are managed by authorized
                            administrators.
                        </small>
                    )}
                </form>
            </div>
        </section>
    );
}
