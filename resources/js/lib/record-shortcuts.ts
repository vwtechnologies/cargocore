import { useEffect, type RefObject } from "react";

type RecordShortcuts = {
    scope: RefObject<HTMLElement | null>;
    page?: boolean;
    detailRegion?: boolean;
    enabled?: boolean;
    canCreate?: boolean;
    canUpdate?: boolean;
    canSave?: boolean;
    onNew?: () => void;
    onEdit?: () => void;
    onSave?: () => void;
};

export function useRecordShortcuts({
    scope,
    page = false,
    detailRegion = false,
    enabled = true,
    canCreate = false,
    canUpdate = false,
    canSave = false,
    onNew,
    onEdit,
    onSave,
}: RecordShortcuts) {
    useEffect(() => {
        const element = scope.current;
        const root = detailRegion
            ? (element?.closest<HTMLElement>("[data-detail-record-region]") ??
              element)
            : element;
        if (!root) return;
        root.setAttribute("data-record-shortcut-scope", "");
        const keys = [onNew && "n", onEdit && "e", onSave && "s"]
            .filter(Boolean)
            .join(" ");
        root.setAttribute("data-record-shortcut-keys", keys);
        function handleShortcut(event: KeyboardEvent) {
            if (
                event.defaultPrevented ||
                !(event.ctrlKey || event.metaKey) ||
                event.altKey ||
                event.shiftKey
            )
                return;
            const key = event.key.toLowerCase();
            if (!["e", "n", "s"].includes(key)) return;
            const target =
                event.target instanceof Element
                    ? event.target
                    : document.activeElement;
            const nearest = target?.closest(
                `[data-record-shortcut-scope][data-record-shortcut-keys~="${key}"]`,
            );
            if (!keys.split(" ").includes(key) && !page) return;
            if (nearest ? nearest !== root : !page) return;
            event.preventDefault();
            if (!enabled || event.repeat || event.isComposing) return;
            const dialogs = document.querySelectorAll(
                '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], dialog[open]',
            );
            const dialog = dialogs[dialogs.length - 1];
            if (dialog && !dialog.contains(root)) return;
            if (key === "n" && canCreate) onNew?.();
            if (key === "e" && canUpdate) onEdit?.();
            if (key === "s" && canSave) onSave?.();
        }
        window.addEventListener("keydown", handleShortcut);
        return () => {
            root.removeAttribute("data-record-shortcut-scope");
            root.removeAttribute("data-record-shortcut-keys");
            window.removeEventListener("keydown", handleShortcut);
        };
    }, [
        scope,
        page,
        detailRegion,
        enabled,
        canCreate,
        canUpdate,
        canSave,
        onNew,
        onEdit,
        onSave,
    ]);
}
