import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Clock3, ChevronRight } from "../components/icons";
import { api, dateTime, params, display } from "../lib/api";
import type { RecordData, PageResult } from "../lib/types";
import {
    Empty,
    ErrorState,
    Loading,
    Modal,
    Pagination,
    PanelTitle,
    SectionHeader,
    useDebounced,
} from "../components/ui";
export { UsersPage } from "./UsersPage";
export { RolesPage } from "./RolesPage";
export function AuditPage() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const term = useDebounced(search);
    const [selected, setSelected] = useState<RecordData>();
    const query = useQuery({
        queryKey: ["audit", page, term],
        queryFn: () =>
            api<PageResult>(`/api/v1/audit?${params({ page, search: term })}`),
    });
    return (
        <>
            <SectionHeader
                eyebrow="Administration"
                title="Audit History"
                description="A traceable history of important changes and security events."
            />
            <section className="panel">
                <PanelTitle
                    title="Activity Log"
                    subtitle="Sensitive values are redacted. Audit records cannot be edited."
                />
                <div className="table-toolbar">
                    <div className="search-input">
                        <Search size={16} />
                        <input
                            aria-label="Search audit history"
                            placeholder="Search activity, module, or record…"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>
                </div>
                {query.isPending ? (
                    <Loading />
                ) : query.error ? (
                    <ErrorState error={query.error} />
                ) : !query.data?.data.length ? (
                    <Empty title="No Activity Found" />
                ) : (
                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date & Time (Pkt)</th>
                                    <th>Action</th>
                                    <th>Module / Record</th>
                                    <th>Changed By</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {query.data.data.map((item) => (
                                    <tr
                                        key={item.id}
                                        onClick={() => setSelected(item)}
                                    >
                                        <td className="nowrap">
                                            {dateTime(item.created_at)}
                                        </td>
                                        <td>
                                            <span className="event-tag">
                                                {String(item.action).replaceAll(
                                                    "_",
                                                    " ",
                                                )}
                                            </span>
                                        </td>
                                        <td>
                                            <strong>
                                                {String(
                                                    item.record_label ??
                                                        item.entity,
                                                )}
                                            </strong>
                                            <small>
                                                {String(item.entity)}{" "}
                                                {item.record_id
                                                    ? `#${item.record_id}`
                                                    : ""}
                                            </small>
                                        </td>
                                        <td>
                                            {(
                                                item.actor as {
                                                    name: string;
                                                } | null
                                            )?.name ?? "System"}
                                        </td>
                                        <td>
                                            <button
                                                className="icon-button"
                                                aria-label="View audit details"
                                                onClick={() =>
                                                    setSelected(item)
                                                }
                                            >
                                                <ChevronRight size={16} />
                                            </button>
                                        </td>
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
                open={!!selected}
                onClose={() => setSelected(undefined)}
                title="Change Details"
                description={
                    selected
                        ? `${selected.entity} · ${dateTime(selected.created_at)}`
                        : ""
                }
                wide
            >
                <div className="audit-detail">
                    <dl className="detail-grid">
                        <div>
                            <dt>Action</dt>
                            <dd>{display(selected?.action)}</dd>
                        </div>
                        <div>
                            <dt>Source Ip</dt>
                            <dd>{display(selected?.ip_address)}</dd>
                        </div>
                    </dl>
                    <table>
                        <thead>
                            <tr>
                                <th>Field</th>
                                <th>Before</th>
                                <th>After</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(
                                (selected?.changes ?? {}) as Record<
                                    string,
                                    { before: unknown; after: unknown }
                                >,
                            ).map(([key, v]) => (
                                <tr key={key}>
                                    <td>{key}</td>
                                    <td>
                                        <pre>
                                            {typeof v.before === "object"
                                                ? JSON.stringify(
                                                      v.before,
                                                      null,
                                                      2,
                                                  )
                                                : display(v.before)}
                                        </pre>
                                    </td>
                                    <td>
                                        <pre>
                                            {typeof v.after === "object"
                                                ? JSON.stringify(
                                                      v.after,
                                                      null,
                                                      2,
                                                  )
                                                : display(v.after)}
                                        </pre>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Modal>
        </>
    );
}
