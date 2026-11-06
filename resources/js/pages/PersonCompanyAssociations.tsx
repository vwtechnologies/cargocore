import { useEffect, useImperativeHandle, useMemo, useState } from "react";
import {
    useMutation,
    useQuery,
    useQueryClient,
    useIsMutating,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Eye, History, Search } from "../components/icons";
import {
    ErrorState,
    Loading,
    Modal,
    Pagination,
    useDebounced,
} from "../components/ui";
import { api, managementApi, params } from "../lib/api";
import { useDirty, useDirtyForm } from "../lib/dirty";
import { useSession } from "../lib/session";
import { ApiError, type PageResult, type RecordData } from "../lib/types";
import { EmployeeDetails } from "./PersonSections";
import type { PersonSectionProps } from "./PeoplePage";

type Assignment = { selected: boolean; amount: string };
type RoleResponse = {
    data: RecordData | null;
    classifications: RecordData[];
    classification_versions: Record<string, number>;
};
function assignments(response?: RoleResponse): Record<number, Assignment> {
    return Object.fromEntries(
        (response?.classifications ?? []).map((role) => [
            Number(role.business_type_id),
            {
                selected:
                    !!response?.data?.status &&
                    !response?.data?.is_deleted &&
                    role.status &&
                    !role.is_deleted,
                amount: String(role.opening_balance ?? ""),
            },
        ]),
    );
}
export function PersonCompanyAssociations({
    person,
    editing,
    actions,
    onEditingChange,
}: PersonSectionProps) {
    const { session } = useSession();
    const guard = useDirty();
    const cache = useQueryClient();
    const busy = useIsMutating() > 0;
    const [company, setCompany] = useState(session.companies[0]?.id);
    const [search, setSearch] = useState("");
    const [loadedCompany, setLoadedCompany] = useState<number>();
    const [snapshot, setSnapshot] = useState<RoleResponse>();
    const [draft, setDraft] = useState<Record<number, Assignment>>({});
    const [conflict, setConflict] = useState(false);
    const [viewing, setViewing] = useState<RecordData | null>(null);
    const capabilities = session.entities.associations.capabilities;
    const canView =
        capabilities.view && session.entities.companies.capabilities.view;
    const roles = useQuery({
        queryKey: ["person-role-options"],
        queryFn: () =>
            api<PageResult>(
                "/api/v1/business-types?per_page=100&context=lookup",
            ),
        enabled: canView,
    });
    const query = useQuery({
        queryKey: ["person-company-roles", person.id, company],
        queryFn: () =>
            api<RoleResponse>(
                `/api/v1/people/${person.id}/company-roles/${company}`,
            ),
        enabled: canView && !!company,
    });
    const associations = useQuery({
        queryKey: ["person-associated-companies", person.id],
        queryFn: () =>
            managementApi<PageResult>(
                `/api/v1/people/${person.id}/associations?per_page=100`,
            ),
        enabled: canView,
    });
    useEffect(() => {
        if ((!editing || loadedCompany !== company) && query.data) {
            setLoadedCompany(company);
            setSnapshot(query.data);
            setDraft(assignments(query.data));
            setConflict(false);
        }
    }, [query.data, editing, company, loadedCompany]);
    const dirty =
        JSON.stringify(draft) !== JSON.stringify(assignments(snapshot));
    useDirtyForm(dirty);
    const canEdit =
        !!snapshot &&
        canView &&
        (snapshot?.data ? capabilities.update : capabilities.create) &&
        person.status;
    const save = useMutation({
        mutationFn: () =>
            api<RoleResponse>(
                `/api/v1/people/${person.id}/company-roles/${company}`,
                {
                    method: "PUT",
                    body: JSON.stringify({
                        version: snapshot?.data?.version ?? 0,
                        classification_versions:
                            snapshot?.classification_versions ?? {},
                        items: Object.entries(draft)
                            .filter(([, value]) => value.selected)
                            .map(([id, value]) => ({
                                business_type_id: Number(id),
                                opening_balance: value.amount || null,
                            })),
                    }),
                },
            ),
        onSuccess: (response) => {
            cache.setQueryData(
                ["person-company-roles", person.id, company],
                response,
            );
            setSnapshot(response);
            setDraft(assignments(response));
            setConflict(false);
            guard.clear();
            onEditingChange(false);
            toast.success("Company associations saved");
        },
        onError: (error) => {
            if (error instanceof ApiError) setConflict(error.status === 409);
            toast.error(error.message);
        },
    });
    const reload = useMutation({
        mutationFn: () =>
            api<RoleResponse>(
                `/api/v1/people/${person.id}/company-roles/${company}`,
            ),
        onSuccess: (response) => {
            cache.setQueryData(
                ["person-company-roles", person.id, company],
                response,
            );
            setSnapshot(response);
            setDraft(assignments(response));
            setConflict(false);
        },
        onError: (error) => toast.error(error.message),
    });
    useImperativeHandle(actions, () => ({
        save: () => {
            if (canEdit && !save.isPending) save.mutate();
        },
        cancel: () => {
            setDraft(assignments(snapshot));
            onEditingChange(false);
            setConflict(false);
        },
    }));
    const companies = session.companies.filter(
        (item) =>
            item.name.toLowerCase().includes(search.toLowerCase()) ||
            item.short_name?.toLowerCase().includes(search.toLowerCase()),
    );
    const selectedCompany = session.companies.find(
        (item) => item.id === company,
    );
    const roleOptions = roles.data?.data ?? [];
    const hiddenAssignments = useMemo(
        () =>
            (snapshot?.classifications ?? []).filter(
                (item) =>
                    !roleOptions.some(
                        (role) => role.id === Number(item.business_type_id),
                    ),
            ),
        [snapshot, roleOptions],
    );
    if (!canView)
        return (
            <div className="notice">
                Company and business-role access is restricted by your role.
            </div>
        );
    return (
        <div className="section-stack">
            <div className="person-association-layout">
                <aside className="person-company-list company-card">
                    <div className="search-input">
                        <Search size={15} />
                        <input
                            aria-label="Search associated companies"
                            placeholder="Search companies…"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>
                    <div
                        role="listbox"
                        aria-label="Companies for business roles"
                        onKeyDown={(event) => {
                            if (!["ArrowUp", "ArrowDown"].includes(event.key))
                                return;
                            event.preventDefault();
                            if (busy) return;
                            const position = companies.findIndex(
                                (item) => item.id === company,
                            );
                            const next =
                                companies[
                                    Math.max(
                                        0,
                                        Math.min(
                                            companies.length - 1,
                                            position +
                                                (event.key === "ArrowDown"
                                                    ? 1
                                                    : -1),
                                        ),
                                    )
                                ];
                            if (next && guard.discard()) {
                                onEditingChange(false);
                                setCompany(next.id);
                                event.currentTarget
                                    .querySelector<HTMLButtonElement>(
                                        `[data-company-id="${next.id}"]`,
                                    )
                                    ?.focus();
                            }
                        }}
                    >
                        {companies.map((item) => (
                            <button
                                key={item.id}
                                role="option"
                                aria-selected={company === item.id}
                                data-company-id={item.id}
                                disabled={busy}
                                type="button"
                                className={
                                    company === item.id ? "selected" : ""
                                }
                                onClick={() => {
                                    if (
                                        company !== item.id &&
                                        guard.discard()
                                    ) {
                                        onEditingChange(false);
                                        setCompany(item.id);
                                    }
                                }}
                            >
                                <span>
                                    <strong>{item.name}</strong>
                                    <small>{item.short_name}</small>
                                </span>
                                {associations.data?.data.some(
                                    (association) =>
                                        association.status &&
                                        association.company_id === item.id,
                                ) && (
                                    <span className="association-linked-label">
                                        Linked
                                    </span>
                                )}
                            </button>
                        ))}
                        {!companies.length && (
                            <p className="section-note">
                                No active companies available.
                            </p>
                        )}
                    </div>
                </aside>
                <section className="company-card person-role-card">
                    <div className="company-card-header">
                        <div>
                            <span className="person-company-caption">
                                COMPANY NAME
                            </span>
                            <h3 className="company-card-title">
                                {selectedCompany?.name ?? "Select a company"}
                            </h3>
                        </div>
                    </div>
                    {(!query.error &&
                        company &&
                        (query.isPending || loadedCompany !== company)) ||
                    roles.isPending ? (
                        <Loading />
                    ) : query.error || roles.error ? (
                        <ErrorState error={query.error ?? roles.error} />
                    ) : !company ? (
                        <div className="notice">
                            Create an active company before assigning business
                            roles.
                        </div>
                    ) : (
                        <>
                            <div className="person-role-scroll">
                                <table className="person-role-table">
                                    <thead>
                                        <tr>
                                            <th>BUSINESS ROLE</th>
                                            <th>OPENING AMOUNT (PKR)</th>
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {roleOptions.map((role) => {
                                            const value = draft[role.id] ?? {
                                                selected: false,
                                                amount: "",
                                            };
                                            const existing =
                                                snapshot?.classifications.find(
                                                    (item) =>
                                                        Number(
                                                            item.business_type_id,
                                                        ) === role.id,
                                                );
                                            const writable =
                                                canEdit &&
                                                (existing
                                                    ? capabilities.update
                                                    : capabilities.create) &&
                                                !save.isPending &&
                                                !reload.isPending;
                                            return (
                                                <tr
                                                    key={role.id}
                                                    className={
                                                        value.selected
                                                            ? "role-assigned"
                                                            : ""
                                                    }
                                                >
                                                    <td>
                                                        <label>
                                                            <input
                                                                type="checkbox"
                                                                aria-label={`Assign ${role.name}`}
                                                                checked={
                                                                    value.selected
                                                                }
                                                                disabled={
                                                                    !writable
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) => {
                                                                    onEditingChange(
                                                                        true,
                                                                    );
                                                                    setDraft(
                                                                        (
                                                                            current,
                                                                        ) => ({
                                                                            ...current,
                                                                            [role.id]:
                                                                                {
                                                                                    ...value,
                                                                                    selected:
                                                                                        event
                                                                                            .target
                                                                                            .checked,
                                                                                },
                                                                        }),
                                                                    );
                                                                }}
                                                            />
                                                            <span>
                                                                {role.name}
                                                            </span>
                                                        </label>
                                                    </td>
                                                    <td>
                                                        <input
                                                            aria-label={`Opening amount for ${role.name}`}
                                                            type="text"
                                                            inputMode="decimal"
                                                            pattern="-?[0-9]{1,17}(\.[0-9]{1,2})?"
                                                            value={value.amount}
                                                            disabled={
                                                                !value.selected ||
                                                                !writable
                                                            }
                                                            onChange={(
                                                                event,
                                                            ) => {
                                                                onEditingChange(
                                                                    true,
                                                                );
                                                                setDraft(
                                                                    (
                                                                        current,
                                                                    ) => ({
                                                                        ...current,
                                                                        [role.id]:
                                                                            {
                                                                                ...value,
                                                                                amount: event
                                                                                    .target
                                                                                    .value,
                                                                            },
                                                                    }),
                                                                );
                                                            }}
                                                            placeholder="Optional"
                                                        />
                                                    </td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="text-button"
                                                            aria-label={`View all ${role.name} for ${selectedCompany?.name}`}
                                                            onClick={() =>
                                                                setViewing(role)
                                                            }
                                                        >
                                                            <Eye size={14} />
                                                            View all
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {!roleOptions.length && (
                                <p className="section-note">
                                    No active business roles have been
                                    configured.
                                </p>
                            )}
                            {hiddenAssignments.length > 0 && (
                                <p className="section-note">
                                    Historical assignments to inactive roles are
                                    retained.
                                </p>
                            )}
                            {conflict && (
                                <div className="notice" role="alert">
                                    Company roles changed after editing began.
                                    Your draft has been kept.
                                    <button
                                        type="button"
                                        className="btn small"
                                        disabled={reload.isPending}
                                        onClick={() => reload.mutate()}
                                    >
                                        <History size={14} />
                                        Reload and review
                                    </button>
                                </div>
                            )}
                            {save.error && <ErrorState error={save.error} />}
                        </>
                    )}
                </section>
            </div>
            <EmployeeDetails
                person={person.id}
                joiningDate={String(person.joining_date ?? "").slice(0, 10)}
                personVersion={person.version}
                hideWhenEmpty
            />
            <Modal
                open={!!viewing}
                onClose={() => setViewing(null)}
                title={`${viewing?.name ?? "Role"} · ${selectedCompany?.name ?? ""}`}
                description="People with this active business role in the selected company."
                wide
            >
                {viewing && company && (
                    <RolePeople
                        key={`${company}-${viewing.id}`}
                        company={company}
                        role={viewing.id}
                    />
                )}
            </Modal>
        </div>
    );
}
function RolePeople({ company, role }: { company: number; role: number }) {
    const [search, setSearch] = useState("");
    const term = useDebounced(search);
    const [page, setPage] = useState(1);
    const query = useQuery({
        queryKey: ["role-people", company, role, term, page],
        queryFn: () =>
            api<PageResult>(
                `/api/v1/people?${params({ company_id: company, business_type_id: role, search: term, page, per_page: 15, context: "lookup" })}`,
            ),
    });
    return (
        <>
            <div className="search-input">
                <Search size={16} />
                <input
                    aria-label="Search people in role"
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                    }}
                    placeholder="Search people…"
                />
            </div>
            {query.isPending ? (
                <Loading />
            ) : query.error ? (
                <ErrorState error={query.error} />
            ) : (
                <>
                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>PERSON</th>
                                    <th>CODE</th>
                                    <th>CNIC</th>
                                </tr>
                            </thead>
                            <tbody>
                                {query.data.data.map((person) => (
                                    <tr key={person.id}>
                                        <td>{person.name}</td>
                                        <td>{person.code}</td>
                                        <td>{String(person.cnic ?? "—")}</td>
                                    </tr>
                                ))}
                                {!query.data.data.length && (
                                    <tr>
                                        <td colSpan={3}>
                                            No people are assigned to this
                                            company and role.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <Pagination
                        page={page}
                        last={query.data.meta.last_page}
                        total={query.data.meta.total}
                        onChange={setPage}
                    />
                </>
            )}
        </>
    );
}
