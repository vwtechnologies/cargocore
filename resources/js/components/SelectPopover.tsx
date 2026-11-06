import {
    useLayoutEffect,
    useRef,
    type CSSProperties,
    type ReactNode,
    type RefObject,
    type KeyboardEventHandler,
} from "react";

export function SelectPopover({
    anchorRef,
    onClose,
    className,
    style,
    children,
    onKeyDown,
}: {
    anchorRef: RefObject<HTMLElement | null>;
    onClose: () => void;
    className: string;
    style?: CSSProperties;
    children: ReactNode;
    onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
}) {
    const panelRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;

    useLayoutEffect(() => {
        const panel = panelRef.current;
        const anchor = anchorRef.current;
        if (!panel || !anchor) return;

        function position() {
            if (!panel || !anchor) return;
            const bounds = anchor.getBoundingClientRect();
            const viewportWidth = document.documentElement.clientWidth;
            const viewportHeight = window.innerHeight;
            if (bounds.bottom <= 0 || bounds.top >= viewportHeight) {
                closeRef.current();
                return;
            }
            const width = Math.min(
                Math.max(bounds.width, 220),
                viewportWidth - 16,
            );
            panel.style.width = `${width}px`;
            const below = Math.max(0, viewportHeight - bounds.bottom - 12);
            const above = Math.max(0, bounds.top - 12);
            const height = Math.min(panel.scrollHeight, 320);
            const opensAbove = below < height && above > below;
            const availableHeight = opensAbove ? above : below;
            panel.style.maxHeight = `${Math.min(320, availableHeight)}px`;
            panel.style.left = `${Math.max(8, Math.min(bounds.left, viewportWidth - width - 8))}px`;
            panel.style.top = `${opensAbove ? bounds.top - panel.getBoundingClientRect().height - 4 : bounds.bottom + 4}px`;
            panel.dataset.placement = opensAbove ? "above" : "below";
        }

        panel.showPopover();
        position();
        panel
            .querySelector<HTMLInputElement>("input")
            ?.focus({ preventScroll: true });
        const observer = new ResizeObserver(position);
        observer.observe(anchor);
        observer.observe(panel);
        function handleScroll(event: Event) {
            if (!panel?.contains(event.target as Node)) position();
        }
        function handleOutside(event: Event) {
            const target = event.target as Node;
            if (!panel?.contains(target) && !anchor?.contains(target))
                closeRef.current();
        }
        window.addEventListener("resize", position);
        document.addEventListener("scroll", handleScroll, true);
        document.addEventListener("pointerdown", handleOutside);
        document.addEventListener("focusin", handleOutside);
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", position);
            document.removeEventListener("scroll", handleScroll, true);
            document.removeEventListener("pointerdown", handleOutside);
            document.removeEventListener("focusin", handleOutside);
            const restoreFocus = panel.contains(document.activeElement);
            panel.hidePopover();
            if (restoreFocus && anchor.isConnected)
                anchor.focus({ preventScroll: true });
        };
    }, [anchorRef]);

    return (
        <div
            ref={panelRef}
            popover="manual"
            className={className}
            data-select-popover
            onPointerDown={(event) => {
                event.stopPropagation();
                if ((event.target as HTMLElement).closest("button"))
                    event.preventDefault();
            }}
            style={{
                ...style,
                position: "fixed",
                inset: "auto",
                margin: 0,
                minWidth: 0,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
            }}
            onKeyDown={(event) => {
                onKeyDown?.(event);
                if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    onClose();
                    anchorRef.current?.focus({ preventScroll: true });
                }
            }}
        >
            {children}
        </div>
    );
}
