import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
    useIsMutating,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    type ColumnDef,
} from "@tanstack/react-table";
import {
    ArrowDownUp,
    ChevronRight,
    Plus,
    Search,
    SlidersHorizontal,
    Pencil,
    Trash2,
    Star,
    Power,
    ArrowLeft,
    ChevronsLeft,
    ChevronsRight,
    ChevronLeft,
    Check,
    X,
} from "./icons";
import { toast } from "sonner";
import {
    api,
    managementApi,
    display,
    endpoint,
    money,
    params,
} from "../lib/api";
import { useDirty } from "../lib/dirty";
import { useRecordShortcuts } from "../lib/record-shortcuts";
import { useSession } from "../lib/session";
import { ApiError } from "../lib/types";
import type { PageResult, RecordData } from "../lib/types";
import { RecordForm, type Parent } from "./RecordForm";
import { RelatedDetailTable } from "./RelatedDetailTable";
import { PageActions } from "./PageActions";
import {
    Badge,
    Confirm,
    Empty,
    ErrorState,
    Loading,
    Modal,
    Pagination,
    PanelTitle,
    useDebounced,
} from "./ui";
const columnsByEntity: Record<string, string[]> = {
    companies: ["name", "code", "short_name", "status"],
    countries: ["name", "short_name", "display_sequence", "status"],
    banks: ["name", "short_name", "uan", "status"],
    people: ["name", "code", "cnic", "status"],
    markas: ["code", "description", "status"],
    "employee-types": ["name", "status"],
    "business-types": ["code", "name", "status"],
    "sub-companies": ["name", "code", "is_default", "status"],
    cities: ["code", "name", "short_name_1", "status"],
    branches: ["name", "city_name", "branch_code", "status"],
    officers: ["person_name", "designation", "branch_name", "status"],
    contacts: ["label", "address", "phone", "mobile", "email"],
    accounts: [
        "bank_name",
        "branch_name",
        "account_title",
        "account_number",
        "status",
    ],
    associations: ["company_name", "status"],
    classifications: ["business_type_name", "opening_balance", "status"],
    "person-markas": ["marka_code", "marka_description", "status"],
};
const extraLabels: Record<string, string> = {
    code: "Code",
    city_name: "City",
    person_name: "Officer",
    branch_name: "Branch",
    bank_name: "Bank",
    company_name: "Company",
    business_type_name: "Business role",
};
export function recordLabel(record: RecordData) {
    return String(
        record.name ??
            record.company_name ??
            record.business_type_name ??
            record.person_name ??
            record.account_title ??
            record.label ??
            record.code ??
            `Record #${record.id}`,
    );
}
export function RecordStatusAction({
    entity,
    record,
    parent,
}: {
    entity: string;
    record: RecordData;
    parent?: Parent;
}) {
    const { session } = useSession();
    const action = record.status ? "Deactivate" : "Activate";
    const mutation = useMutation({
        mutationFn: () =>
            api(`${endpoint(entity, parent)}/${record.id}`, {
                method: "PUT",
                body: JSON.stringify({ ...record, status: !record.status }),
            }),
        onSuccess: () =>
            toast.success(record.status ? "Record inactive" : "Record active"),
        onError: (error) => toast.error(error.message),
    });
    if (!session.entities[entity]?.capabilities.update) return null;
    return (
        <button
            type="button"
            className="icon-action-btn"
            aria-label={`${action} ${recordLabel(record)}`}
            aria-pressed={record.status}
            title={`${record.status ? "Active" : "Inactive"} · ${action}`}
            style={{ color: record.status ? "#147d64" : "#a33d35" }}
            disabled={mutation.isPending}
            onClick={(event) => {
                event.stopPropagation();
                mutation.mutate();
            }}
        >
            <Power size={15} />
        </button>
    );
}

