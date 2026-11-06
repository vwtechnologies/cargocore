import { ApiError } from "../lib/types";
import { useState, useEffect } from "react";
import {
    useParams,
    useNavigate,
    Link,
    useSearchParams,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Building2,
    Users,
    Landmark,
    Globe2,
    FolderKanban,
} from "../components/icons";
import { useDirty } from "../lib/dirty";
import { useSession } from "../lib/session";
import { managementApi } from "../lib/api";
import type { RecordData, PageResult } from "../lib/types";
import {
    RecordGrid,
    RecordDetails,
    ChildSection,
    recordLabel,
} from "../components/Records";
import { ReferenceSelect } from "../components/ReferenceSelect";
import { SectionHeader, Loading, ErrorState, Badge } from "../components/ui";
import {
    Documents,
    EmployeeDetails,
    Associations,
    UserAccess,
} from "./PersonSections";
const descriptions: Record<string, string> = {
    companies: "Manage your companies and the businesses beneath them.",
    countries: "Keep countries and cities connected across your workspace.",
    banks: "Your banks, branches, and the people behind them.",
    people: "One person. Every business relationship, in one place.",
    markas: "A central register for your MARKA codes and descriptions.",
    "employee-types": "Organize the roles and designations of your team.",
    "business-types": "Define how people participate in your business.",
};
export function ModulePage() {
    const guard = useDirty();
    const { entity = "companies", id } = useParams();
    const { session, company } = useSession();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [tab, setTab] = useState("details");
    const [businessType, setBusinessType] = useState<unknown>(
        searchParams.get("business_type_id"),
    );
    const [filterCompany, setFilterCompany] = useState(
        !!searchParams.get("company_id"),
    );
    const definition = session.entities[entity];
    const query = useQuery({
        queryKey: ["record", entity, id],
        queryFn: () =>
            managementApi<{ data: RecordData }>(`/api/v1/${entity}/${id}`),
        enabled: !!id && !!definition,
    });
    const navigation = useQuery({
        queryKey: ["navigation", entity, id, searchParams.toString()],
        queryFn: () =>
            managementApi<{
                navigation: {
                    first: number | null;
                    previous: number | null;
                    next: number | null;
                    last: number | null;
                    position: number;
                    total: number;
                };
            }>(`/api/v1/${entity}?${searchParams}&position_of=${id}`),
        enabled: !!id && !!definition,
    });
    useEffect(() => {
        setTab("details");
    }, [entity, id]);
    useEffect(() => {
        if (query.error instanceof ApiError && query.error.status === 404) {
            navigate(`/${entity}`, { replace: true });
        }
    }, [query.error, entity, navigate]);
    if (!definition)
        return <ErrorState error={new Error("This module does not exist.")} />;
    if (!definition.capabilities.view)
        return (
            <ErrorState
                error={
                    new Error("You do not have permission to view this module.")
                }
            />
        );
    const record = query.isError ? undefined : query.data?.data;
    const tabs =
        entity === "people"
            ? [
                  ["details", "Personal details"],
                  ["contacts", "Contacts"],
                  ["documents", "Documents"],
                  ["accounts", "Bank accounts"],
                  ["associations", "Business associations"],
                  ["employee", "Employee details"],
                  ["access", "User access"],
              ]
            : entity === "banks"
              ? [
                    ["details", "Branches"],
                    ["officers", "Bank officers"],
                ]
              : [];
    const parent = id ? { entity, id: Number(id) } : undefined;
    return (
        <>
            <SectionHeader
                eyebrow={
                    entity === "people"
                        ? "PEOPLE & RELATIONSHIPS"
                        : [
                                "markas",
                                "countries",
                                "employee-types",
                                "business-types",
                            ].includes(entity)
                          ? "MASTER DATA"
                          : "ORGANIZATION"
                }
                title={id && record ? recordLabel(record) : definition.label}
                description={
                    id
                        ? entity !== "employee-types" && record?.code
                            ? `${record.code} · ${definition.label === "People" ? "Person profile" : "Master record"}`
                            : "Connected record details"
                        : descriptions[entity]
                }
            />
            {!id ? (
                <>
                    {entity === "people" && (
                        <div className="people-filters">
                            <div className="field">
                                <label>Business role</label>
                                <ReferenceSelect
                                    entity="business-types"
                                    value={businessType}
                                    onChange={setBusinessType}
                                />
                            </div>
                            <label className="filter-check">
                                <input
                                    type="checkbox"
                                    checked={filterCompany}
                                    onChange={(e) =>
                                        setFilterCompany(e.target.checked)
                                    }
                                />
                                Selected company only
                            </label>
                        </div>
                    )}
                    <RecordGrid
                        key={entity}
                        persistFilters
                        entity={entity}
                        title={`${definition.label} directory`}
                        subtitle="Search, select, and manage your records."
                        filters={
                            entity === "people"
                                ? {
                                      business_type_id: businessType,
                                      company_id: filterCompany
                                          ? company
                                          : undefined,
                                  }
                                : {}
                        }
                        onSelect={(r, filters) =>
                            navigate(`/${entity}/${r.id}?${filters}`)
                        }
                    />
                </>
            ) : (
                <>
                    <div className="record-nav">
                        <Link
                            to={`/${entity}?${searchParams}`}
                            className="text-button"
                        >
                            <ArrowLeft size={15} />
                            All {definition.label.toLowerCase()}
                        </Link>
                        <div className="nav-buttons">
                            <span className="muted">Browse records</span>
                            {navigation.data && (
                                <>
                                    <span className="muted">
                                        {navigation.data.navigation.position} of{" "}
                                        {navigation.data.navigation.total}
                                    </span>
                                    {(
                                        [
                                            [ChevronsLeft, "first", "First"],
                                            [
                                                ChevronLeft,
                                                "previous",
                                                "Previous",
                                            ],
                                            [ChevronRight, "next", "Next"],
                                            [ChevronsRight, "last", "Last"],
                                        ] as const
                                    ).map(([Icon, key, label]) => {
                                        const target =
                                            navigation.data.navigation[key];
                                        return (
                                            <button
                                                className="icon-button"
                                                key={key}
                                                aria-label={`${label} record`}
                                                title={`${label} record`}
                                                disabled={
                                                    !target ||
                                                    target === Number(id)
                                                }
                                                onClick={() =>
                                                    navigate(
                                                        `/${entity}/${target}?${searchParams}`,
                                                    )
                                                }
                                            >
                                                <Icon size={16} />
                                            </button>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    </div>
                    {query.isPending ? (
                        <Loading />
                    ) : query.error ? (
                        <ErrorState error={query.error} />
                    ) : (
                        record &&
                        parent && (
                            <div className="section-stack">
                                {entity !== "people" && (
                                    <RecordDetails
                                        key={record.id}
                                        entity={entity}
                                        record={record}
                                        onClose={() => navigate(`/${entity}`)}
                                    />
                                )}{" "}
                                {!!tabs.length && (
                                    <div
                                        className="tabs"
                                        role="tablist"
                                        aria-label="Record sections"
                                    >
                                        {tabs.map(([key, label]) => (
                                            <button
                                                key={key}
                                                role="tab"
                                                aria-selected={tab === key}
                                                tabIndex={tab === key ? 0 : -1}
                                                onKeyDown={(event) => {
                                                    if (
                                                        ![
                                                            "ArrowLeft",
                                                            "ArrowRight",
                                                            "Home",
                                                            "End",
                                                        ].includes(event.key)
                                                    )
                                                        return;
                                                    event.preventDefault();
                                                    const index =
                                                        tabs.findIndex(
                                                            ([value]) =>
                                                                value === key,
                                                        );
                                                    const next =
                                                        event.key === "Home"
                                                            ? 0
                                                            : event.key ===
                                                                "End"
                                                              ? tabs.length - 1
                                                              : (index +
                                                                    (event.key ===
                                                                    "ArrowRight"
                                                                        ? 1
                                                                        : -1) +
                                                                    tabs.length) %
                                                                tabs.length;
                                                    if (guard.discard()) {
                                                        setTab(tabs[next][0]);
                                                        (
                                                            event.currentTarget.parentElement?.querySelectorAll(
                                                                "button",
                                                            )[
                                                                next
                                                            ] as HTMLButtonElement
                                                        )?.focus();
                                                    }
                                                }}
                                                className={
                                                    tab === key ? "current" : ""
                                                }
                                                onClick={() => {
                                                    if (guard.discard())
                                                        setTab(key);
                                                }}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {entity === "companies" && (
                                    <ChildSection
                                        entity="sub-companies"
                                        parent={parent}
                                        title="Sub-companies"
                                    />
                                )}
                                {entity === "countries" && (
                                    <ChildSection
                                        entity="cities"
                                        parent={parent}
                                        title="Cities"
                                    />
                                )}
                                {entity === "banks" &&
                                    (tab === "officers" ? (
                                        <ChildSection
                                            entity="officers"
                                            parent={parent}
                                            title="Bank-wide officers"
                                        />
                                    ) : (
                                        <ChildSection
                                            entity="branches"
                                            parent={parent}
                                            title="Bank branches"
                                        >
                                            {(branch) => (
                                                <div className="nested-section">
                                                    <ChildSection
                                                        entity="officers"
                                                        parent={parent}
                                                        filters={{
                                                            bank_branch_id:
                                                                branch.id,
                                                        }}
                                                        createDefaults={{
                                                            bank_branch_id:
                                                                branch.id,
                                                        }}
                                                        title={`Officers · ${branch.name}`}
                                                    />
                                                </div>
                                            )}
                                        </ChildSection>
                                    ))}
                                {entity === "people" &&
                                    (tab === "details" ? (
                                        <>
                                            <RecordDetails
                                                entity={entity}
                                                record={record}
                                                onClose={() =>
                                                    navigate("/people")
                                                }
                                            />
                                            <Documents
                                                person={record.id}
                                                imagesOnly
                                            />
                                        </>
                                    ) : tab === "contacts" ? (
                                        <ChildSection
                                            entity="contacts"
                                            parent={parent}
                                            title="Contact information"
                                        />
                                    ) : tab === "documents" ? (
                                        <Documents person={record.id} />
                                    ) : tab === "accounts" ? (
                                        <ChildSection
                                            entity="accounts"
                                            parent={parent}
                                            title="Bank accounts"
                                        />
                                    ) : tab === "associations" ? (
                                        <Associations person={record.id} />
                                    ) : tab === "employee" ? (
                                        <EmployeeDetails person={record.id} />
                                    ) : (
                                        <UserAccess person={record.id} />
                                    ))}
                            </div>
                        )
                    )}
                </>
            )}
        </>
    );
}
