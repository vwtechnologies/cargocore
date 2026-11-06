import { titleCaseLabel } from "../lib/labels";
import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Globe,
    Plus,
    Pencil,
    Trash2,
    Check,
    X,
    Search,
} from "../components/icons";
import { toast } from "sonner";
import { useDirty } from "../lib/dirty";
import { useSession } from "../lib/session";
import {
    EditableDetailTable,
    InlineStatus,
    type DetailTableHandle,
    type DetailColumn,
} from "../components/EditableDetailTable";
import { api, managementApi, params } from "../lib/api";
import { ApiError } from "../lib/types";
import type { PageResult, RecordData } from "../lib/types";
import { Badge, Confirm, useDebounced } from "../components/ui";
import {
    MasterDetailShell,
    type MasterColumn,
    type ViewAllColumn,
} from "../components/MasterDetailShell";

interface CountryFormData {
    name: string;
    short_name: string;
    display_sequence: number | "";
    status: boolean;
}

interface CityFormData {
    name: string;
    short_name_1: string;
    short_name_2: string;
    status: boolean;
}

const emptyCity = (): CityFormData => ({
    name: "",
    short_name_1: "",
    short_name_2: "",
    status: true,
});

export function CountriesPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const cache = useQueryClient();
    const guard = useDirty();
    const { session } = useSession();
    const cityTable = useRef<DetailTableHandle>(null);

    const [search, setSearch] = useState("");
    const [citySearch, setCitySearch] = useState("");
    const citySearchTerm = useDebounced(citySearch);
    const debouncedSearch = useDebounced(search);
    const [page, setPage] = useState(1);

    // Country edit / create states
    const [isEditing, setIsEditing] = useState(false);
    const editVersion = useRef(0);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState<CountryFormData>({
        name: "",
        short_name: "",
        display_sequence: 1,
        status: true,
    });

    const firstInputRef = useRef<HTMLInputElement | null>(null);

    // Country delete modal
    const [deletingCountry, setDeletingCountry] = useState(false);

    const [deletingCity, setDeletingCity] = useState<RecordData | null>(null);

    // Query Countries (max 25 per page)
    const { data: countriesData, isLoading: isCountriesLoading } = useQuery({
        queryKey: ["countries", debouncedSearch, page],
        queryFn: () =>
            managementApi<PageResult<RecordData>>(
                `/api/v1/countries?${params({
                    search: debouncedSearch,
                    page,
                    per_page: 25,
                })}`,
            ),
    });

    // Query all countries for View All directory modal
    const { data: allCountriesData } = useQuery({
        queryKey: ["all-countries"],
        queryFn: () =>
            managementApi<PageResult<RecordData>>(
                "/api/v1/countries?per_page=100",
            ),
    });

    const countries = useMemo(
        () => countriesData?.data || [],
        [countriesData?.data],
    );
    const allCountries = useMemo(
        () => allCountriesData?.data || countries,
        [allCountriesData?.data, countries],
    );
    const totalRecords = countriesData?.meta?.total || countries.length;
    const lastPage = countriesData?.meta?.last_page || 1;

    const displayOrderOptions = useMemo(() => {
        const countryCount = allCountriesData?.meta.total ?? totalRecords;
        const options = Array.from(
            { length: Math.max(1, countryCount + (isCreating ? 1 : 0)) },
            (_, index) => index + 1,
        );
        const storedOrders = allCountries
            .map((country) => Number(country.display_sequence))
            .filter((order) => Number.isInteger(order) && order > 0);
        options.push(...storedOrders);
        if (isCreating && storedOrders.length) {
            options.push(Math.max(...storedOrders) + 1);
        }
        const current = formData.display_sequence;
        if (typeof current === "number" && !options.includes(current)) {
            options.push(current);
        }
        return [...new Set(options)].sort((first, second) => first - second);
    }, [
        allCountriesData?.meta.total,
        allCountries,
        totalRecords,
        isCreating,
        formData.display_sequence,
    ]);

    const { data: countryRecord, error: countryError } = useQuery({
        queryKey: ["country-record", id],
        queryFn: () =>
            managementApi<{ data: RecordData }>(`/api/v1/countries/${id}`),
        enabled: !!id && !isCreating,
    });

    // Selected country
    const selectedCountry = useMemo(() => {
        if (
            isCreating ||
            (countryError instanceof ApiError && countryError.status === 404)
        )
            return null;
        if (id) {
            return (
                countryRecord?.data ??
                countries.find((c) => String(c.id) === String(id)) ??
                null
            );
        }
        return countries[0] || null;
    }, [countries, countryRecord, countryError, id, isCreating]);

    useEffect(() => {
        if (
            id &&
            countryError instanceof ApiError &&
            countryError.status === 404
        ) {
            setIsEditing(false);
            navigate("/countries", { replace: true });
        }
    }, [id, countryRecord, countryError, navigate]);

    // Query Cities for selected country
    const { data: citiesData, isLoading: isCitiesLoading } = useQuery({
        queryKey: ["cities", selectedCountry?.id, citySearchTerm],
        queryFn: () =>
            managementApi<PageResult<RecordData>>(
                `/api/v1/countries/${selectedCountry?.id}/cities?${params({ per_page: 100, search: citySearchTerm })}`,
            ),
        enabled: !!selectedCountry?.id && !isCreating,
    });

    const cities = useMemo(() => citiesData?.data || [], [citiesData?.data]);

    // Sync formData with selected country
    useEffect(() => {
        if (!selectedCountry && !isCreating && !isEditing) {
            setFormData({
                name: "",
                short_name: "",
                display_sequence: 1,
                status: true,
            });
        }
        if (selectedCountry && !isCreating && !isEditing) {
            setFormData({
                name: String(selectedCountry.name || ""),
                short_name: String(selectedCountry.short_name || ""),
                display_sequence: Number(selectedCountry.display_sequence ?? 1),
                status: selectedCountry.status !== false,
            });
        }
    }, [selectedCountry, isCreating, isEditing]);

    // Country Mutations
    const saveCountryMutation = useMutation({
        mutationFn: async () => {
            if (!formData.name.trim()) {
                throw new Error("Country name is required.");
            }
            if (
                formData.display_sequence === "" ||
                !Number.isInteger(formData.display_sequence) ||
                formData.display_sequence < 1
            ) {
                throw new Error(
                    "Display order must be a whole number of one or greater.",
                );
            }
            if (isCreating) {
                return api<{ data: RecordData }>("/api/v1/countries", {
                    method: "POST",
                    body: JSON.stringify(formData),
                });
            } else {
                if (!selectedCountry) throw new Error("No country selected.");
                return api<{ data: RecordData }>(
                    `/api/v1/countries/${selectedCountry.id}`,
                    {
                        method: "PUT",
                        body: JSON.stringify({
                            ...formData,
                            version: editVersion.current,
                        }),
                    },
                );
            }
        },
        onSuccess: (data) => {
            cache.invalidateQueries({ queryKey: ["countries"] });
            cache.invalidateQueries({ queryKey: ["all-countries"] });
            const saved = data.data;
            cache.setQueryData(["country-record", String(saved.id)], data);
            if (isCreating) {
                setIsCreating(false);
                setIsEditing(false);
                toast.success("Country created successfully");
            } else {
                setIsEditing(false);
                toast.success("Country updated successfully");
            }
            navigate(`/countries/${saved.id}`);
        },
        onError: (err: unknown) => {
            const message =
                err instanceof Error ? err.message : "Failed to save country";
            toast.error(message);
        },
    });

    const deleteCountryMutation = useMutation({
        mutationFn: async () => {
            if (!selectedCountry) return;
            return api(`/api/v1/countries/${selectedCountry.id}`, {
                method: "DELETE",
                body: JSON.stringify({ version: selectedCountry.version }),
            });
        },
        onSuccess: () => {
            cache.invalidateQueries({ queryKey: ["countries"] });
            cache.invalidateQueries({ queryKey: ["all-countries"] });
            toast.success("Country deleted successfully");
            setDeletingCountry(false);
            setIsCreating(false);
            setIsEditing(false);
            const remaining = countries.filter(
                (c) => c.id !== selectedCountry?.id,
            );
            if (remaining.length > 0) {
                navigate(`/countries/${remaining[0].id}`);
            } else {
                navigate("/countries");
            }
        },
        onError: (err: unknown) => {
            const message =
                err instanceof Error ? err.message : "Failed to delete country";
            toast.error(message);
        },
    });

    const deleteCityMutation = useMutation({
        mutationFn: async (city: RecordData) => {
            if (!selectedCountry) return;
            return api(
                `/api/v1/countries/${selectedCountry.id}/cities/${city.id}`,
                {
                    method: "DELETE",
                    body: JSON.stringify({ version: city.version }),
                },
            );
        },
        onSuccess: () => {
            cache.invalidateQueries({
                queryKey: ["cities", selectedCountry?.id],
            });
            toast.success("City deleted successfully");
            setDeletingCity(null);
        },
        onError: (err: unknown) => {
            const message =
                err instanceof Error ? err.message : "Failed to delete city";
            toast.error(message);
        },
    });

    // Navigation Handlers
    const handleNewCountry = () => {
        if (!guard.discard()) return;
        cityTable.current?.reset();
        setIsCreating(true);
        setIsEditing(false);
        setFormData({
            name: "",
            short_name: "",
            display_sequence: 1,
            status: true,
        });
        setTimeout(() => {
            firstInputRef.current?.focus();
        }, 50);
    };

    const handleEditCountry = () => {
        if (!selectedCountry || !guard.discard()) return;
        cityTable.current?.reset();
        editVersion.current = selectedCountry!.version;
        setIsEditing(true);
        setIsCreating(false);
        setFormData({
            name: String(selectedCountry.name || ""),
            short_name: String(selectedCountry.short_name || ""),
            display_sequence: Number(selectedCountry.display_sequence ?? 1),
            status: selectedCountry.status !== false,
        });
        setTimeout(() => {
            firstInputRef.current?.focus();
        }, 50);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setIsCreating(false);
        if (selectedCountry) {
            setFormData({
                name: String(selectedCountry.name || ""),
                short_name: String(selectedCountry.short_name || ""),
                display_sequence: Number(selectedCountry.display_sequence ?? 1),
                status: selectedCountry.status !== false,
            });
        }
    };

    const handleSelectItem = (c: RecordData) => {
        if (!guard.discard()) return;
        setIsCreating(false);
        setIsEditing(false);
        navigate(`/countries/${c.id}`);
    };

    // Columns for Master List Table
    const masterColumns: MasterColumn<RecordData>[] = [
        {
            key: "short_name",
            label: "Short Name",
            width: "30%",
            className: "code-cell",
            render: (c) => String(c.short_name || "—"),
        },
        {
            key: "name",
            label: "Country Name",
            width: "45%",
            className: "name-cell",
            render: (c) => (
                <button
                    type="button"
                    className="company-row-btn"
                    aria-label={String(c.name || "")}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleSelectItem(c);
                    }}
                >
                    {String(c.name || "")}
                </button>
            ),
        },
        {
            key: "display_sequence",
            label: "Order",
            width: "25%",
            render: (c) => String(c.display_sequence ?? "—"),
        },
    ];

    // Columns for View All Modal
    const viewAllColumns: ViewAllColumn<RecordData>[] = [
        { key: "short_name", label: "Short Name", width: "20%" },
        { key: "name", label: "Country Name", width: "40%" },
        { key: "display_sequence", label: "Display Order", width: "20%" },
        {
            key: "status",
            label: "Status",
            width: "20%",
            render: (country) => (country.status ? "Active" : "Inactive"),
        },
    ];

    const cityColumns: DetailColumn<CityFormData>[] = [
        ...(
            [
                ["name", "City Name"],
                ["short_name_1", "Short Name 1"],
                ["short_name_2", "Short Name 2"],
            ] as const
        ).map(([key, label]) => ({
            key,
            label: titleCaseLabel(label),
            render: (_record: RecordData, value: CityFormData) =>
                value[key] || "—",
            editor: (
                value: CityFormData,
                change: (key: keyof CityFormData, value: unknown) => void,
            ) => (
                <input
                    aria-label={label}
                    maxLength={key === "name" ? 255 : 50}
                    required={key === "name"}
                    value={value[key]}
                    onChange={(event) => change(key, event.target.value)}
                />
            ),
        })),
        {
            key: "status",
            label: "Status",
            width: "110px",
            render: (_record, value) => (
                <Badge
                    active={value.status}
                    label={value.status ? "Active" : "Inactive"}
                />
            ),
            editor: (value, change) => (
                <InlineStatus
                    label="City Status"
                    value={value.status}
                    onChange={(status) => change("status", status)}
                />
            ),
        },
    ];
    const handleSaveShortcut = () => {
        if (cityTable.current?.hasActive()) cityTable.current.saveActive();
        else if (isEditing || isCreating) saveCountryMutation.mutate();
    };

    return (
        <MasterDetailShell
            title="Countries"
            icon={<Globe size={22} />}
            backTo="/"
            isEditing={isEditing}
            isCreating={isCreating}
            isSaving={saveCountryMutation.isPending}
            hasSelectedItem={!!selectedCountry}
            canCreate={session.entities.countries.capabilities.create}
            canUpdate={session.entities.countries.capabilities.update}
            canDelete={session.entities.countries.capabilities.delete}
            onStartCreate={handleNewCountry}
            onStartEdit={handleEditCountry}
            onSave={() => saveCountryMutation.mutate()}
            onSaveShortcut={handleSaveShortcut}
            onCancel={handleCancelEdit}
            onDelete={() => setDeletingCountry(true)}
            newAriaLabel="Add record"
            listHeading="Countries"
            items={countries}
            columns={masterColumns}
            selectedId={selectedCountry?.id ?? null}
            onSelectItem={handleSelectItem}
            isLoading={isCountriesLoading}
            search={search}
            onSearchChange={(val) => {
                setSearch(val);
                setPage(1);
            }}
            searchAriaLabel="Search records"
            searchPlaceholder="Search records…"
            page={page}
            lastPage={lastPage}
            totalRecords={totalRecords}
            onPageChange={setPage}
            viewAllItems={allCountries}
            viewAllColumns={viewAllColumns}
            onSelectFromViewAll={(c) => {
                setIsCreating(false);
                setIsEditing(false);
                navigate(`/countries/${c.id}`);
            }}
            isDeleting={deletingCountry}
            onCloseDelete={() => setDeletingCountry(false)}
            onConfirmDelete={() => deleteCountryMutation.mutate()}
            deleteTitle="Delete Country?"
            deleteDescription={`Are you sure you want to delete ${selectedCountry?.name}? Countries with linked cities cannot be deleted.`}
            isDeletingBusy={deleteCountryMutation.isPending}
        >
            {/* Right Panel Detail Card (Uniform structure matching Companies) */}
            <div
                className="company-card"
                {...(isCreating
                    ? {
                          role: "dialog",
                          "aria-label": "New country",
                      }
                    : {})}
            >
                {/* Dark Card Header */}
                <div className="company-card-header">
                    <h2 className="company-card-title">
                        {isCreating
                            ? "New Country"
                            : String(selectedCountry?.name || "—")}
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

                {/* Country Form Fields */}
                <div className="company-card-body">
                    <div className="country-fields-grid country-primary-fields">
                        <div className="company-field">
                            <label htmlFor="country-name">
                                Country Name{" "}
                                <span className="req-star" aria-hidden="true">
                                    *
                                </span>
                            </label>
                            <input
                                ref={firstInputRef}
                                id="country-name"
                                aria-label="Country Name"
                                type="text"
                                maxLength={255}
                                readOnly={!isEditing && !isCreating}
                                value={formData.name}
                                required
                                placeholder="Enter country name"
                                onChange={(event) =>
                                    setFormData((data) => ({
                                        ...data,
                                        name: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="company-field">
                            <label htmlFor="country-short-name">
                                Short Name
                            </label>
                            <input
                                id="country-short-name"
                                aria-label="Short Name"
                                type="text"
                                maxLength={20}
                                readOnly={!isEditing && !isCreating}
                                value={formData.short_name}
                                placeholder="e.g. PK"
                                onChange={(event) =>
                                    setFormData((data) => ({
                                        ...data,
                                        short_name: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="company-field">
                            <label htmlFor="country-display-order">
                                Display Order
                            </label>
                            <select
                                id="country-display-order"
                                aria-label="Display Order"
                                disabled={!isEditing && !isCreating}
                                value={formData.display_sequence}
                                onChange={(event) =>
                                    setFormData((data) => ({
                                        ...data,
                                        display_sequence: Number(
                                            event.target.value,
                                        ),
                                    }))
                                }
                            >
                                {displayOrderOptions.map((order) => (
                                    <option key={order} value={order}>
                                        {order}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {/* Active Status Switch */}
                        <div className="company-field country-status-field">
                            <span className="company-toggle-label">Status</span>
                            <div className="company-toggle-switch">
                                <button
                                    type="button"
                                    role="switch"
                                    aria-label="Country status"
                                    aria-checked={formData.status}
                                    disabled={!isEditing && !isCreating}
                                    className={`switch-track ${formData.status ? "active" : ""} ${isEditing || isCreating ? "interactive" : ""}`}
                                    onClick={() => {
                                        if (isEditing || isCreating) {
                                            setFormData((d) => ({
                                                ...d,
                                                status: !d.status,
                                            }));
                                        }
                                    }}
                                    style={{ border: "none", padding: 0 }}
                                >
                                    <span className="switch-knob" />
                                </button>
                                <span className="switch-text">
                                    {formData.status ? "Active" : "Inactive"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Card: Cities Table (Inline Add & Inline Edit) */}
            {selectedCountry && !isCreating && (
                <div
                    className="company-card subcompanies-card"
                    data-detail-record-region
                >
                    <div className="company-card-header">
                        <div className="company-card-header-left">
                            <h3 className="company-card-title">Cities</h3>
                        </div>

                        <button
                            type="button"
                            className="btn-subcompany-add"
                            aria-label="Add record"
                            disabled={
                                !selectedCountry.status ||
                                !session.entities.cities.capabilities.create
                            }
                            onClick={() => cityTable.current?.create()}
                        >
                            <Plus size={15} />
                            <span>Add Row</span>
                        </button>
                    </div>

                    <div className="table-toolbar">
                        <div className="search-input">
                            <Search size={16} />
                            <input
                                aria-label="Search Cities"
                                placeholder="Search cities…"
                                value={citySearch}
                                onChange={(event) =>
                                    setCitySearch(event.target.value)
                                }
                            />
                        </div>
                    </div>
                    <EditableDetailTable<CityFormData>
                        key={selectedCountry.id}
                        controllerRef={cityTable}
                        title="Cities"
                        singular="City"
                        rows={cities}
                        columns={cityColumns}
                        loading={isCitiesLoading}
                        values={(record) =>
                            record
                                ? {
                                      name: String(record.name ?? ""),
                                      short_name_1: String(
                                          record.short_name_1 ?? "",
                                      ),
                                      short_name_2: String(
                                          record.short_name_2 ?? "",
                                      ),
                                      status: record.status !== false,
                                  }
                                : emptyCity()
                        }
                        canCreate={
                            session.entities.cities.capabilities.create &&
                            selectedCountry.status
                        }
                        canUpdate={session.entities.cities.capabilities.update}
                        canDelete={session.entities.cities.capabilities.delete}
                        onDelete={setDeletingCity}
                        onReload={async (record) =>
                            (
                                await managementApi<{ data: RecordData }>(
                                    `/api/v1/countries/${selectedCountry.id}/cities/${record.id}`,
                                )
                            ).data
                        }
                        onSave={async (value, record) => {
                            const response = await api<{ data: RecordData }>(
                                `/api/v1/countries/${selectedCountry.id}/cities${record ? `/${record.id}` : ""}`,
                                {
                                    method: record ? "PUT" : "POST",
                                    body: JSON.stringify({
                                        name: value.name.trim(),
                                        short_name_1:
                                            value.short_name_1.trim() || null,
                                        short_name_2:
                                            value.short_name_2.trim() || null,
                                        status: value.status,
                                        ...(record
                                            ? {
                                                  code: record.code,
                                                  version: record.version,
                                              }
                                            : {}),
                                    }),
                                },
                            );
                            return response.data;
                        }}
                    />
                </div>
            )}

            {/* City Delete Modal */}
            <Confirm
                open={!!deletingCity}
                title="Delete City"
                description={`Are you sure you want to delete ${deletingCity?.name}?`}
                busy={deleteCityMutation.isPending}
                onClose={() => setDeletingCity(null)}
                onConfirm={() => {
                    if (deletingCity) deleteCityMutation.mutate(deletingCity);
                }}
            />
        </MasterDetailShell>
    );
}
