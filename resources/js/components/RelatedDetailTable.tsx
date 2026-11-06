import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, endpoint, managementApi, params } from "../lib/api";
import { useSession } from "../lib/session";
import type { PageResult, RecordData } from "../lib/types";
import type { Parent } from "./RecordForm";
import {
    EditableDetailTable,
    InlineStatus,
    type DetailColumn,
    type DetailTableHandle,
} from "./EditableDetailTable";
import { ReferenceSelect } from "./ReferenceSelect";
import {
    Badge,
    Confirm,
    ErrorState,
    Pagination,
    PanelTitle,
    useDebounced,
} from "./ui";
import { Plus, Search } from "./icons";

type Values = Record<string, unknown>;
export function RelatedDetailTable({
    entity,
    parent,
    title,
    filters,
    createDefaults,
    selected,
    onSelect,
}: {
    entity: string;
    parent: Parent;
    title: string;
    filters: Values;
    createDefaults: Values;
    selected?: number;
    onSelect: (record: RecordData, saved?: boolean) => void;
}) {
    const { session } = useSession();
    const definition = session.entities[entity];
    const table = useRef<DetailTableHandle>(null);
    const [search, setSearch] = useState("");
    const term = useDebounced(search);
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState("");
    const [sort, setSort] = useState("id");
    const [direction, setDirection] = useState("asc");
    const [deleting, setDeleting] = useState<RecordData | null>(null);
    const query = useQuery({
        queryKey: [
            "related-table",
            entity,
            parent,
            filters,
            term,
            page,
            status,
            sort,
            direction,
        ],
        queryFn: () =>
            managementApi<PageResult>(
                `${endpoint(entity, parent)}?${params({ ...filters, search: term, page, per_page: 15, status, sort, direction })}`,
            ),
        enabled: definition.capabilities.view,
    });
    const parentQuery = useQuery({
        queryKey: ["related-parent", parent],
        queryFn: () =>
            managementApi<{ data: RecordData }>(
                `/api/v1/${parent.entity}/${parent.id}`,
            ),
    });
    const fields = useMemo(
        () =>
            Object.entries(definition.fields).filter(
                ([key]) =>
                    key !== "code" &&
                    key !== "type_number" &&
                    !(entity === "contacts" && key === "label"),
            ),
        [definition, entity],
    );
    const singular = definition.label
        .toLowerCase()
        .replace(/ies$/, "y")
        .replace(/s$/, "");
    function referenceFilters(key: string, value: Values): Values {
        const field = definition.fields[key];
        if (
            field.entity === "cities" ||
            (entity === "accounts" && field.entity === "banks")
        )
            return { country_id: value.country_id };
        if (field.entity === "branches")
            return {
                bank_id: entity === "officers" ? parent.id : value.bank_id,
                city_id: value.city_id,
            };
        return {};
    }
    const columns: DetailColumn<Values>[] = fields.map(([key, field]) => ({
        key,
        label: field.label.toUpperCase(),
        width:
            field.type === "boolean"
                ? "100px"
                : field.type === "reference"
                  ? "180px"
                  : field.type === "money"
                    ? "160px"
                    : "200px",
        render: (_record, value) =>
            field.type === "boolean" ? (
                <Badge active={!!value[key]} />
            ) : field.type === "reference" ? (
                <ReferenceSelect
                    entity={field.entity!}
                    label={field.label}
                    value={value[key]}
                    readOnly
                    showCode={false}
                    filters={referenceFilters(key, value)}
                    onChange={() => {}}
                />
            ) : (
                String(value[key] || "—")
            ),
        editor: (value, change) => {
            if (field.type === "boolean")
                return (
                    <InlineStatus
                        label={field.label}
                        value={!!value[key]}
                        onChange={(status) => change(key, status)}
                    />
                );
            if (field.type === "reference")
                return (
                    <ReferenceSelect
                        entity={field.entity!}
                        label={field.label}
                        value={value[key]}
                        showCode={false}
                        filters={referenceFilters(key, value)}
                        disabled={!!field.depends && !value[field.depends]}
                        onChange={(selected) => {
                            change(key, selected);
                            if (key === "country_id") {
                                if ("city_id" in value) change("city_id", null);
                                if (entity === "accounts")
                                    change("bank_id", null);
                            }
                            if (
                                ["country_id", "city_id", "bank_id"].includes(
                                    key,
                                ) &&
                                "bank_branch_id" in value
                            )
                                change("bank_branch_id", null);
                        }}
                    />
                );
            return (
                <input
                    aria-label={field.label}
                    type={
                        field.type === "date"
                            ? "date"
                            : field.type === "email"
                              ? "email"
                              : field.type === "url"
                                ? "url"
                                : field.type === "number"
                                  ? "number"
                                  : "text"
                    }
                    inputMode={field.type === "money" ? "decimal" : undefined}
                    required={field.required}
                    maxLength={field.max}
                    min={field.min}
                    value={String(value[key] ?? "")}
                    onChange={(event) => change(key, event.target.value)}
                />
            );
        },
    }));
    if (entity === "person-markas") {
        columns.splice(1, 0, {
            key: "marka_description",
            label: "MARKA DESCRIPTION",
            width: "300px",
            render: (record) => String(record?.marka_description ?? "—"),
            editor: (value) => <MarkaDescription id={value.marka_id} />,
        });
    }
    const remove = useMutation({
        mutationFn: () =>
            api(`${endpoint(entity, parent)}/${deleting!.id}`, {
                method: "DELETE",
                body: JSON.stringify({ version: deleting!.version }),
            }),
        onSuccess: () => {
            setDeleting(null);
            toast.success("Record deleted successfully");
        },
        onError: (error) => toast.error(error.message),
    });
    if (!definition.capabilities.view)
        return (
            <div className="notice">
                You do not have access to this section.
            </div>
        );
    return (
        <section
            className="panel related-inline-section"
            data-detail-record-region
        >
            <PanelTitle
                title={title}
                action={
                    definition.capabilities.create && (
                        <button
                            className="btn primary small"
                            disabled={!parentQuery.data?.data.status}
                            onClick={() => table.current?.create()}
                        >
                            <Plus size={15} />
                            Add record
                        </button>
                    )
                }
            />
            <div className="table-toolbar">
                <div className="search-input">
                    <Search size={16} />
                    <input
                        aria-label={`Search ${definition.label}`}
                        placeholder={`Search ${definition.label.toLowerCase()}…`}
                        value={search}
                        onChange={(event) => {
                            setSearch(event.target.value);
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
                <select
                    aria-label={`Sort ${title}`}
                    value={sort}
                    onChange={(event) => {
                        setSort(event.target.value);
                        setPage(1);
                    }}
                >
                    <option value="id">Record order</option>
                    {fields.map(([key, field]) => (
                        <option key={key} value={key}>
                            {field.label}
                        </option>
                    ))}
                </select>
                <select
                    aria-label={`Sort direction ${title}`}
                    value={direction}
                    onChange={(event) => {
                        setDirection(event.target.value);
                        setPage(1);
                    }}
                >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                </select>
            </div>
            {query.error ? (
                <ErrorState error={query.error} />
            ) : (
                <EditableDetailTable<Values>
                    controllerRef={table}
                    title={title}
                    singular={singular}
                    rows={query.data?.data ?? []}
                    columns={columns}
                    loading={query.isPending}
                    canCreate={
                        definition.capabilities.create &&
                        !!parentQuery.data?.data.status
                    }
                    canUpdate={definition.capabilities.update}
                    canDelete={definition.capabilities.delete}
                    selectedId={selected}
                    onSelect={onSelect}
                    onDelete={setDeleting}
                    onReload={async (record) =>
                        (
                            await managementApi<{ data: RecordData }>(
                                `${endpoint(entity, parent)}/${record.id}`,
                            )
                        ).data
                    }
                    onSaved={(record) => {
                        if (!selected || selected === record.id)
                            onSelect(record, true);
                    }}
                    values={(record) =>
                        Object.fromEntries(
                            fields.map(([key, field]) => {
                                let value =
                                    record?.[key] ??
                                    createDefaults[key] ??
                                    field.default ??
                                    (field.type === "boolean"
                                        ? false
                                        : field.type === "reference"
                                          ? null
                                          : "");
                                if (Array.isArray(value))
                                    value = value.join(", ");
                                return [key, value];
                            }),
                        )
                    }
                    onSave={async (value, record) => {
                        const body: Values = { ...value };
                        for (const [key, field] of fields) {
                            if (field.type === "list")
                                body[key] = String(value[key] ?? "")
                                    .split(/[,;\n]/)
                                    .map((item) => item.trim())
                                    .filter(Boolean);
                            else if (value[key] === "") body[key] = null;
                            else if (field.type === "number")
                                body[key] = Number(value[key]);
                        }
                        if (record) {
                            body.version = record.version;
                            if (definition.fields.code) body.code = record.code;
                        }
                        const response = await api<{ data: RecordData }>(
                            `${endpoint(entity, parent)}${record ? `/${record.id}` : ""}`,
                            {
                                method: record ? "PUT" : "POST",
                                body: JSON.stringify(body),
                            },
                        );
                        return response.data;
                    }}
                />
            )}
            {query.data && (
                <Pagination
                    page={page}
                    last={query.data.meta.last_page}
                    total={query.data.meta.total}
                    onChange={setPage}
                />
            )}
            <Confirm
                open={!!deleting}
                title={`Delete ${singular}?`}
                description="This record will be deleted if no dependent references prevent it."
                busy={remove.isPending}
                onClose={() => setDeleting(null)}
                onConfirm={() => remove.mutate()}
            />
        </section>
    );
}

function MarkaDescription({ id }: { id: unknown }) {
    const query = useQuery({
        queryKey: ["marka-description", id],
        queryFn: () =>
            api<PageResult>(
                `/api/v1/markas?${params({ id, context: "lookup" })}`,
            ),
        enabled: !!id,
    });
    return (
        <span>
            {!id
                ? "—"
                : query.isPending
                  ? "Loading…"
                  : String(query.data?.data[0]?.description ?? "Unavailable")}
        </span>
    );
}
