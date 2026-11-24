import { titleCaseLabel } from "../lib/labels";
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
import { ApiError, type Field, type RecordData } from "../lib/types";
import { ReferenceSelect } from "./ReferenceSelect";
import { RepeatableValues } from "./RepeatableValues";
import { ErrorState, Spinner, Modal } from "./ui";
import { useRecordShortcuts } from "../lib/record-shortcuts";
export type Parent = { entity: string; id: number };

/** A section made only of category switches; each switch names itself, so the field label above it is skipped. */
function isToggleOnlyGroup(fields: [string, Field][]): boolean {
    return fields.every(
        ([key, field]) => field.type === "boolean" && key !== "status",
    );
}
export function RecordForm({
    entity,
    record,
    parent,
    onDone,
    onDirty,
    defaults = {},
    formId,
    hideActions = false,
}: {
    entity: string;
    record?: RecordData;
    parent?: Parent;
    onDone: (saved?: boolean, savedRecord?: RecordData) => void;
    onDirty?: (dirty: boolean) => void;
    defaults?: Record<string, unknown>;
    /** Lets a page header button submit this form with `form.requestSubmit()`. */
    formId?: string;
    /** Hides the built-in Cancel/Save bar when the page header provides those actions. */
    hideActions?: boolean;
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
    const entries = Object.entries(definition.fields);
    const contactField = (key: string) =>
        /address|phone|mobile|email|website|contact/.test(key);
    const isAccount = entity === "accounts" || entity === "bank-accounts";
    const accountGroup = (title: string, keys: string[]) => ({
        title,
        fields: keys
            .filter((key) => key in definition.fields)
            .map((key) => [key, definition.fields[key]] as [string, Field]),
    });
    const showsAccountCompany =
        !!values.is_our_account || !!values.is_company || !!values.company_id;
    const fieldGroups: { title?: string; fields: [string, Field][] }[] =
        isAccount
            ? [
                  accountGroup("Bank & Branch", [
                      "country_id",
                      "bank_id",
                      "city_id",
                      "bank_branch_id",
                  ]),
                  accountGroup("Account Details", [
                      "account_number",
                      "iban",
                      "account_title",
                      "short_title",
                      "account_type",
                      "person_id",
                      "account_holder_name",
                      "account_holder_cnic",
                      "authorized_signatory_name",
                      "authorized_signatory_cnic",
                  ]),
                  accountGroup("Categories", [
                      "is_our_account",
                      "is_cheque",
                      "is_beneficiary",
                      "is_employee",
                      "is_company",
                      "is_other",
                  ]),
                  ...(showsAccountCompany
                      ? [
                            accountGroup("Our Company & Banking Address", [
                                "company_id",
                                "company_address_id",
                            ]),
                        ]
                      : []),
                  accountGroup("Opening Balance & Status", [
                      "opening_balance_date",
                      "opening_balance",
                      "status",
                  ]),
              ].filter((group) => group.fields.length > 0)
            : entries.length > 8
              ? [
                    {
                        title: "General",
                        fields: entries.filter(
                            ([key, field]) =>
                                field.type !== "boolean" && !contactField(key),
                        ),
                    },
                    {
                        title: "Contact Details",
                        fields: entries.filter(
                            ([key, field]) =>
                                field.type !== "boolean" && contactField(key),
                        ),
                    },
                    {
                        title: "Status",
                        fields: entries.filter(
                            ([, field]) => field.type === "boolean",
                        ),
                    },
                ].filter((group) => group.fields.length > 0)
              : [{ fields: entries }];
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
            return api<{ data: RecordData }>(
                `${endpoint(entity, parent)}${record ? `/${record.id}` : ""}`,
                { method: record ? "PUT" : "POST", body: JSON.stringify(body) },
            );
        },
        onSuccess: async (response) => {
            reset(values);
            onDirty?.(false);
            guard.clear();
            await cache.invalidateQueries();
            if (entity === "companies") await refresh();
            toast.success(record ? "Changes saved" : "Record created");
            onDone(true, response?.data);
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
        if (key === "company_id" && "company_address_id" in values)
            setValue("company_address_id", null, { shouldDirty: true });
        if (key === "country_id") {
            setValue("city_id", null, { shouldDirty: true });
            if (isAccount && "bank_id" in values)
                setValue("bank_id", null, { shouldDirty: true });
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
                id={formId}
                ref={shortcutScope}
                onSubmit={handleSubmit((data) => mutation.mutate(data))}
                className="record-form"
                onKeyDown={handleEnterNav}
            >
                <div className="form-grid">
                    {fieldGroups.map((group, index) => (
                        <section
                            className={`form-field-section${isToggleOnlyGroup(group.fields) ? " toggle-only-section" : ""}`}
                            key={group.title ?? index}
                        >
                            {group.title && <h3>{group.title}</h3>}
                            <div className="form-grid">
                                {group.fields.map(([key, field]) => {
                                    const type = field.type ?? "text";
                                    const disabled =
                                        !!record && !!field.immutable;
                                    if (
                                        (field.depends &&
                                            !values[field.depends]) ||
                                        (isAccount &&
                                            field.entity === "banks" &&
                                            !values.country_id) ||
                                        (isAccount &&
                                            field.entity === "branches" &&
                                            !values.bank_id) ||
                                        (entity === "people" &&
                                            key === "joining_date" &&
                                            !values.is_employee)
                                    )
                                        return null;
                                    const inputId = `field-${entity}-${key}`;
                                    const filters: Record<string, unknown> = {};
                                    if (
                                        field.entity === "cities" ||
                                        (isAccount && field.entity === "banks")
                                    )
                                        filters.country_id = values.country_id;
                                    if (field.entity === "company-addresses")
                                        filters.company_id = values.company_id;
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
                                            {!isToggleOnlyGroup(
                                                group.fields,
                                            ) && (
                                                <label htmlFor={inputId}>
                                                    {titleCaseLabel(
                                                        field.label,
                                                    )}
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
                                            )}
                                            {type === "reference" ? (
                                                <>
                                                    <Controller
                                                        control={control}
                                                        name={key}
                                                        render={({
                                                            field: f,
                                                        }) => (
                                                            <ReferenceSelect
                                                                id={inputId}
                                                                label={titleCaseLabel(
                                                                    field.label,
                                                                )}
                                                                entity={
                                                                    field.entity!
                                                                }
                                                                value={f.value}
                                                                filters={
                                                                    filters
                                                                }
                                                                disabled={
                                                                    !!field.depends &&
                                                                    !values[
                                                                        field
                                                                            .depends
                                                                    ]
                                                                }
                                                                onChange={(v) =>
                                                                    changeReference(
                                                                        key,
                                                                        v,
                                                                    )
                                                                }
                                                            />
                                                        )}
                                                    />
                                                    {key === "person_id" &&
                                                        session.entities.people
                                                            .capabilities
                                                            .create && (
                                                            <button
                                                                type="button"
                                                                className="text-button"
                                                                onClick={() =>
                                                                    setPersonQuick(
                                                                        true,
                                                                    )
                                                                }
                                                            >
                                                                <Plus
                                                                    size={12}
                                                                />
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
                                                                checked={
                                                                    !!f.value
                                                                }
                                                                onChange={(e) =>
                                                                    f.onChange(
                                                                        e.target
                                                                            .checked,
                                                                    )
                                                                }
                                                            />
                                                            <span className="switch" />
                                                            <span>
                                                                {key ===
                                                                "status"
                                                                    ? f.value
                                                                        ? "Active"
                                                                        : "Inactive"
                                                                    : key ===
                                                                        "is_default"
                                                                      ? "Set as default"
                                                                      : titleCaseLabel(
                                                                            field.label,
                                                                        )}
                                                            </span>
                                                        </label>
                                                    )}
                                                />
                                            ) : type === "list" ? (
                                                <Controller
                                                    control={control}
                                                    name={key}
                                                    render={({ field: f }) => (
                                                        <RepeatableValues
                                                            label={titleCaseLabel(
                                                                field.label,
                                                            )}
                                                            values={
                                                                (f.value ??
                                                                    []) as string[]
                                                            }
                                                            onChange={
                                                                f.onChange
                                                            }
                                                        />
                                                    )}
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
                                                    <datalist
                                                        id={`options-${key}`}
                                                    >
                                                        {field.options?.map(
                                                            (o) => (
                                                                <option
                                                                    key={o}
                                                                    value={o}
                                                                />
                                                            ),
                                                        )}
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
                                                    step={
                                                        type === "number"
                                                            ? 1
                                                            : undefined
                                                    }
                                                    min={field.min}
                                                    maxLength={
                                                        key.endsWith("cnic")
                                                            ? 15
                                                            : field.max
                                                    }
                                                    disabled={disabled}
                                                    required={field.required}
                                                    {...register(key)}
                                                />
                                            )}{" "}
                                            {errors[key] && (
                                                <span
                                                    className="field-error"
                                                    role="alert"
                                                >
                                                    {String(
                                                        errors[key]?.message,
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
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
                <div className="form-actions" hidden={hideActions}>
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
                title="Create Person"
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
