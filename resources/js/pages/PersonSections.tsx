import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    FileText,
    Upload,
    Download,
    Trash2,
    Image,
    Plus,
    Check,
    ShieldCheck,
    ExternalLink,
    Pencil,
    X,
} from "../components/icons";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, managementApi, dateTime, display, money } from "../lib/api";
import { useDirtyForm } from "../lib/dirty";
import { useSession } from "../lib/session";
import type { RecordData, PageResult } from "../lib/types";
import { ChildSection } from "../components/Records";
import { ReferenceSelect } from "../components/ReferenceSelect";
import {
    Badge,
    Empty,
    ErrorState,
    Loading,
    Modal,
    PanelTitle,
    Spinner,
    Confirm,
} from "../components/ui";
export function Documents({
    person,
    imagesOnly = false,
}: {
    person: number;
    imagesOnly?: boolean;
}) {
    const { session } = useSession();
    const can = (action: string) =>
        session.permissions.includes(`documents.${action}`);
    const cache = useQueryClient();
    const [editing, setEditing] = useState<RecordData | null | undefined>();
    const [kind, setKind] = useState("identification");
    const [type, setType] = useState("");
    const [number, setNumber] = useState("");
    const [expiry, setExpiry] = useState("");
    const [file, setFile] = useState<File>();
    const [remove, setRemove] = useState<RecordData>();
    const documentDirty =
        editing !== undefined &&
        (!!file ||
            type !== String(editing?.document_type ?? "") ||
            number !== String(editing?.document_number ?? "") ||
            expiry !== String(editing?.expires_on ?? "").slice(0, 10));
    useDirtyForm(documentDirty);
    const closeDocument = () => {
        if (!documentDirty || window.confirm("Discard unsaved changes?"))
            setEditing(undefined);
    };
    const query = useQuery({
        queryKey: ["documents", person],
        queryFn: () =>
            managementApi<{ data: RecordData[] }>(
                `/api/v1/people/${person}/documents`,
            ),
        enabled: can("view"),
    });
    const save = useMutation({
        mutationFn: () => {
            const data = new FormData();
            data.set("kind", kind);
            data.set("document_type", type);
            data.set("document_number", number);
            data.set("expires_on", expiry);
            if (file) data.set("file", file);
            if (editing) data.set("version", String(editing.version));
            return api(
                `/api/v1/people/${person}/documents${editing ? `/${editing.id}` : ""}`,
                { method: "POST", body: data },
            );
        },
        onSuccess: () => {
            cache.invalidateQueries({ queryKey: ["documents", person] });
            toast.success("File saved");
            setEditing(undefined);
        },
        onError: (e) => toast.error(e.message),
    });
    const deletion = useMutation({
        mutationFn: () =>
            api(`/api/v1/people/${person}/documents/${remove!.id}`, {
                method: "DELETE",
                body: JSON.stringify({ version: remove!.version }),
            }),
        onSuccess: () => {
            cache.invalidateQueries({ queryKey: ["documents", person] });
            setRemove(undefined);
            toast.success("File removed");
        },
        onError: (e) => toast.error(e.message),
    });
    function edit(record: RecordData | null, initialKind = "identification") {
        setEditing(record);
        setKind(String(record?.kind ?? initialKind));
        setType(String(record?.document_type ?? ""));
        setNumber(String(record?.document_number ?? ""));
        setExpiry(String(record?.expires_on ?? "").slice(0, 10));
        setFile(undefined);
        save.reset();
    }
    if (!can("view"))
        return (
            <div className="notice">
                Document access is restricted by your role.
            </div>
        );
    return (
        <>
            <section className="panel">
                <PanelTitle
                    title={
                        imagesOnly
                            ? "Profile & signature"
                            : "Documents & identification"
                    }
                    subtitle={
                        imagesOnly
                            ? "Private images attached to this person."
                            : "Protected files, available only to authorized users."
                    }
                    action={
                        !imagesOnly &&
                        can("create") && (
                            <button
                                className="btn primary small"
                                onClick={() => edit(null)}
                            >
                                <Upload size={15} />
                                Upload document
                            </button>
                        )
                    }
                />
                {query.isPending ? (
                    <Loading />
                ) : query.error ? (
                    <ErrorState error={query.error} />
                ) : imagesOnly ? (
                    <div className="profile-uploads">
                        {["profile", "signature"].map((k) => {
                            const doc = query.data?.data.find(
                                (d) => d.kind === k,
                            );
                            return (
                                <div className="profile-upload" key={k}>
                                    <div className={`image-preview ${k}`}>
                                        {doc ? (
                                            <img
                                                alt={
                                                    k === "profile"
                                                        ? "Profile picture"
                                                        : "Signature"
                                                }
                                                src={`/api/v1/people/${person}/documents/${doc.id}/download?context=management&inline=1&v=${doc.version}`}
                                            />
                                        ) : (
                                            <Image size={28} />
                                        )}
                                    </div>
                                    <div>
                                        <h3>
                                            {k === "profile"
                                                ? "Profile picture"
                                                : "Signature"}
                                        </h3>
                                        <p>
                                            {doc
                                                ? String(doc.original_name)
                                                : "No image uploaded"}
                                        </p>
                                        {can(doc ? "update" : "create") && (
                                            <button
                                                className="btn secondary small"
                                                onClick={() =>
                                                    edit(doc ?? null, k)
                                                }
                                            >
                                                <Upload size={13} />
                                                {doc ? "Replace" : "Upload"}
                                            </button>
                                        )}
                                        {doc && (
                                            <a
                                                className="text-button"
                                                target="_blank"
                                                rel="noreferrer"
                                                href={`/api/v1/people/${person}/documents/${doc.id}/download?context=management&inline=1`}
                                            >
                                                View image
                                            </a>
                                        )}
                                        {doc && can("delete") && (
                                            <button
                                                className="text-button"
                                                onClick={() => setRemove(doc)}
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : query.data?.data.filter((d) => d.kind === "identification")
                      .length === 0 ? (
                    <Empty
                        title="No documents uploaded"
                        description="Attach identification documents as PDF, JPG, PNG or WebP files."
                    />
                ) : (
                    <div className="document-list">
                        {query.data?.data
                            .filter((d) => d.kind === "identification")
                            .map((doc) => (
                                <div className="document-row" key={doc.id}>
                                    <span className="file-icon">
                                        <FileText size={22} />
                                    </span>
                                    <div>
                                        <strong>
                                            {String(
                                                doc.document_type ||
                                                    doc.original_name,
                                            )}
                                        </strong>
                                        <small>
                                            {String(doc.original_name)} ·{" "}
                                            {(Number(doc.size) / 1024).toFixed(
                                                0,
                                            )}{" "}
                                            KB
                                        </small>
                                        <small>
                                            {doc.document_number
                                                ? `ID: ${doc.document_number}`
                                                : ""}
                                            {doc.expires_on
                                                ? ` · Expires ${String(doc.expires_on).slice(0, 10)}`
                                                : ""}
                                        </small>
                                    </div>
                                    <div className="button-group">
                                        <a
                                            className="icon-button"
                                            title="Download document"
                                            href={`/api/v1/people/${person}/documents/${doc.id}/download?context=management`}
                                        >
                                            <Download size={17} />
                                        </a>
                                        {can("update") && (
                                            <button
                                                className="icon-button"
                                                title="Replace document"
                                                onClick={() => edit(doc)}
                                            >
                                                <Upload size={17} />
                                            </button>
                                        )}
                                        {can("delete") && (
                                            <button
                                                className="icon-button delete-button"
                                                title="Remove document"
                                                onClick={() => setRemove(doc)}
                                            >
                                                <Trash2 size={17} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
            </section>
            <Modal
                open={editing !== undefined}
                onClose={closeDocument}
                title={editing ? "Replace file" : "Upload file"}
                description="Maximum 10 MB. Images are re-encoded and all files are stored privately."
            >
                <form
                    className="security-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        save.mutate();
                    }}
                >
                    {kind === "identification" && (
                        <>
                            <div className="field">
                                <label htmlFor="document-type">
                                    Document type
                                </label>
                                <input
                                    id="document-type"
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                    placeholder="e.g. Passport, CNIC"
                                />
                            </div>
                            <div className="field">
                                <label htmlFor="document-number">
                                    Document number
                                </label>
                                <input
                                    id="document-number"
                                    value={number}
                                    onChange={(e) => setNumber(e.target.value)}
                                />
                            </div>
                            <div className="field">
                                <label htmlFor="document-expiry">
                                    Expiry date
                                </label>
                                <input
                                    id="document-expiry"
                                    type="date"
                                    value={expiry}
                                    onChange={(e) => setExpiry(e.target.value)}
                                />
                            </div>
                        </>
                    )}
                    <label className="upload-zone">
                        <Upload size={26} />
                        <strong>{file ? file.name : "Choose a file"}</strong>
                        <span>PDF, JPG, PNG or WebP</span>
                        <input
                            type="file"
                            required
                            accept={
                                kind === "identification"
                                    ? ".pdf,.jpg,.jpeg,.png,.webp"
                                    : ".jpg,.jpeg,.png,.webp"
                            }
                            onChange={(e) => setFile(e.target.files?.[0])}
                        />
                    </label>
                    {save.error && <ErrorState error={save.error} />}
                    <button className="btn primary" disabled={save.isPending}>
                        {save.isPending ? <Spinner /> : <Upload size={16} />}
                        Save file
                    </button>
                </form>
            </Modal>
            <Confirm
                open={!!remove}
                title="Remove this document?"
                description="The document will no longer appear in this person's active profile."
                onClose={() => setRemove(undefined)}
                onConfirm={() => deletion.mutate()}
                busy={deletion.isPending}
            />
        </>
    );
}
export function EmployeeDetails({
    person,
    joiningDate,
    personVersion,
    hideWhenEmpty = false,
}: {
    person: number;
    joiningDate?: string;
    personVersion?: number;
    hideWhenEmpty?: boolean;
}) {
    const { session } = useSession();
    const cache = useQueryClient();
    const [editing, setEditing] = useState(false);
    const [editVersion, setEditVersion] = useState(0);
    const [joining, setJoining] = useState(joiningDate ?? "");
    const [personEditVersion, setPersonEditVersion] = useState(personVersion);
    const [salary, setSalary] = useState("");
    const [types, setTypes] = useState<number[]>([]);
    const canView = session.permissions.includes("employee-details.view");
    const query = useQuery({
        queryKey: ["employee", person],
        queryFn: () =>
            managementApi<{
                data:
                    | (RecordData & { types: { id: number; name: string }[] })
                    | null;
                eligible: boolean;
            }>(`/api/v1/people/${person}/employee`),
        enabled: canView,
    });
    const save = useMutation({
        mutationFn: () =>
            api(`/api/v1/people/${person}/employee`, {
                method: "PUT",
                body: JSON.stringify({
                    salary: salary || null,
                    ...(joiningDate !== undefined &&
                    session.entities.people.capabilities.update
                        ? {
                              joining_date: joining || null,
                              person_version: personEditVersion,
                          }
                        : {}),
                    type_ids: types,
                    version: editVersion,
                }),
            }),
        onSuccess: () => {
            cache.invalidateQueries({ queryKey: ["employee", person] });
            setEditing(false);
            toast.success("Employee details saved");
        },
    });
    const employeeDirty =
        editing &&
        (joining !== (joiningDate ?? "") ||
            salary !== String(query.data?.data?.salary ?? "") ||
            JSON.stringify(types) !==
                JSON.stringify(query.data?.data?.types.map((t) => t.id) ?? []));
    useDirtyForm(employeeDirty);
    if (!canView)
        return (
            <div className="notice">
                Employee details are restricted by your role.
            </div>
        );
    if (query.isPending) return <Loading />;
    if (query.error) return <ErrorState error={query.error} />;
    const record = query.data?.data;
    if (hideWhenEmpty && !query.data?.eligible && !record) return null;
    return (
        <section className="panel">
            <PanelTitle
                title="Employee details"
                subtitle="Salary and employee types are shared across this person’s companies."
                action={
                    query.data?.eligible &&
                    session.permissions.includes(
                        `employee-details.${record ? "update" : "create"}`,
                    ) &&
                    !editing && (
                        <button
                            className="btn primary small"
                            onClick={() => {
                                setJoining(joiningDate ?? "");
                                setPersonEditVersion(personVersion);
                                setSalary(String(record?.salary ?? ""));
                                setTypes(record?.types.map((t) => t.id) ?? []);
                                setEditVersion(record?.version ?? 0);
                                setEditing(true);
                            }}
                        >
                            {record ? (
                                <Pencil className="mobile-action-icon" />
                            ) : (
                                <Plus className="mobile-action-icon" />
                            )}
                            {record ? "Edit details" : "Add details"}
                        </button>
                    )
                }
            />
            {!query.data?.eligible && (
                <div className="notice">
                    Mark this person as an Employee in Personal Details or
                    assign an active Employee business role to edit this
                    section. Previous details are retained.
                </div>
            )}
            {editing ? (
                <form
                    className="security-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        save.mutate();
                    }}
                >
                    {joiningDate !== undefined && (
                        <div className="field">
                            <label htmlFor="employee-joining-date">
                                Joining date
                            </label>
                            <input
                                id="employee-joining-date"
                                type="date"
                                value={joining}
                                readOnly={
                                    !session.entities.people.capabilities.update
                                }
                                onChange={(event) =>
                                    setJoining(event.target.value)
                                }
                            />
                        </div>
                    )}
                    <div className="field">
                        <label htmlFor="salary">Salary (PKR)</label>
                        <input
                            id="salary"
                            inputMode="decimal"
                            value={salary}
                            onChange={(e) => setSalary(e.target.value)}
                        />
                    </div>
                    <div className="field">
                        <label htmlFor="employee-types">Employee types</label>
                        <ReferenceSelect
                            id="employee-types"
                            entity="employee-types"
                            multiple
                            value={types}
                            onChange={(v) => setTypes(v as number[])}
                        />
                    </div>
                    {save.error && <ErrorState error={save.error} />}
                    <div className="button-group">
                        <button
                            type="button"
                            className="btn secondary"
                            onClick={() => {
                                if (
                                    !employeeDirty ||
                                    window.confirm("Discard unsaved changes?")
                                )
                                    setEditing(false);
                            }}
                        >
                            <X className="mobile-action-icon" /> Cancel
                        </button>
                        <button
                            className="btn primary"
                            disabled={save.isPending}
                        >
                            <Check size={16} />
                            Save details
                        </button>
                    </div>
                </form>
            ) : record ? (
                <dl className="detail-grid">
                    {joiningDate !== undefined && (
                        <div>
                            <dt>Joining date</dt>
                            <dd>{joiningDate || "—"}</dd>
                        </div>
                    )}
                    <div>
                        <dt>Salary</dt>
                        <dd className="amount">{money(record.salary)}</dd>
                    </div>
                    <div>
                        <dt>Employee types</dt>
                        <dd>
                            {record.types.map((t) => (
                                <span key={t.id} className="value-chip">
                                    {t.name}
                                </span>
                            ))}
                        </dd>
                    </div>
                </dl>
            ) : (
                <Empty
                    title="No employee details"
                    description="Mark this person as an Employee in Personal Details or assign the Employee business role, then add salary and employee types here."
                />
            )}
        </section>
    );
}
export function Associations({ person }: { person: number }) {
    return (
        <ChildSection
            entity="associations"
            parent={{ entity: "people", id: person }}
            title="Company associations"
        >
            {(r) => (
                <div className="nested-section">
                    <ClassificationBatch association={r.id} />
                    <div style={{ height: 12 }} />
                    <ChildSection
                        entity="classifications"
                        parent={{ entity: "associations", id: r.id }}
                        title={`Business roles · ${r.company_name}`}
                    />
                    <p className="section-note">
                        Opening amounts are captured separately for each
                        business role. Ledger posting will be introduced with
                        the accounting module.
                    </p>
                </div>
            )}
        </ChildSection>
    );
}
export function UserAccess({ person }: { person: number }) {
    const { session } = useSession();
    const can = session.permissions.includes("users.view");
    const query = useQuery({
        queryKey: ["person-user", person],
        queryFn: () => api<PageResult>(`/api/v1/users?person_id=${person}`),
        enabled: can,
    });
    if (!can)
        return (
            <div className="notice">
                User administration is restricted by your role.
            </div>
        );
    return (
        <section className="panel">
            <PanelTitle
                title="System access"
                subtitle="User credentials and permissions are managed separately from this profile."
            />
            {query.isPending ? (
                <Loading />
            ) : query.error ? (
                <ErrorState error={query.error} />
            ) : query.data?.data.length ? (
                <div className="access-summary">
                    <ShieldCheck size={34} />
                    <div>
                        <h3>{String(query.data.data[0].username)}</h3>
                        <p>{String(query.data.data[0].role_name)}</p>
                        <Badge
                            active={query.data.data[0].status}
                            label={
                                query.data.data[0].status
                                    ? "Active"
                                    : "Inactive"
                            }
                        />
                    </div>
                    <Link
                        className="btn secondary"
                        to={`/users?person_id=${person}`}
                    >
                        <ExternalLink size={15} />
                        Manage account
                    </Link>
                </div>
            ) : (
                <Empty
                    title="No system account"
                    description="A person can be part of your business without having system access."
                    action={
                        session.permissions.includes("users.create") && (
                            <Link
                                className="btn primary"
                                to={`/users?person_id=${person}`}
                            >
                                <Plus size={15} />
                                Create user account
                            </Link>
                        )
                    }
                />
            )}
        </section>
    );
}
function ClassificationBatch({ association }: { association: number }) {
    const { session } = useSession();
    const cache = useQueryClient();
    const [open, setOpen] = useState(false);
    const [types, setTypes] = useState<number[]>([]);
    const [amounts, setAmounts] = useState<Record<number, string>>({});
    const batchDirty = open && types.length > 0;
    useDirtyForm(batchDirty);
    const lookup = useQuery({
        queryKey: ["business-types"],
        queryFn: () => api<PageResult>("/api/v1/business-types?per_page=100"),
        enabled: open,
    });
    const save = useMutation({
        mutationFn: () =>
            api(`/api/v1/associations/${association}/classifications/batch`, {
                method: "POST",
                body: JSON.stringify({
                    items: types.map((id) => ({
                        business_type_id: id,
                        opening_balance: amounts[id] || null,
                        status: true,
                    })),
                }),
            }),
        onSuccess: () => {
            cache.invalidateQueries();
            setOpen(false);
            setTypes([]);
            setAmounts({});
            toast.success("Business roles assigned");
        },
    });
    if (!session.entities.classifications.capabilities.create) return null;
    return (
        <>
            <button
                className="btn secondary small"
                onClick={() => setOpen(true)}
            >
                <Plus size={14} />
                Assign multiple business roles
            </button>
            <Modal
                open={open}
                onClose={() => {
                    if (
                        !batchDirty ||
                        window.confirm("Discard unsaved changes?")
                    ) {
                        setOpen(false);
                        setTypes([]);
                        setAmounts({});
                    }
                }}
                title="Assign business roles"
                description="Each selected business role can have its own opening amount in PKR."
            >
                <form
                    className="security-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        save.mutate();
                    }}
                >
                    <div className="field">
                        <label htmlFor="business-classifications">
                            Business roles
                        </label>
                        <ReferenceSelect
                            id="business-classifications"
                            entity="business-types"
                            multiple
                            value={types}
                            onChange={(v) => setTypes(v as number[])}
                        />
                    </div>
                    {types.map((id) => (
                        <div className="field" key={id}>
                            <label htmlFor={`amount-${id}`}>
                                {lookup.data?.data.find((t) => t.id === id)
                                    ?.name ?? `Type ${id}`}{" "}
                                · Opening amount (PKR)
                            </label>
                            <input
                                id={`amount-${id}`}
                                inputMode="decimal"
                                value={amounts[id] ?? ""}
                                onChange={(e) =>
                                    setAmounts({
                                        ...amounts,
                                        [id]: e.target.value,
                                    })
                                }
                                placeholder="Optional"
                            />
                        </div>
                    ))}
                    {save.error && <ErrorState error={save.error} />}
                    <button
                        className="btn primary"
                        disabled={!types.length || save.isPending}
                    >
                        {save.isPending ? <Spinner /> : <Check size={15} />}
                        Assign business roles
                    </button>
                </form>
            </Modal>
        </>
    );
}
