import type { FormEvent } from "react";

export function uppercaseBusinessInput(event: FormEvent<HTMLElement>) {
    const field = event.target;
    if (!(
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement
    ))
        return;
    if (
        field.readOnly ||
        field.disabled ||
        field.closest("[data-preserve-case]")
    )
        return;
    if (
        field instanceof HTMLInputElement &&
        !["text", "tel", "email", "url"].includes(field.type)
    )
        return;
    const identity = [
        field.id,
        field.name,
        field.getAttribute("aria-label"),
        field.getAttribute("autocomplete"),
        field.getAttribute("placeholder"),
    ].join(" ");
    if (/password|search|token/i.test(identity)) return;
    if (
        event.nativeEvent instanceof InputEvent &&
        event.nativeEvent.isComposing
    )
        return;
    const original = field.value;
    const converted = original.toUpperCase();
    if (original === converted) return;
    const start = field.selectionStart,
        end = field.selectionEnd;
    const prototype =
        field instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(
        field,
        converted,
    );
    if (start !== null && end !== null)
        field.setSelectionRange(
            original.slice(0, start).toUpperCase().length,
            original.slice(0, end).toUpperCase().length,
        );
}
