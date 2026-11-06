import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { History, LockKeyhole } from "../components/icons";
import { ErrorState, Loading } from "../components/ui";
import { api } from "../lib/api";
import { useDirty, useDirtyForm } from "../lib/dirty";
import { defaultCompanyIds, useSession } from "../lib/session";
import { ApiError, type RecordData } from "../lib/types";
import type { PersonSectionProps } from "./PeoplePage";

type AccountValues = {
    username: string;
    role_id: string;
    status: boolean;
    company_ids: number[];
    password: string;
    password_confirmation: string;
};
export function PersonAccount({
    person,
    editing,
    actions,
    onEditingChange,
}: PersonSectionProps) {
    const { session } = useSession();
    const cache = useQueryClient();
    const guard = useDirty();
    const canView = session.permissions.includes("users.view");
    const query = useQuery({
        queryKey: ["person-account", person.id],
        queryFn: () =>
            api<{ data: RecordData | null }>(
                `/api/v1/people/${person.id}/user-account`,
            ),
        enabled: canView,
    });
    const roles = useQuery({
        queryKey: ["person-account-roles"],
        queryFn: () => api<{ data: RecordData[] }>("/api/v1/roles"),
        enabled: canView,
    });
    function values(record?: RecordData | null): AccountValues {
        return {
            username: String(record?.username ?? ""),
            role_id: String(record?.role_id ?? ""),
            status: record?.status !== false,
            company_ids: (
                (record?.company_ids ??
                    (record
                        ? []
                        : defaultCompanyIds(session.companies))) as number[]
            ).filter((id) =>
                session.companies.some((company) => company.id === id),
            ),
            password: "",
            password_confirmation: "",
        };
    }
    const [snapshot, setSnapshot] = useState<RecordData | null>(null);
    const [form, setForm] = useState<AccountValues>(() => values());
    const [wantsAccount, setWantsAccount] = useState(false);
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [conflict, setConflict] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);
    const initialized = useRef(false);
    useEffect(() => {
        if ((!editing || !initialized.current) && query.data) {
            initialized.current = true;
            setSnapshot(query.data.data);
            setForm(values(query.data.data));
            setWantsAccount(!!query.data.data);
            setErrors({});
            setConflict(false);
        }
    }, [query.data, editing]);
    const dirty =
        editing &&
        (wantsAccount !== !!snapshot ||
            JSON.stringify(form) !== JSON.stringify(values(snapshot)));
    useDirtyForm(dirty);
    const canEdit =
        canView &&
        session.permissions.includes(`users.${snapshot ? "update" : "create"}`);
    const save = useMutation({
        mutationFn: async () => {
            if (!formRef.current?.reportValidity())
                throw new Error("Complete the required account fields.");
            return api<{ data: RecordData }>(
                `/api/v1/users${snapshot ? `/${snapshot.id}` : ""}`,
                {
                    method: snapshot ? "PUT" : "POST",
                    body: JSON.stringify({
                        ...form,
                        role_id: Number(form.role_id),
                        name: person.name,
                        person_id: person.id,
                        email: snapshot?.email ?? null,
                        password: form.password || null,
                        password_confirmation:
                            form.password_confirmation || null,
                        ...(snapshot ? { version: snapshot.version } : {}),
                    }),
                },
            );
        },
        onSuccess: (response) => {
            cache.setQueryData(["person-account", person.id], response);
            setSnapshot(response.data);
            setForm(values(response.data));
            setWantsAccount(true);
            setErrors({});
            setConflict(false);
            guard.clear();
            onEditingChange(false);
            toast.success("User account saved");
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
        mutationFn: () =>
            api<{ data: RecordData | null }>(
                `/api/v1/people/${person.id}/user-account`,
            ),
        onSuccess: (response) => {
            cache.setQueryData(["person-account", person.id], response);
            setSnapshot(response.data);
            setForm(values(response.data));
            setWantsAccount(!!response.data);
            setConflict(false);
            setErrors({});
        },
        onError: (error) => toast.error(error.message),
    });
    useImperativeHandle(actions, () => ({
        save: () => {
            if (!wantsAccount && !snapshot) onEditingChange(false);
            else if (canEdit && !save.isPending) save.mutate();
        },
        cancel: () => {
            setForm(values(snapshot));
            setWantsAccount(!!snapshot);
            setErrors({});
            setConflict(false);
            onEditingChange(false);
        },
    }));
    function update<K extends keyof AccountValues>(
        key: K,
        value: AccountValues[K],
    ) {
        setForm((current) => ({ ...current, [key]: value }));
    }
    if (!canView)
        return (
            <div className="notice">
                User administration is restricted by your role.
            </div>
        );
    if (query.isPending || roles.isPending) return <Loading />;
    if (query.error || roles.error)
        return <ErrorState error={query.error ?? roles.error} />;
    return (
        <section className="company-card person-account-card">
            <div className="person-section-heading">
                <LockKeyhole size={17} />
                <h3>User Account</h3>
            </div>
            <form
                ref={formRef}
                className="person-account-form"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (canEdit && editing) save.mutate();
                }}
            >
                <div className="person-account-toggle">
                    <button
                        type="button"
                        role="switch"
                        aria-label="This person needs to sign in"
                        aria-checked={snapshot ? form.status : wantsAccount}
                        disabled={!canEdit || save.isPending}
                        className={`switch-track ${(snapshot ? form.status : wantsAccount) ? "active" : ""}`}
                        onClick={() => {
                            if (!snapshot && wantsAccount && !guard.discard())
                                return;
                            onEditingChange(true);
                            if (snapshot) update("status", !form.status);
                            else {
                                setWantsAccount(!wantsAccount);
                                if (!wantsAccount) setForm(values());
                                if (wantsAccount) {
                                    setForm(values());
                                    onEditingChange(false);
                                }
                            }
                        }}
                    >
                        <span className="switch-knob" />
                    </button>
                    <div>
                        <strong>
                            This person needs to sign in to CargoCore
                        </strong>
                        <p>
                            Activate an account and choose its role and portal
                            companies.
                        </p>
                    </div>
                </div>
                {(wantsAccount || snapshot) && (
                    <fieldset
                        disabled={save.isPending || reload.isPending}
                        className="inline-cell-fields"
                    >
                        <div className="person-fields-grid">
                            <div className="company-field">
                                <label htmlFor="person-username">
                                    USERNAME{" "}
                                    <span className="required-star">*</span>
                                </label>
                                <input
                                    id="person-username"
                                    autoComplete="off"
                                    maxLength={80}
                                    required
                                    pattern="[a-zA-Z0-9_.\-]+"
                                    readOnly={!editing || !canEdit}
                                    value={form.username}
                                    aria-invalid={!!errors.username}
                                    onChange={(event) =>
                                        update("username", event.target.value)
                                    }
                                />
                                {errors.username && (
                                    <span role="alert" className="field-error">
                                        {errors.username.join(" ")}
                                    </span>
                                )}
                            </div>
                            <div className="company-field">
                                <label htmlFor="person-user-role">
                                    USER ROLE{" "}
                                    <span className="required-star">*</span>
                                </label>
                                <select
                                    id="person-user-role"
                                    required
                                    disabled={!editing || !canEdit}
                                    value={form.role_id}
                                    onChange={(event) =>
                                        update("role_id", event.target.value)
                                    }
                                >
                                    <option value="">Select a role</option>
                                    {roles.data?.data.map((role) => (
                                        <option key={role.id} value={role.id}>
                                            {role.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.role_id && (
                                    <span role="alert" className="field-error">
                                        {errors.role_id.join(" ")}
                                    </span>
                                )}
                            </div>
                            {editing && canEdit && (
                                <>
                                    <div className="company-field">
                                        <label htmlFor="person-password">
                                            {snapshot
                                                ? "NEW PASSWORD"
                                                : "PASSWORD"}
                                            {!snapshot && (
                                                <span className="required-star">
                                                    {" "}
                                                    *
                                                </span>
                                            )}
                                        </label>
                                        <input
                                            type="password"
                                            id="person-password"
                                            autoComplete="new-password"
                                            minLength={12}
                                            required={!snapshot}
                                            value={form.password}
                                            onChange={(event) =>
                                                update(
                                                    "password",
                                                    event.target.value,
                                                )
                                            }
                                            placeholder={
                                                snapshot
                                                    ? "Leave blank to keep the password"
                                                    : "At least 12 characters, letters and numbers"
                                            }
                                        />
                                        {errors.password && (
                                            <span
                                                role="alert"
                                                className="field-error"
                                            >
                                                {errors.password.join(" ")}
                                            </span>
                                        )}
                                    </div>
                                    <div className="company-field">
                                        <label htmlFor="person-password-confirmation">
                                            CONFIRM PASSWORD
                                        </label>
                                        <input
                                            type="password"
                                            id="person-password-confirmation"
                                            autoComplete="new-password"
                                            required={
                                                !snapshot || !!form.password
                                            }
                                            value={form.password_confirmation}
                                            onChange={(event) =>
                                                update(
                                                    "password_confirmation",
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                </>
                            )}
                            <div className="company-field person-comments">
                                <label>PORTAL COMPANY ACCESS</label>
                                <div
                                    className="person-portal-companies"
                                    role="group"
                                    aria-label="Portal company access"
                                >
                                    {session.companies.map((company) => (
                                        <label key={company.id}>
                                            <input
                                                type="checkbox"
                                                disabled={!editing || !canEdit}
                                                checked={form.company_ids.includes(
                                                    company.id,
                                                )}
                                                onChange={(event) =>
                                                    update(
                                                        "company_ids",
                                                        event.target.checked
                                                            ? [
                                                                  ...form.company_ids,
                                                                  company.id,
                                                              ]
                                                            : form.company_ids.filter(
                                                                  (id) =>
                                                                      id !==
                                                                      company.id,
                                                              ),
                                                    )
                                                }
                                            />
                                            {company.name}
                                        </label>
                                    ))}
                                    {!session.companies.length && (
                                        <p>
                                            No active companies are available.
                                        </p>
                                    )}
                                </div>
                                {errors.company_ids && (
                                    <span role="alert" className="field-error">
                                        {errors.company_ids.join(" ")}
                                    </span>
                                )}
                            </div>
                        </div>
                    </fieldset>
                )}
                {conflict && (
                    <div className="notice" role="alert">
                        This account changed after editing began. Your draft has
                        been kept.
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
                {save.error && <ErrorState error={save.error} />}
            </form>
        </section>
    );
}
