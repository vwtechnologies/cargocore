import { useEffect, useRef, useState, type Ref } from "react";
import {
    useMutation,
    useQuery,
    useQueryClient,
    useIsMutating,
} from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { MasterDetailShell } from "../components/MasterDetailShell";
import { ChildSection } from "../components/Records";
import { Badge, ErrorState, Loading, useDebounced } from "../components/ui";
import {
    Building2,
    CreditCard,
    LockKeyhole,
    Phone,
    Tags,
    User,
} from "../components/icons";
import { api, managementApi, params } from "../lib/api";
import { useDirty } from "../lib/dirty";
import { useSession } from "../lib/session";
import type { PageResult, RecordData } from "../lib/types";
import { PersonBasic } from "./PersonBasic";
import { PersonCompanyAssociations } from "./PersonCompanyAssociations";
import { PersonAccount } from "./PersonAccount";

export type PersonActions = { save: () => void; cancel: () => void };
export type PersonSectionProps = {
    person: RecordData;
    editing: boolean;
    actions: Ref<PersonActions>;
    onEditingChange: (value: boolean) => void;
};
const tabs = [
    ["basic", "Personal Details", User],
    ["associations", "Company Associations", Building2],
    ["contacts", "Contacts", Phone],
    ["markas", "Marka", Tags],
    ["accounts", "Bank Accounts", CreditCard],
    ["access", "User Account", LockKeyhole],
] as const;
export const initials = (name: unknown) =>
    String(name ?? "")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();

