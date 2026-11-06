import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, params, display } from "../lib/api";
import type { PageResult, RecordData } from "../lib/types";
import { useDebounced, Spinner } from "./ui";
import { SelectPopover } from "./SelectPopover";
import { Check, X } from "./icons";
export function ReferenceSelect({
    entity,
    value,
    onChange,
    filters = {},
    disabled = false,
    id,
    label,
    multiple = false,
    showCode = true,
    readOnly = false,
    lookupPath,
    clearUnavailable = true,
}: {
    entity: string;
    value: unknown;
    onChange: (v: unknown) => void;
    filters?: Record<string, unknown>;
    disabled?: boolean;
    id?: string;
    label?: string;
    multiple?: boolean;
    showCode?: boolean;
    readOnly?: boolean;
    lookupPath?: string;
    clearUnavailable?: boolean;
}) {
    const [search, setSearch] = useState("");
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const term = useDebounced(search);
    const query = useQuery({
        queryKey: ["lookup", entity, lookupPath, filters, term],
        queryFn: () =>
            api<PageResult>(
                `${lookupPath ?? `/api/v1/${entity}`}?${params({ ...filters, search: term, per_page: 100, status: 1, context: "lookup" })}`,
            ),
        enabled: !disabled && !readOnly,
    });
    const vals = Array.isArray(value) ? value.map(Number) : [];
    const hasSelection = multiple ? vals.length > 0 : !!value;
    const selected = useQuery({
        queryKey: ["selected-lookup", entity, lookupPath, filters, value],
        queryFn: ({ signal }) =>
            api<PageResult>(
                `${lookupPath ?? `/api/v1/${entity}`}?${params({ ...filters, ...(multiple ? { ids: vals.join(",") } : { id: value }), per_page: 100, status: 1, context: "lookup" })}`,
                { signal },
            ),
        enabled: hasSelection && !disabled,
        placeholderData: multiple ? (previous) => previous : undefined,
    });
    useEffect(() => {
        if (
            !hasSelection ||
            !clearUnavailable ||
            disabled ||
            readOnly ||
            !selected.isSuccess ||
            selected.isFetching
        )
            return;
        const available = new Set(
            selected.data.data.map((record) => record.id),
        );
        if (multiple) {
            const valid = vals.filter((id) => available.has(id));
            if (valid.length !== vals.length) onChange(valid);
        } else if (!available.has(Number(value))) {
            onChange(null);
        }
    }, [
        selected.data,
        selected.isSuccess,
        selected.isFetching,
        hasSelection,
        disabled,
        readOnly,
        multiple,
        value,
        onChange,
        clearUnavailable,
    ]);
    const name = (r: RecordData) =>
        entity === "markas"
            ? String(r.code)
            : String(
                  r.name ?? r.description ?? r.company_name ?? r.code ?? r.id,
              );
    const selectedRecord = selected.isError
        ? undefined
        : selected.data?.data.find((record) => record.id === Number(value));
    const selectedRecords = new Map(
        [...(query.data?.data ?? []), ...(selected.data?.data ?? [])].map(
            (record) => [record.id, record],
        ),
    );
    if (readOnly) {
        return (
            <span className="reference-value">
                {selectedRecord
                    ? name(selectedRecord)
                    : value
                      ? selected.isPending
                          ? "Loading…"
                          : "Unavailable"
                      : "—"}
            </span>
        );
    }
    return (
        <div
            className={`reference-select ${multiple ? "reference-select-multiple" : ""}`}
        >
            <button
                ref={triggerRef}
                type="button"
                id={id}
                className="select-button"
                aria-label={label}
                aria-expanded={open}
                aria-readonly={readOnly || undefined}
                disabled={disabled}
                onClick={() => {
                    if (readOnly) return;
                    if (!open) void query.refetch();
                    setOpen(!open);
                }}
            >
                <span className="reference-selection-label">
                    {multiple
                        ? `${vals.length} selected`
                        : selectedRecord
                          ? name(selectedRecord)
                          : readOnly
                            ? value
                                ? "Unavailable"
                                : "—"
                            : value && !clearUnavailable
                              ? "Linked person unavailable"
                              : "Select…"}
                </span>
                <span aria-hidden="true">⌄</span>
            </button>
            {multiple && vals.length > 0 && (
                <div
                    className="reference-tags"
                    role="list"
                    aria-label={`Selected ${label ?? entity}`}
                >
                    {vals.map((recordId) => {
                        const record = selectedRecords.get(recordId);
                        const recordName = record
                            ? name(record)
                            : selected.isPending
                              ? "Loading…"
                              : "Unavailable";
                        return (
                            <span
                                className="reference-tag"
                                role="listitem"
                                key={recordId}
                            >
                                <span className="reference-tag-label">
                                    {recordName}
                                </span>
                                <button
                                    type="button"
                                    className="reference-tag-remove"
                                    aria-label={`Remove ${recordName}`}
                                    title={`Remove ${recordName}`}
                                    disabled={disabled}
                                    onClick={() => {
                                        onChange(
                                            vals.filter(
                                                (value) => value !== recordId,
                                            ),
                                        );
                                        triggerRef.current?.focus({
                                            preventScroll: true,
                                        });
                                    }}
                                >
                                    <X size={12} />
                                </button>
                            </span>
                        );
                    })}
                </div>
            )}
            {open && (
                <SelectPopover
                    anchorRef={triggerRef}
                    onClose={() => setOpen(false)}
                    className="reference-popover"
                    onKeyDown={(event) => {
                        if (!["ArrowDown", "ArrowUp"].includes(event.key))
                            return;
                        event.preventDefault();
                        event.stopPropagation();
                        const options = Array.from(
                            event.currentTarget.querySelectorAll<HTMLButtonElement>(
                                "[data-reference-option]",
                            ),
                        );
                        if (!options.length) return;
                        const current = options.indexOf(
                            document.activeElement as HTMLButtonElement,
                        );
                        const next =
                            current < 0
                                ? event.key === "ArrowDown"
                                    ? 0
                                    : options.length - 1
                                : Math.max(
                                      0,
                                      Math.min(
                                          options.length - 1,
                                          current +
                                              (event.key === "ArrowDown"
                                                  ? 1
                                                  : -1),
                                      ),
                                  );
                        options[next].focus({ preventScroll: true });
                        const list =
                            options[next].closest(".reference-options")!;
                        const bounds = options[next].getBoundingClientRect();
                        const viewport = list.getBoundingClientRect();
                        if (bounds.top < viewport.top)
                            list.scrollTop += bounds.top - viewport.top;
                        else if (bounds.bottom > viewport.bottom)
                            list.scrollTop += bounds.bottom - viewport.bottom;
                    }}
                >
                    <input
                        placeholder="Search records…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label={`Search ${label ?? entity}`}
                    />
                    <div className="reference-options">
                        <button
                            type="button"
                            data-mobile-icon-only
                            aria-label="Clear selection"
                            onClick={() => {
                                onChange(multiple ? [] : null);
                                setOpen(false);
                            }}
                        >
                            <X className="mobile-action-icon" /> Clear selection
                        </button>
                        {query.isPending ? (
                            <Spinner />
                        ) : query.error ? (
                            <p role="alert">{query.error.message}</p>
                        ) : (
                            query.data?.data.map((r) => (
                                <button
                                    type="button"
                                    key={r.id}
                                    data-reference-option
                                    className={
                                        vals.includes(r.id) ||
                                        Number(value) === r.id
                                            ? "chosen"
                                            : ""
                                    }
                                    onClick={() => {
                                        onChange(
                                            multiple
                                                ? vals.includes(r.id)
                                                    ? vals.filter(
                                                          (v) => v !== r.id,
                                                      )
                                                    : [...vals, r.id]
                                                : r.id,
                                        );
                                        if (!multiple) setOpen(false);
                                    }}
                                >
                                    {name(r)}
                                    {showCode &&
                                        entity !== "employee-types" && (
                                            <small>{display(r.code)}</small>
                                        )}
                                </button>
                            ))
                        )}
                        {query.data?.data.length === 0 && (
                            <p>No matching active records.</p>
                        )}
                        {query.data && query.data.meta.total > 100 && (
                            <p>Type to narrow the results.</p>
                        )}
                    </div>
                    <button
                        className="reference-done"
                        type="button"
                        onClick={() => setOpen(false)}
                    >
                        <Check className="mobile-action-icon" /> Done
                    </button>
                </SelectPopover>
            )}
        </div>
    );
}
