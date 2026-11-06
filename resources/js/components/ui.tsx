import { titleCaseLabel } from "../lib/labels";
import { useEffect, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { PageActions } from "./PageActions";
import {
    AlertCircle,
    ArrowUpRight,
    Check,
    CircleCheck,
    CircleXmark,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Inbox,
    History,
    LoaderCircle,
    Trash2,
    X,
} from "./icons";
export function Spinner() {
    return <LoaderCircle className="spin" size={19} />;
}
export function Loading() {
    return (
        <div className="loading">
            <Spinner />
            <span>Loading your workspace…</span>
        </div>
    );
}
export function Badge({
    active = true,
    label,
}: {
    active?: boolean;
    label?: string;
}) {
    return (
        <span className={`badge ${active ? "active" : "inactive"}`}>
            <StatusIndicator active={active} />
            {label ?? (active ? "Active" : "Inactive")}
        </span>
    );
}
export function StatusIndicator({ active }: { active: boolean }) {
    const Icon = active ? CircleCheck : CircleXmark;
    return (
        <span
            className={`record-status-icon ${active ? "enabled" : "disabled"}`}
            role="img"
            aria-label={active ? "Active" : "Inactive"}
            title={active ? "Active" : "Inactive"}
        >
            <Icon size={16} />
        </span>
    );
}
export function ErrorState({
    error,
    retry,
}: {
    error: unknown;
    retry?: () => void;
}) {
    return (
        <div className="error-state" role="alert">
            <AlertCircle size={20} />
            <div>
                <strong>We couldn’t complete that request</strong>
                <p>{error instanceof Error ? error.message : String(error)}</p>
                {retry && (
                    <button className="btn secondary small" onClick={retry}>
                        <History className="mobile-action-icon" /> Try again
                    </button>
                )}
            </div>
        </div>
    );
}
export function Empty({
    title = "No records yet",
    description = "Add your first record to get started.",
    action,
}: {
    title?: string;
    description?: string;
    action?: ReactNode;
}) {
    return (
        <div className="empty">
            <span className="empty-icon">
                <Inbox size={26} />
            </span>
            <h3>{title}</h3>
            <p>{description}</p>
            {action}
        </div>
    );
}
export function Modal({
    open,
    onClose,
    title,
    description,
    children,
    wide = false,
    appearance = "default",
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: ReactNode;
    wide?: boolean;
    appearance?: "default" | "confirmation";
}) {
    const previousFocus = useRef<HTMLElement | null>(null);
    return (
        <Dialog.Root
            open={open}
            onOpenChange={(v) => {
                if (!v) onClose();
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="modal-overlay" />
                <Dialog.Content
                    className={`modal ${wide ? "wide" : ""} ${appearance === "confirmation" ? "confirmation-modal" : ""}`}
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onOpenAutoFocus={(event) => {
                        const focused = document.activeElement;
                        if (
                            focused instanceof HTMLElement &&
                            !(
                                event.target instanceof HTMLElement &&
                                event.target.contains(focused)
                            )
                        ) {
                            previousFocus.current = focused;
                        }
                    }}
                    onCloseAutoFocus={(event) => {
                        if (previousFocus.current?.isConnected) {
                            event.preventDefault();
                            previousFocus.current.focus();
                        }
                    }}
                >
                    <div
                        className={`modal-head ${appearance === "confirmation" ? "company-card-header" : ""}`}
                    >
                        <div
                            className={
                                appearance === "confirmation"
                                    ? "confirmation-title"
                                    : undefined
                            }
                        >
                            {appearance === "confirmation" && (
                                <Trash2 size={19} aria-hidden="true" />
                            )}
                            <Dialog.Title
                                className={
                                    appearance === "confirmation"
                                        ? "company-card-title"
                                        : undefined
                                }
                            >
                                {title}
                            </Dialog.Title>
                            {appearance !== "confirmation" && (
                                <Dialog.Description>
                                    {description ??
                                        "Changes are saved securely to your workspace."}
                                </Dialog.Description>
                            )}
                        </div>
                        <Dialog.Close
                            className="icon-button"
                            aria-label="Close"
                        >
                            <X size={20} />
                        </Dialog.Close>
                    </div>
                    {appearance === "confirmation" && (
                        <Dialog.Description className="confirmation-description">
                            {description}
                        </Dialog.Description>
                    )}
                    {children}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
export function Confirm({
    open,
    title,
    description,
    onConfirm,
    onClose,
    busy = false,
}: {
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    onClose: () => void;
    busy?: boolean;
}) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            description={description}
            appearance="confirmation"
        >
            <div className="modal-actions">
                <button
                    type="button"
                    className="btn-company-cancel"
                    onClick={onClose}
                >
                    <X size={15} aria-hidden="true" />
                    Cancel
                </button>
                <button
                    type="button"
                    className="btn danger confirmation-delete"
                    disabled={busy}
                    onClick={onConfirm}
                >
                    {busy ? (
                        <Spinner />
                    ) : (
                        <Trash2 size={15} aria-hidden="true" />
                    )}
                    Delete record
                </button>
            </div>
        </Modal>
    );
}
export function Pagination({
    page,
    last,
    onChange,
}: {
    page: number;
    last: number;
    total: number;
    onChange: (p: number) => void;
}) {
    return (
        <div className="pagination">
            <span className="muted">
                Page {page} of {last}
            </span>
            <div>
                {[
                    [ChevronsLeft, 1, "First"],
                    [ChevronLeft, page - 1, "Previous"],
                    [ChevronRight, page + 1, "Next"],
                    [ChevronsRight, last, "Last"],
                ].map(([Icon, target, label], i) => {
                    const C = Icon as typeof Check;
                    return (
                        <button
                            key={String(label)}
                            className="icon-button"
                            title={String(label)}
                            aria-label={`${label} page`}
                            disabled={i < 2 ? page <= 1 : page >= last}
                            onClick={() => onChange(Number(target))}
                        >
                            <C size={16} />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
export function useDebounced<T>(value: T, ms = 300) {
    const [result, setResult] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setResult(value), ms);
        return () => clearTimeout(id);
    }, [value, ms]);
    return result;
}
export function SectionHeader({
    eyebrow,
    title,
    description,
    actions,
}: {
    eyebrow?: string;
    title: string;
    description?: string;
    actions?: ReactNode;
}) {
    return (
        <div className="page-heading">
            <div>
                {eyebrow && <div className="eyebrow">{eyebrow}</div>}
                <h1>{titleCaseLabel(title)}</h1>
                {description && <p>{description}</p>}
            </div>
            {actions && <PageActions>{actions}</PageActions>}
        </div>
    );
}
export function PanelTitle({
    title,
    subtitle,
    action,
}: {
    title: string;
    subtitle?: string;
    action?: ReactNode;
}) {
    return (
        <div className="panel-title">
            <div>
                <h2>{titleCaseLabel(title)}</h2>
                {subtitle && <p>{subtitle}</p>}
            </div>
            {action}
        </div>
    );
}
export function ArrowLink() {
    return <ArrowUpRight size={15} />;
}
export {
    SearchableSelect,
    type SearchableOption,
    type SearchableSelectProps,
} from "./SearchableSelect";
