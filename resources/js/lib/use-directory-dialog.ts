import { useEffect, useRef, type RefObject } from "react";

export function useDirectoryDialog(
    open: boolean,
    searchRef: RefObject<HTMLInputElement | null>,
    onClose: () => void,
) {
    const close = useRef(onClose);
    close.current = onClose;
    useEffect(() => {
        if (!open) return;
        const previousFocus = document.activeElement as HTMLElement | null;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const timer = window.setTimeout(
            () => searchRef.current?.focus({ preventScroll: true }),
            0,
        );
        function handleKey(event: KeyboardEvent) {
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                close.current();
            } else if (event.key === "Tab") {
                const dialog = searchRef.current?.closest(
                    ".view-all-modal-box",
                );
                const controls = Array.from(
                    dialog?.querySelectorAll<HTMLElement>(
                        'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
                    ) ?? [],
                ).filter((control) => control.getClientRects().length > 0);
                const first = controls[0],
                    last = controls.at(-1);
                if (
                    event.shiftKey &&
                    (document.activeElement === first ||
                        !dialog?.contains(document.activeElement))
                ) {
                    event.preventDefault();
                    last?.focus();
                } else if (
                    !event.shiftKey &&
                    (document.activeElement === last ||
                        !dialog?.contains(document.activeElement))
                ) {
                    event.preventDefault();
                    first?.focus();
                }
            }
        }
        document.addEventListener("keydown", handleKey, true);
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener("keydown", handleKey, true);
            document.body.style.overflow = overflow;
            if (previousFocus?.isConnected)
                previousFocus.focus({ preventScroll: true });
        };
    }, [open, searchRef]);
}