export function RecordGrid({
    entity,
    parent,
    title,
    subtitle,
    filters = {},
    onSelect,
    selected,
    compact = false,
    createDefaults = {},
    persistFilters = false,
}: {
    entity: string;
    parent?: Parent;
    title?: string;
    subtitle?: string;
    filters?: Record<string, unknown>;
    onSelect?: (r: RecordData, query: string) => void;
    persistFilters?: boolean;
    selected?: number;
    compact?: boolean;
    createDefaults?: Record<string, unknown>;
}) {
    const { session } = useSession();
    const definition = session.entities[entity];
    const [urlFilters, setUrlFilters] = useSearchParams();
    const initial = (key: string, fallback: string) =>
        persistFilters ? (urlFilters.get(key) ?? fallback) : fallback;
    const [search, setSearch] = useState(initial("search", ""));
    const debounced = useDebounced(search);
    const [page, setPage] = useState(Number(initial("page", "1")) || 1);
    const [status, setStatus] = useState(initial("status", ""));
    const [sort, setSort] = useState(initial("sort", "id"));
    const [direction, setDirection] = useState(initial("direction", "asc"));
    const [creating, setCreating] = useState(false);
    const shortcutScope = useRef<HTMLElement>(null);
    const [dirty, setDirty] = useState(false);
    const previousFilters = useRef(JSON.stringify(filters));
    useEffect(() => {
        const current = JSON.stringify(filters);
        if (previousFilters.current !== current) {
            previousFilters.current = current;
            setPage(1);
        }
    }, [JSON.stringify(filters)]);
    const query = useQuery({
        queryKey: [
            "records",
            entity,
            parent,
            debounced,
            page,
            status,
            sort,
            direction,
            filters,
        ],
        queryFn: () =>
            managementApi<PageResult>(
                `${endpoint(entity, parent)}?${params({ ...filters, search: debounced, page, status, sort, direction, per_page: compact ? 10 : 15 })}`,
            ),
        enabled: definition.capabilities.view,
    });
    const filterQuery = params({
        ...filters,
        search: debounced,
        page,
        status,
        sort,
        direction,
    });
    useEffect(() => {
        if (persistFilters) setUrlFilters(filterQuery, { replace: true });
    }, [filterQuery, persistFilters]);
    const keys = compact
        ? ["name", "status"]
        : (columnsByEntity[entity] ?? ["name", "status"]);
    const columns = useMemo<ColumnDef<RecordData>[]>(
        () =>
            keys.map((key) => ({
                accessorKey: key,
                header:
                    definition.fields[key]?.label ?? extraLabels[key] ?? key,
                cell: ({ row }) =>
                    key === "status" ? (
                        <Badge active={row.original.status} />
                    ) : key === "is_default" ? (
                        row.original[key] ? (
                            <span className="default-tag">
                                <Star size={12} />
                                Default
                            </span>
                        ) : (
                            "—"
                        )
                    ) : key === "opening_balance" ? (
                        money(row.original[key])
                    ) : key === "name" ? (
                        <div className="name-cell">
                            <span
                                aria-hidden="true"
                                className={`avatar avatar-${row.original.id % 4}`}
                            >
                                {recordLabel(row.original)
                                    .slice(0, 2)
                                    .toUpperCase()}
                            </span>
                            <div>
                                <strong>{display(row.original[key])}</strong>
                                {compact && entity !== "employee-types" && (
                                    <small>{row.original.code}</small>
                                )}
                            </div>
                        </div>
                    ) : (
                        <span className={key === "code" ? "code" : ""}>
                            {display(row.original[key])}
                        </span>
                    ),
            })),
        [entity, compact],
    );
    const table = useReactTable({
        data: query.data?.data ?? [],
        columns,
        getCoreRowModel: getCoreRowModel(),
    });
    const close = (saved = false) => {
        if (saved || !dirty || window.confirm("Discard unsaved changes?")) {
            setCreating(false);
            setDirty(false);
        }
    };
    useRecordShortcuts({
        scope: shortcutScope,
        page: !parent,
        enabled: !query.isPending && !creating,
        canCreate: definition.capabilities.create,
        onNew: () => setCreating(true),
    });
    if (!definition.capabilities.view)
        return (
            <div className="notice">
                You do not have access to this section.
            </div>
        );
    return (
        <>
            <section
                ref={shortcutScope}
                className={`panel record-grid ${compact ? "compact" : ""}`}
            >
                {title && (
                    <PanelTitle
                        title={title}
                        subtitle={subtitle}
                        action={
                            definition.capabilities.create && (
                                <PageActions sticky={!parent}>
                                    <button
                                        className="btn primary small"
                                        onClick={() => setCreating(true)}
                                    >
                                        <Plus size={15} />
                                        <span>
                                            Add{" "}
                                            {entity === "people"
                                                ? "person"
                                                : "record"}
                                        </span>
                                    </button>
                                </PageActions>
                            )
                        }
                    />
                )}
                <div className="table-toolbar">
                    <div className="search-input">
                        <Search size={16} />
                        <input
                            aria-label={`Search ${definition.label}`}
                            placeholder={`Search ${definition.label.toLowerCase()}…`}
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>
                    <select
                        aria-label="Filter status"
                        value={status}
                        onChange={(event) => {
                            setStatus(event.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="">All statuses</option>
                        <option value="1">Active</option>
                        <option value="0">Inactive</option>
                    </select>
                    {!title && definition.capabilities.create && (
                        <PageActions sticky={!parent}>
                            <button
                                className="btn primary small"
                                onClick={() => setCreating(true)}
                            >
                                <Plus size={16} />
                                Add record
                            </button>
                        </PageActions>
                    )}
                </div>
                {query.isPending ? (
                    <Loading />
                ) : query.error ? (
                    <ErrorState
                        error={query.error}
                        retry={() => query.refetch()}
                    />
                ) : query.data?.data.length === 0 ? (
                    <Empty
                        title={
                            search
                                ? "No matching records"
                                : `No ${definition.label.toLowerCase()} yet`
                        }
                        description={
                            search
                                ? "Try another search or change your filters."
                                : "Add a record to start building your connected workspace."
                        }
                        action={
                            !title &&
                            definition.capabilities.create && (
                                <button
                                    className="btn secondary small"
                                    onClick={() => setCreating(true)}
                                >
                                    <Plus size={14} />
                                    Add record
                                </button>
                            )
                        }
                    />
                ) : (
                    <div className="table-scroll">
                        <table>
                            <thead>
                                {table.getHeaderGroups().map((g) => (
                                    <tr key={g.id}>
                                        {g.headers.map((h) => (
                                            <th key={h.id}>
                                                <button
                                                    onClick={() => {
                                                        if (sort === h.id)
                                                            setDirection(
                                                                direction ===
                                                                    "asc"
                                                                    ? "desc"
                                                                    : "asc",
                                                            );
                                                        else {
                                                            setSort(h.id);
                                                            setDirection("asc");
                                                        }
                                                        setPage(1);
                                                    }}
                                                >
                                                    {flexRender(
                                                        h.column.columnDef
                                                            .header,
                                                        h.getContext(),
                                                    )}
                                                    <ArrowDownUp size={11} />
                                                </button>
                                            </th>
                                        ))}
                                        {onSelect && (
                                            <th aria-label="Open record" />
                                        )}
                                    </tr>
                                ))}
                            </thead>
                            <tbody>
                                {table.getRowModel().rows.map((row) => (
                                    <tr
                                        key={row.id}
                                        className={
                                            selected === row.original.id
                                                ? "selected"
                                                : ""
                                        }
                                        onClick={() =>
                                            onSelect?.(
                                                row.original,
                                                filterQuery,
                                            )
                                        }
                                    >
                                        {row
                                            .getVisibleCells()
                                            .map((cell, i) => (
                                                <td key={cell.id}>
                                                    {i === 0 && onSelect ? (
                                                        <button
                                                            className="row-link"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onSelect(
                                                                    row.original,
                                                                    filterQuery,
                                                                );
                                                            }}
                                                        >
                                                            {flexRender(
                                                                cell.column
                                                                    .columnDef
                                                                    .cell,
                                                                cell.getContext(),
                                                            )}
                                                        </button>
                                                    ) : (
                                                        flexRender(
                                                            cell.column
                                                                .columnDef.cell,
                                                            cell.getContext(),
                                                        )
                                                    )}
                                                </td>
                                            ))}
                                        {onSelect && (
                                            <td>
                                                <ChevronRight
                                                    size={16}
                                                    className="muted"
                                                />
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {query.data && (
                    <Pagination
                        page={page}
                        last={query.data.meta.last_page}
                        total={query.data.meta.total}
                        onChange={setPage}
                    />
                )}
            </section>
            <Modal
                open={creating}
                onClose={() => close()}
                title={`New ${definition.label === "People" ? "person" : definition.label.toLowerCase().replace(/ies$/, "y").replace(/s$/, "")}`}
                description={
                    parent
                        ? "This record will be linked to the selected parent."
                        : "Create a new record in your business workspace."
                }
                wide
            >
                <RecordForm
                    entity={entity}
                    parent={parent}
                    defaults={createDefaults}
                    onDirty={setDirty}
                    onDone={close}
                />
            </Modal>
        </>
    );
}
export function RecordDetails({
    entity,
    record,
    parent,
    onClose,
    children,
}: {
    entity: string;
    record: RecordData;
    parent?: Parent;
    onClose?: () => void;
    children?: React.ReactNode;
}) {
    const { session } = useSession();
    const definition = session.entities[entity];
    const cache = useQueryClient();
    const isSaving = useIsMutating() > 0;
    const [editing, setEditing] = useState(false);
    const [creating, setCreating] = useState(false);
    const shortcutScope = useRef<HTMLElement>(null);
    const [dirty, setDirty] = useState(false);
    const [deleting, setDeleting] = useState(false);
    useEffect(() => {
        setEditing(false);
        setDirty(false);
    }, [record.id]);
    const remove = useMutation({
        mutationFn: () =>
            api(`${endpoint(entity, parent)}/${record.id}`, {
                method: "DELETE",
                body: JSON.stringify({ version: record.version }),
            }),
        onSuccess: () => {
            cache.invalidateQueries();
            toast.success("Record deleted");
            setDeleting(false);
            onClose?.();
        },
        onError: (e) => {
            toast.error(e.message);
            setDeleting(false);
        },
    });
    const cancel = (saved = false) => {
        if (saved || !dirty || window.confirm("Discard unsaved changes?")) {
            setEditing(false);
            setCreating(false);
            setDirty(false);
        }
    };
    useRecordShortcuts({
        scope: shortcutScope,
        page: !parent,
        enabled: !remove.isPending,
        canCreate: definition.capabilities.create,
        canUpdate: definition.capabilities.update && !editing && !creating,
        onNew: () => {
            if (dirty && !window.confirm("Discard unsaved changes?")) return;
            setEditing(false);
            setDirty(false);
            setCreating(true);
        },
        onEdit: () => setEditing(true),
        canSave: editing,
        onSave: () =>
            shortcutScope.current?.querySelector("form")?.requestSubmit(),
    });
    return (
        <>
            <section className="panel detail-panel" ref={shortcutScope}>
                <PanelTitle
                    title={recordLabel(record)}
                    subtitle={
                        entity !== "employee-types" && record.code
                            ? `${record.code} · Record details`
                            : `Record #${record.id}`
                    }
                    action={
                        <PageActions className="button-group" sticky={!parent}>
                            {record.is_default === true && (
                                <span className="default-tag">
                                    <Star size={13} />
                                    Default
                                </span>
                            )}
                            <Badge active={record.status} />
                            {editing && (
                                <>
                                    <button
                                        className="btn primary small"
                                        disabled={isSaving}
                                        onClick={() =>
                                            shortcutScope.current
                                                ?.querySelector("form")
                                                ?.requestSubmit()
                                        }
                                    >
                                        <Check className="mobile-action-icon" />{" "}
                                        Save
                                    </button>
                                    <button
                                        className="btn secondary small"
                                        disabled={isSaving}
                                        onClick={() => cancel()}
                                    >
                                        <X className="mobile-action-icon" />{" "}
                                        Cancel
                                    </button>
                                </>
                            )}
                            {!editing && definition.capabilities.update && (
                                <button
                                    className="btn secondary small"
                                    onClick={() => setEditing(true)}
                                >
                                    <Pencil size={14} />
                                    Edit
                                </button>
                            )}
                            {!editing && definition.capabilities.delete && (
                                <button
                                    className="icon-button delete-button"
                                    title="Delete record"
                                    aria-label="Delete record"
                                    onClick={() => setDeleting(true)}
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </PageActions>
                    }
                />
                {editing ? (
                    <RecordForm
                        key={record.id}
                        entity={entity}
                        parent={parent}
                        record={record}
                        onDirty={setDirty}
                        onDone={cancel}
                    />
                ) : (
                    <dl className="detail-grid">
                        {Object.entries(definition.fields)
                            .filter(
                                ([key, f]) =>
                                    key !== "status" && key !== "is_default",
                            )
                            .map(([key, field]) => (
                                <div
                                    key={key}
                                    className={
                                        field.type === "textarea"
                                            ? "span-two"
                                            : ""
                                    }
                                >
                                    <dt>{field.label}</dt>
                                    <dd>
                                        {field.type === "reference"
                                            ? display(
                                                  (record[
                                                      key.replace(
                                                          "_id",
                                                          "_name",
                                                      )
                                                  ] ??
                                                      record[
                                                          key ===
                                                          "bank_branch_id"
                                                              ? "branch_name"
                                                              : key
                                                      ])
                                                      ? (record[
                                                            key.replace(
                                                                "_id",
                                                                "_name",
                                                            )
                                                        ] ??
                                                            record[
                                                                key ===
                                                                "bank_branch_id"
                                                                    ? "branch_name"
                                                                    : key
                                                            ])
                                                      : null,
                                              )
                                            : field.type === "money"
                                              ? money(record[key])
                                              : field.type === "list"
                                                ? Array.isArray(record[key])
                                                    ? (
                                                          record[
                                                              key
                                                          ] as string[]
                                                      ).map((v, i) => (
                                                          <span
                                                              className="value-chip"
                                                              key={i}
                                                          >
                                                              {v}
                                                          </span>
                                                      ))
                                                    : "—"
                                                : display(record[key])}
                                    </dd>
                                </div>
                            ))}
                    </dl>
                )}
                {children}
            </section>
            <Confirm
                open={deleting}
                title="Delete this record?"
                description="Deletion is allowed only when no dependent records reference this record. Deactivate referenced records instead."
                busy={remove.isPending}
                onClose={() => setDeleting(false)}
                onConfirm={() => remove.mutate()}
            />
            <Modal
                open={creating}
                onClose={() => cancel()}
                title={`New ${definition.label.toLowerCase().replace(/ies$/, "y").replace(/s$/, "")}`}
                wide
            >
                <RecordForm
                    entity={entity}
                    parent={parent}
                    onDirty={setDirty}
                    onDone={cancel}
                />
            </Modal>
        </>
    );
}
export function ChildSection({
    entity,
    parent,
    filters = {},
    title,
    children,
    createDefaults = {},
}: {
    entity: string;
    parent: Parent;
    filters?: Record<string, unknown>;
    title?: string;
    children?: (r: RecordData) => React.ReactNode;
    createDefaults?: Record<string, unknown>;
}) {
    const [selected, setSelected] = useState<RecordData>();
    const guard = useDirty();
    useEffect(() => setSelected(undefined), [parent.id, entity]);
    const query = useQuery({
        queryKey: ["record", entity, parent, selected?.id],
        queryFn: () =>
            managementApi<{ data: RecordData }>(
                `${endpoint(entity, parent)}/${selected!.id}`,
            ),
        enabled: !!selected,
    });
    useEffect(() => {
        if (query.error instanceof ApiError && query.error.status === 404)
            setSelected(undefined);
    }, [query.error]);
    return (
        <div className="section-stack">
            <RelatedDetailTable
                key={`${entity}-${parent.entity}-${parent.id}`}
                entity={entity}
                parent={parent}
                filters={filters}
                title={title ?? "Linked records"}
                selected={selected?.id}
                createDefaults={createDefaults}
                onSelect={(record, saved) => {
                    if (
                        saved ||
                        !children ||
                        selected?.id === record.id ||
                        guard.discard()
                    )
                        setSelected(record);
                }}
            />
            {selected &&
                children &&
                (query.isPending ? (
                    <Loading />
                ) : query.error ? (
                    <ErrorState error={query.error} />
                ) : (
                    query.data && (
                        <div key={selected.id}>
                            {children?.(query.data.data)}
                        </div>
                    )
                ))}
        </div>
    );
}
