import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Contact, AlertCircle, Plus, Pencil } from "../components/icons";
import { toast } from "sonner";
import { api, managementApi, params } from "../lib/api";
import { useSession } from "../lib/session";
import type { PageResult, RecordData } from "../lib/types";
import { Modal, Loading, useDebounced } from "../components/ui";
import {
    MasterDetailShell,
    type MasterColumn,
    type ViewAllColumn,
} from "../components/MasterDetailShell";

interface EmployeeTypeFormData {
    name: string;
    status: boolean;
}

export function EmployeeTypesPage() {
    const { session } = useSession();
    const { id } = useParams();
    const navigate = useNavigate();
    const cache = useQueryClient();

    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounced(search);
    const [page, setPage] = useState(1);

    // Form editing state (Standardized to match Companies)
    const [isEditing, setIsEditing] = useState(false);
    const editVersion = useRef(0);
    const pendingSelection = useRef<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState<EmployeeTypeFormData>({
        name: "",
        status: true,
    });

    const nameInputRef = useRef<HTMLInputElement | null>(null);

    // Delete modal state
    const [isDeleting, setIsDeleting] = useState(false);

    // Unsaved Changes Interception
    const [unsavedPrompt, setUnsavedPrompt] = useState<{
        open: boolean;
        targetAction: () => void;
    } | null>(null);

    // Query Employee Types (max 25 per page)
    const { data: employeeTypesData, isLoading: isListLoading } = useQuery({
        queryKey: ["employee-types", debouncedSearch, page],
        queryFn: () =>
            managementApi<PageResult<RecordData>>(
                `/api/v1/employee-types?${params({
                    search: debouncedSearch,
                    page,
                    per_page: 25,
                })}`,
            ),
    });

    // Query all employee types for View All directory modal
    const { data: allEmployeeTypesData } = useQuery({
        queryKey: ["all-employee-types"],
        queryFn: () =>
            managementApi<PageResult<RecordData>>(
                "/api/v1/employee-types?per_page=100",
            ),
    });

    const employeeTypes = useMemo(
        () => employeeTypesData?.data || [],
        [employeeTypesData?.data],
    );
    const allEmployeeTypes = useMemo(
        () => allEmployeeTypesData?.data || employeeTypes,
        [allEmployeeTypesData?.data, employeeTypes],
    );
    const totalRecords = employeeTypesData?.meta?.total || employeeTypes.length;
    const lastPage = employeeTypesData?.meta?.last_page || 1;

    const { data: employeeTypeRecord } = useQuery({
        queryKey: ["employee-type-record", id],
        queryFn: () =>
            managementApi<{ data: RecordData }>(`/api/v1/employee-types/${id}`),
        enabled: !!id && !isCreating,
    });

    // Selected Employee Type
    const selectedEmployeeType = useMemo(() => {
        if (isCreating) return null;
        if (id) {
            const found = employeeTypes.find(
                (e) => String(e.id) === String(id),
            );
            return employeeTypeRecord?.data ?? found ?? null;
        }
        return employeeTypes[0] || null;
    }, [employeeTypes, employeeTypeRecord, id, isCreating]);

    useEffect(() => {
        setIsEditing(false);
    }, [selectedEmployeeType?.id]);

    // Keep URL in sync with selected record
    useEffect(() => {
        if (pendingSelection.current) {
            if (id === pendingSelection.current)
                pendingSelection.current = null;
            return;
        }
        if (!isCreating && selectedEmployeeType && !id) {
            navigate(`/employee-types/${selectedEmployeeType.id}`, {
                replace: true,
            });
        }
    }, [selectedEmployeeType, id, isCreating, navigate]);

    // Sync form data with selected record
    useEffect(() => {
        if (!selectedEmployeeType && !isCreating && !isEditing) {
            setFormData({ name: "", status: true });
        }
        if (selectedEmployeeType && !isCreating && !isEditing) {
            setFormData({
                name: String(selectedEmployeeType.name || ""),
                status: selectedEmployeeType.status !== false,
            });
        }
    }, [selectedEmployeeType, isCreating, isEditing]);

    // Check if form is dirty
    const isFormDirty = useMemo(() => {
        if (!isEditing && !isCreating) return false;
        if (isCreating) {
            return formData.name.trim() !== "" || !formData.status;
        }
        if (!selectedEmployeeType) return false;
        return (
            formData.name !== String(selectedEmployeeType.name || "") ||
            formData.status !== (selectedEmployeeType.status !== false)
        );
    }, [formData, selectedEmployeeType, isEditing, isCreating]);

    // Guard navigation when dirty
    const attemptNavigation = (action: () => void) => {
        if (isFormDirty) {
            setUnsavedPrompt({
                open: true,
                targetAction: action,
            });
        } else {
            action();
        }
    };

    // Save Mutation
    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!formData.name.trim()) {
                throw new Error("Employee type name is required.");
            }

            if (isCreating) {
                return api<{ data: RecordData }>("/api/v1/employee-types", {
                    method: "POST",
                    body: JSON.stringify({
                        name: formData.name.trim(),
                        status: formData.status,
                    }),
                });
            } else {
                if (!selectedEmployeeType)
                    throw new Error("No record selected.");
                return api<{ data: RecordData }>(
                    `/api/v1/employee-types/${selectedEmployeeType.id}`,
                    {
                        method: "PUT",
                        body: JSON.stringify({
                            name: formData.name.trim(),
                            status: formData.status,
                            version: editVersion.current,
                        }),
                    },
                );
            }
        },
        onSuccess: (response) => {
            cache.invalidateQueries({ queryKey: ["employee-types"] });
            cache.invalidateQueries({ queryKey: ["all-employee-types"] });
            const savedRecord = response.data;
            cache.setQueryData(
                ["employee-type-record", String(savedRecord.id)],
                response,
            );
            if (isCreating) {
                pendingSelection.current = String(savedRecord.id);
                setIsCreating(false);
                setIsEditing(false);
                toast.success("Employee type created successfully");
                navigate(`/employee-types/${savedRecord.id}`, {
                    replace: true,
                });
            } else {
                setIsEditing(false);
                toast.success("Employee type updated successfully");
            }
        },
        onError: (err: unknown) => {
            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to save employee type";
            toast.error(message);
        },
    });

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: async () => {
            if (!selectedEmployeeType) return;
            return api(`/api/v1/employee-types/${selectedEmployeeType.id}`, {
                method: "DELETE",
                body: JSON.stringify({ version: selectedEmployeeType.version }),
            });
        },
        onSuccess: () => {
            cache.invalidateQueries({ queryKey: ["employee-types"] });
            cache.invalidateQueries({ queryKey: ["all-employee-types"] });
            toast.success("Employee type deleted successfully");
            setIsDeleting(false);
            setIsCreating(false);
            setIsEditing(false);
            const remaining = employeeTypes.filter(
                (e) => e.id !== selectedEmployeeType?.id,
            );
            if (remaining.length > 0) {
                navigate(`/employee-types/${remaining[0].id}`, {
                    replace: true,
                });
            } else {
                navigate("/employee-types", { replace: true });
            }
        },
        onError: (err: unknown) => {
            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to delete employee type";
            toast.error(message);
        },
    });

    // Start Create
    const handleStartCreate = () => {
        attemptNavigation(() => {
            setIsCreating(true);
            setIsEditing(false);
            setFormData({
                name: "",
                status: true,
            });
            setTimeout(() => {
                if (nameInputRef.current) {
                    nameInputRef.current.focus();
                    nameInputRef.current.select();
                }
            }, 50);
        });
    };

    // Start Edit
    const handleStartEdit = () => {
        if (!selectedEmployeeType) return;
        editVersion.current = selectedEmployeeType!.version;
        setIsEditing(true);
        setIsCreating(false);
        setFormData({
            name: String(selectedEmployeeType.name || ""),
            status: selectedEmployeeType.status !== false,
        });
        setTimeout(() => {
            if (nameInputRef.current) {
                nameInputRef.current.focus();
            }
        }, 50);
    };

    // Cancel Edit / Create
    const handleCancel = () => {
        setIsCreating(false);
        setIsEditing(false);
        if (selectedEmployeeType) {
            setFormData({
                name: String(selectedEmployeeType.name || ""),
                status: selectedEmployeeType.status !== false,
            });
        }
    };

    // Select item from master list
    const handleSelectItem = (item: RecordData) => {
        if (selectedEmployeeType?.id === item.id && !isCreating && !isEditing)
            return;
        attemptNavigation(() => {
            setIsCreating(false);
            setIsEditing(false);
            navigate(`/employee-types/${item.id}`);
        });
    };

    // Master Table Columns
    const masterColumns: MasterColumn<RecordData>[] = [
        {
            key: "name",
            label: "Employee Type",
            width: "65%",
            className: "name-cell",
            render: (item) => (
                <button
                    type="button"
                    className="company-row-btn"
                    aria-label={String(item.name || "")}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleSelectItem(item);
                    }}
                >
                    {String(item.name || "")}
                </button>
            ),
        },
        {
            key: "status",
            label: "Status",
            width: "35%",
            render: (item) => (item.status ? "Active" : "Inactive"),
        },
    ];

    // View All Modal Columns
    const viewAllColumns: ViewAllColumn<RecordData>[] = [
        { key: "name", label: "Employee Type", width: "75%" },
        {
            key: "status",
            label: "Status",
            width: "25%",
            render: (item) => (item.status ? "Active" : "Inactive"),
        },
    ];

    return (
        <div className="employee-types-workspace">
            <MasterDetailShell
                title="Employee Types"
                icon={<Contact size={22} />}
                backTo="/"
                isEditing={isEditing}
                isCreating={isCreating}
                isSaving={saveMutation.isPending}
                hasSelectedItem={!!selectedEmployeeType}
                canCreate={
                    session.entities["employee-types"].capabilities.create
                }
                canUpdate={
                    session.entities["employee-types"].capabilities.update
                }
                canDelete={
                    session.entities["employee-types"].capabilities.delete
                }
                onStartCreate={handleStartCreate}
                onStartEdit={handleStartEdit}
                onSave={() => saveMutation.mutate()}
                onCancel={handleCancel}
                onDelete={() => setIsDeleting(true)}
                newAriaLabel={id ? "New employee type" : "Add record"}
                listHeading="Employee Types"
                items={employeeTypes}
                columns={masterColumns}
                selectedId={selectedEmployeeType?.id ?? null}
                onSelectItem={handleSelectItem}
                isLoading={isListLoading}
                search={search}
                onSearchChange={(val) => {
                    setSearch(val);
                    setPage(1);
                }}
                searchAriaLabel="Search Employee types"
                searchPlaceholder="Search records…"
                page={page}
                lastPage={lastPage}
                totalRecords={totalRecords}
                onPageChange={setPage}
                viewAllItems={allEmployeeTypes}
                viewAllColumns={viewAllColumns}
                onSelectFromViewAll={(item) => {
                    attemptNavigation(() => {
                        setIsCreating(false);
                        setIsEditing(false);
                        navigate(`/employee-types/${item.id}`);
                    });
                }}
                isDeleting={isDeleting}
                onCloseDelete={() => setIsDeleting(false)}
                onConfirmDelete={() => deleteMutation.mutate()}
                deleteTitle="Delete Employee Type?"
                deleteDescription={`Are you sure you want to delete "${selectedEmployeeType?.name}"? This action cannot be undone.`}
                isDeletingBusy={deleteMutation.isPending}
            >
                {/* Right Panel Detail Card (Uniform structure matching Companies) */}
                <div
                    className="company-card"
                    {...(isCreating
                        ? {
                              role: "dialog",
                              "aria-label": "New employee type",
                          }
                        : {})}
                >
                    {/* Dark Header */}
                    <div className="company-card-header">
                        <h2 className="company-card-title">
                            {isCreating
                                ? "New Employee Type"
                                : String(selectedEmployeeType?.name || "—")}
                        </h2>

                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                            }}
                        >
                            {isCreating ? (
                                <span className="company-editing-badge">
                                    <Plus size={13} /> Creating
                                </span>
                            ) : isEditing ? (
                                <span className="company-editing-badge">
                                    <Pencil size={13} /> Editing
                                </span>
                            ) : (
                                <span className="company-card-badge">
                                    Read only
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Form Fields */}
                    <div className="company-card-body">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (isEditing || isCreating) {
                                    saveMutation.mutate();
                                }
                            }}
                        >
                            <div className="country-fields-grid employee-type-fields">
                                <div className="company-field">
                                    <label htmlFor="emp-name">
                                        Employee Type{" "}
                                        <span className="required-star">*</span>
                                    </label>
                                    <input
                                        ref={nameInputRef}
                                        id="emp-name"
                                        type="text"
                                        readOnly={!isEditing && !isCreating}
                                        value={formData.name}
                                        placeholder="e.g. Managing Director"
                                        maxLength={255}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                name: e.target.value,
                                            }))
                                        }
                                        required
                                    />
                                </div>
                                <div className="company-toggle-row">
                                    <span className="company-toggle-label">
                                        Status
                                    </span>
                                    <div className="company-toggle-switch">
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-label="Employee type status"
                                            aria-checked={formData.status}
                                            disabled={!isEditing && !isCreating}
                                            className={`switch-track ${formData.status ? "active" : ""} ${isEditing || isCreating ? "interactive" : ""}`}
                                            onClick={() => {
                                                if (isEditing || isCreating) {
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        status: !prev.status,
                                                    }));
                                                }
                                            }}
                                            style={{
                                                border: "none",
                                                padding: 0,
                                            }}
                                        >
                                            <span className="switch-knob" />
                                        </button>
                                        <span className="switch-text">
                                            {formData.status
                                                ? "Active"
                                                : "Inactive"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Unsaved Changes Prompt Modal */}
                {unsavedPrompt && (
                    <Modal
                        open={unsavedPrompt.open}
                        onClose={() => setUnsavedPrompt(null)}
                        title="Unsaved Changes"
                    >
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "14px",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: "10px",
                                }}
                            >
                                <AlertCircle
                                    size={22}
                                    style={{
                                        color: "#a1814c",
                                        flexShrink: 0,
                                        marginTop: "2px",
                                    }}
                                />
                                <div>
                                    <p
                                        style={{
                                            fontSize: "14px",
                                            color: "#1f2937",
                                            margin: 0,
                                            fontWeight: 500,
                                        }}
                                    >
                                        You have unsaved changes in this record.
                                    </p>
                                    <p
                                        style={{
                                            fontSize: "12px",
                                            color: "#6b7280",
                                            margin: "4px 0 0 0",
                                        }}
                                    >
                                        Do you want to save your changes before
                                        proceeding, or discard them?
                                    </p>
                                </div>
                            </div>

                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "flex-end",
                                    gap: "8px",
                                    marginTop: "8px",
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => setUnsavedPrompt(null)}
                                    style={{
                                        padding: "6px 14px",
                                        fontSize: "13px",
                                        color: "#374151",
                                        background: "#ffffff",
                                        border: "1px solid #d1d5db",
                                        borderRadius: "6px",
                                        cursor: "pointer",
                                    }}
                                >
                                    Keep Editing
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const action =
                                            unsavedPrompt.targetAction;
                                        setUnsavedPrompt(null);
                                        setIsEditing(false);
                                        setIsCreating(false);
                                        action();
                                    }}
                                    style={{
                                        padding: "6px 14px",
                                        fontSize: "13px",
                                        color: "#873d3d",
                                        background: "#fee2e2",
                                        border: "1px solid #fecaca",
                                        borderRadius: "6px",
                                        cursor: "pointer",
                                    }}
                                >
                                    Discard &amp; Proceed
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const action =
                                            unsavedPrompt.targetAction;
                                        try {
                                            await saveMutation.mutateAsync();
                                            setUnsavedPrompt(null);
                                            action();
                                        } catch {
                                            // Error handled in mutation
                                        }
                                    }}
                                    style={{
                                        padding: "6px 14px",
                                        fontSize: "13px",
                                        color: "#ffffff",
                                        background: "#3e6957",
                                        border: "none",
                                        borderRadius: "6px",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                    }}
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </MasterDetailShell>
        </div>
    );
}
