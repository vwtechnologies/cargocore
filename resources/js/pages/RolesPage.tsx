import { titleCaseLabel } from "../lib/labels";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MasterDetailShell } from "../components/MasterDetailShell";
import { History, KeyRound, LockKeyhole } from "../components/icons";
import { ErrorState, Loading } from "../components/ui";
import { api, managementApi } from "../lib/api";
import { useDirty, useDirtyForm } from "../lib/dirty";
import { useSession } from "../lib/session";
import { ApiError, type RecordData } from "../lib/types";

type RoleData = RecordData & {
    is_system: boolean;
    permissions: { name: string }[];
};
type RoleResponse = { data: RoleData[]; permissions: string[] };
const actions = ["view", "create", "update", "delete"];
const groups = [
    {
        label: "Master Data",
        rows: [
            ["companies", "Company & Sub-Company"],
            ["geography", "Country & City"],
            ["banks", "Banks, Branches & Officers"],
            ["employee-types", "Employee Type"],
            ["markas", "Marka"],
            ["people", "Person Information"],
            [
                "associations",
                "Company Associations & Business Role Assignments",
            ],
            ["employee-details", "Person Employee Details"],
            ["person-accounts", "Person Bank Accounts"],
            ["documents", "Person Documents, Pictures & Signatures"],
            ["business-types", "Business Roles"],
        ],
    },
    {
        label: "Administration",
        rows: [
            ["users", "User Management"],
            ["roles", "System Roles & Permissions"],
            ["audit", "Audit History"],
        ],
    },
];

