import { titleCaseLabel } from "../lib/labels";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import {
    ArrowLeft,
    Plus,
    Pencil,
    Trash2,
    Check,
    X,
    Search,
    Maximize2,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from "./icons";
import { Loading, Confirm, StatusIndicator } from "./ui";
import type { RecordData } from "../lib/types";
import { useRecordShortcuts } from "../lib/record-shortcuts";
import { PageActions } from "./PageActions";
import { MobileRecordBrowser } from "./MobileRecordBrowser";
import { useDirectoryDialog } from "../lib/use-directory-dialog";

export interface MasterColumn<T = RecordData> {
    key: string;
    label: string;
    width?: string;
    className?: string;
    render?: (item: T, isSelected: boolean) => React.ReactNode;
}

export interface ViewAllColumn<T = RecordData> {
    key: string;
    label: string;
    width?: string;
    render?: (item: T) => React.ReactNode;
}

export interface MasterDetailShellProps<T extends RecordData = RecordData> {
    // Page Header
    title: string;
    icon: React.ReactNode;
    backTo?: string;

    // Top Action State
    isEditing: boolean;
    isCreating: boolean;
    isSaving?: boolean;
    hasSelectedItem: boolean;
    canCreate?: boolean;
    canUpdate?: boolean;
    canDelete?: boolean;
    onStartCreate: () => void;
    onStartEdit: () => void;
    onSave: () => void;
    onSaveShortcut?: () => void;
    onCancel: () => void;
    onDelete: () => void;
    newAriaLabel?: string;
    newButtonLabel?: string;

    // Master List Panel
    listHeading?: string;
    items: T[];
    columns: MasterColumn<T>[];
    selectedId: number | string | null;
    onSelectItem: (item: T) => void;
    isLoading?: boolean;
    emptyText?: string;
    search: string;
    onSearchChange: (value: string) => void;
    searchAriaLabel?: string;
    searchPlaceholder?: string;

    // Pagination
    page: number;
    lastPage: number;
    totalRecords: number;
    onPageChange: (page: number) => void;

    // View All Modal
    viewAllItems?: T[];
    viewAllColumns?: ViewAllColumn<T>[];
    onSelectFromViewAll?: (item: T) => void;

    // Delete Modal
    isDeleting?: boolean;
    onCloseDelete?: () => void;
    onConfirmDelete?: () => void;
    deleteTitle?: string;
    deleteDescription?: string;
    isDeletingBusy?: boolean;

    // Right Panel Content
    children: React.ReactNode;
}

export function MasterDetailShell<T extends RecordData = RecordData>({
    title,
    icon,
    backTo = "/",

    isEditing,
    isCreating,
    isSaving = false,
    hasSelectedItem,
    canCreate = true,
    canUpdate = true,
    canDelete = true,
    onStartCreate,
    onStartEdit,
    onSave,
    onSaveShortcut,
    onCancel,
    onDelete,
    newAriaLabel = "Add record",
    newButtonLabel = "New",

    listHeading,
    items,
    columns,
    selectedId,
    onSelectItem,
    isLoading = false,
    emptyText = `No ${title.toLowerCase()} found`,
    search,
    onSearchChange,
    searchAriaLabel = "Search records",
    searchPlaceholder = "Search records…",

    page,
    lastPage,
    onPageChange,

    viewAllItems,
    viewAllColumns,
    onSelectFromViewAll,

    isDeleting = false,
    onCloseDelete,
    onConfirmDelete,
    deleteTitle = `Delete ${title}?`,
    deleteDescription = "Are you sure you want to delete this record? This action cannot be undone.",
    isDeletingBusy = false,

    children,
}: MasterDetailShellProps<T>) {
    const listColumns = columns.filter((column) => column.key !== "status");
    const shortcutScope = useRef<HTMLDivElement>(null);
    useRecordShortcuts({
        scope: shortcutScope,
        page: true,
        enabled: !isSaving,
        canCreate,
        canUpdate: canUpdate && hasSelectedItem && !isEditing && !isCreating,
        canSave: !!onSaveShortcut || isEditing || isCreating,
        onNew: onStartCreate,
        onEdit: onStartEdit,
        onSave: onSaveShortcut ?? onSave,
    });
    const directoryColumns: MasterColumn<T>[] = [
        ...(viewAllColumns ?? columns).filter(
            (column) => column.key !== "status",
        ),
        {
            key: "status",
            label: "Status",
            render: (item) => (
                <StatusIndicator active={item.status !== false} />
            ),
        },
    ];
    const primaryDirectoryColumn =
        directoryColumns.find((column) => column.key === "name")?.key ??
        directoryColumns[0]?.key;
    // View All Modal State
    const [viewAllOpen, setViewAllOpen] = useState(false);
    const [viewAllSearch, setViewAllSearch] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const viewAllSearchInputRef = useRef<HTMLInputElement | null>(null);
    const viewAllRowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

    const tableContainerRef = useRef<HTMLDivElement | null>(null);
    const listPanelRef = useRef<HTMLElement | null>(null);
    const tableRowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

    const selectedIndex = useMemo(() => {
        if (!selectedId) return 0;
        const idx = items.findIndex((i) => i.id === selectedId);
        return idx >= 0 ? idx : 0;
    }, [items, selectedId]);

    // Keyboard navigation in left list
    const handleTableKeyDown = (e: React.KeyboardEvent | KeyboardEvent) => {
        if (viewAllOpen) return;

        const target = e.target as HTMLElement | null;
        const isInput =
            target?.tagName === "INPUT" ||
            target?.tagName === "TEXTAREA" ||
            target?.tagName === "SELECT";
        const isSearchInput = target?.closest(".company-search-box") !== null;

        if (isInput) {
            if (isSearchInput && (e.key === "ArrowDown" || e.key === "Enter")) {
                e.preventDefault();
                tableContainerRef.current?.focus();
                if (
                    e.key === "Enter" &&
                    hasSelectedItem &&
                    !isEditing &&
                    !isCreating
                ) {
                    onStartEdit();
                }
            }
            if (e.key === "Escape" && (isEditing || isCreating)) {
                e.preventDefault();
                onCancel();
            }
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (items.length === 0) return;
            const nextIndex = Math.min(items.length - 1, selectedIndex + 1);
            const nextItem = items[nextIndex];
            if (nextItem) {
                onSelectItem(nextItem);
                tableRowRefs.current[nextIndex]?.scrollIntoView({
                    block: "nearest",
                    behavior: "smooth",
                });
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (items.length === 0) return;
            const prevIndex = Math.max(0, selectedIndex - 1);
            const prevItem = items[prevIndex];
            if (prevItem) {
                onSelectItem(prevItem);
                tableRowRefs.current[prevIndex]?.scrollIntoView({
                    block: "nearest",
                    behavior: "smooth",
                });
            }
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (hasSelectedItem && !isEditing && !isCreating) {
                onStartEdit();
            }
        }
    };

    useEffect(() => {
        const onGlobalKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target?.closest(".company-search-box")) handleTableKeyDown(e);
        };
        window.addEventListener("keydown", onGlobalKey);
        return () => window.removeEventListener("keydown", onGlobalKey);
    }, [
        items,
        selectedIndex,
        hasSelectedItem,
        isEditing,
        isCreating,
        viewAllOpen,
    ]);

    // Universal Enter key navigation to move focus to the next field
    const handleEnterNav = (e: React.KeyboardEvent) => {
        if (e.key !== "Enter") return;
        const target = e.target as HTMLElement;
        if (!target) return;

        // Do not navigate if inside search box or View All modal
        if (
            target.closest(".company-search-box") ||
            target.closest(".view-all-modal-box")
        )
            return;

        // If in a multiline textarea, allow regular Enter
        if (target.tagName === "TEXTAREA" && !e.ctrlKey) return;

        // If combobox popover is open, let combobox handle selection
        if (
            target.closest("[data-combobox-open='true']") ||
            target.closest(".reference-popover")
        )
            return;

        // If user pressed Enter on an explicit submit button or inline save button, allow normal click
        if (
            target.tagName === "BUTTON" &&
            (target.classList.contains("btn-company-save") ||
                target.classList.contains("btn-subcompany-add") ||
                target.classList.contains("btn-city-action-save") ||
                target.classList.contains("btn-branch-save") ||
                target.classList.contains("btn-officer-save"))
        ) {
            return;
        }

        // Find closest form or card or row container
        const container = target.closest(
            ".company-card, tr.city-row-inline-editing, tr.branch-row-inline-editing, tr.officer-row-inline-editing, tr.subcompany-row-inline-editing, form, .company-detail-panel",
        );
        if (!container) return;

        const selector =
            'input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), button.searchable-select-trigger:not([disabled]):not(.is-readonly), button[role="switch"]:not([disabled])';
        const fields = Array.from(
            container.querySelectorAll<HTMLElement>(selector),
        ).filter(
            (el) => el.offsetParent !== null && !el.hasAttribute("disabled"),
        );

        const currentIndex = fields.indexOf(target);
        if (currentIndex !== -1 && currentIndex + 1 < fields.length) {
            e.preventDefault();
            fields[currentIndex + 1].focus();
        }
    };

    // View All Modal Filtered Items
    const fullDataset = viewAllItems || items;
    const filteredViewAllItems = useMemo(() => {
        if (!viewAllSearch.trim()) return fullDataset;
        const q = viewAllSearch.toLowerCase();
        return fullDataset.filter((item) => {
            return (
                String(item.name || "")
                    .toLowerCase()
                    .includes(q) ||
                String(item.short_name || "")
                    .toLowerCase()
                    .includes(q) ||
                String(item.code || "")
                    .toLowerCase()
                    .includes(q) ||
                String(item.description || "")
                    .toLowerCase()
                    .includes(q) ||
                String(item.address || "")
                    .toLowerCase()
                    .includes(q)
            );
        });
    }, [fullDataset, viewAllSearch]);

    // Handle View All modal navigation
    const handleViewAllKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex((prev) =>
                Math.min(filteredViewAllItems.length - 1, prev + 1),
            );
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex((prev) => Math.max(0, prev - 1));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (filteredViewAllItems[highlightedIndex]) {
                const chosen = filteredViewAllItems[highlightedIndex];
                setViewAllOpen(false);
                if (onSelectFromViewAll) {
                    onSelectFromViewAll(chosen);
                } else {
                    onSelectItem(chosen);
                }
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            setViewAllOpen(false);
        }
    };

    useDirectoryDialog(viewAllOpen, viewAllSearchInputRef, () =>
        setViewAllOpen(false),
    );

    useEffect(() => {
        if (viewAllOpen && viewAllRowRefs.current[highlightedIndex]) {
            viewAllRowRefs.current[highlightedIndex]?.scrollIntoView({
                block: "nearest",
                behavior: "smooth",
            });
        }
    }, [highlightedIndex, viewAllOpen]);

    return (
        <div className="company-page-container" ref={shortcutScope}>
            <MobileRecordBrowser
                title={title}
                listRef={listPanelRef}
                onViewAll={() => {
                    setViewAllOpen(true);
                    setViewAllSearch("");
                    setHighlightedIndex(0);
                }}
            />
            {/* Top Page Header (Uniform across all pages) */}
            <header className="company-header">
                <div className="company-header-left">
                    <Link
                        to={backTo}
                        className="company-back-btn"
                        aria-label="Back"
                    >
                        <ArrowLeft size={16} />
                        <span>Back</span>
                    </Link>

                    <div className="company-icon-badge">{icon}</div>

                    <div className="company-title-wrap">
                        <h1 className="company-page-title">{title}</h1>
                    </div>
                </div>

                <PageActions className="company-header-actions">
                    {isEditing || isCreating ? (
                        <>
                            <button
                                type="button"
                                className="btn-company-save"
                                aria-label="Save record"
                                onClick={onSave}
                                disabled={isSaving}
                            >
                                <Check size={16} />
                                <span>Save</span>
                            </button>

                            <button
                                type="button"
                                className="btn-company-cancel"
                                onClick={onCancel}
                                disabled={isSaving}
                                aria-label="Cancel"
                            >
                                <X size={15} />
                                <span>Cancel</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                className="btn-company-new"
                                aria-label={newAriaLabel}
                                aria-keyshortcuts="Control+n Meta+n"
                                title="New Record (Ctrl/Cmd+N)"
                                onClick={onStartCreate}
                                disabled={!canCreate}
                            >
                                <Plus size={16} />
                                <span>{newButtonLabel}</span>
                            </button>

                            <button
                                type="button"
                                className="btn-company-edit"
                                aria-keyshortcuts="Control+e Meta+e"
                                title="Edit Selected Record (Ctrl/Cmd+E)"
                                onClick={onStartEdit}
                                disabled={!hasSelectedItem || !canUpdate}
                                aria-label="Edit"
                            >
                                <Pencil size={15} />
                                <span>Edit</span>
                            </button>

                            <button
                                type="button"
                                className="btn-company-delete"
                                onClick={onDelete}
                                disabled={!hasSelectedItem || !canDelete}
                                aria-label="Delete"
                            >
                                <Trash2 size={15} />
                                <span>Delete</span>
                            </button>
                        </>
                    )}
                </PageActions>
            </header>

            {/* Split Master-Detail Layout */}
            <div className="company-split-layout">
                {/* Left Master List Panel (Uniform across all pages) */}
                <aside className="company-list-panel" ref={listPanelRef}>
                    <div className="company-list-topbar">
                        <span className="company-list-heading">
                            {titleCaseLabel(listHeading || title)}
                        </span>
                        <button
                            type="button"
                            className="company-view-all-btn"
                            onClick={() => {
                                setViewAllOpen(true);
                                setViewAllSearch("");
                                setHighlightedIndex(0);
                            }}
                            title={`View all ${title.toLowerCase()} in full table popup`}
                            aria-label={`View all ${title.toLowerCase()}`}
                        >
                            <Maximize2 size={13} />
                            <span>View All</span>
                        </button>
                    </div>

                    <div className="company-search-box">
                        <Search size={16} className="company-search-icon" />
                        <input
                            type="text"
                            placeholder={searchPlaceholder}
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                            aria-label={searchAriaLabel}
                        />
                    </div>

                    <div
                        className="company-table-container"
                        tabIndex={0}
                        ref={tableContainerRef}
                        onKeyDown={handleTableKeyDown}
                        aria-label={`${title} Table Navigation`}
                    >
                        <table className="company-master-table">
                            <thead>
                                <tr>
                                    {listColumns.map((col) => (
                                        <th
                                            key={col.key}
                                            style={
                                                col.width
                                                    ? { width: col.width }
                                                    : undefined
                                            }
                                            className={col.className}
                                        >
                                            {titleCaseLabel(col.label)}
                                        </th>
                                    ))}
                                    <th
                                        className="master-status-cell"
                                        aria-label="Status"
                                    >
                                        <span className="visually-hidden">
                                            Status
                                        </span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading && items.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={listColumns.length + 1}
                                            className="table-loading-cell"
                                            style={{
                                                textAlign: "center",
                                                padding: "30px",
                                            }}
                                        >
                                            <Loading />
                                        </td>
                                    </tr>
                                ) : items.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={listColumns.length + 1}
                                            className="table-empty-cell"
                                            style={{
                                                textAlign: "center",
                                                padding: "30px",
                                                color: "#6b7280",
                                            }}
                                        >
                                            {emptyText}
                                        </td>
                                    </tr>
                                ) : (
                                    items.map((item, idx) => {
                                        const isSelected =
                                            selectedId === item.id;
                                        return (
                                            <tr
                                                key={item.id}
                                                ref={(el) => {
                                                    tableRowRefs.current[idx] =
                                                        el;
                                                }}
                                                className={
                                                    isSelected && !isCreating
                                                        ? "row-selected"
                                                        : ""
                                                }
                                                onClick={() =>
                                                    onSelectItem(item)
                                                }
                                            >
                                                {listColumns.map((col) => (
                                                    <td
                                                        key={col.key}
                                                        className={
                                                            col.className
                                                        }
                                                        style={
                                                            col.width
                                                                ? {
                                                                      width: col.width,
                                                                  }
                                                                : undefined
                                                        }
                                                    >
                                                        {col.render ? (
                                                            col.render(
                                                                item,
                                                                isSelected,
                                                            )
                                                        ) : col.key ===
                                                          "name" ? (
                                                            <button
                                                                type="button"
                                                                className="company-row-btn"
                                                                aria-label={String(
                                                                    item.name ||
                                                                        "",
                                                                )}
                                                                onClick={(
                                                                    e,
                                                                ) => {
                                                                    e.stopPropagation();
                                                                    onSelectItem(
                                                                        item,
                                                                    );
                                                                }}
                                                            >
                                                                {String(
                                                                    item.name ||
                                                                        "",
                                                                )}
                                                            </button>
                                                        ) : (
                                                            String(
                                                                item[col.key] ??
                                                                    "—",
                                                            )
                                                        )}
                                                    </td>
                                                ))}
                                                <td className="master-status-cell">
                                                    <StatusIndicator
                                                        active={
                                                            item.status !==
                                                            false
                                                        }
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    <div className="company-list-footer">
                        <span>
                            {page} of {Math.max(1, lastPage)}
                        </span>
                        <div className="company-pagination-btns">
                            <button
                                type="button"
                                disabled={page <= 1}
                                onClick={() => onPageChange(1)}
                                title="First Page"
                            >
                                <ChevronsLeft size={15} />
                            </button>
                            <button
                                type="button"
                                disabled={page <= 1}
                                onClick={() =>
                                    onPageChange(Math.max(1, page - 1))
                                }
                                title="Previous Page"
                            >
                                <ChevronLeft size={15} />
                            </button>
                            <button
                                type="button"
                                disabled={page >= lastPage}
                                onClick={() => onPageChange(page + 1)}
                                title="Next Page"
                            >
                                <ChevronRight size={15} />
                            </button>
                            <button
                                type="button"
                                disabled={page >= lastPage}
                                onClick={() => onPageChange(lastPage)}
                                title="Last Page"
                            >
                                <ChevronsRight size={15} />
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Right Detail Panel */}
                <main
                    className="company-detail-panel"
                    onKeyDown={handleEnterNav}
                >
                    {children}
                </main>
            </div>

            {/* View All Directory Popup (Uniform modal) */}
            {viewAllOpen && (
                <div
                    className="view-all-modal-overlay"
                    onClick={() => setViewAllOpen(false)}
                >
                    <div
                        className="view-all-modal-box"
                        role="dialog"
                        aria-modal="true"
                        aria-label={`All ${title} Directory`}
                        data-state="open"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="view-all-modal-header">
                            <div>
                                <h3 className="view-all-modal-title">
                                    All {title} Directory
                                </h3>
                            </div>
                            <button
                                type="button"
                                className="view-all-close-btn"
                                onClick={() => setViewAllOpen(false)}
                                aria-label="Close directory"
                            >
                                <ArrowLeft className="mobile-action-icon" />
                                Close
                            </button>
                        </div>

                        <div className="view-all-search-wrap">
                            <Search
                                size={18}
                                className="view-all-search-icon"
                            />
                            <input
                                ref={viewAllSearchInputRef}
                                type="text"
                                placeholder="Search records…"
                                aria-label={`Search all ${title.toLowerCase()}`}
                                value={viewAllSearch}
                                onChange={(e) => {
                                    setViewAllSearch(e.target.value);
                                    setHighlightedIndex(0);
                                }}
                                onKeyDown={handleViewAllKeyDown}
                            />
                        </div>

                        <div
                            className="view-all-table-wrap"
                            tabIndex={0}
                            role="region"
                            aria-label="Directory records"
                        >
                            <table className="view-all-table">
                                <thead>
                                    <tr>
                                        {directoryColumns.map((col) => (
                                            <th
                                                key={col.key}
                                                style={
                                                    col.width
                                                        ? {
                                                              width: col.width,
                                                          }
                                                        : undefined
                                                }
                                            >
                                                {titleCaseLabel(col.label)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredViewAllItems.length === 0 ? (
                                        <tr className="view-all-empty-row">
                                            <td
                                                colSpan={
                                                    directoryColumns.length
                                                }
                                                style={{
                                                    textAlign: "center",
                                                    padding: "40px",
                                                    color: "#6b7f75",
                                                    fontSize: "14px",
                                                }}
                                            >
                                                No records found matching
                                                &ldquo;{viewAllSearch}&rdquo;
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredViewAllItems.map(
                                            (item, idx) => {
                                                const isHighlighted =
                                                    idx === highlightedIndex;
                                                const isCurrent =
                                                    selectedId === item.id;
                                                return (
                                                    <tr
                                                        key={item.id}
                                                        ref={(el) => {
                                                            viewAllRowRefs.current[
                                                                idx
                                                            ] = el;
                                                        }}
                                                        className={`view-all-row ${isHighlighted ? "view-all-row-active" : ""}`}
                                                        onClick={() => {
                                                            setViewAllOpen(
                                                                false,
                                                            );
                                                            if (
                                                                onSelectFromViewAll
                                                            ) {
                                                                onSelectFromViewAll(
                                                                    item,
                                                                );
                                                            } else {
                                                                onSelectItem(
                                                                    item,
                                                                );
                                                            }
                                                        }}
                                                        onMouseEnter={() =>
                                                            setHighlightedIndex(
                                                                idx,
                                                            )
                                                        }
                                                    >
                                                        {directoryColumns.map(
                                                            (col) => (
                                                                <td
                                                                    key={
                                                                        col.key
                                                                    }
                                                                    data-label={titleCaseLabel(
                                                                        col.label,
                                                                    )}
                                                                    className={
                                                                        col.key ===
                                                                        primaryDirectoryColumn
                                                                            ? "view-all-primary-cell"
                                                                            : col.key ===
                                                                                "status"
                                                                              ? "view-all-status-cell"
                                                                              : [
                                                                                      "description",
                                                                                      "address",
                                                                                  ].includes(
                                                                                      col.key,
                                                                                  )
                                                                                ? "view-all-wide-cell"
                                                                                : undefined
                                                                    }
                                                                >
                                                                    {col.render ? (
                                                                        col.render(
                                                                            item,
                                                                            isCurrent,
                                                                        )
                                                                    ) : col.key ===
                                                                      "name" ? (
                                                                        <div className="view-all-record-name">
                                                                            <span>
                                                                                {String(
                                                                                    item.name ||
                                                                                        "",
                                                                                )}
                                                                            </span>
                                                                            {isCurrent && (
                                                                                <span className="view-all-current">
                                                                                    Current
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    ) : col.key ===
                                                                      "status" ? (
                                                                        <span
                                                                            className={`view-all-badge ${item.status !== false ? "active" : "inactive"}`}
                                                                        >
                                                                            {item.status !==
                                                                            false
                                                                                ? "Active"
                                                                                : "Inactive"}
                                                                        </span>
                                                                    ) : (
                                                                        String(
                                                                            item[
                                                                                col
                                                                                    .key
                                                                            ] ??
                                                                                "—",
                                                                        )
                                                                    )}
                                                                </td>
                                                            ),
                                                        )}
                                                    </tr>
                                                );
                                            },
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleting && (
                <Confirm
                    open={isDeleting}
                    onClose={onCloseDelete || (() => {})}
                    onConfirm={onConfirmDelete || (() => {})}
                    title={deleteTitle}
                    description={deleteDescription}
                    busy={isDeletingBusy}
                />
            )}
        </div>
    );
}
