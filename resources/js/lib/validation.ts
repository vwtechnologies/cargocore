import { z } from "zod";
import type { Field } from "./types";
export function formSchema(fields: Record<string, Field>) {
    return z
        .object(
            Object.fromEntries(
                Object.keys(fields).map((key) => [key, z.unknown()]),
            ),
        )
        .superRefine((values, ctx) => {
            for (const [key, field] of Object.entries(fields)) {
                const value = values[key];
                const empty =
                    value === null || value === undefined || value === "";
                const issue = (message: string) =>
                    ctx.addIssue({ code: "custom", path: [key], message });
                if (field.required && empty) {
                    issue(`${field.label} is required.`);
                    continue;
                }
                if (empty) continue;
                if (
                    field.type === "money" &&
                    !/^-?\d{1,17}(\.\d{1,2})?$/.test(String(value))
                )
                    issue(
                        "Enter an amount with no more than two decimal places.",
                    );
                if (
                    field.type === "email" &&
                    !z.email().safeParse(value).success
                )
                    issue("Enter a valid email address.");
                if (field.type === "url" && !/^https?:\/\//.test(String(value)))
                    issue("Enter a website starting with https:// or http://.");
                if (
                    field.type === "number" &&
                    (!Number.isInteger(Number(value)) ||
                        Number(value) < (field.min ?? 0))
                )
                    issue(
                        `Enter a whole number of at least ${field.min ?? 0}.`,
                    );
                if (
                    key === "cnic" &&
                    !/^\d{13}$/.test(String(value).replace(/[\s-]/g, ""))
                )
                    issue("CNIC must contain 13 digits.");
            }
        });
}
