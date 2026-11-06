import { useEffect, useState, type RefObject } from "react";
import { Eye } from "./icons";

export function MobileRecordBrowser({
    title,
    listRef,
    onViewAll,
}: {
    title: string;
    listRef: RefObject<HTMLElement | null>;
    onViewAll: () => void;
}) {
    const [pastList, setPastList] = useState(false);
    const [top, setTop] = useState(56);

    useEffect(() => {
        const list = listRef.current;
        if (!list) return;
        const header = document.querySelector(".topbar-header");
        let observer: IntersectionObserver;
        function observeList() {
            observer?.disconnect();
            const offset = header?.getBoundingClientRect().height ?? 0;
            setTop(offset);
            setPastList(list!.getBoundingClientRect().bottom <= offset);
            observer = new IntersectionObserver(
                ([entry]) =>
                    setPastList(
                        !entry.isIntersecting &&
                            entry.boundingClientRect.bottom <= offset,
                    ),
                { rootMargin: `-${offset}px 0px 0px 0px` },
            );
            observer.observe(list!);
        }
        observeList();
        const resize = new ResizeObserver(observeList);
        if (header) resize.observe(header);
        return () => {
            observer.disconnect();
            resize.disconnect();
        };
    }, [listRef]);

    return (
        <div
            className="mobile-record-browser"
            data-visible={pastList}
            style={{ top }}
            role="region"
            aria-label="Record browser"
            aria-hidden={!pastList}
            inert={!pastList}
        >
            <span className="mobile-record-browser-title">All {title}</span>
            <button
                type="button"
                className="mobile-record-browser-button"
                onClick={onViewAll}
                aria-label={`View all ${title.toLowerCase()}`}
                title={`View all ${title.toLowerCase()}`}
            >
                <Eye size={20} />
            </button>
        </div>
    );
}
