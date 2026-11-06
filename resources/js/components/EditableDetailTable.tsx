import { titleCaseLabel } from "../lib/labels";
import {
    useImperativeHandle,
    useLayoutEffect,
    useRef,
    useState,
    type KeyboardEvent,
    type ReactNode,
    type Ref,
} from "react";
import { toast } from "sonner";
import { ApiError, type RecordData } from "../lib/types";
import { useQueryClient } from "@tanstack/react-query";
import { useDirtyForm } from "../lib/dirty";
import { useRecordShortcuts } from "../lib/record-shortcuts";
import { Check, History, LoaderCircle, Pencil, Plus, Trash2, X } from "./icons";

export type DetailTableHandle = {
    create: (column?: string) => void;
    edit: (record: RecordData, column?: string) => void;
    saveActive: () => void;
    reset: () => void;
    hasActive: () => boolean;
};
export type DetailColumn<T> = {
    key: keyof T & string;
    label: string;
    width?: string;
    render: (record: RecordData, value: T) => ReactNode;
    editor: (
        value: T,
        change: (key: keyof T, value: unknown) => void,
    ) => ReactNode;
};
type Draft<T> = { record?: RecordData; original: T; value: T };

export function EditableDetailTable<T extends object>({
    title,
    singular,
    rows,
    columns,
    values,
    onSave,
    onSaved,
    onReload,
    onDelete,
    onSelect,
    selectedId,
    canCreate = true,
    canUpdate = true,
    canDelete = true,
    disabled = false,
    controllerRef,
    loading = false,
    onActive,
}: {
    title: string;
    singular: string;
    rows: RecordData[];
    columns: DetailColumn<T>[];
    values: (record?: RecordData) => T;
    onSave: (
        value: T,
        record: RecordData | undefined,
        patch: (change: Partial<T>) => void,
    ) => Promise<RecordData>;
    onSaved?: (record: RecordData) => void;
    onReload: (record: RecordData) => Promise<RecordData>;
    onDelete?: (record: RecordData) => void;
    onSelect?: (record: RecordData) => void;
    selectedId?: number;
    canCreate?: boolean;
    canUpdate?: boolean;
    canDelete?: boolean;
    disabled?: boolean;
    controllerRef?: Ref<DetailTableHandle>;
    loading?: boolean;
    onActive?: () => void;
}) {
    const cache = useQueryClient();
    const [conflicts, setConflicts] = useState<Record<string, boolean>>({});
    const [drafts, setDrafts] = useState<Record<string, Draft<T>>>({});
    const [active, setActive] = useState<{
        key: string;
        column: string;
    } | null>(null);
    const [saving, setSaving] = useState<string | null>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    const suppressFocus = useRef(false);
    const keyboardNavigation = useRef(false);
    const [focusRevision, setFocusRevision] = useState(0);
    const draftsRef = useRef(drafts);
    draftsRef.current = drafts;
    const dirty = Object.values(drafts).some(
        (draft) =>
            JSON.stringify(draft.value) !== JSON.stringify(draft.original),
    );
    useDirtyForm(dirty);
    const shortcutRecord =
        rows.find((record) => String(record.id) === active?.key) ??
        rows.find((record) => record.id === selectedId);
    useRecordShortcuts({
        scope: tableRef,
        detailRegion: true,
        enabled: !disabled && saving === null && !loading,
        canCreate,
        canUpdate: canUpdate && !!shortcutRecord && active?.key !== "new",
        canSave: !!active,
        onNew: () => {
            activate();
            setFocusRevision((value) => value + 1);
        },
        onEdit: () => {
            if (shortcutRecord) {
                activate(shortcutRecord, active?.column);
                setFocusRevision((value) => value + 1);
            }
        },
        onSave: () => {
            if (active) void save(active.key);
        },
    });

    function activate(record?: RecordData, column: string = columns[0].key) {
        if (saving) return;
        if (disabled || (record ? !canUpdate : !canCreate)) {
            if (record) {
                setActive({ key: String(record.id), column });
                onSelect?.(record);
            }
            return;
        }
        const key = record ? String(record.id) : "new";
        setDrafts((current) =>
            current[key]
                ? current
                : {
                      ...current,
                      [key]: {
                          record,
                          value: values(record),
                          original: values(record),
                      },
                  },
        );
        setActive({ key, column });
        onActive?.();
        if (record) onSelect?.(record);
    }
    function removeDraft(key: string) {
        setDrafts((current) => {
            const next = { ...current };
            delete next[key];
            return next;
        });
        if (key === "new") {
            setActive((current) =>
                current?.key === key
                    ? rows[0]
                        ? { key: String(rows[0].id), column: columns[0].key }
                        : null
                    : current,
            );
        }
        setConflicts((current) => {
            const next = { ...current };
            delete next[key];
            return next;
        });
        setFocusRevision((current) => current + 1);
    }
    async function reload(key: string) {
        const draft = draftsRef.current[key];
        if (!draft?.record || saving) return;
        setSaving(key);
        try {
            const record = await onReload(draft.record);
            const value = values(record);
            setDrafts((current) => ({
                ...current,
                [key]: { record, value, original: value },
            }));
            setConflicts((current) => ({ ...current, [key]: false }));
            setFocusRevision((current) => current + 1);
            await cache.invalidateQueries();
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Could not reload this record.",
            );
        } finally {
            setSaving(null);
        }
    }
    function patch(key: string, change: Partial<T>) {
        setDrafts((current) => ({
            ...current,
            [key]: {
                ...current[key],
                value: { ...current[key].value, ...change },
            },
        }));
    }
    async function save(key: string) {
        const draft = draftsRef.current[key];
        if (!draft || saving) return;
        const row = tableRef.current?.querySelector<HTMLTableRowElement>(
            `[data-row-key="${key}"]`,
        );
        const invalid = Array.from(
            row?.querySelectorAll<HTMLInputElement>(
                "input, select, textarea",
            ) ?? [],
        ).find((input) => !input.checkValidity());
        if (invalid) {
            invalid.reportValidity();
            invalid.focus();
            return;
        }
        setSaving(key);
        try {
            const record = await onSave(draft.value, draft.record, (change) =>
                patch(key, change),
            );
            removeDraft(key);
            onSaved?.(record);
            toast.success(`${singular} saved successfully`);
        } catch (error) {
            if (error instanceof ApiError && error.status === 409)
                setConflicts((current) => ({ ...current, [key]: true }));
            toast.error(
                error instanceof Error
                    ? error.message
                    : `Could not save ${singular.toLowerCase()}.`,
            );
        } finally {
            setSaving(null);
        }
    }
    useImperativeHandle(controllerRef, () => ({
        create: (column) => activate(undefined, column),
        edit: (record, column) => activate(record, column),
        saveActive: () => {
            if (active) void save(active.key);
        },
        reset: () => {
            setDrafts({});
            setActive(null);
        },
        hasActive: () => !!active && !!drafts[active.key],
    }));
    useLayoutEffect(() => {
        if (!active || saving !== null) return;
        const cell = tableRef.current?.querySelector<HTMLElement>(
            `[data-row-key="${active.key}"] [data-column="${active.column}"]`,
        );
        const input =
            cell?.querySelector<HTMLElement>(
                "input, button, select, textarea",
            ) ?? cell;
        if (cell && tableRef.current?.parentElement) {
            const scroller = tableRef.current.parentElement;
            const bounds = cell.getBoundingClientRect();
            const viewport = scroller.getBoundingClientRect();
            if (keyboardNavigation.current) {
                const headerBottom =
                    document.querySelector(".topbar")?.getBoundingClientRect()
                        .bottom ?? 64;
                if (bounds.top < headerBottom + 8)
                    window.scrollBy(0, bounds.top - headerBottom - 8);
                else if (bounds.bottom > window.innerHeight - 12)
                    window.scrollBy(0, bounds.bottom - window.innerHeight + 12);
            }
            keyboardNavigation.current = false;
            if (bounds.left < viewport.left)
                scroller.scrollLeft += bounds.left - viewport.left;
            else if (bounds.right > viewport.right)
                scroller.scrollLeft += bounds.right - viewport.right;
        }
        suppressFocus.current = true;
        input?.focus({ preventScroll: true });
        suppressFocus.current = false;
        if (input instanceof HTMLInputElement && input.type === "text")
            input.select();
    }, [active?.key, active?.column, focusRevision, saving]);

    function navigate(event: KeyboardEvent<HTMLTableElement>) {
        if ((event.target as HTMLElement).closest("[data-select-popover]"))
            return;
        if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "s"
        ) {
            event.preventDefault();
            event.stopPropagation();
            if (active) void save(active.key);
            return;
        }
        if (event.key === "Escape" && active) {
            event.preventDefault();
            event.stopPropagation();
            removeDraft(active.key);
            return;
        }
        if (event.key === "Enter" && active) {
            const target = event.target as HTMLElement;
            event.stopPropagation();
            if (
                target.closest(".editable-detail-actions") ||
                target.tagName === "BUTTON"
            )
                return;
            event.preventDefault();
            const index = columns.findIndex(
                (column) => column.key === active.column,
            );
            if (index < columns.length - 1) {
                const record =
                    draftsRef.current[active.key]?.record ??
                    rows.find((record) => String(record.id) === active.key);
                activate(record, columns[index + 1].key);
            } else {
                tableRef.current
                    ?.querySelector<HTMLButtonElement>(
                        `[data-row-key="${active.key}"] .save`,
                    )
                    ?.focus();
            }
            return;
        }
        if (
            !active ||
            !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
                event.key,
            )
        )
            return;
        if (
            event.defaultPrevented ||
            (event.target as HTMLElement).closest("[data-combobox-open='true']")
        )
            return;
        const input = event.target;
        if (
            !event.altKey &&
            input instanceof HTMLInputElement &&
            input.selectionStart !== null &&
            ["ArrowLeft", "ArrowRight"].includes(event.key)
        ) {
            if (
                input.selectionStart !== input.selectionEnd &&
                !(
                    input.selectionStart === 0 &&
                    input.selectionEnd === input.value.length
                )
            )
                return;
            if (event.key === "ArrowLeft" && input.selectionStart !== 0) return;
            if (
                event.key === "ArrowRight" &&
                input.selectionEnd !== input.value.length
            )
                return;
        }
        event.preventDefault();
        event.stopPropagation();
        keyboardNavigation.current = true;
        const columnIndex = columns.findIndex(
            (column) => column.key === active.column,
        );
        const visible = [...(drafts.new ? [undefined] : []), ...rows];
        const rowIndex = visible.findIndex(
            (record) => (record ? String(record.id) : "new") === active.key,
        );
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            const next = Math.max(
                0,
                Math.min(
                    visible.length - 1,
                    rowIndex + (event.key === "ArrowDown" ? 1 : -1),
                ),
            );
            if (next !== rowIndex) activate(visible[next], active.column);
        } else {
            const next = Math.max(
                0,
                Math.min(
                    columns.length - 1,
                    columnIndex + (event.key === "ArrowRight" ? 1 : -1),
                ),
            );
            activate(visible[rowIndex], columns[next].key);
        }
    }
    function renderRow(record?: RecordData) {
        const key = record ? String(record.id) : "new";
        const draft = drafts[key];
        const isEditing = active?.key === key && !!draft;
        const pending =
            !!draft &&
            (!record ||
                JSON.stringify(draft.value) !== JSON.stringify(draft.original));
        const rowValue = draft?.value ?? values(record);
        const rowLabel = String(
            record?.name ??
                record?.person_name ??
                record?.account_title ??
                record?.company_name ??
                record?.business_type_name ??
                record?.marka_code ??
                record?.label ??
                record?.address ??
                singular,
        );
        return (
            <tr
                key={key}
                data-row-key={key}
                data-editing={isEditing || undefined}
                data-dirty={pending || undefined}
                aria-label={record ? rowLabel : `New ${singular.toLowerCase()}`}
                className={`${isEditing ? "editable-detail-row" : ""} ${selectedId === record?.id ? "row-selected" : ""}`}
            >
                {columns.map((column, index) => (
                    <td
                        key={column.key}
                        data-column={column.key}
                        inert={saving !== null}
                        tabIndex={isEditing ? -1 : index === 0 ? 0 : -1}
                        onFocus={(event) => {
                            if (suppressFocus.current) return;
                            if (
                                (event.target as HTMLElement).closest(
                                    "[data-select-popover]",
                                )
                            )
                                return;
                            if (event.target === event.currentTarget)
                                activate(record, column.key);
                            else if (isEditing && active?.column !== column.key)
                                setActive({ key, column: column.key });
                        }}
                        onPointerDown={(event) => {
                            if (!isEditing) {
                                event.preventDefault();
                                activate(record, column.key);
                            } else if (active?.column !== column.key)
                                activate(record, column.key);
                        }}
                    >
                        {isEditing ? (
                            <fieldset
                                className="inline-cell-fields"
                                disabled={
                                    saving !== null ||
                                    disabled ||
                                    (record ? !canUpdate : !canCreate)
                                }
                            >
                                {column.editor(rowValue, (field, value) =>
                                    patch(key, {
                                        [field]: value,
                                    } as Partial<T>),
                                )}
                            </fieldset>
                        ) : record ? (
                            column.render(record, rowValue)
                        ) : (
                            ""
                        )}
                    </td>
                ))}
                <td
                    className="editable-detail-actions"
                    onClick={(event) => event.stopPropagation()}
                >
                    {isEditing || pending ? (
                        <>
                            {conflicts[key] && (
                                <button
                                    type="button"
                                    className="icon-action-btn"
                                    aria-label="Reload and review"
                                    title="Reload The Latest Record And Review Before Editing"
                                    disabled={saving !== null}
                                    onClick={() => void reload(key)}
                                >
                                    <History size={15} />
                                </button>
                            )}
                            <button
                                type="button"
                                className="icon-action-btn save"
                                aria-label="Save changes"
                                title={`Save ${singular.toLowerCase()}`}
                                disabled={
                                    saving !== null ||
                                    disabled ||
                                    (record ? !canUpdate : !canCreate)
                                }
                                onClick={() => void save(key)}
                            >
                                {saving === key ? (
                                    <LoaderCircle size={15} spin />
                                ) : (
                                    <Check size={15} />
                                )}
                            </button>
                            <button
                                type="button"
                                className="icon-action-btn cancel"
                                aria-label="Cancel"
                                title="Cancel Row Changes"
                                disabled={saving !== null}
                                onClick={() => removeDraft(key)}
                            >
                                <X size={15} />
                            </button>
                        </>
                    ) : (
                        record && (
                            <>
                                {canUpdate && (
                                    <button
                                        type="button"
                                        className="icon-action-btn"
                                        aria-label={`Edit ${rowLabel}`}
                                        title="Edit Row"
                                        disabled={disabled}
                                        onClick={() => activate(record)}
                                    >
                                        <Pencil size={15} />
                                    </button>
                                )}
                                {canDelete && onDelete && (
                                    <button
                                        type="button"
                                        className="icon-action-btn delete"
                                        aria-label={`Remove ${rowLabel}`}
                                        title="Remove Row"
                                        disabled={disabled}
                                        onClick={() => onDelete(record)}
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                )}
                            </>
                        )
                    )}
                </td>
            </tr>
        );
    }
    return (
        <div className="editable-detail-scroll">
            <table
                ref={tableRef}
                className="subcompany-table editable-detail-table"
                role="grid"
                aria-label={title}
                onKeyDown={navigate}
            >
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th
                                key={column.key}
                                style={{ width: column.width }}
                                aria-disabled={
                                    !canCreate || disabled || saving !== null
                                }
                                onClick={() => activate(undefined, column.key)}
                            >
                                <button
                                    type="button"
                                    className="editable-detail-heading"
                                    aria-label={`Add ${singular.toLowerCase()}: ${titleCaseLabel(column.label)}`}
                                    disabled={
                                        !canCreate ||
                                        disabled ||
                                        saving !== null
                                    }
                                >
                                    <span>{titleCaseLabel(column.label)}</span>
                                    <Plus size={10} />
                                </button>
                            </th>
                        ))}
                        <th className="editable-detail-actions">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {drafts.new && renderRow()}
                    {loading && rows.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length + 1}>
                                Loading records…
                            </td>
                        </tr>
                    ) : (
                        rows.map(renderRow)
                    )}
                    {!loading && !rows.length && !drafts.new && (
                        <tr>
                            <td colSpan={columns.length + 1}>
                                No records yet. Click a column header or Add to
                                create one.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

export function InlineStatus({
    value,
    onChange,
    label,
}: {
    value: boolean;
    onChange: (value: boolean) => void;
    label: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-label={label}
            aria-checked={value}
            className={`inline-status ${value ? "enabled" : "disabled"}`}
            onClick={() => onChange(!value)}
        >
            {value ? "Active" : "Inactive"}
        </button>
    );
}
