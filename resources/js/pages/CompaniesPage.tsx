import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft,
    Building2,
    Phone,
    Plus,
    Pencil,
    Trash2,
    Search,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Check,
    X,
    Maximize2,
    AlertCircle,
} from "../components/icons";
import { toast } from "sonner";
import { api, managementApi, params } from "../lib/api";
import { RecordStatusAction } from "../components/Records";
import { useSession } from "../lib/session";
import { useRecordShortcuts } from "../lib/record-shortcuts";
import { PageActions } from "../components/PageActions";
import { MobileRecordBrowser } from "../components/MobileRecordBrowser";
import { useDirectoryDialog } from "../lib/use-directory-dialog";
import { ApiError } from "../lib/types";
import type { PageResult, RecordData } from "../lib/types";
import {
    Modal,
    Confirm,
    Loading,
    ErrorState,
    useDebounced,
    SearchableSelect,
    StatusIndicator,
} from "../components/ui";

interface CompanyFormData {
    name: string;
    short_name: string;
    address: string;
    contact_number: string;
    fax_number: string;
    website: string;
    status: boolean;
    is_default: boolean;
}

interface SubCompanyRowData {
    id?: number;
    code: string;
    name: string;
    address: string;
    phone: string;
    version?: number;
}

export function CompaniesPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { session } = useSession();
    const cache = useQueryClient();

    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounced(search);
    const [page, setPage] = useState(1);

    // Inline form state
    const [isEditing, setIsEditing] = useState(false);
    const editVersion = useRef(0);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState<CompanyFormData>({
        name: "",
        short_name: "",
        address: "",
        contact_number: "",
        fax_number: "",
        website: "",
        status: true,
        is_default: false,
    });

    const firstInputRef = useRef<HTMLInputElement | null>(null);
    const shortcutScope = useRef<HTMLDivElement>(null);
    const subShortcutScope = useRef<HTMLDivElement>(null);
    const initialCompanyForm = useRef(formData);
    const lastSelectedSub = useRef<number | null>(null);
    const tableContainerRef = useRef<HTMLDivElement | null>(null);
    const listPanelRef = useRef<HTMLElement | null>(null);
    const tableRowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

    // Delete modal
    const [deletingCompany, setDeletingCompany] = useState(false);

    // Sub-companies inline editing & adding state
    const [isAddingSub, setIsAddingSub] = useState(false);
    const [newSubData, setNewSubData] = useState<SubCompanyRowData>({
        code: "",
        name: "",
        address: "",
        phone: "",
    });
    const [editingSubId, setEditingSubId] = useState<number | null>(null);
    const [editingSubData, setEditingSubData] =
        useState<SubCompanyRowData | null>(null);
    const [initialSubData, setInitialSubData] =
        useState<SubCompanyRowData | null>(null);
    const [unsavedDrafts, setUnsavedDrafts] = useState<
        Record<number, SubCompanyRowData>
    >({});
    const [deletingSub, setDeletingSub] = useState<RecordData | null>(null);
    const [unsavedPrompt, setUnsavedPrompt] = useState<{
        open: boolean;
        subName: string;
        onSave: () => Promise<void> | void;
        onProceedUnsaved: () => void;
    } | null>(null);

    // Country and City for Company Contact
    const [companyCountryId, setCompanyCountryId] = useState<string | number>(
        "1",
    );
    const [companyCityId, setCompanyCityId] = useState<string | number>("3");

    const countriesQuery = useQuery({
        queryKey: ["all-countries-lookup"],
        queryFn: () =>
            api<PageResult<RecordData>>("/api/v1/countries?per_page=100"),
    });
    const countries = useMemo(
        () => countriesQuery.data?.data || [],
        [countriesQuery.data?.data],
    );

    const countryOptions = useMemo(
        () =>
            countries.map((c) => ({
                value: c.id,
                label: String(c.name),
                code: String(c.short_name || c.code || ""),
            })),
        [countries],
    );

    const citiesQuery = useQuery({
        queryKey: ["company-cities-lookup", companyCountryId],
        queryFn: () =>
            api<PageResult<RecordData>>(
                companyCountryId
                    ? `/api/v1/countries/${companyCountryId}/cities?per_page=100`
                    : `/api/v1/cities?per_page=100`,
            ),
        enabled: true,
    });
    const cities = useMemo(
        () => citiesQuery.data?.data || [],
        [citiesQuery.data?.data],
    );

    const cityOptions = useMemo(
        () =>
            cities.map((c) => ({
                value: c.id,
                label: String(c.name),
                code: String(c.short_name_1 || c.code || ""),
            })),
        [cities],
    );

    const newSubInputRef = useRef<HTMLInputElement | null>(null);
    const editNameInputRef = useRef<HTMLInputElement | null>(null);

    // View All Companies Directory popup state
    const [viewAllOpen, setViewAllOpen] = useState(false);
    const [viewAllSearch, setViewAllSearch] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const viewAllSearchInputRef = useRef<HTMLInputElement | null>(null);
    const viewAllRowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

    // Fetch all companies for master list (max 25 at a time)
    const companiesQuery = useQuery({
        queryKey: ["companies-list", debouncedSearch, page],
        queryFn: () =>
            managementApi<PageResult>(
                `/api/v1/companies?${params({
                    search: debouncedSearch,
                    page,
                    per_page: 25,
                })}`,
            ),
    });

    const companies = useMemo(
        () => (companiesQuery.data?.data as RecordData[]) || [],
        [companiesQuery.data],
    );

    // MUST ALWAYS KEEP FIRST COMPANY SELECTED IF NO ID IN URL
    const selectedCompanyId = useMemo(() => {
        if (id) return Number(id);
        if (companies.length > 0) return Number(companies[0].id);
        return null;
    }, [id, companies]);

    // Fetch selected company detail
    const selectedCompanyQuery = useQuery({
        queryKey: ["company-detail", selectedCompanyId],
        queryFn: () =>
            managementApi<{ data: RecordData }>(
                `/api/v1/companies/${selectedCompanyId}`,
            ),
        enabled: !!selectedCompanyId,
    });

    // Provide immediate fallback to item from list so it never shows stuck loader
    useEffect(() => {
        if (
            selectedCompanyQuery.error instanceof ApiError &&
            selectedCompanyQuery.error.status === 404
        ) {
            setIsEditing(false);
            navigate("/companies", { replace: true });
        }
    }, [selectedCompanyQuery.error, navigate]);

    const selectedCompany = useMemo(() => {
        if (selectedCompanyQuery.isError) return null;
        if (selectedCompanyQuery.data?.data) {
            return selectedCompanyQuery.data.data;
        }
        if (selectedCompanyId) {
            return companies.find((c) => c.id === selectedCompanyId) || null;
        }
        return null;
    }, [
        selectedCompanyQuery.data,
        selectedCompanyQuery.isError,
        selectedCompanyId,
        companies,
    ]);

    // Current index in the master companies table
    const selectedIndex = useMemo(() => {
        if (!selectedCompanyId) return 0;
        const idx = companies.findIndex((c) => c.id === selectedCompanyId);
        return idx >= 0 ? idx : 0;
    }, [companies, selectedCompanyId]);

    // Fetch sub-companies for selected company
    const subCompaniesQuery = useQuery({
        queryKey: ["sub-companies", selectedCompanyId],
        queryFn: () =>
            managementApi<PageResult>(
                `/api/v1/companies/${selectedCompanyId}/sub-companies?per_page=50`,
            ),
        enabled: !!selectedCompanyId,
    });

    const subCompanies = useMemo(
        () => (subCompaniesQuery.data?.data as RecordData[]) || [],
        [subCompaniesQuery.data],
    );

    // Sync formData when selected company loads or changes
    useEffect(() => {
        if (selectedCompany && !isCreating && !isEditing) {
            setFormData({
                name: String(selectedCompany.name || ""),
                short_name: String(
                    selectedCompany.short_name || selectedCompany.code || "",
                ),
                address: String(selectedCompany.address || ""),
                contact_number: String(selectedCompany.contact_number || ""),
                fax_number: String(selectedCompany.fax_number || ""),
                website: String(selectedCompany.website || ""),
                status: selectedCompany.status !== false,
                is_default: !!selectedCompany.is_default,
            });
            setIsEditing(false);
        }
    }, [selectedCompany, isCreating, isEditing]);

    // Reset edit/create modes when switching company id
    useEffect(() => {
        setIsEditing(false);
        setIsCreating(false);
        setIsAddingSub(false);
        setEditingSubId(null);
        setEditingSubData(null);
        setInitialSubData(null);
        setUnsavedDrafts({});
        setUnsavedPrompt(null);
    }, [id]);

    // Auto-focus when adding sub-company
    useEffect(() => {
        if (isAddingSub) {
            newSubInputRef.current?.focus();
        }
    }, [isAddingSub]);

    // Auto-focus when editing sub-company row
    useEffect(() => {
        if (editingSubId !== null) {
            editNameInputRef.current?.focus();
        }
    }, [editingSubId]);

    // Auto-scroll selected row in table
    useEffect(() => {
        if (tableRowRefs.current[selectedIndex]) {
            tableRowRefs.current[selectedIndex]?.scrollIntoView({
                block: "nearest",
                behavior: "smooth",
            });
        }
    }, [selectedIndex]);

    // Start inline create
    const handleStartCreate = () => {
        setIsCreating(true);
        setIsEditing(false);
        const next: CompanyFormData = {
            name: "",
            short_name: "",
            address: "",
            contact_number: "",
            fax_number: "",
            website: "",
            status: true,
            is_default: false,
        };
        initialCompanyForm.current = next;
        setFormData(next);
    };

    // Start inline edit
    const handleStartEdit = () => {
        if (!selectedCompany) return;
        editVersion.current = selectedCompany!.version;
        setIsEditing(true);
        setIsCreating(false);
        const next: CompanyFormData = {
            name: String(selectedCompany.name || ""),
            short_name: String(
                selectedCompany.short_name || selectedCompany.code || "",
            ),
            address: String(selectedCompany.address || ""),
            contact_number: String(selectedCompany.contact_number || ""),
            fax_number: String(selectedCompany.fax_number || ""),
            website: String(selectedCompany.website || ""),
            status: selectedCompany.status !== false,
            is_default: !!selectedCompany.is_default,
        };
        initialCompanyForm.current = next;
        setFormData(next);
    };

    // Focus table container when returning to read-only
    const previouslyViewingDirectory = useRef(false);
    useEffect(() => {
        const closedDirectory =
            previouslyViewingDirectory.current && !viewAllOpen;
        previouslyViewingDirectory.current = viewAllOpen;
        if (!isEditing && !isCreating && !viewAllOpen && !closedDirectory) {
            tableContainerRef.current?.focus();
        }
    }, [isEditing, isCreating, viewAllOpen]);

    // Cancel inline edit / create
    const handleCancel = () => {
        setIsEditing(false);
        setIsCreating(false);
        if (selectedCompany) {
            setFormData({
                name: String(selectedCompany.name || ""),
                short_name: String(
                    selectedCompany.short_name || selectedCompany.code || "",
                ),
                address: String(selectedCompany.address || ""),
                contact_number: String(selectedCompany.contact_number || ""),
                fax_number: String(selectedCompany.fax_number || ""),
                website: String(selectedCompany.website || ""),
                status: selectedCompany.status !== false,
                is_default: !!selectedCompany.is_default,
            });
        }
        tableContainerRef.current?.focus();
    };

    // Table keyboard navigation: Arrow keys navigate rows, Enter starts editing
    const handleTableKeyDown = (e: React.KeyboardEvent | KeyboardEvent) => {
        if (viewAllOpen) return;

        const target = e.target as HTMLElement | null;
        const isInput =
            target?.tagName === "INPUT" ||
            target?.tagName === "TEXTAREA" ||
            target?.tagName === "SELECT";
        const isSearchInput = target?.closest(".company-search-box") !== null;

        if (isInput) {
            if (isSearchInput && (e.key === "ArrowDown" || e.key === "Enter")) {
                e.preventDefault();
                tableContainerRef.current?.focus();
                if (
                    e.key === "Enter" &&
                    selectedCompany &&
                    !isEditing &&
                    !isCreating
                ) {
                    handleStartEdit();
                }
                return;
            }
            if (e.key === "Escape" && (isEditing || isCreating)) {
                e.preventDefault();
                handleCancel();
            }
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (companies.length === 0) return;
            const nextIndex = Math.min(companies.length - 1, selectedIndex + 1);
            const nextCompany = companies[nextIndex];
            if (nextCompany) {
                attemptNavigation(() => {
                    setIsEditing(false);
                    setIsCreating(false);
                    navigate(`/companies/${nextCompany.id}`);
                });
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (companies.length === 0) return;
            const prevIndex = Math.max(0, selectedIndex - 1);
            const prevCompany = companies[prevIndex];
            if (prevCompany) {
                attemptNavigation(() => {
                    setIsEditing(false);
                    setIsCreating(false);
                    navigate(`/companies/${prevCompany.id}`);
                });
            }
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (selectedCompany && !isEditing && !isCreating) {
                handleStartEdit();
            }
        }
    };

    useEffect(() => {
        const onGlobalKey = (e: KeyboardEvent) => {
            handleTableKeyDown(e);
        };
        window.addEventListener("keydown", onGlobalKey);
        return () => window.removeEventListener("keydown", onGlobalKey);
    }, [
        companies,
        selectedIndex,
        selectedCompany,
        isEditing,
        isCreating,
        viewAllOpen,
    ]);

    // Create company mutation
    const createCompanyMutation = useMutation({
        mutationFn: (data: CompanyFormData) => {
            const payload: Record<string, unknown> = {
                name: data.name.trim(),
                short_name: data.short_name.trim() || null,
                address: data.address.trim() || null,
                contact_number: data.contact_number.trim() || null,
                fax_number: data.fax_number.trim() || null,
                website:
                    data.website.trim() &&
                    data.website.trim().startsWith("http")
                        ? data.website.trim()
                        : null,
                status: data.status,
                is_default: data.is_default,
            };
            return api<{ data: RecordData }>("/api/v1/companies", {
                method: "POST",
                body: JSON.stringify(payload),
            });
        },
        onSuccess: async (res) => {
            cache.invalidateQueries({ queryKey: ["companies-list"] });
            cache.invalidateQueries({ queryKey: ["all-companies-directory"] });
            cache.invalidateQueries({ queryKey: ["dashboard"] });
            await cache.invalidateQueries({ queryKey: ["session"] });
            toast.success("Company created successfully");
            setIsCreating(false);
            setIsEditing(false);
            navigate(`/companies/${res.data.id}`);
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to create company");
        },
    });

    // Update company mutation
    const updateCompanyMutation = useMutation({
        mutationFn: (data: CompanyFormData) => {
            const payload: Record<string, unknown> = {
                name: data.name.trim(),
                short_name: data.short_name.trim() || null,
                address: data.address.trim() || null,
                contact_number: data.contact_number.trim() || null,
                fax_number: data.fax_number.trim() || null,
                website:
                    data.website.trim() &&
                    data.website.trim().startsWith("http")
                        ? data.website.trim()
                        : null,
                status: data.status,
                is_default: data.is_default,
                version: editVersion.current,
            };
            return api<{ data: RecordData }>(
                `/api/v1/companies/${selectedCompany?.id}`,
                {
                    method: "PUT",
                    body: JSON.stringify(payload),
                },
            );
        },
        onSuccess: async () => {
            cache.invalidateQueries({ queryKey: ["companies-list"] });
            cache.invalidateQueries({ queryKey: ["all-companies-directory"] });
            cache.invalidateQueries({
                queryKey: ["company-detail", selectedCompany?.id],
            });
            cache.invalidateQueries({ queryKey: ["dashboard"] });
            await cache.invalidateQueries({ queryKey: ["session"] });
            toast.success("Company updated successfully");
            setIsEditing(false);
            setIsCreating(false);
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to update company");
        },
    });

    const isSaving =
        createCompanyMutation.isPending || updateCompanyMutation.isPending;

    const handleSave = () => {
        if (!formData.name.trim()) {
            toast.error("Company name is required");
            return;
        }
        if (isCreating) {
            createCompanyMutation.mutate(formData);
        } else if (isEditing && selectedCompany) {
            updateCompanyMutation.mutate(formData);
        }
    };

    // Delete company mutation
    const deleteCompanyMutation = useMutation({
        mutationFn: () =>
            api(`/api/v1/companies/${selectedCompany?.id}`, {
                method: "DELETE",
                body: JSON.stringify({ version: selectedCompany?.version }),
            }),
        onSuccess: () => {
            cache.invalidateQueries({ queryKey: ["companies-list"] });
            cache.invalidateQueries({ queryKey: ["all-companies-directory"] });
            cache.invalidateQueries({ queryKey: ["dashboard"] });
            toast.success("Company deleted successfully");
            setDeletingCompany(false);
            navigate("/companies");
        },
        onError: (err: Error) => {
            toast.error(err.message);
            setDeletingCompany(false);
        },
    });

    // Sub-company dirty checks
    const isSubRowDirty = (
        current: SubCompanyRowData | null,
        initial: SubCompanyRowData | null,
    ): boolean => {
        if (!current || !initial) return false;
        return (
            current.code.trim() !== initial.code.trim() ||
            current.name.trim() !== initial.name.trim() ||
            current.address.trim() !== initial.address.trim() ||
            current.phone.trim() !== initial.phone.trim()
        );
    };

    const isNewSubRowDirty = (current: SubCompanyRowData): boolean => {
        return (
            current.code.trim() !== "" ||
            current.name.trim() !== "" ||
            current.address.trim() !== "" ||
            current.phone.trim() !== ""
        );
    };

    // Create sub-company mutation
    const createSubMutation = useMutation({
        mutationFn: (data: SubCompanyRowData) =>
            api(`/api/v1/companies/${selectedCompanyId}/sub-companies`, {
                method: "POST",
                body: JSON.stringify({
                    name: data.name.trim(),
                    code: data.code.trim() || undefined,
                    address: data.address.trim() || null,
                    contact_numbers: data.phone.trim()
                        ? [data.phone.trim()]
                        : [],
                    status: true,
                }),
            }),
        onSuccess: () => {
            cache.invalidateQueries({
                queryKey: ["sub-companies", selectedCompanyId],
            });
            toast.success("Sub-company created successfully");
            setIsAddingSub(false);
            setNewSubData({ code: "", name: "", address: "", phone: "" });
            setUnsavedPrompt(null);
        },
        onError: (err: Error) => {
            toast.error(err.message);
        },
    });

    // Edit sub-company mutation
    const editSubMutation = useMutation({
        mutationFn: (data: SubCompanyRowData) =>
            api(
                `/api/v1/companies/${selectedCompanyId}/sub-companies/${data.id}`,
                {
                    method: "PUT",
                    body: JSON.stringify({
                        name: data.name.trim(),
                        code: data.code.trim() || undefined,
                        address: data.address.trim() || null,
                        contact_numbers: data.phone.trim()
                            ? [data.phone.trim()]
                            : [],
                        version: data.version,
                        status: true,
                    }),
                },
            ),
        onSuccess: (_, variables) => {
            cache.invalidateQueries({
                queryKey: ["sub-companies", selectedCompanyId],
            });
            toast.success("Sub-company updated successfully");
            if (variables.id) {
                setUnsavedDrafts((prev) => {
                    const copy = { ...prev };
                    delete copy[variables.id!];
                    return copy;
                });
            }
            setEditingSubId(null);
            setEditingSubData(null);
            setInitialSubData(null);
            setUnsavedPrompt(null);
        },
        onError: (err: Error) => {
            toast.error(err.message);
        },
    });

    // Delete sub-company mutation
    const deleteSubMutation = useMutation({
        mutationFn: (sub: RecordData) =>
            api(
                `/api/v1/companies/${selectedCompany?.id}/sub-companies/${sub.id}`,
                {
                    method: "DELETE",
                    body: JSON.stringify({ version: sub.version }),
                },
            ),
        onSuccess: () => {
            cache.invalidateQueries({
                queryKey: ["sub-companies", selectedCompanyId],
            });
            toast.success("Sub-company deleted successfully");
            setDeletingSub(null);
        },
        onError: (err: Error) => {
            toast.error(err.message);
            setDeletingSub(null);
        },
    });

    // Save sub-company actions
    const handleSaveNewSub = async () => {
        if (!newSubData.name.trim()) {
            toast.error("Sub-company name is required");
            return;
        }
        await createSubMutation.mutateAsync(newSubData);
    };

    const handleSaveExistingSub = async (data: SubCompanyRowData | null) => {
        if (!data) return;
        if (!data.name.trim()) {
            toast.error("Sub-company name is required");
            return;
        }
        await editSubMutation.mutateAsync(data);
    };

    const handleCancelNewSub = () => {
        setIsAddingSub(false);
        setNewSubData({ code: "", name: "", address: "", phone: "" });
    };

    const handleCancelEditSub = (subId: number) => {
        if (
            editingSubData &&
            initialSubData &&
            isSubRowDirty(editingSubData, initialSubData)
        ) {
            setUnsavedDrafts((prev) => ({
                ...prev,
                [subId]: { ...editingSubData },
            }));
            toast.info("Changes stored as unsaved draft");
        }
        setEditingSubId(null);
        setEditingSubData(null);
        setInitialSubData(null);
    };

    // Navigation and unsaved prompt interception
    const attemptNavigation = (targetAction: () => void) => {
        if (isAddingSub && isNewSubRowDirty(newSubData)) {
            setUnsavedPrompt({
                open: true,
                subName: newSubData.name || "New sub-company",
                onSave: async () => {
                    await handleSaveNewSub();
                    targetAction();
                },
                onProceedUnsaved: () => {
                    setIsAddingSub(false);
                    setUnsavedPrompt(null);
                    targetAction();
                },
            });
            return;
        }

        if (
            editingSubId !== null &&
            editingSubData &&
            initialSubData &&
            isSubRowDirty(editingSubData, initialSubData)
        ) {
            const currentId = editingSubId;
            const draft = { ...editingSubData };
            setUnsavedPrompt({
                open: true,
                subName: editingSubData.name || "Sub-company",
                onSave: async () => {
                    await handleSaveExistingSub(editingSubData);
                    targetAction();
                },
                onProceedUnsaved: () => {
                    setUnsavedDrafts((prev) => ({
                        ...prev,
                        [currentId]: draft,
                    }));
                    setEditingSubId(null);
                    setEditingSubData(null);
                    setInitialSubData(null);
                    setUnsavedPrompt(null);
                    targetAction();
                },
            });
            return;
        }

        if (isAddingSub) setIsAddingSub(false);
        if (editingSubId !== null) {
            setEditingSubId(null);
            setEditingSubData(null);
            setInitialSubData(null);
        }
        targetAction();
    };

    const startEditingSub = (sub: RecordData) => {
        setIsAddingSub(false);
        const subId = Number(sub.id);
        lastSelectedSub.current = subId;
        setEditingSubId(subId);
        const draft = unsavedDrafts[subId];
        const initial: SubCompanyRowData = {
            id: subId,
            code: String(sub.code || ""),
            name: String(sub.name || ""),
            address: String(sub.address || ""),
            phone:
                Array.isArray(sub.contact_numbers) && sub.contact_numbers.length
                    ? String(sub.contact_numbers[0])
                    : String(sub.contact_number || ""),
            version: typeof sub.version === "number" ? sub.version : 1,
        };
        setInitialSubData(initial);
        setEditingSubData(
            draft ? { ...draft, version: initial.version } : { ...initial },
        );
    };

    const handleRowClick = (sub: RecordData) => {
        if (editingSubId === Number(sub.id)) return;
        attemptNavigation(() => {
            startEditingSub(sub);
        });
    };

    const handleAddSubClick = () => {
        attemptNavigation(() => {
            setIsAddingSub(true);
            setNewSubData({ code: "", name: "", address: "", phone: "" });
        });
    };

    const handleAddSubFromHeader = (column: number) => {
        if (
            !session.entities["sub-companies"].capabilities.create ||
            !selectedCompany?.status
        )
            return;
        const focusColumn = () =>
            requestAnimationFrame(() => {
                const inputs = document.querySelectorAll<HTMLInputElement>(
                    ".subcompany-row-inline-editing.row-adding input",
                );
                inputs[column]?.focus({ preventScroll: true });
            });
        if (isAddingSub) {
            focusColumn();
            return;
        }
        attemptNavigation(() => {
            setIsAddingSub(true);
            setNewSubData({ code: "", name: "", address: "", phone: "" });
            focusColumn();
        });
    };

    const handleSubInputKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>,
        currentIndex: number,
        isNew: boolean,
    ) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (isNew) {
                if (subCompanies.length > 0) {
                    attemptNavigation(() => {
                        startEditingSub(subCompanies[0]);
                    });
                }
            } else if (currentIndex < subCompanies.length - 1) {
                attemptNavigation(() => {
                    startEditingSub(subCompanies[currentIndex + 1]);
                });
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (!isNew && currentIndex > 0) {
                attemptNavigation(() => {
                    startEditingSub(subCompanies[currentIndex - 1]);
                });
            } else if (!isNew && currentIndex === 0 && isAddingSub) {
                attemptNavigation(() => {
                    newSubInputRef.current?.focus();
                });
            }
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (isNew) {
                handleSaveNewSub();
            } else if (editingSubData) {
                handleSaveExistingSub(editingSubData);
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            if (isNew) {
                handleCancelNewSub();
            } else if (editingSubId !== null) {
                handleCancelEditSub(editingSubId);
            }
        }
    };

    // View All Companies Directory query
    const allCompaniesQuery = useQuery({
        queryKey: ["all-companies-directory"],
        queryFn: () =>
            managementApi<PageResult>(`/api/v1/companies?per_page=100`),
        enabled: viewAllOpen,
    });

    const allCompanies = useMemo(
        () => (allCompaniesQuery.data?.data as RecordData[]) || companies,
        [allCompaniesQuery.data, companies],
    );

    const filteredCompanies = useMemo(() => {
        if (!viewAllSearch.trim()) return allCompanies;
        const q = viewAllSearch.toLowerCase();
        return allCompanies.filter((c) => {
            const name = String(c.name || "").toLowerCase();
            const code = String(c.short_name || c.code || "").toLowerCase();
            const phone = String(c.contact_number || "").toLowerCase();
            const fax = String(c.fax_number || "").toLowerCase();
            const website = String(c.website || "").toLowerCase();
            const address = String(c.address || "").toLowerCase();
            return (
                name.includes(q) ||
                code.includes(q) ||
                phone.includes(q) ||
                fax.includes(q) ||
                website.includes(q) ||
                address.includes(q)
            );
        });
    }, [allCompanies, viewAllSearch]);

    // Handle View All popup keyboard navigation
    const handleViewAllKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex((prev) =>
                Math.min(filteredCompanies.length - 1, prev + 1),
            );
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex((prev) => Math.max(0, prev - 1));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (filteredCompanies[highlightedIndex]) {
                handleSelectFromViewAll(filteredCompanies[highlightedIndex]);
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            setViewAllOpen(false);
        }
    };

    const handleSelectFromViewAll = (c: RecordData) => {
        setViewAllOpen(false);
        setIsEditing(false);
        setIsCreating(false);
        navigate(`/companies/${c.id}`);
        toast.info(`Loaded ${c.name} in read-only form`);
    };

    useDirectoryDialog(viewAllOpen, viewAllSearchInputRef, () =>
        setViewAllOpen(false),
    );

    useEffect(() => {
        if (viewAllOpen && viewAllRowRefs.current[highlightedIndex]) {
            viewAllRowRefs.current[highlightedIndex]?.scrollIntoView({
                block: "nearest",
                behavior: "smooth",
            });
        }
    }, [highlightedIndex, viewAllOpen]);

    const activeFormStatus =
        isCreating || isEditing
            ? formData.status
            : selectedCompany
              ? selectedCompany.status !== false
              : true;

    const saveCurrentRecord = () => {
        if (isAddingSub) void handleSaveNewSub();
        else if (editingSubId !== null && editingSubData)
            void handleSaveExistingSub(editingSubData);
        else if (isEditing || isCreating) handleSave();
    };
    const companyCapabilities = session.entities.companies.capabilities;
    const subCapabilities = session.entities["sub-companies"].capabilities;
    const selectedSub = subCompanies.find(
        (record) => Number(record.id) === lastSelectedSub.current,
    );
    const shortcutBusy =
        isSaving ||
        createSubMutation.isPending ||
        editSubMutation.isPending ||
        deleteSubMutation.isPending;
    useRecordShortcuts({
        scope: shortcutScope,
        page: true,
        enabled: !shortcutBusy,
        canCreate: companyCapabilities.create,
        canUpdate:
            companyCapabilities.update &&
            !!selectedCompany &&
            !isEditing &&
            !isCreating,
        canSave: isCreating
            ? companyCapabilities.create
            : isEditing
              ? companyCapabilities.update
              : isAddingSub
                ? subCapabilities.create
                : editingSubId !== null && subCapabilities.update,
        onNew: () => {
            if (
                (isEditing || isCreating) &&
                JSON.stringify(formData) !==
                    JSON.stringify(initialCompanyForm.current) &&
                !window.confirm("Discard unsaved changes?")
            )
                return;
            attemptNavigation(handleStartCreate);
        },
        onEdit: () => attemptNavigation(handleStartEdit),
        onSave: saveCurrentRecord,
    });
    useRecordShortcuts({
        scope: subShortcutScope,
        enabled: !shortcutBusy,
        canCreate: subCapabilities.create && !!selectedCompany?.status,
        canUpdate:
            subCapabilities.update &&
            !!selectedSub &&
            editingSubId === null &&
            !isAddingSub,
        canSave: isAddingSub
            ? subCapabilities.create
            : editingSubId !== null && subCapabilities.update,
        onNew: () => handleAddSubFromHeader(0),
        onEdit: () => {
            if (selectedSub)
                attemptNavigation(() => startEditingSub(selectedSub));
        },
        onSave: saveCurrentRecord,
    });

    // Enter key navigation to move to next field
    const handleEnterNav = (e: React.KeyboardEvent) => {
        if (e.key !== "Enter") return;
        const target = e.target as HTMLElement;
        if (!target) return;
        if (
            target.closest(".company-search-box") ||
            target.closest(".view-all-modal-box")
        )
            return;
        if (target.tagName === "TEXTAREA" && !e.ctrlKey) return;
        if (target.closest("[data-combobox-open='true']")) return;
        if (
            target.tagName === "BUTTON" &&
            (target.classList.contains("btn-company-save") ||
                target.classList.contains("btn-subcompany-add") ||
                target.classList.contains("btn-subcompany-save-pill"))
        ) {
            return;
        }

        const container = target.closest(
            ".company-card, tr.subcompany-row-inline-editing, form, .company-detail-panel",
        );
        if (!container) return;

        const selector =
            'input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), button.searchable-select-trigger:not([disabled]):not(.is-readonly), button[role="switch"]:not([disabled])';
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

    return (
        <div className="company-page-container" ref={shortcutScope}>
            {/* Top Page Header */}
            <header className="company-header">
                <div className="company-header-left">
                    <Link to="/" className="company-back-btn">
                        <ArrowLeft size={16} />
                        <span>Back</span>
                    </Link>

                    <div className="company-icon-badge">
                        <Building2 size={22} />
                    </div>

                    <div className="company-title-wrap">
                        <h1 className="company-page-title">Companies</h1>
                    </div>
                </div>

                <PageActions className="company-header-actions">
                    {isEditing || isCreating ? (
                        <>
                            <button
                                type="button"
                                className="btn-company-save"
                                aria-label="Save record"
                                onClick={handleSave}
                                disabled={isSaving}
                            >
                                <Check size={16} />
                                <span>Save</span>
                            </button>

                            <button
                                type="button"
                                className="btn-company-cancel"
                                onClick={handleCancel}
                                disabled={isSaving}
                            >
                                <X size={15} />
                                <span>Cancel</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                className="btn-company-new"
                                aria-label={id ? "New company" : "Add record"}
                                onClick={handleStartCreate}
                                disabled={
                                    !companyCapabilities.create || isSaving
                                }
                                aria-keyshortcuts="Control+n Meta+n"
                                title="New record (Ctrl/Cmd+N)"
                            >
                                <Plus size={16} />
                                <span>New</span>
                            </button>

                            <button
                                type="button"
                                className="btn-company-edit"
                                onClick={handleStartEdit}
                                disabled={
                                    !selectedCompany ||
                                    !companyCapabilities.update ||
                                    isSaving
                                }
                                aria-keyshortcuts="Control+e Meta+e"
                                title="Edit selected record (Ctrl/Cmd+E)"
                            >
                                <Pencil size={15} />
                                <span>Edit</span>
                            </button>

                            <button
                                type="button"
                                className="btn-company-delete"
                                onClick={() => setDeletingCompany(true)}
                                disabled={!selectedCompany}
                            >
                                <Trash2 size={15} />
                                <span>Delete</span>
                            </button>
                        </>
                    )}
                </PageActions>
            </header>

            {/* Split Master-Detail Layout */}
            <MobileRecordBrowser
                title="Companies"
                listRef={listPanelRef}
                onViewAll={() => {
                    setViewAllOpen(true);
                    setViewAllSearch("");
                    setHighlightedIndex(0);
                }}
            />
            <div className="company-split-layout">
                {/* Left Master List */}
                <aside className="company-list-panel" ref={listPanelRef}>
                    <div className="company-list-topbar">
                        <span className="company-list-heading">Companies</span>
                        <button
                            type="button"
                            className="company-view-all-btn"
                            onClick={() => {
                                setViewAllOpen(true);
                                setViewAllSearch("");
                                setHighlightedIndex(0);
                            }}
                            title="View all companies in full table popup"
                            aria-label="View all companies"
                        >
                            <Maximize2 size={13} />
                            <span>View All</span>
                        </button>
                    </div>

                    <div className="company-search-box">
                        <Search size={16} className="company-search-icon" />
                        <input
                            type="text"
                            placeholder="Search records…"
                            aria-label="Search Companies"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>

                    <div
                        className="company-table-container"
                        tabIndex={0}
                        ref={tableContainerRef}
                        onKeyDown={handleTableKeyDown}
                        aria-label="Companies Table Navigation"
                    >
                        <table className="company-master-table">
                            <thead>
                                <tr>
                                    <th className="company-code-heading">
                                        CODE
                                    </th>
                                    <th>COMPANY NAME</th>
                                    <th
                                        className="master-status-cell"
                                        aria-label="Status"
                                    />
                                </tr>
                            </thead>
                            <tbody>
                                {companiesQuery.isPending &&
                                companies.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={3}
                                            className="table-loading-cell"
                                        >
                                            <Loading />
                                        </td>
                                    </tr>
                                ) : companies.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={3}
                                            className="table-empty-cell"
                                        >
                                            No companies found
                                        </td>
                                    </tr>
                                ) : (
                                    companies.map((c, idx) => {
                                        const isSelected =
                                            selectedCompanyId === c.id;
                                        return (
                                            <tr
                                                key={c.id}
                                                ref={(el) => {
                                                    tableRowRefs.current[idx] =
                                                        el;
                                                }}
                                                className={
                                                    isSelected && !isCreating
                                                        ? "row-selected"
                                                        : ""
                                                }
                                                onClick={() => {
                                                    attemptNavigation(() => {
                                                        setIsCreating(false);
                                                        setIsEditing(false);
                                                        navigate(
                                                            `/companies/${c.id}`,
                                                        );
                                                        tableContainerRef.current?.focus();
                                                    });
                                                }}
                                            >
                                                <td className="code-cell">
                                                    {String(
                                                        c.short_name ||
                                                            c.code ||
                                                            "",
                                                    )}
                                                </td>
                                                <td className="name-cell">
                                                    <button
                                                        type="button"
                                                        className="company-row-btn"
                                                        aria-label={String(
                                                            c.name || "",
                                                        )}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setIsCreating(
                                                                false,
                                                            );
                                                            setIsEditing(false);
                                                            navigate(
                                                                `/companies/${c.id}`,
                                                            );
                                                            tableContainerRef.current?.focus();
                                                        }}
                                                    >
                                                        {String(c.name || "")}
                                                    </button>
                                                </td>
                                                <td className="master-status-cell">
                                                    <StatusIndicator
                                                        active={
                                                            c.status !== false
                                                        }
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    <div className="company-list-footer">
                        <span>
                            {page} of {companiesQuery.data?.meta.last_page || 1}
                        </span>
                        <div className="company-pagination-btns">
                            <button
                                disabled={page <= 1}
                                onClick={() => setPage(1)}
                                title="First page"
                            >
                                <ChevronsLeft size={15} />
                            </button>
                            <button
                                disabled={page <= 1}
                                onClick={() =>
                                    setPage((p) => Math.max(1, p - 1))
                                }
                                title="Previous page"
                            >
                                <ChevronLeft size={15} />
                            </button>
                            <button
                                disabled={
                                    !companiesQuery.data ||
                                    page >= companiesQuery.data.meta.last_page
                                }
                                onClick={() => setPage((p) => p + 1)}
                                title="Next page"
                            >
                                <ChevronRight size={15} />
                            </button>
                            <button
                                disabled={
                                    !companiesQuery.data ||
                                    page >= companiesQuery.data.meta.last_page
                                }
                                onClick={() =>
                                    setPage(
                                        companiesQuery.data?.meta.last_page ||
                                            1,
                                    )
                                }
                                title="Last page"
                            >
                                <ChevronsRight size={15} />
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Right Detail Panel - Using <div> to ensure zero top-padding offset */}
                <div
                    className="company-detail-panel"
                    onKeyDown={handleEnterNav}
                >
                    {selectedCompanyQuery.isPending &&
                    !selectedCompany &&
                    !isCreating ? (
                        <div className="company-card loading-card">
                            <Loading />
                        </div>
                    ) : selectedCompanyQuery.error &&
                      !selectedCompany &&
                      !isCreating ? (
                        <div className="company-card error-card">
                            <ErrorState error={selectedCompanyQuery.error} />
                        </div>
                    ) : selectedCompany || isCreating ? (
                        <>
                            {/* Top Card: Company Record Details */}
                            <div
                                className="company-card"
                                {...(isCreating
                                    ? {
                                          role: "dialog",
                                          "aria-label": "New company",
                                      }
                                    : {})}
                            >
                                <div className="company-card-header">
                                    <h2 className="company-card-title">
                                        {isCreating
                                            ? "New Company"
                                            : String(
                                                  selectedCompany?.name ?? "—",
                                              )}
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
                                            <span className="company-readonly-badge">
                                                Read only
                                            </span>
                                        )}

                                        {(isEditing || isCreating) && (
                                            <div
                                                style={{
                                                    display: "flex",
                                                    gap: "8px",
                                                }}
                                            >
                                                <button
                                                    type="button"
                                                    className="btn-company-save"
                                                    aria-label="Save record"
                                                    onClick={handleSave}
                                                    disabled={isSaving}
                                                >
                                                    <Check size={16} />
                                                    <span>Save</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-company-cancel"
                                                    onClick={handleCancel}
                                                    disabled={isSaving}
                                                >
                                                    <X size={15} />
                                                    <span>Cancel</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Card Body */}
                                <div className="company-card-body">
                                    {/* General Section */}
                                    <div className="company-form-section">
                                        <div className="company-section-header">
                                            <div className="company-section-title-wrap">
                                                <Building2
                                                    size={15}
                                                    className="company-section-icon"
                                                />
                                                <h4 className="company-section-eyebrow">
                                                    GENERAL
                                                </h4>
                                            </div>
                                        </div>
                                        <div className="company-fields-grid company-general-grid">
                                            <div className="company-field company-field-code">
                                                <label htmlFor="company-code">
                                                    COMPANY CODE{" "}
                                                    <span className="req-star">
                                                        *
                                                    </span>
                                                </label>
                                                <input
                                                    ref={firstInputRef}
                                                    id="company-code"
                                                    aria-label="Short name"
                                                    type="text"
                                                    readOnly={
                                                        !isEditing &&
                                                        !isCreating
                                                    }
                                                    value={
                                                        isEditing || isCreating
                                                            ? formData.short_name
                                                            : String(
                                                                  selectedCompany?.short_name ||
                                                                      selectedCompany?.code ||
                                                                      "",
                                                              )
                                                    }
                                                    onChange={(e) =>
                                                        setFormData((d) => ({
                                                            ...d,
                                                            short_name:
                                                                e.target.value,
                                                        }))
                                                    }
                                                    placeholder="e.g. CCL"
                                                />
                                            </div>

                                            <div className="company-field company-field-name">
                                                <label htmlFor="company-name">
                                                    COMPANY NAME{" "}
                                                    <span className="req-star">
                                                        *
                                                    </span>
                                                </label>
                                                <input
                                                    id="company-name"
                                                    aria-label="Name"
                                                    type="text"
                                                    readOnly={
                                                        !isEditing &&
                                                        !isCreating
                                                    }
                                                    value={
                                                        isEditing || isCreating
                                                            ? formData.name
                                                            : String(
                                                                  selectedCompany?.name ||
                                                                      "",
                                                              )
                                                    }
                                                    onChange={(e) =>
                                                        setFormData((d) => ({
                                                            ...d,
                                                            name: e.target
                                                                .value,
                                                        }))
                                                    }
                                                    placeholder="Enter company name"
                                                />
                                            </div>

                                            <div className="company-field company-field-tax">
                                                <label htmlFor="company-tax">
                                                    NTN / TAX NO.
                                                </label>
                                                <input
                                                    id="company-tax"
                                                    aria-label="NTN / TAX NO."
                                                    type="text"
                                                    readOnly={
                                                        !isEditing &&
                                                        !isCreating
                                                    }
                                                    value={
                                                        isEditing || isCreating
                                                            ? formData.fax_number
                                                            : String(
                                                                  selectedCompany?.fax_number ||
                                                                      "4211-869",
                                                              )
                                                    }
                                                    onChange={(e) =>
                                                        setFormData((d) => ({
                                                            ...d,
                                                            fax_number:
                                                                e.target.value,
                                                        }))
                                                    }
                                                    placeholder="e.g. 4211-869"
                                                />
                                            </div>
                                        </div>

                                        <div className="company-default-controls">
                                            <div className="company-toggle-row">
                                                <span className="company-toggle-label">
                                                    ACTIVE
                                                </span>
                                                <div className="company-toggle-switch">
                                                    <button
                                                        type="button"
                                                        role="switch"
                                                        aria-label="Company status"
                                                        aria-checked={
                                                            activeFormStatus
                                                        }
                                                        disabled={
                                                            (!isEditing &&
                                                                !isCreating) ||
                                                            isSaving
                                                        }
                                                        className={`switch-track ${activeFormStatus ? "active" : ""} ${isEditing || isCreating ? "interactive" : ""}`}
                                                        onClick={() =>
                                                            setFormData(
                                                                (current) => ({
                                                                    ...current,
                                                                    status: !current.status,
                                                                }),
                                                            )
                                                        }
                                                    >
                                                        <span className="switch-knob" />
                                                    </button>
                                                    <span className="switch-text">
                                                        {activeFormStatus
                                                            ? "Active"
                                                            : "Inactive"}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="company-toggle-row">
                                                <span className="company-toggle-label">
                                                    SET AS DEFAULT
                                                </span>
                                                <div className="company-toggle-switch">
                                                    <button
                                                        type="button"
                                                        role="switch"
                                                        aria-label="Set as default company"
                                                        aria-checked={
                                                            isEditing ||
                                                            isCreating
                                                                ? formData.is_default
                                                                : !!selectedCompany?.is_default
                                                        }
                                                        disabled={
                                                            (!isEditing &&
                                                                !isCreating) ||
                                                            isSaving ||
                                                            !activeFormStatus
                                                        }
                                                        className={`switch-track ${(isEditing || isCreating ? formData.is_default : selectedCompany?.is_default) ? "active" : ""} ${isEditing || isCreating ? "interactive" : ""}`}
                                                        onClick={() =>
                                                            setFormData(
                                                                (current) => ({
                                                                    ...current,
                                                                    is_default:
                                                                        !current.is_default,
                                                                }),
                                                            )
                                                        }
                                                    >
                                                        <span className="switch-knob" />
                                                    </button>
                                                    <span className="switch-text">
                                                        {(
                                                            isEditing ||
                                                            isCreating
                                                                ? formData.is_default
                                                                : selectedCompany?.is_default
                                                        )
                                                            ? "Default"
                                                            : "Not default"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section Separator / Divider between General and Contact */}
                                    <div className="company-section-separator" />

                                    {/* Contact Section */}
                                    <div className="company-form-section">
                                        <div className="company-section-header">
                                            <div className="company-section-title-wrap">
                                                <Phone
                                                    size={15}
                                                    className="company-section-icon"
                                                />
                                                <h4 className="company-section-eyebrow">
                                                    CONTACT
                                                </h4>
                                            </div>
                                        </div>
                                        <div className="company-fields-grid company-contact-grid">
                                            <div className="company-field company-field-phone">
                                                <label htmlFor="company-phone">
                                                    PHONE
                                                </label>
                                                <input
                                                    id="company-phone"
                                                    aria-label="Phone"
                                                    type="text"
                                                    readOnly={
                                                        !isEditing &&
                                                        !isCreating
                                                    }
                                                    value={
                                                        isEditing || isCreating
                                                            ? formData.contact_number
                                                            : String(
                                                                  selectedCompany?.contact_number ||
                                                                      "+92 21 3456 7788",
                                                              )
                                                    }
                                                    onChange={(e) =>
                                                        setFormData((d) => ({
                                                            ...d,
                                                            contact_number:
                                                                e.target.value,
                                                        }))
                                                    }
                                                    placeholder="+92 21 3456 7788"
                                                />
                                            </div>

                                            <div className="company-field company-field-email">
                                                <label htmlFor="company-email">
                                                    EMAIL
                                                </label>
                                                <input
                                                    id="company-email"
                                                    aria-label="Email"
                                                    type="text"
                                                    readOnly={
                                                        !isEditing &&
                                                        !isCreating
                                                    }
                                                    value={
                                                        isEditing || isCreating
                                                            ? formData.website
                                                            : String(
                                                                  selectedCompany?.website ||
                                                                      "info@cargocore.pk",
                                                              )
                                                    }
                                                    onChange={(e) =>
                                                        setFormData((d) => ({
                                                            ...d,
                                                            website:
                                                                e.target.value,
                                                        }))
                                                    }
                                                    placeholder="info@cargocore.pk"
                                                />
                                            </div>

                                            <div className="company-field company-field-country">
                                                <label>COUNTRY</label>
                                                <SearchableSelect
                                                    ariaLabel="Country"
                                                    placeholder="Select Country"
                                                    searchPlaceholder="Search country…"
                                                    value={companyCountryId}
                                                    onChange={(val) => {
                                                        setCompanyCountryId(
                                                            val,
                                                        );
                                                        setCompanyCityId("");
                                                    }}
                                                    options={countryOptions}
                                                    readOnly={
                                                        !isEditing &&
                                                        !isCreating
                                                    }
                                                />
                                            </div>

                                            <div className="company-field company-field-city">
                                                <label>CITY</label>
                                                <SearchableSelect
                                                    ariaLabel="City"
                                                    placeholder="Select City"
                                                    searchPlaceholder="Search city…"
                                                    value={companyCityId}
                                                    onChange={(val) =>
                                                        setCompanyCityId(val)
                                                    }
                                                    options={cityOptions}
                                                    readOnly={
                                                        !isEditing &&
                                                        !isCreating
                                                    }
                                                />
                                            </div>

                                            <div className="company-field company-field-address col-span-2">
                                                <label htmlFor="company-address">
                                                    ADDRESS
                                                </label>
                                                <textarea
                                                    id="company-address"
                                                    aria-label="Address"
                                                    readOnly={
                                                        !isEditing &&
                                                        !isCreating
                                                    }
                                                    rows={1}
                                                    value={
                                                        isEditing || isCreating
                                                            ? formData.address
                                                            : String(
                                                                  selectedCompany?.address ||
                                                                      "Plot 12, West Wharf, Karachi",
                                                              )
                                                    }
                                                    onChange={(e) =>
                                                        setFormData((d) => ({
                                                            ...d,
                                                            address:
                                                                e.target.value,
                                                        }))
                                                    }
                                                    placeholder="Plot 12, West Wharf, Karachi"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Card: Sub-Companies (Only when company exists) */}
                            {selectedCompany && !isCreating && (
                                <div
                                    className="company-card subcompanies-card"
                                    ref={subShortcutScope}
                                >
                                    <div className="company-card-header">
                                        <div className="company-card-header-left">
                                            <h3 className="company-card-title">
                                                Sub-companies
                                            </h3>
                                        </div>

                                        <button
                                            type="button"
                                            className="btn-subcompany-add"
                                            aria-label="Add record"
                                            onClick={handleAddSubClick}
                                        >
                                            <Plus size={15} />
                                            <span>Add</span>
                                        </button>
                                    </div>

                                    <div className="company-card-body subcompany-card-body">
                                        <div className="subcompany-table-container">
                                            <table className="subcompany-table">
                                                <thead>
                                                    <tr>
                                                        {(
                                                            [
                                                                ["CODE", "15%"],
                                                                ["NAME", "25%"],
                                                                [
                                                                    "ADDRESS",
                                                                    "30%",
                                                                ],
                                                                [
                                                                    "PHONE",
                                                                    "18%",
                                                                ],
                                                            ] as const
                                                        ).map(
                                                            (
                                                                [label, width],
                                                                index,
                                                            ) => (
                                                                <th
                                                                    key={label}
                                                                    style={{
                                                                        width,
                                                                    }}
                                                                    onClick={() =>
                                                                        handleAddSubFromHeader(
                                                                            index,
                                                                        )
                                                                    }
                                                                >
                                                                    <button
                                                                        type="button"
                                                                        className="editable-detail-heading"
                                                                        aria-label={`Add sub-company: ${label}`}
                                                                        disabled={
                                                                            !session
                                                                                .entities[
                                                                                "sub-companies"
                                                                            ]
                                                                                .capabilities
                                                                                .create ||
                                                                            !selectedCompany?.status
                                                                        }
                                                                    >
                                                                        {label}
                                                                        <Plus
                                                                            size={
                                                                                10
                                                                            }
                                                                        />
                                                                    </button>
                                                                </th>
                                                            ),
                                                        )}
                                                        <th
                                                            style={{
                                                                width: "12%",
                                                            }}
                                                            className="actions-header"
                                                        />
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {/* 1. Inline New Sub-Company Row */}
                                                    {isAddingSub && (
                                                        <tr className="subcompany-row-inline-editing row-adding">
                                                            <td>
                                                                <input
                                                                    ref={
                                                                        newSubInputRef
                                                                    }
                                                                    type="text"
                                                                    className="city-inline-input"
                                                                    placeholder="e.g. SUB-01"
                                                                    aria-label="Code"
                                                                    value={
                                                                        newSubData.code
                                                                    }
                                                                    onChange={(
                                                                        e,
                                                                    ) =>
                                                                        setNewSubData(
                                                                            (
                                                                                prev,
                                                                            ) => ({
                                                                                ...prev,
                                                                                code: e
                                                                                    .target
                                                                                    .value,
                                                                            }),
                                                                        )
                                                                    }
                                                                    onKeyDown={(
                                                                        e,
                                                                    ) =>
                                                                        handleSubInputKeyDown(
                                                                            e,
                                                                            -1,
                                                                            true,
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="text"
                                                                    className="city-inline-input"
                                                                    placeholder="Sub-company Name *"
                                                                    aria-label="Name"
                                                                    value={
                                                                        newSubData.name
                                                                    }
                                                                    onChange={(
                                                                        e,
                                                                    ) =>
                                                                        setNewSubData(
                                                                            (
                                                                                prev,
                                                                            ) => ({
                                                                                ...prev,
                                                                                name: e
                                                                                    .target
                                                                                    .value,
                                                                            }),
                                                                        )
                                                                    }
                                                                    onKeyDown={(
                                                                        e,
                                                                    ) =>
                                                                        handleSubInputKeyDown(
                                                                            e,
                                                                            -1,
                                                                            true,
                                                                        )
                                                                    }
                                                                    required
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="text"
                                                                    className="city-inline-input"
                                                                    placeholder="Address"
                                                                    aria-label="Address"
                                                                    value={
                                                                        newSubData.address
                                                                    }
                                                                    onChange={(
                                                                        e,
                                                                    ) =>
                                                                        setNewSubData(
                                                                            (
                                                                                prev,
                                                                            ) => ({
                                                                                ...prev,
                                                                                address:
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                            }),
                                                                        )
                                                                    }
                                                                    onKeyDown={(
                                                                        e,
                                                                    ) =>
                                                                        handleSubInputKeyDown(
                                                                            e,
                                                                            -1,
                                                                            true,
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="text"
                                                                    className="city-inline-input"
                                                                    placeholder="Phone / Contact"
                                                                    aria-label="Contact number"
                                                                    value={
                                                                        newSubData.phone
                                                                    }
                                                                    onChange={(
                                                                        e,
                                                                    ) =>
                                                                        setNewSubData(
                                                                            (
                                                                                prev,
                                                                            ) => ({
                                                                                ...prev,
                                                                                phone: e
                                                                                    .target
                                                                                    .value,
                                                                            }),
                                                                        )
                                                                    }
                                                                    onKeyDown={(
                                                                        e,
                                                                    ) =>
                                                                        handleSubInputKeyDown(
                                                                            e,
                                                                            -1,
                                                                            true,
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                            <td className="actions-cell subcompany-inline-actions">
                                                                <button
                                                                    type="button"
                                                                    className="btn-subcompany-save-pill"
                                                                    aria-label="Save changes"
                                                                    title="Save record"
                                                                    onClick={
                                                                        handleSaveNewSub
                                                                    }
                                                                    disabled={
                                                                        createSubMutation.isPending
                                                                    }
                                                                >
                                                                    <Check
                                                                        size={
                                                                            14
                                                                        }
                                                                    />
                                                                    <span>
                                                                        Save
                                                                    </span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="btn-city-action-cancel"
                                                                    aria-label="Cancel"
                                                                    title="Cancel"
                                                                    onClick={
                                                                        handleCancelNewSub
                                                                    }
                                                                    disabled={
                                                                        createSubMutation.isPending
                                                                    }
                                                                >
                                                                    <X
                                                                        size={
                                                                            14
                                                                        }
                                                                    />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    )}

                                                    {/* 2. Loading state */}
                                                    {subCompaniesQuery.isPending ? (
                                                        <tr>
                                                            <td
                                                                colSpan={5}
                                                                className="table-loading-cell"
                                                            >
                                                                <Loading />
                                                            </td>
                                                        </tr>
                                                    ) : subCompanies.length ===
                                                          0 && !isAddingSub ? (
                                                        <tr>
                                                            <td
                                                                colSpan={5}
                                                                className="table-empty-cell"
                                                            >
                                                                No sub-companies
                                                                linked yet.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        subCompanies.map(
                                                            (sub, index) => {
                                                                const isEditingThis =
                                                                    editingSubId ===
                                                                    Number(
                                                                        sub.id,
                                                                    );
                                                                const hasDraft =
                                                                    !!unsavedDrafts[
                                                                        Number(
                                                                            sub.id,
                                                                        )
                                                                    ];
                                                                const displayDraft =
                                                                    unsavedDrafts[
                                                                        Number(
                                                                            sub.id,
                                                                        )
                                                                    ];
                                                                const isDirty =
                                                                    isEditingThis &&
                                                                    editingSubData &&
                                                                    initialSubData &&
                                                                    isSubRowDirty(
                                                                        editingSubData,
                                                                        initialSubData,
                                                                    );
                                                                const showUnsavedBadge =
                                                                    hasDraft ||
                                                                    isDirty;

                                                                const codeVal =
                                                                    String(
                                                                        (isEditingThis
                                                                            ? editingSubData?.code
                                                                            : displayDraft?.code) ??
                                                                            sub.code ??
                                                                            "",
                                                                    );
                                                                const nameVal =
                                                                    String(
                                                                        (isEditingThis
                                                                            ? editingSubData?.name
                                                                            : displayDraft?.name) ??
                                                                            sub.name ??
                                                                            "",
                                                                    );
                                                                const addressVal =
                                                                    String(
                                                                        (isEditingThis
                                                                            ? editingSubData?.address
                                                                            : displayDraft?.address) ??
                                                                            sub.address ??
                                                                            "",
                                                                    );
                                                                const phoneVal =
                                                                    String(
                                                                        isEditingThis
                                                                            ? editingSubData?.phone
                                                                            : (hasDraft &&
                                                                                  displayDraft?.phone) ||
                                                                                  (Array.isArray(
                                                                                      sub.contact_numbers,
                                                                                  ) &&
                                                                                  sub
                                                                                      .contact_numbers
                                                                                      .length
                                                                                      ? sub
                                                                                            .contact_numbers[0]
                                                                                      : sub.contact_number ||
                                                                                        ""),
                                                                    );

                                                                if (
                                                                    isEditingThis
                                                                ) {
                                                                    return (
                                                                        <tr
                                                                            key={
                                                                                sub.id
                                                                            }
                                                                            className={`subcompany-row subcompany-row-inline-editing ${
                                                                                isDirty
                                                                                    ? "subcompany-row-dirty"
                                                                                    : ""
                                                                            }`}
                                                                        >
                                                                            <td>
                                                                                <input
                                                                                    type="text"
                                                                                    className="city-inline-input"
                                                                                    placeholder="Code"
                                                                                    aria-label="Code"
                                                                                    value={
                                                                                        editingSubData?.code ||
                                                                                        ""
                                                                                    }
                                                                                    onChange={(
                                                                                        e,
                                                                                    ) =>
                                                                                        setEditingSubData(
                                                                                            (
                                                                                                prev,
                                                                                            ) =>
                                                                                                prev
                                                                                                    ? {
                                                                                                          ...prev,
                                                                                                          code: e
                                                                                                              .target
                                                                                                              .value,
                                                                                                      }
                                                                                                    : null,
                                                                                        )
                                                                                    }
                                                                                    onKeyDown={(
                                                                                        e,
                                                                                    ) =>
                                                                                        handleSubInputKeyDown(
                                                                                            e,
                                                                                            index,
                                                                                            false,
                                                                                        )
                                                                                    }
                                                                                />
                                                                            </td>
                                                                            <td>
                                                                                <div
                                                                                    style={{
                                                                                        display:
                                                                                            "flex",
                                                                                        alignItems:
                                                                                            "center",
                                                                                        gap: "6px",
                                                                                    }}
                                                                                >
                                                                                    <input
                                                                                        ref={
                                                                                            editNameInputRef
                                                                                        }
                                                                                        type="text"
                                                                                        className="city-inline-input"
                                                                                        placeholder="Sub-company Name"
                                                                                        aria-label="Name"
                                                                                        value={
                                                                                            editingSubData?.name ||
                                                                                            ""
                                                                                        }
                                                                                        onChange={(
                                                                                            e,
                                                                                        ) =>
                                                                                            setEditingSubData(
                                                                                                (
                                                                                                    prev,
                                                                                                ) =>
                                                                                                    prev
                                                                                                        ? {
                                                                                                              ...prev,
                                                                                                              name: e
                                                                                                                  .target
                                                                                                                  .value,
                                                                                                          }
                                                                                                        : null,
                                                                                            )
                                                                                        }
                                                                                        onKeyDown={(
                                                                                            e,
                                                                                        ) =>
                                                                                            handleSubInputKeyDown(
                                                                                                e,
                                                                                                index,
                                                                                                false,
                                                                                            )
                                                                                        }
                                                                                        required
                                                                                    />
                                                                                    {showUnsavedBadge && (
                                                                                        <span
                                                                                            className="subcompany-unsaved-badge"
                                                                                            title="Unsaved changes"
                                                                                        >
                                                                                            Unsaved
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td>
                                                                                <input
                                                                                    type="text"
                                                                                    className="city-inline-input"
                                                                                    placeholder="Address"
                                                                                    aria-label="Address"
                                                                                    value={
                                                                                        editingSubData?.address ||
                                                                                        ""
                                                                                    }
                                                                                    onChange={(
                                                                                        e,
                                                                                    ) =>
                                                                                        setEditingSubData(
                                                                                            (
                                                                                                prev,
                                                                                            ) =>
                                                                                                prev
                                                                                                    ? {
                                                                                                          ...prev,
                                                                                                          address:
                                                                                                              e
                                                                                                                  .target
                                                                                                                  .value,
                                                                                                      }
                                                                                                    : null,
                                                                                        )
                                                                                    }
                                                                                    onKeyDown={(
                                                                                        e,
                                                                                    ) =>
                                                                                        handleSubInputKeyDown(
                                                                                            e,
                                                                                            index,
                                                                                            false,
                                                                                        )
                                                                                    }
                                                                                />
                                                                            </td>
                                                                            <td>
                                                                                <input
                                                                                    type="text"
                                                                                    className="city-inline-input"
                                                                                    placeholder="Phone / Contact"
                                                                                    aria-label="Contact number"
                                                                                    value={
                                                                                        editingSubData?.phone ||
                                                                                        ""
                                                                                    }
                                                                                    onChange={(
                                                                                        e,
                                                                                    ) =>
                                                                                        setEditingSubData(
                                                                                            (
                                                                                                prev,
                                                                                            ) =>
                                                                                                prev
                                                                                                    ? {
                                                                                                          ...prev,
                                                                                                          phone: e
                                                                                                              .target
                                                                                                              .value,
                                                                                                      }
                                                                                                    : null,
                                                                                        )
                                                                                    }
                                                                                    onKeyDown={(
                                                                                        e,
                                                                                    ) =>
                                                                                        handleSubInputKeyDown(
                                                                                            e,
                                                                                            index,
                                                                                            false,
                                                                                        )
                                                                                    }
                                                                                />
                                                                            </td>
                                                                            <td className="actions-cell subcompany-inline-actions">
                                                                                <button
                                                                                    type="button"
                                                                                    className="btn-subcompany-save-pill"
                                                                                    aria-label="Save changes"
                                                                                    title="Save record"
                                                                                    onClick={() =>
                                                                                        handleSaveExistingSub(
                                                                                            editingSubData,
                                                                                        )
                                                                                    }
                                                                                    disabled={
                                                                                        editSubMutation.isPending
                                                                                    }
                                                                                >
                                                                                    <Check
                                                                                        size={
                                                                                            14
                                                                                        }
                                                                                    />
                                                                                    <span>
                                                                                        Save
                                                                                    </span>
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    className="btn-city-action-cancel"
                                                                                    aria-label="Cancel"
                                                                                    title="Cancel"
                                                                                    onClick={() =>
                                                                                        handleCancelEditSub(
                                                                                            Number(
                                                                                                sub.id,
                                                                                            ),
                                                                                        )
                                                                                    }
                                                                                    disabled={
                                                                                        editSubMutation.isPending
                                                                                    }
                                                                                >
                                                                                    <X
                                                                                        size={
                                                                                            14
                                                                                        }
                                                                                    />
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                }

                                                                return (
                                                                    <tr
                                                                        key={
                                                                            sub.id
                                                                        }
                                                                        className={`subcompany-row subcompany-row-clickable ${
                                                                            hasDraft
                                                                                ? "subcompany-row-has-draft"
                                                                                : ""
                                                                        }`}
                                                                        onClick={() =>
                                                                            handleRowClick(
                                                                                sub,
                                                                            )
                                                                        }
                                                                        title="Click to edit sub-company"
                                                                    >
                                                                        <td className="code-cell">
                                                                            {codeVal ||
                                                                                "—"}
                                                                        </td>
                                                                        <td className="name-cell">
                                                                            <div
                                                                                style={{
                                                                                    display:
                                                                                        "flex",
                                                                                    alignItems:
                                                                                        "center",
                                                                                    gap: "6px",
                                                                                }}
                                                                            >
                                                                                <span className="subcompany-name-text">
                                                                                    {
                                                                                        nameVal
                                                                                    }
                                                                                </span>
                                                                                {showUnsavedBadge && (
                                                                                    <span
                                                                                        className="subcompany-unsaved-badge"
                                                                                        title="Unsaved changes"
                                                                                    >
                                                                                        Unsaved
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td
                                                                            className="address-cell"
                                                                            style={{
                                                                                color: addressVal
                                                                                    ? "#1e362a"
                                                                                    : "#9ca3af",
                                                                            }}
                                                                        >
                                                                            {addressVal ||
                                                                                "—"}
                                                                        </td>
                                                                        <td
                                                                            className="phone-cell"
                                                                            style={{
                                                                                color: phoneVal
                                                                                    ? "#1e362a"
                                                                                    : "#9ca3af",
                                                                            }}
                                                                        >
                                                                            {phoneVal ||
                                                                                "—"}
                                                                        </td>
                                                                        <td className="actions-cell">
                                                                            <RecordStatusAction
                                                                                entity="sub-companies"
                                                                                record={
                                                                                    sub
                                                                                }
                                                                                parent={{
                                                                                    entity: "companies",
                                                                                    id: selectedCompanyId!,
                                                                                }}
                                                                            />
                                                                            <button
                                                                                type="button"
                                                                                className="icon-action-btn edit"
                                                                                title="Edit sub-company"
                                                                                aria-label={`Edit ${nameVal}`}
                                                                                onClick={(
                                                                                    e,
                                                                                ) => {
                                                                                    e.stopPropagation();
                                                                                    handleRowClick(
                                                                                        sub,
                                                                                    );
                                                                                }}
                                                                            >
                                                                                <Pencil
                                                                                    size={
                                                                                        15
                                                                                    }
                                                                                />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                className="icon-action-btn delete"
                                                                                title="Delete sub-company"
                                                                                aria-label={`Delete ${nameVal}`}
                                                                                onClick={(
                                                                                    e,
                                                                                ) => {
                                                                                    e.stopPropagation();
                                                                                    setDeletingSub(
                                                                                        sub,
                                                                                    );
                                                                                }}
                                                                            >
                                                                                <Trash2
                                                                                    size={
                                                                                        15
                                                                                    }
                                                                                />
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            },
                                                        )
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div
                            className="company-card empty-card"
                            style={{
                                textAlign: "center",
                                padding: "60px 24px",
                            }}
                        >
                            <div
                                className="company-icon-badge"
                                style={{
                                    margin: "0 auto 16px",
                                    width: "48px",
                                    height: "48px",
                                }}
                            >
                                <Building2 size={24} />
                            </div>
                            <h3
                                style={{
                                    fontSize: "17px",
                                    fontWeight: 700,
                                    color: "#0f2519",
                                    marginBottom: "8px",
                                }}
                            >
                                Select a company
                            </h3>
                            <p
                                style={{
                                    color: "#6b7f75",
                                    fontSize: "13.5px",
                                    maxWidth: "360px",
                                    margin: "0 auto 20px",
                                }}
                            >
                                Choose a legal entity from the list to view its
                                general settings, contacts, and sub-companies,
                                or create a new company.
                            </p>
                            <button
                                type="button"
                                className="btn-company-new"
                                onClick={handleStartCreate}
                                disabled={
                                    !companyCapabilities.create || isSaving
                                }
                                aria-keyshortcuts="Control+n Meta+n"
                                title="New record (Ctrl/Cmd+N)"
                            >
                                <Plus size={16} />
                                <span>Create Company</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirm: Delete Company */}
            <Confirm
                open={deletingCompany}
                title="Delete this company?"
                description={`Are you sure you want to delete ${selectedCompany?.name}? This action cannot be undone.`}
                busy={deleteCompanyMutation.isPending}
                onClose={() => setDeletingCompany(false)}
                onConfirm={() => deleteCompanyMutation.mutate()}
            />

            {/* Modal: Unsaved Sub-Company Changes Prompt */}
            {unsavedPrompt && (
                <Modal
                    open={unsavedPrompt.open}
                    onClose={() => setUnsavedPrompt(null)}
                    title="Unsaved Sub-Company Changes"
                    description={`You have modified "${unsavedPrompt.subName}" but haven't saved your changes yet. Please save your changes before proceeding elsewhere.`}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: "10px",
                            marginTop: "24px",
                        }}
                    >
                        <button
                            type="button"
                            className="btn secondary"
                            onClick={() => {
                                unsavedPrompt.onProceedUnsaved();
                            }}
                        >
                            <ArrowLeft className="mobile-action-icon" /> Proceed
                            without Saving
                        </button>
                        <button
                            type="button"
                            className="btn primary"
                            onClick={async () => {
                                await unsavedPrompt.onSave();
                            }}
                            disabled={
                                createSubMutation.isPending ||
                                editSubMutation.isPending
                            }
                        >
                            <Check size={16} />
                            <span>Save & Proceed</span>
                        </button>
                    </div>
                </Modal>
            )}

            {/* Confirm: Delete Sub-Company */}
            <Confirm
                open={!!deletingSub}
                title="Delete sub-company?"
                description={`Are you sure you want to delete ${deletingSub?.name}?`}
                busy={deleteSubMutation.isPending}
                onClose={() => setDeletingSub(null)}
                onConfirm={() =>
                    deletingSub && deleteSubMutation.mutate(deletingSub)
                }
            />

            {/* View All Companies Directory Popup */}
            {viewAllOpen && (
                <div
                    className="view-all-modal-overlay"
                    onClick={() => setViewAllOpen(false)}
                >
                    <div
                        className="view-all-modal-box"
                        role="dialog"
                        aria-modal="true"
                        aria-label="All Companies Directory"
                        data-state="open"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="view-all-modal-header">
                            <div>
                                <h3 className="view-all-modal-title">
                                    All Companies Directory
                                </h3>
                            </div>
                            <button
                                type="button"
                                className="view-all-close-btn"
                                onClick={() => setViewAllOpen(false)}
                                aria-label="Close directory"
                            >
                                <ArrowLeft className="mobile-action-icon" />
                                Close
                            </button>
                        </div>

                        {/* Search Input Bar */}
                        <div className="view-all-search-wrap">
                            <Search
                                size={18}
                                className="view-all-search-icon"
                            />
                            <input
                                ref={viewAllSearchInputRef}
                                type="text"
                                placeholder="Search records…"
                                aria-label="Search all companies"
                                value={viewAllSearch}
                                onChange={(e) => {
                                    setViewAllSearch(e.target.value);
                                    setHighlightedIndex(0);
                                }}
                                onKeyDown={handleViewAllKeyDown}
                            />
                        </div>

                        {/* Full Table Details */}
                        <div
                            className="view-all-table-wrap"
                            tabIndex={0}
                            role="region"
                            aria-label="Directory records"
                        >
                            <table className="view-all-table">
                                <thead>
                                    <tr>
                                        <th>CODE</th>
                                        <th>COMPANY NAME</th>
                                        <th>NTN / TAX NO.</th>
                                        <th>PHONE</th>
                                        <th>EMAIL / WEBSITE</th>
                                        <th>ADDRESS</th>
                                        <th>STATUS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allCompaniesQuery.isPending &&
                                    allCompanies.length === 0 ? (
                                        <tr className="view-all-empty-row">
                                            <td
                                                colSpan={7}
                                                style={{
                                                    textAlign: "center",
                                                    padding: "40px",
                                                }}
                                            >
                                                <Loading />
                                            </td>
                                        </tr>
                                    ) : filteredCompanies.length === 0 ? (
                                        <tr className="view-all-empty-row">
                                            <td
                                                colSpan={7}
                                                style={{
                                                    textAlign: "center",
                                                    padding: "40px",
                                                    color: "#6b7f75",
                                                    fontSize: "14px",
                                                }}
                                            >
                                                No companies found matching
                                                &ldquo;{viewAllSearch}&rdquo;
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredCompanies.map((comp, idx) => {
                                            const isHighlighted =
                                                idx === highlightedIndex;
                                            const isCurrent =
                                                selectedCompanyId === comp.id;
                                            return (
                                                <tr
                                                    key={comp.id}
                                                    ref={(el) => {
                                                        viewAllRowRefs.current[
                                                            idx
                                                        ] = el;
                                                    }}
                                                    className={`view-all-row ${isHighlighted ? "view-all-row-active" : ""}`}
                                                    onClick={() =>
                                                        handleSelectFromViewAll(
                                                            comp,
                                                        )
                                                    }
                                                    onMouseEnter={() =>
                                                        setHighlightedIndex(idx)
                                                    }
                                                >
                                                    <td
                                                        data-label="CODE"
                                                        style={{
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        {String(
                                                            comp.short_name ||
                                                                comp.code ||
                                                                "—",
                                                        )}
                                                    </td>
                                                    <td
                                                        data-label="COMPANY NAME"
                                                        className="view-all-primary-cell"
                                                    >
                                                        <div className="view-all-record-name">
                                                            <span>
                                                                {String(
                                                                    comp.name ||
                                                                        "",
                                                                )}
                                                            </span>
                                                            {isCurrent && (
                                                                <span className="view-all-current">
                                                                    Current
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td data-label="NTN / TAX NO.">
                                                        {String(
                                                            comp.fax_number ||
                                                                "4211-869",
                                                        )}
                                                    </td>
                                                    <td data-label="PHONE">
                                                        {String(
                                                            comp.contact_number ||
                                                                "—",
                                                        )}
                                                    </td>
                                                    <td
                                                        data-label="EMAIL / WEBSITE"
                                                        className="view-all-wide-cell"
                                                    >
                                                        {String(
                                                            comp.website || "—",
                                                        )}
                                                    </td>
                                                    <td
                                                        data-label="ADDRESS"
                                                        className="view-all-wide-cell"
                                                    >
                                                        {String(
                                                            comp.address || "—",
                                                        )}
                                                    </td>
                                                    <td
                                                        data-label="STATUS"
                                                        className="view-all-status-cell"
                                                    >
                                                        <StatusIndicator
                                                            active={
                                                                comp.status !==
                                                                false
                                                            }
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
