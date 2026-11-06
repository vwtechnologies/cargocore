import { useEffect, useRef, useState, type ReactNode } from "react";

export function PageActions({
    children,
    className = "heading-actions",
    sticky = true,
}: {
    children: ReactNode;
    className?: string;
    sticky?: boolean;
}) {
    const source = useRef<HTMLDivElement>(null);
    const [showBottomBar, setShowBottomBar] = useState(false);

    useEffect(() => {
        const element = source.current;
        if (!element || !sticky) return;
        const header = document.querySelector(".topbar-header");
        let observer: IntersectionObserver;
        function observeActions() {
            observer?.disconnect();
            const headerHeight = header?.getBoundingClientRect().height ?? 0;
            observer = new IntersectionObserver(
                ([entry]) => {
                    setShowBottomBar(
                        !entry.isIntersecting &&
                            entry.boundingClientRect.bottom <= headerHeight,
                    );
                },
                { rootMargin: `-${headerHeight}px 0px 0px 0px` },
            );
            observer.observe(element!);
        }
        observeActions();
        const resize = new ResizeObserver(observeActions);
        if (header) resize.observe(header);
        return () => {
            observer.disconnect();
            resize.disconnect();
        };
    }, [sticky]);

    return (
        <>
            <div
                ref={source}
                className={className}
                data-page-actions={sticky ? "" : undefined}
            >
                {children}
            </div>
            {sticky && (
                <div
                    className="page-bottom-actions"
                    data-visible={showBottomBar}
                    role="group"
                    aria-label="Page actions"
                    aria-hidden={!showBottomBar}
                    inert={!showBottomBar}
                >
                    <div className={className}>{children}</div>
                </div>
            )}
        </>
    );
}
