import { useSyncExternalStore } from "react";

/**
 * Tracks every write request (save, update, delete) in flight across the app.
 * While any is running the page is locked against clicks and submit keys, so a
 * double click or a repeated Enter can never send the same entry twice.
 */
let pendingWrites = 0;
const listeners = new Set<() => void>();
const inFlight = new Map<string, Promise<unknown>>();

function setPending(next: number): void {
    const wasSaving = pendingWrites > 0;
    pendingWrites = next;
    const isSaving = pendingWrites > 0;
    if (wasSaving !== isSaving) {
        document.body.classList.toggle("is-saving", isSaving);
        document.body.setAttribute("aria-busy", String(isSaving));
        listeners.forEach((listener) => listener());
    }
}

/**
 * Runs a write request, sharing the in-flight promise when an identical write
 * (same method, path and body) is already running instead of sending it again.
 */
export function trackWrite<T>(
    key: string | null,
    send: () => Promise<T>,
): Promise<T> {
    const existing = key ? inFlight.get(key) : undefined;
    if (existing) {
        return existing as Promise<T>;
    }
    setPending(pendingWrites + 1);
    const request = send().finally(() => {
        if (key) {
            inFlight.delete(key);
        }
        setPending(pendingWrites - 1);
    });
    if (key) {
        inFlight.set(key, request);
    }
    return request;
}

export function isSaving(): boolean {
    return pendingWrites > 0;
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useIsSaving(): boolean {
    return useSyncExternalStore(subscribe, isSaving, () => false);
}

/** Swallows submit keys while a save runs; pointer clicks are blocked in CSS. */
function blockRepeatSubmit(event: KeyboardEvent): void {
    if (!isSaving()) {
        return;
    }
    const isSaveShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";
    const target = event.target as HTMLElement | null;
    const activatesControl =
        (event.key === "Enter" &&
            !!target?.closest("button, a, [role=button], form")) ||
        (event.key === " " && !!target?.closest("button, [role=button]"));
    if (isSaveShortcut || activatesControl) {
        event.preventDefault();
        event.stopImmediatePropagation();
    }
}

function warnBeforeLeaving(event: BeforeUnloadEvent): void {
    if (isSaving()) {
        event.preventDefault();
    }
}

if (typeof window !== "undefined") {
    window.addEventListener("keydown", blockRepeatSubmit, true);
    window.addEventListener("beforeunload", warnBeforeLeaving);
}
