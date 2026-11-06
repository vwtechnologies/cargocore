import {
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
    type Ref,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ReferenceSelect } from "../components/ReferenceSelect";
import { ErrorState, StatusIndicator } from "../components/ui";
import { User, Image, History } from "../components/icons";
import { api, managementApi } from "../lib/api";
import { useDirtyForm } from "../lib/dirty";
import { useSession } from "../lib/session";
import { ApiError, type RecordData } from "../lib/types";
import { Documents } from "./PersonSections";
import type { PersonActions } from "./PeoplePage";

const empty = {
    name: "",
    father_husband_name: "",
    cnic: "",
    date_of_birth: "",
    gender: "",
    city_id: null as unknown,
    ntn: "",
    strn: "",
    comments: "",
    status: true,
    is_employee: false,
};
type EmployeeResponse = {
    data: (RecordData & { types: { id: number; name: string }[] }) | null;
    eligible: boolean;
};
type EmployeeDraft = { types: number[]; original: number[]; version: number };
function fields(person?: RecordData) {
    return Object.fromEntries(
        Object.entries(empty).map(([key, fallback]) => [
            key,
            key === "gender"
                ? String(person?.[key] ?? "").toUpperCase()
                : key === "date_of_birth"
                  ? String(person?.[key] ?? "").slice(0, 10)
                  : (person?.[key] ?? fallback),
        ]),
    );
}
export function PersonBasic({
    person,
    editing,
    creating,
    actions,
    onEditingChange,
    onSaved,
}: {
    person?: RecordData;
    editing: boolean;
    creating: boolean;
    actions: Ref<PersonActions>;
    onEditingChange: (value: boolean) => void;
    onSaved: (record: RecordData) => void;
}) {
    const { session } = useSession();
    const cache = useQueryClient();
    const [form, setForm] = useState(() => fields(person));
    const [snapshot, setSnapshot] = useState(person);
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [conflict, setConflict] = useState(false);
    const [employeeDraft, setEmployeeDraft] = useState<EmployeeDraft | null>(
        null,
    );
    const canViewEmployee = session.permissions.includes(
        "employee-details.view",
    );
    const employee = useQuery({
        queryKey: ["employee", person?.id],
        queryFn: () =>
            managementApi<EmployeeResponse>(
                `/api/v1/people/${person!.id}/employee`,
            ),
        enabled: !!person && canViewEmployee,
    });
    const employeeProfile = employee.data?.data;
    const employeeTypes =
        employeeDraft?.types ??
        employeeProfile?.types.map((type) => type.id) ??
        [];
    const canManageEmployee =
        canViewEmployee &&
        session.permissions.includes(
            `employee-details.${employeeProfile ? "update" : "create"}`,
        ) &&
        (!person || (employee.isSuccess && !employee.isFetching));
    const employeeDirty =
        !!employeeDraft &&
        JSON.stringify([...employeeDraft.types].sort((a, b) => a - b)) !==
            JSON.stringify([...employeeDraft.original].sort((a, b) => a - b));
    const formRef = useRef<HTMLFormElement>(null);
    const nameRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (creating) nameRef.current?.focus();
    }, [creating]);
    const previousEditing = useRef(false);
    useEffect(() => {
        if (!editing || !previousEditing.current) {
            setForm(fields(person));
            setSnapshot(person);
            setErrors({});
            setConflict(false);
            setEmployeeDraft(null);
        }
        previousEditing.current = editing;
    }, [editing, person]);
    const dirty =
        editing &&
        (JSON.stringify(form) !== JSON.stringify(fields(snapshot)) ||
            (!!form.is_employee && employeeDirty));
    useDirtyForm(dirty);
    const save = useMutation({
        mutationFn: async () => {
            if (!formRef.current?.reportValidity())
                throw new Error("Complete the required personal details.");
            const { is_employee, ...personal } = form;
            return api<{ data: RecordData }>(
                `/api/v1/people${creating ? "" : `/${person!.id}`}`,
                {
                    method: creating ? "POST" : "PUT",
                    body: JSON.stringify({
                        ...personal,
                        ...(canViewEmployee
                            ? { is_employee: !!is_employee }
                            : {}),
                        ...(is_employee && employeeDirty && employeeDraft
                            ? {
                                  employee: {
                                      type_ids: employeeDraft.types,
                                      version: employeeDraft.version,
                                  },
                              }
                            : {}),
                        name: String(form.name).trim(),
                        cnic: form.cnic || null,
                        date_of_birth: form.date_of_birth || null,
                        gender: form.gender || null,
                        city_id: form.city_id || null,
                        ...(form.city_id ? { place: null } : {}),
                        ...(creating ? {} : { version: snapshot!.version }),
                    }),
                },
            );
        },
        onSuccess: (response) => {
            cache.invalidateQueries({
                queryKey: ["employee", response.data.id],
            });
            setEmployeeDraft(null);
            onSaved(response.data);
            toast.success(
                creating ? "Person created" : "Personal details saved",
            );
        },
        onError: (error) => {
            if (error instanceof ApiError) {
                setErrors(error.errors);
                setConflict(error.status === 409);
            }
            toast.error(error.message);
        },
    });
    const reload = useMutation({
        mutationFn: async () => {
            const [response, details] = await Promise.all([
                managementApi<{ data: RecordData }>(
                    `/api/v1/people/${person!.id}`,
                ),
                canViewEmployee
                    ? managementApi<EmployeeResponse>(
                          `/api/v1/people/${person!.id}/employee`,
                      )
                    : Promise.resolve(null),
            ]);
            if (details) cache.setQueryData(["employee", person!.id], details);
            return response;
        },
        onSuccess: (response) => {
            cache.setQueryData(
                ["person-workspace", String(person!.id)],
                response,
            );
            setSnapshot(response.data);
            setForm(fields(response.data));
            setErrors({});
            setConflict(false);
            setEmployeeDraft(null);
        },
        onError: (error) => toast.error(error.message),
    });
    useImperativeHandle(actions, () => ({
        save: () => {
            if (editing && !save.isPending) save.mutate();
        },
        cancel: () => {
            setForm(fields(snapshot));
            onEditingChange(false);
            setErrors({});
            setConflict(false);
            setEmployeeDraft(null);
        },
    }));
    const canEdit =
        editing &&
        (creating
            ? session.entities.people.capabilities.create
            : session.entities.people.capabilities.update);
    function update(key: string, value: unknown) {
        setForm((current) => ({ ...current, [key]: value }));
    }
    const inputs = [
        ["name", "Full name"],
        ["father_husband_name", "Father / husband name"],
        ["cnic", "CNIC"],
        ["date_of_birth", "Date of birth"],
        ["gender", "Gender"],
        ["city_id", "Place"],
        ["ntn", "NTN"],
        ["strn", "STRN"],
    ];
    return (
        <>
            <section className="company-card person-basic-card">
                <div className="person-section-heading">
                    <User size={17} />
                    <h3>Personal details</h3>
                </div>
                <div className="person-basic-layout">
                    <form
                        ref={formRef}
                        className="person-basic-form"
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (canEdit) save.mutate();
                        }}
                    >
                        <fieldset
                            disabled={save.isPending || reload.isPending}
                            className="inline-cell-fields"
                        >
                            <div className="person-fields-grid">
                                {inputs.map(([key, label]) => (
                                    <div className="company-field" key={key}>
                                        <label htmlFor={`person-${key}`}>
                                            {label}
                                            {key === "name" && (
                                                <span className="required-star">
                                                    {" "}
                                                    *
                                                </span>
                                            )}
                                        </label>
                                        {key === "gender" ? (
                                            <select
                                                id={`person-${key}`}
                                                value={String(form[key])}
                                                disabled={!canEdit}
                                                onChange={(event) =>
                                                    update(
                                                        key,
                                                        event.target.value,
                                                    )
                                                }
                                            >
                                                <option value="">
                                                    Select gender
                                                </option>
                                                {[
                                                    "MALE",
                                                    "FEMALE",
                                                    ...(![
                                                        "",
                                                        "MALE",
                                                        "FEMALE",
                                                    ].includes(
                                                        String(form.gender),
                                                    )
                                                        ? [String(form.gender)]
                                                        : []),
                                                ].map((value) => (
                                                    <option
                                                        key={value}
                                                        value={value}
                                                    >
                                                        {value}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : key === "city_id" ? (
                                            !canEdit ? (
                                                <div className="person-readonly-value">
                                                    {String(
                                                        snapshot?.city_id
                                                            ? (snapshot.city_name ??
                                                                  "Unavailable")
                                                            : (snapshot?.place ??
                                                                  "—"),
                                                    )}
                                                </div>
                                            ) : (
                                                <ReferenceSelect
                                                    entity="cities"
                                                    label="Place"
                                                    id={`person-${key}`}
                                                    value={form.city_id}
                                                    onChange={(value) =>
                                                        update(key, value)
                                                    }
                                                    showCode={false}
                                                />
                                            )
                                        ) : (
                                            <input
                                                id={`person-${key}`}
                                                aria-label={label}
                                                ref={
                                                    key === "name"
                                                        ? nameRef
                                                        : undefined
                                                }
                                                type={
                                                    key === "date_of_birth"
                                                        ? "date"
                                                        : "text"
                                                }
                                                readOnly={!canEdit}
                                                value={String(form[key])}
                                                required={key === "name"}
                                                maxLength={
                                                    key === "cnic"
                                                        ? 15
                                                        : key === "ntn" ||
                                                            key === "strn"
                                                          ? 50
                                                          : 255
                                                }
                                                max={
                                                    key === "date_of_birth"
                                                        ? new Date()
                                                              .toISOString()
                                                              .slice(0, 10)
                                                        : undefined
                                                }
                                                inputMode={
                                                    key === "cnic"
                                                        ? "numeric"
                                                        : undefined
                                                }
                                                aria-invalid={!!errors[key]}
                                                aria-describedby={
                                                    errors[key]
                                                        ? `person-error-${key}`
                                                        : undefined
                                                }
                                                onChange={(event) =>
                                                    update(
                                                        key,
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        )}
                                        {errors[key] && (
                                            <span
                                                className="field-error"
                                                role="alert"
                                                id={`person-error-${key}`}
                                            >
                                                {errors[key].join(" ")}
                                            </span>
                                        )}
                                    </div>
                                ))}
                                <div className="company-field person-comments">
                                    <label htmlFor="person-comments">
                                        Comments / notes
                                    </label>
                                    <textarea
                                        id="person-comments"
                                        rows={4}
                                        maxLength={10000}
                                        value={String(form.comments)}
                                        readOnly={!canEdit}
                                        onChange={(event) =>
                                            update(
                                                "comments",
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="company-toggle-row">
                                    <span className="company-toggle-label">
                                        STATUS
                                    </span>
                                    <div className="company-toggle-switch">
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-label="Person status"
                                            aria-checked={!!form.status}
                                            disabled={!canEdit}
                                            className={`switch-track ${form.status ? "active" : ""}`}
                                            onClick={() =>
                                                update("status", !form.status)
                                            }
                                        >
                                            <span className="switch-knob" />
                                        </button>
                                        <StatusIndicator
                                            active={!!form.status}
                                        />
                                        <span>
                                            {form.status
                                                ? "Active"
                                                : "Inactive"}
                                        </span>
                                    </div>
                                </div>
                                {canViewEmployee && (
                                    <>
                                        <div className="company-field person-employee-selection">
                                            <label htmlFor="person-is-employee">
                                                Employee
                                            </label>
                                            <label className="person-employee-checkbox">
                                                <input
                                                    id="person-is-employee"
                                                    type="checkbox"
                                                    aria-label="Employee"
                                                    checked={!!form.is_employee}
                                                    disabled={
                                                        !canEdit ||
                                                        !canManageEmployee
                                                    }
                                                    onChange={(event) =>
                                                        update(
                                                            "is_employee",
                                                            event.target
                                                                .checked,
                                                        )
                                                    }
                                                />
                                                This person is an employee
                                            </label>
                                        </div>
                                        {!!form.is_employee && (
                                            <div className="company-field person-employee-types">
                                                <label htmlFor="person-employee-types">
                                                    Employee types
                                                </label>
                                                {canEdit ? (
                                                    <ReferenceSelect
                                                        id="person-employee-types"
                                                        label="Employee types"
                                                        entity="employee-types"
                                                        multiple
                                                        showCode={false}
                                                        disabled={
                                                            !canManageEmployee ||
                                                            !form.status
                                                        }
                                                        value={employeeTypes}
                                                        onChange={(value) =>
                                                            setEmployeeDraft(
                                                                (current) => ({
                                                                    types: value as number[],
                                                                    original:
                                                                        current?.original ??
                                                                        employeeProfile?.types.map(
                                                                            (
                                                                                type,
                                                                            ) =>
                                                                                type.id,
                                                                        ) ??
                                                                        [],
                                                                    version:
                                                                        current?.version ??
                                                                        employeeProfile?.version ??
                                                                        0,
                                                                }),
                                                            )
                                                        }
                                                    />
                                                ) : (
                                                    <div className="person-readonly-value">
                                                        {employee.isPending
                                                            ? "Loading…"
                                                            : employeeProfile
                                                                    ?.types
                                                                    .length
                                                              ? employeeProfile.types.map(
                                                                    (type) => (
                                                                        <span
                                                                            key={
                                                                                type.id
                                                                            }
                                                                            className="value-chip"
                                                                        >
                                                                            {
                                                                                type.name
                                                                            }
                                                                        </span>
                                                                    ),
                                                                )
                                                              : "—"}
                                                    </div>
                                                )}
                                                {errors[
                                                    "employee.type_ids"
                                                ] && (
                                                    <span
                                                        className="field-error"
                                                        role="alert"
                                                    >
                                                        {errors[
                                                            "employee.type_ids"
                                                        ].join(" ")}
                                                    </span>
                                                )}
                                                {Object.entries(errors)
                                                    .filter(([key]) =>
                                                        key.startsWith(
                                                            "employee.type_ids.",
                                                        ),
                                                    )
                                                    .map(([key, messages]) => (
                                                        <span
                                                            key={key}
                                                            className="field-error"
                                                            role="alert"
                                                        >
                                                            {messages.join(" ")}
                                                        </span>
                                                    ))}
                                            </div>
                                        )}
                                        {!form.is_employee &&
                                            employeeProfile && (
                                                <p className="section-note person-comments">
                                                    Previous employee details
                                                    are retained.
                                                </p>
                                            )}
                                        {employee.error && (
                                            <ErrorState
                                                error={employee.error}
                                            />
                                        )}
                                    </>
                                )}
                            </div>
                        </fieldset>
                        {conflict && (
                            <div className="notice" role="alert">
                                This person changed after editing began. Your
                                draft is kept.
                                <button
                                    type="button"
                                    className="btn small"
                                    disabled={reload.isPending}
                                    onClick={() => reload.mutate()}
                                >
                                    <History size={14} />
                                    Reload and review
                                </button>
                            </div>
                        )}
                        {save.error && !Object.keys(errors).length && (
                            <ErrorState error={save.error} />
                        )}
                    </form>
                    <aside className="person-images">
                        {person ? (
                            <Documents person={person.id} imagesOnly />
                        ) : (
                            <>
                                <div className="person-upload-placeholder">
                                    <Image size={30} />
                                    <strong>Profile picture</strong>
                                </div>
                                <div className="person-upload-placeholder signature">
                                    <Image size={25} />
                                    <strong>Signature</strong>
                                </div>
                                <small>Save the person to upload images.</small>
                            </>
                        )}
                    </aside>
                </div>
            </section>
            {person && (
                <details className="person-identification">
                    <summary>Identification documents</summary>
                    <Documents person={person.id} />
                </details>
            )}
        </>
    );
}
