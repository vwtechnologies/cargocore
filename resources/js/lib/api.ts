import { ApiError } from "./types";
import { notifyRecordsChanged } from "./live-data";
let csrfToken: string | undefined;

export async function csrf() {
    const response = await fetch("/csrf-token", {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || typeof body?.token !== "string" || !body.token) {
        throw new ApiError(
            body?.message ||
                "Could not refresh your session. Please reload and try again.",
            response.status,
            body?.errors,
            body?.code,
        );
    }
    csrfToken = body.token;
}
export async function api<T>(
    path: string,
    options: RequestInit = {},
): Promise<T> {
    const send = () => {
        const token = document.cookie
            .split("; ")
            .find((cookie) => cookie.startsWith("XSRF-TOKEN="))
            ?.slice(11);
        const headers = new Headers({
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
            ...(options.body instanceof FormData
                ? {}
                : { "Content-Type": "application/json" }),
        });
        new Headers(options.headers).forEach((value, name) =>
            headers.set(name, value),
        );
        if (csrfToken) {
            headers.set("X-CSRF-TOKEN", csrfToken);
            headers.delete("X-XSRF-TOKEN");
        } else if (token) {
            headers.set("X-XSRF-TOKEN", decodeURIComponent(token));
        }
        return fetch(path, { ...options, credentials: "same-origin", headers });
    };
    let response = await send();
    if (
        response.status === 419 &&
        ["POST", "PUT", "PATCH", "DELETE"].includes(
            (options.method ?? "GET").toUpperCase(),
        )
    ) {
        await csrf();
        response = await send();
    }
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