export function RolesPage() {
    const { session } = useSession();
    const allowed = session.user.role === "Super Admin";
    const guard = useDirty();
    const cache = useQueryClient();
    const formRef = useRef<HTMLFormElement>(null);
    const [snapshot, setSnapshot] = useState<RoleData>();
    const [mode, setMode] = useState<"view" | "edit" | "create">("view");
    const [name, setName] = useState("");
    const [status, setStatus] = useState(true);
    const [permissions, setPermissions] = useState<string[]>([]);
    const [search, setSearch] = useState("");
    const [permissionSearch, setPermissionSearch] = useState("");
    const [page, setPage] = useState(1);
    const query = useQuery({
        queryKey: ["management-roles"],
        queryFn: () => managementApi<RoleResponse>("/api/v1/roles"),
        enabled: allowed,
    });
    const all = query.data?.permissions ?? [];
    const immutable = snapshot?.name === "Super Admin";
    const editable = mode !== "view" && !immutable;
    const originalPermissions = immutable
        ? all
        : (snapshot?.permissions.map((permission) => permission.name) ?? []);
    const dirty =
        mode !== "view" &&
        JSON.stringify([name, status, [...permissions].sort()]) !==
            JSON.stringify([
                mode === "create" ? "" : (snapshot?.name ?? ""),
                mode === "create" ? true : (snapshot?.status ?? true),
                mode === "create" ? [] : [...originalPermissions].sort(),
            ]);
    useDirtyForm(dirty);

    function load(role: RoleData, edit = role.name !== "Super Admin") {
        setSnapshot(role);
        setName(String(role.name));
        setStatus(role.status !== false);
        setPermissions(
            role.name === "Super Admin"
                ? all
                : role.permissions.map((permission) => permission.name),
        );
        setMode(edit ? "edit" : "view");
    }
    useEffect(() => {
        if (!snapshot && mode !== "create" && query.data?.data[0])
            load(query.data.data[0], false);
    }, [query.data, snapshot, mode]);
    const save = useMutation({
        mutationFn: () =>
            api<{ data: RoleData }>(
                `/api/v1/roles${mode === "create" ? "" : `/${snapshot!.id}`}`,
                {
                    method: mode === "create" ? "POST" : "PUT",
                    body: JSON.stringify({
                        name,
                        status,
                        permissions,
                        version: snapshot?.version,
                    }),
                },
            ),
        onSuccess: (response) => {
            guard.clear();
            load(response.data, false);
            cache.invalidateQueries();
            toast.success("Role permissions saved");
        },
    });
    function choose(role: RoleData) {
        if (save.isPending || !guard.discard()) return;
        save.reset();
        load(role);
    }
    function cancel() {
        if (!guard.discard()) return;
        save.reset();
        const role = snapshot ?? query.data?.data[0];
        if (role) load(role, false);
        else setMode("view");
    }
    const filtered = (query.data?.data ?? []).filter((role) =>
        String(role.name).toLowerCase().includes(search.toLowerCase()),
    );
    if (!allowed)
        return (
            <ErrorState
                error={
                    new Error(
                        "Only Super Admin can manage roles and permissions.",
                    )
                }
            />
        );
    return (
        <div className="role-permissions-workspace">
            <MasterDetailShell
                title="Role Permissions"
                icon={<KeyRound size={22} />}
                isEditing={mode === "edit"}
                isCreating={mode === "create"}
                isSaving={save.isPending}
                hasSelectedItem={!!snapshot}
                canCreate={query.isSuccess}
                canUpdate={!!snapshot && !immutable}
                canDelete={false}
                onStartCreate={() => {
                    if (!guard.discard()) return;
                    save.reset();
                    setSnapshot(undefined);
                    setName("");
                    setStatus(true);
                    setPermissions([]);
                    setMode("create");
                }}
                onStartEdit={() => {
                    if (snapshot && !immutable) load(snapshot);
                }}
                onSave={() => {
                    if (editable && !save.isPending)
                        formRef.current?.requestSubmit();
                }}
                onCancel={cancel}
                onDelete={() => {}}
                newButtonLabel="New role"
                newAriaLabel="New role"
                listHeading="Roles"
                items={filtered.slice((page - 1) * 15, page * 15)}
                columns={[
                    {
                        key: "name",
                        label: "Role Name",
                        render: (role) => (
                            <span className="role-list-name">
                                <span>{String(role.name)}</span>
                                {role.is_system === true && (
                                    <LockKeyhole
                                        size={13}
                                        aria-label="System role"
                                    />
                                )}
                            </span>
                        ),
                    },
                ]}
                selectedId={mode === "create" ? null : (snapshot?.id ?? null)}
                onSelectItem={choose}
                search={search}
                onSearchChange={(value) => {
                    setSearch(value);
                    setPage(1);
                }}
                searchPlaceholder="Search roles…"
                page={page}
                lastPage={Math.max(1, Math.ceil(filtered.length / 15))}
                totalRecords={filtered.length}
                onPageChange={setPage}
                viewAllItems={query.data?.data}
                onSelectFromViewAll={choose}
            >
                {query.isPending ? (
                    <Loading />
                ) : query.error ? (
                    <ErrorState error={query.error} />
                ) : (
                    <form
                        ref={formRef}
                        className="company-card role-permissions-form"
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (editable && !save.isPending) save.mutate();
                        }}
                    >
                        <div className="company-card-header">
                            <h2 className="company-card-title">
                                {mode === "create"
                                    ? "New Role"
                                    : name || "Role Permissions"}
                            </h2>
                            <span className="company-readonly-badge">
                                {immutable
                                    ? "System role"
                                    : editable
                                      ? "Editing"
                                      : "Read only"}
                            </span>
                        </div>
                        <div className="company-card-body role-name-fields">
                            <div className="company-field">
                                <label htmlFor="role-name">
                                    Role Name{" "}
                                    <span className="req-star">*</span>
                                </label>
                                <input
                                    id="role-name"
                                    value={name}
                                    required
                                    maxLength={100}
                                    readOnly={
                                        !editable ||
                                        (snapshot?.is_system &&
                                            mode !== "create")
                                    }
                                    onChange={(event) =>
                                        setName(
                                            event.target.value.toUpperCase(),
                                        )
                                    }
                                />
                            </div>
                            <div className="company-field">
                                <label htmlFor="role-status">Status</label>
                                <button
                                    id="role-status"
                                    type="button"
                                    role="switch"
                                    aria-label="Role status"
                                    aria-checked={status}
                                    disabled={
                                        !editable ||
                                        (snapshot?.is_system &&
                                            mode !== "create")
                                    }
                                    className={`company-toggle-switch ${status ? "on" : "off"}`}
                                    onClick={() => setStatus(!status)}
                                >
                                    <span
                                        className={`switch-track ${status ? "active" : ""}`}
                                        aria-hidden="true"
                                    >
                                        <span className="switch-knob" />
                                    </span>
                                    <span>
                                        {status ? "Active" : "Inactive"}
                                    </span>
                                </button>
                            </div>
                        </div>
                        <div className="table-scroll role-permission-scroll">
                            <div className="table-toolbar">
                                <input
                                    aria-label="Search Permissions"
                                    placeholder="Search permissions…"
                                    value={permissionSearch}
                                    onChange={(event) =>
                                        setPermissionSearch(event.target.value)
                                    }
                                />
                            </div>
                            <table
                                className="role-permission-matrix"
                                aria-label="Role permissions"
                            >
                                <thead>
                                    <tr>
                                        <th scope="col">Form</th>
                                        {actions.map((action) => (
                                            <th key={action} scope="col">
                                                {titleCaseLabel(action)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {groups.map((group) => (
                                        <RoleGroup
                                            key={group.label}
                                            label={group.label}
                                            rows={group.rows.filter(
                                                ([, title]) =>
                                                    title
                                                        .toLowerCase()
                                                        .includes(
                                                            permissionSearch.toLowerCase(),
                                                        ),
                                            )}
                                            all={all}
                                            permissions={permissions}
                                            locked={!editable || save.isPending}
                                            onChange={(permission, checked) =>
                                                setPermissions((current) =>
                                                    checked
                                                        ? [
                                                              ...new Set([
                                                                  ...current,
                                                                  permission,
                                                              ]),
                                                          ]
                                                        : current.filter(
                                                              (value) =>
                                                                  value !==
                                                                  permission,
                                                          ),
                                                )
                                            }
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {save.error && (
                            <div className="role-permission-error">
                                <ErrorState error={save.error} />
                                {save.error instanceof ApiError &&
                                    save.error.status === 409 && (
                                        <button
                                            type="button"
                                            className="btn secondary"
                                            onClick={async () => {
                                                if (!guard.discard()) return;
                                                const latest =
                                                    await query.refetch();
                                                const role =
                                                    latest.data?.data.find(
                                                        (item) =>
                                                            item.id ===
                                                            snapshot?.id,
                                                    );
                                                if (role) {
                                                    load(role);
                                                    save.reset();
                                                }
                                            }}
                                        >
                                            <History className="mobile-action-icon" />{" "}
                                            Reload and review
                                        </button>
                                    )}
                            </div>
                        )}
                    </form>
                )}
            </MasterDetailShell>
        </div>
    );
}

function RoleGroup({
    label,
    rows,
    all,
    permissions,
    locked,
    onChange,
}: {
    label: string;
    rows: string[][];
    all: string[];
    permissions: string[];
    locked: boolean;
    onChange: (permission: string, checked: boolean) => void;
}) {
    return (
        <>
            <tr className="role-permission-category">
                <th colSpan={5} scope="colgroup">
                    {label}
                </th>
            </tr>
            {rows.map(([module, title]) => (
                <tr key={module}>
                    <th scope="row">{title}</th>
                    {actions.map((action) => {
                        const permission = `${module}.${action}`;
                        return (
                            <td key={action}>
                                {all.includes(permission) ? (
                                    <input
                                        type="checkbox"
                                        aria-label={`${title}: ${action}`}
                                        checked={permissions.includes(
                                            permission,
                                        )}
                                        disabled={locked || module === "roles"}
                                        title={
                                            module === "roles"
                                                ? "Only Super Admin can manage roles and permissions"
                                                : undefined
                                        }
                                        onChange={(event) =>
                                            onChange(
                                                permission,
                                                event.target.checked,
                                            )
                                        }
                                    />
                                ) : (
                                    <span aria-label="Not applicable">—</span>
                                )}
                            </td>
                        );
                    })}
                </tr>
            ))}
        </>
    );
}
