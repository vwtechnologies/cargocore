import { ApiError } from "./types";
import { notifyRecordsChanged } from "./live-data";
export async function csrf() {
    await fetch("/sanctum/csrf-cookie", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
    });
}
export async function api<T>(
    path: string,
    options: RequestInit = {},
): Promise<T> {
    const token = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.slice(11);
    const headers: Record<string, string> = {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...(options.body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
        ...(token ? { "X-XSRF-TOKEN": decodeURIComponent(token) } : {}),
        ...(options.headers as Record<string, string>),
    };
    const response = await fetch(
        path.startsWith("/api/") || !path.startsWith("/") ? path : path,
        { ...options, credentials: "same-origin", headers },
    );
    const body =
        response.status === 204
            ? null
            : await response.json().catch(() => null);
    if (!response.ok) {
        if (
            response.status === 401 &&
            !path.includes("login") &&
            !path.includes("/session")
        )
            window.dispatchEvent(new Event("session-expired"));
        throw new ApiError(
            body?.message || `Request failed (${response.status})`,
            response.status,
            body?.errors,
            body?.code,
        );
    }
    if (
        path.startsWith("/api/v1/") &&
        ["POST", "PUT", "PATCH", "DELETE"].includes(
            (options.method ?? "GET").toUpperCase(),
        )
    ) {
        notifyRecordsChanged();
    }
    return body as T;
}
export function managementApi<T>(path: string): Promise<T> {
    return api<T>(`${path}${path.includes("?") ? "&" : "?"}context=management`);
}
export const endpoint = (
    entity: string,
    parent?: { entity: string; id: number },
) => `/api/v1/${parent ? `${parent.entity}/${parent.id}/` : ""}${entity}`;
export function params(values: Record<string, unknown>) {
    const p = new URLSearchParams();
    Object.entries(values).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
    });
    return p.toString();
}
export function display(value: unknown): string {
    if (value === null || value === undefined || value === "") return "—";
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
}
export function money(value: unknown): string {
    if (value === null || value === undefined || value === "") return "—";
    const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
    if (!match) return String(value);
    const integer = new Intl.NumberFormat("en-PK", {
        maximumFractionDigits: 0,
    }).format(BigInt(match[2]));
    return `PKR ${match[1]}${integer}.${(match[3] ?? "").padEnd(2, "0")}`;
}
export const dateTime = (value: unknown) =>
    new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Karachi",
    }).format(new Date(String(value)));