export function PeoplePage() {
    const { id } = useParams();
    const { pathname } = useLocation();
    const { session } = useSession();
    const guard = useDirty();
    const navigate = useNavigate();
    const cache = useQueryClient();
    const capabilities = session.entities.people.capabilities;
    const isSaving = useIsMutating() > 0;
    const [search, setSearch] = useState("");
    const term = useDebounced(search);
    const [page, setPage] = useState(1);
    const [tab, setTab] = useState("basic");
    const [editing, setEditing] = useState(false);
    const [creating, setCreating] = useState(false);
    const [destination, setDestination] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<RecordData | null>(null);
    const actions = useRef<PersonActions>(null);
    const content = useRef<HTMLDivElement>(null);
    const root = useRef<HTMLDivElement>(null);
    const list = useQuery({
        queryKey: ["person-master", term, page],
        queryFn: () =>
            managementApi<PageResult>(
                `/api/v1/people?${params({ search: term, page, per_page: 25 })}`,
            ),
    });
    const directory = useQuery({
        queryKey: ["person-directory"],
        queryFn: () => managementApi<PageResult>("/api/v1/people?per_page=100"),
    });
    const query = useQuery({
        queryKey: ["person-workspace", id],
        queryFn: () =>
            managementApi<{ data: RecordData }>(`/api/v1/people/${id}`),
        enabled: !!id && !creating,
    });
    const person = creating ? undefined : query.data?.data;
    useEffect(() => {
        if (!id && !creating && !destination && list.data?.data[0])
            navigate(`/people/${list.data.data[0].id}`, { replace: true });
    }, [id, creating, destination, list.data, navigate]);
    useEffect(() => {
        const scroller = root.current?.querySelector<HTMLElement>(
            ".company-table-container",
        );
        const selected =
            scroller?.querySelector<HTMLElement>("tr.row-selected");
        if (!scroller || !selected || creating) return;
        const row = selected.getBoundingClientRect();
        const bounds = scroller.getBoundingClientRect();
        if (row.top < bounds.top) scroller.scrollTop += row.top - bounds.top;
        else if (row.bottom > bounds.bottom)
            scroller.scrollTop += row.bottom - bounds.bottom;
    }, [person?.id, creating, list.data]);
    useEffect(() => {
        if (destination === pathname) {
            setDestination(null);
        } else if (destination && !guard.dirty) {
            navigate(destination, { replace: true });
        }
    }, [destination, pathname, guard.dirty, navigate]);
    function select(record: RecordData) {
        if (isSaving || !guard.discard()) return;
        setCreating(false);
        setEditing(false);
        setDestination(`/people/${record.id}`);
    }
    const remove = useMutation({
        mutationFn: () =>
            api(`/api/v1/people/${deleting!.id}`, {
                method: "DELETE",
                body: JSON.stringify({ version: deleting!.version }),
            }),
        onSuccess: async () => {
            setDeleting(null);
            setEditing(false);
            await cache.invalidateQueries({ queryKey: ["person-master"] });
            setDestination("/people");
            toast.success("Person deleted");
        },
        onError: (error) => toast.error(error.message),
    });
    function changeTab(next: string) {
        if (isSaving || tab === next || !guard.discard()) return;
        setEditing(false);
        setTab(next);
    }
    const sectionCanEdit =
        tab === "basic"
            ? capabilities.update
            : tab === "associations"
              ? session.entities.associations.capabilities.update ||
                session.entities.associations.capabilities.create
              : tab === "access"
                ? session.permissions.includes("users.update") ||
                  session.permissions.includes("users.create")
                : tab === "markas"
                  ? session.entities["person-markas"].capabilities.update ||
                    session.entities["person-markas"].capabilities.create
                  : tab === "contacts"
                    ? capabilities.update
                    : false;
    return (
        <div className="people-workspace" ref={root}>
            <MasterDetailShell
                title="Person Information"
                icon={<User size={22} />}
                isEditing={editing}
                isSaving={isSaving}
                isCreating={creating}
                hasSelectedItem={!!person}
                canCreate={capabilities.create && !isSaving}
                canUpdate={sectionCanEdit && !isSaving}
                canDelete={capabilities.delete && !isSaving}
                onStartCreate={() => {
                    if (guard.discard()) {
                        setCreating(true);
                        setEditing(true);
                        setTab("basic");
                    }
                }}
                onStartEdit={() => {
                    if (tab === "contacts" || tab === "markas")
                        content.current
                            ?.querySelector<HTMLElement>(
                                ".editable-detail-table tbody td",
                            )
                            ?.focus();
                    else setEditing(true);
                }}
                onSave={() => actions.current?.save()}
                onCancel={() => {
                    if (creating) {
                        if (guard.discard()) {
                            setCreating(false);
                            setEditing(false);
                        }
                    } else actions.current?.cancel();
                }}
                onDelete={() => {
                    if (person && guard.discard()) setDeleting(person);
                }}
                newAriaLabel="New person"
                newButtonLabel="New"
                listHeading="People"
                items={list.data?.data ?? []}
                columns={[
                    {
                        key: "name",
                        label: "Person",
                        render: (item) => (
                            <button
                                type="button"
                                className="company-row-btn people-list-person"
                                aria-label={String(item.name)}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    select(item);
                                }}
                            >
                                <span className="avatar">
                                    {initials(item.name)}
                                </span>
                                <span>
                                    <strong>{String(item.name)}</strong>
                                    <small>
                                        {item.code}
                                        {item.cnic ? ` · ${item.cnic}` : ""}
                                    </small>
                                </span>
                            </button>
                        ),
                    },
                ]}
                selectedId={
                    creating ? null : (person?.id ?? Number(id) ?? null)
                }
                onSelectItem={select}
                isLoading={list.isPending}
                search={search}
                searchAriaLabel="Search people"
                searchPlaceholder="Name, code or CNIC…"
                onSearchChange={(value) => {
                    if (guard.discard()) {
                        setSearch(value);
                        setPage(1);
                    }
                }}
                page={page}
                lastPage={list.data?.meta.last_page ?? 1}
                totalRecords={list.data?.meta.total ?? 0}
                onPageChange={(value) => {
                    if (guard.discard()) setPage(value);
                }}
                viewAllItems={directory.data?.data}
                viewAllColumns={[
                    { key: "name", label: "Full Name" },
                    { key: "code", label: "Person Code" },
                    { key: "cnic", label: "CNIC" },
                ]}
                onSelectFromViewAll={select}
                isDeleting={!!deleting}
                onCloseDelete={() => setDeleting(null)}
                onConfirmDelete={() => remove.mutate()}
                deleteTitle="Delete Person?"
                deleteDescription={`Delete ${deleting?.name ?? "this person"}? Linked records prevent deletion; mark the person inactive to retain their history.`}
                isDeletingBusy={remove.isPending}
            >
                <div className="person-workspace-content" ref={content}>
                    <div className="person-identity-header">
                        <span className="person-identity-avatar">
                            <User size={25} />
                        </span>
                        <div>
                            <h2>
                                {creating
                                    ? "New person"
                                    : String(person?.name ?? "Select a person")}
                            </h2>
                            <p>
                                {person?.code ?? "One record per person"}
                                {person ? (
                                    <>
                                        <span> · </span>
                                        <Badge
                                            active={person.status}
                                            label={
                                                person.status
                                                    ? "Active"
                                                    : "Inactive"
                                            }
                                        />
                                    </>
                                ) : (
                                    ""
                                )}
                            </p>
                        </div>
                        <span className="company-editing-badge">
                            {creating
                                ? "Creating"
                                : editing
                                  ? "Editing"
                                  : "Read only"}
                        </span>
                    </div>
                    <div
                        className="person-tabs"
                        role="tablist"
                        aria-label="Person sections"
                        onKeyDown={(event) => {
                            if (
                                ![
                                    "ArrowLeft",
                                    "ArrowRight",
                                    "Home",
                                    "End",
                                ].includes(event.key)
                            )
                                return;
                            event.preventDefault();
                            const enabled = Array.from(
                                event.currentTarget.querySelectorAll<HTMLButtonElement>(
                                    "button:not([disabled])",
                                ),
                            );
                            const current = enabled.indexOf(
                                document.activeElement as HTMLButtonElement,
                            );
                            const next =
                                event.key === "Home"
                                    ? 0
                                    : event.key === "End"
                                      ? enabled.length - 1
                                      : (current +
                                            (event.key === "ArrowRight"
                                                ? 1
                                                : -1) +
                                            enabled.length) %
                                        enabled.length;
                            enabled[next]?.focus();
                        }}
                    >
                        {tabs.map(([key, label, Icon]) => (
                            <button
                                key={key}
                                id={`person-tab-${key}`}
                                type="button"
                                role="tab"
                                aria-selected={tab === key}
                                aria-controls="person-tab-panel"
                                tabIndex={tab === key ? 0 : -1}
                                disabled={creating && key !== "basic"}
                                onClick={() => changeTab(key)}
                            >
                                <Icon size={15} />
                                {label}
                            </button>
                        ))}
                    </div>
                    <div
                        id="person-tab-panel"
                        role="tabpanel"
                        aria-labelledby={`person-tab-${tab}`}
                    >
                        {list.error ? (
                            <ErrorState error={list.error} />
                        ) : !creating && query.error ? (
                            <ErrorState error={query.error} />
                        ) : !creating && !person ? (
                            query.isPending && id ? (
                                <Loading />
                            ) : (
                                <div className="notice">
                                    Select a person or create a new record.
                                </div>
                            )
                        ) : tab === "basic" ? (
                            <PersonBasic
                                key={creating ? "new" : person!.id}
                                person={person}
                                editing={editing || creating}
                                creating={creating}
                                actions={actions}
                                onEditingChange={setEditing}
                                onSaved={(record) => {
                                    guard.clear();
                                    cache.setQueryData(
                                        ["person-workspace", String(record.id)],
                                        { data: record },
                                    );
                                    setCreating(false);
                                    setEditing(false);
                                    setDestination(`/people/${record.id}`);
                                }}
                            />
                        ) : person && tab === "associations" ? (
                            <PersonCompanyAssociations
                                key={person.id}
                                person={person}
                                editing={editing}
                                actions={actions}
                                onEditingChange={setEditing}
                            />
                        ) : person && tab === "contacts" ? (
                            <ChildSection
                                key={person.id}
                                entity="contacts"
                                parent={{ entity: "people", id: person.id }}
                                title="Contact Information"
                            />
                        ) : person && tab === "markas" ? (
                            <ChildSection
                                key={person.id}
                                entity="person-markas"
                                parent={{ entity: "people", id: person.id }}
                                title="Marka"
                            />
                        ) : tab === "accounts" ? (
                            <section className="company-card coming-soon">
                                <CreditCard size={32} />
                                <h2>Coming Soon</h2>
                                <p>Bank Accounts</p>
                            </section>
                        ) : person && tab === "access" ? (
                            <PersonAccount
                                key={person.id}
                                person={person}
                                editing={editing}
                                actions={actions}
                                onEditingChange={setEditing}
                            />
                        ) : null}
                    </div>
                </div>
            </MasterDetailShell>
        </div>
    );
}
