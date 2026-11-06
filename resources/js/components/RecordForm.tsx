import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { formSchema } from "../lib/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, History, Plus, Trash2, X } from "./icons";
import { useDirtyForm, useDirty } from "../lib/dirty";
import { useSession } from "../lib/session";
import { api, managementApi, endpoint } from "../lib/api";
import { ApiError, type RecordData } from "../lib/types";
import { ReferenceSelect } from "./ReferenceSelect";
import { ErrorState, Spinner, Modal } from "./ui";
import { useRecordShortcuts } from "../lib/record-shortcuts";
export type Parent = { entity: string; id: number };
export function RecordForm({
    entity,
    record,
    parent,
    onDone,
    onDirty,
    defaults = {},
}: {
    entity: string;
    record?: RecordData;
    parent?: Parent;
    onDone: (saved?: boolean) => void;
    onDirty?: (dirty: boolean) => void;
    defaults?: Record<string, unknown>;
}) {
    const { session, refresh } = useSession();
    const definition = session.entities[entity];
    const cache = useQueryClient();
    const [personQuick, setPersonQuick] = useState(false);
    const shortcutScope = useRef<HTMLFormElement>(null);
    const [editVersion, setEditVersion] = useState(record?.version);
    const initial = useMemo(
        () =>
            Object.fromEntries(
                Object.entries(definition.fields).map(([k, f]) => [
                    k,
                    record?.[k] ??
                        defaults[k] ??
                        f.default ??
                        (f.type === "boolean"
                            ? false
                            : f.type === "list"
                              ? []
                              : f.type === "reference"
                                ? null
                                : ""),
                ]),
            ),
        [record, entity],
    );
    const schema = useMemo(() => formSchema(definition.fields), [entity]);
    const {
        register,
        handleSubmit,
        control,
        watch,
        setValue,
        setError,
        formState: { errors, isDirty },
        reset,
    } = useForm<Record<string, unknown>>({
        defaultValues: initial,
        resolver: zodResolver(schema),
    });
    const values = watch();
    useDirtyForm(isDirty);
    const guard = useDirty();
    useEffect(() => onDirty?.(isDirty), [isDirty, onDirty]);
    useEffect(() => {
        const warn = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [isDirty]);

    const mutation = useMutation({
        mutationFn: async (data: Record<string, unknown>) => {
            const body: Record<string, unknown> = {
                ...data,
                ...(record ? { version: editVersion } : {}),
            };
            Object.entries(definition.fields).forEach(([k, f]) => {
                if (body[k] === "") body[k] = null;
                if (f.type === "number" && body[k] !== null)
                    body[k] = Number(body[k]);
            });
            return api(
                `${endpoint(entity, parent)}${record ? `/${record.id}` : ""}`,
                { method: record ? "PUT" : "POST", body: JSON.stringify(body) },
            );
        },
        onSuccess: async () => {
            reset(values);
            onDirty?.(false);
            guard.clear();
            await cache.invalidateQueries();
            if (entity === "companies") await refresh();
            toast.success(record ? "Changes saved" : "Record created");
            onDone(true);
        },
        onError: (error) => {
            if (error instanceof ApiError)
                Object.entries(error.errors).forEach(([key, messages]) =>
                    setError(key, { message: messages.join(" ") }),
                );
        },
    });

    useRecordShortcuts({
        scope: shortcutScope,
        enabled: !mutation.isPending,
        canSave: record
            ? definition.capabilities.update
            : definition.capabilities.create,
        onSave: () => {
            void handleSubmit((data) => mutation.mutate(data))();
        },
    });

    // Enter key navigation to move focus to the next field
    const handleEnterNav = (e: React.KeyboardEvent) => {
        if (e.key !== "Enter") return;
        const target = e.target as HTMLElement;
        if (!target) return;
        if (target.tagName === "TEXTAREA" && !e.ctrlKey) return;
        if (target.closest("[data-combobox-open='true']")) return;
        if (
            target.tagName === "BUTTON" &&
            (target.getAttribute("type") === "submit" ||
                target.classList.contains("btn-primary"))
        )
            return;

        const container = target.closest("form.record-form");
        if (!container) return;

        const selector =
            'input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), button.select-button:not([disabled]), button[role="switch"]:not([disabled])';
        const fields = Array.from(
            container.querySelectorAll<HTMLElement>(selector),
        ).filter(
            (el) => el.offsetParent !== null && !el.hasAttribute("disabled"),
        );

        const currentIndex = fields.indexOf(target);
        if (currentIndex !== -1 && currentIndex + 1 < fields.length) {
            e.preventDefault();
            fields[currentIndex + 1].focus();
        }
    };
    function changeReference(key: string, value: unknown) {
        setValue(key, value, { shouldDirty: true });
        if (key === "country_id") {
            setValue("city_id", null, { shouldDirty: true });
            if ("bank_branch_id" in values)
                setValue("bank_branch_id", null, { shouldDirty: true });
        }
        if (key === "city_id" || key === "bank_id")
            if ("bank_branch_id" in values)
                setValue("bank_branch_id", null, { shouldDirty: true });
    }
    return (
        <>
            <form
                ref={shortcutScope}
                onSubmit={handleSubmit((data) => mutation.mutate(data))}
                className="record-form"
                onKeyDown={handleEnterNav}
            >
                <div className="form-grid">
                    {Object.entries(definition.fields).map(([key, field]) => {
                        const type = field.type ?? "text";
                        const disabled = !!record && !!field.immutable;
                        const inputId = `field-${entity}-${key}`;
                        const filters: Record<string, unknown> = {};
                        if (
                            field.entity === "cities" ||
                            (entity === "accounts" && field.entity === "banks")
                        )
                            filters.country_id = values.country_id;
                        if (field.entity === "branches") {
                            filters.bank_id =
                                entity === "officers"
                                    ? parent?.id
                                    : values.bank_id;
                            filters.city_id = values.city_id;
                        }
                        return (
                            <div
                                key={key}
                                className={`field ${["textarea", "list"].includes(type) ? "span-two" : ""}`}
                            >
                                <label htmlFor={inputId}>
                                    {field.label}
                                    {field.required && (
                                        <span
                                            aria-hidden="true"
                                            className="required"
                                        >
                                            {" "}
                                            *
                                        </span>
                                    )}
                                </label>
                                {type === "reference" ? (
                                    <>
                                        <Controller
                                            control={control}
                                            name={key}
                                            render={({ field: f }) => (
                                                <ReferenceSelect
                                                    id={inputId}
                                                    label={field.label}
                                                    entity={field.entity!}
                                                    value={f.value}
                                                    filters={filters}
                                                    disabled={
                                                        !!field.depends &&
                                                        !values[field.depends]
                                                    }
                                                    onChange={(v) =>
                                                        changeReference(key, v)
                                                    }
                                                />
                                            )}
                                        />
                                        {key === "person_id" &&
                                            session.entities.people.capabilities
                                                .create && (
                                                <button
                                                    type="button"
                                                    className="text-button"
                                                    onClick={() =>
                                                        setPersonQuick(true)
                                                    }
                                                >
                                                    <Plus size={12} />
                                                    Create person
                                                </button>
                                            )}
                                    </>
                                ) : type === "boolean" ? (
                                    <Controller
                                        name={key}
                                        control={control}
                                        render={({ field: f }) => (
                                            <label className="switch-row">
                                                <input
                                                    id={inputId}
                                                    type="checkbox"
                                                    checked={!!f.value}
                                                    onChange={(e) =>
                                                        f.onChange(
                                                            e.target.checked,
                                                        )
                                                    }
                                                />
                                                <span className="switch" />
                                                <span>
                                                    {key === "status"
                                                        ? f.value
                                                            ? "Active"
                                                            : "Inactive"
                                                        : "Set as default"}
                                                </span>
                                            </label>
                                        )}
                                    />
                                ) : type === "list" ? (
                                    <Controller
                                        control={control}
                                        name={key}
                                        render={({ field: f }) => {
                                            const items = (f.value ??
                                                []) as string[];
                                            return (
                                                <div className="repeatable">
                                                    {items.map((item, i) => (
                                                        <div
                                                            className="repeatable-row"
                                                            key={i}
                                                        >
                                                            <input
                                                                aria-label={`${field.label} ${i + 1}`}
                                                                value={item}
                                                                onChange={(e) =>
                                                                    f.onChange(
                                                                        items.map(
                                                                            (
                                                                                v,
                                                                                j,
                                                                            ) =>
                                                                                i ===
                                                                                j
                                                                                    ? e
                                                                                          .target
                                                                                          .value
                                                                                    : v,
                                                                        ),
                                                                    )
                                                                }
                                                            />
                                                            <button
                                                                type="button"
                                                                className="icon-button"
                                                                aria-label={`Remove ${field.label} ${i + 1}`}
                                                                onClick={() =>
                                                                    f.onChange(
                                                                        items.filter(
                                                                            (
                                                                                _,
                                                                                j,
                                                                            ) =>
                                                                                j !==
                                                                                i,
                                                                        ),
                                                                    )
                                                                }
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        className="text-button"
                                                        onClick={() =>
                                                            f.onChange([
                                                                ...items,
                                                                "",
                                                            ])
                                                        }
                                                    >
                                                        <Plus size={14} />
                                                        Add number
                                                    </button>
                                                </div>
                                            );
                                        }}
                                    />
                                ) : type === "textarea" ? (
                                    <textarea
                                        id={inputId}
                                        rows={3}
                                        {...register(key)}
                                        maxLength={field.max}
                                    />
                                ) : type === "combobox" ? (
                                    <>
                                        <input
                                            id={inputId}
                                            list={`options-${key}`}
                                            {...register(key)}
                                            maxLength={field.max}
                                        />
                                        <datalist id={`options-${key}`}>
                                            {field.options?.map((o) => (
                                                <option key={o} value={o} />
                                            ))}
                                        </datalist>
                                    </>
                                ) : (
                                    <input
                                        id={inputId}
                                        type={
                                            type === "money"
                                                ? "text"
                                                : [
                                                        "date",
                                                        "number",
                                                        "email",
                                                        "url",
                                                    ].includes(type)
                                                  ? type
                                                  : "text"
                                        }
                                        inputMode={
                                            type === "money"
                                                ? "decimal"
                                                : undefined
                                        }
                                        step={type === "number" ? 1 : undefined}
                                        min={field.min}
                                        maxLength={
                                            key === "cnic" ? 15 : field.max
                                        }
                                        disabled={disabled}
                                        required={field.required}
                                        {...register(key)}
                                    />
                                )}{" "}
                                {errors[key] && (
                                    <span className="field-error" role="alert">
                                        {String(errors[key]?.message)}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
                {mutation.error && <ErrorState error={mutation.error} />}
                {record &&
                    mutation.error instanceof ApiError &&
                    mutation.error.status === 409 && (
                        <button
                            type="button"
                            className="btn secondary"
                            onClick={async () => {
                                if (
                                    !window.confirm(
                                        "Replace your unsaved fields with the latest saved record?",
                                    )
                                )
                                    return;
                                try {
                                    const latest = await managementApi<{
                                        data: RecordData;
                                    }>(
                                        `${endpoint(entity, parent)}/${record.id}`,
                                    );
                                    reset(
                                        Object.fromEntries(
                                            Object.entries(
                                                definition.fields,
                                            ).map(([key, field]) => [
                                                key,
                                                latest.data[key] ??
                                                    (field.type === "boolean"
                                                        ? false
                                                        : field.type === "list"
                                                          ? []
                                                          : field.type ===
                                                              "reference"
                                                            ? null
                                                            : ""),
                                            ]),
                                        ),
                                    );
                                    setEditVersion(latest.data.version);
                                    mutation.reset();
                                    toast.success(
                                        "Latest record loaded. Review before saving.",
                                    );
                                } catch (error) {
                                    toast.error((error as Error).message);
                                }
                            }}
                        >
                            <History className="mobile-action-icon" /> Reload
                            latest record
                        </button>
                    )}
                <div className="form-actions">
                    <span className="muted">
                        {isDirty
                            ? "You have unsaved changes"
                            : "All fields marked * are required"}
                    </span>
                    <div>
                        <button
                            type="button"
                            className="btn secondary"
                            onClick={() => onDone(false)}
                        >
                            <X className="mobile-action-icon" /> Cancel
                        </button>
                        <button
                            className="btn primary"
                            disabled={mutation.isPending}
                        >
                            {mutation.isPending ? (
                                <Spinner />
                            ) : (
                                <Check size={16} />
                            )}
                            Save {record ? "changes" : "record"}
                        </button>
                    </div>
                </div>
            </form>
            <Modal
                open={personQuick}
                onClose={() => setPersonQuick(false)}
                title="Create person"
                wide
            >
                <RecordForm
                    entity="people"
                    onDone={() => setPersonQuick(false)}
                />
            </Modal>
        </>
    );
}
