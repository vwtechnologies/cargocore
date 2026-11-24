import { useState, type Ref } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ReferenceSelect } from "../components/ReferenceSelect";
import { RelatedDetailTable } from "../components/RelatedDetailTable";
import { bankAccountCategories } from "../components/BankAccountSummary";
import { display, managementApi, params } from "../lib/api";
import { useSession } from "../lib/session";
import type { PageResult, RecordData } from "../lib/types";

export const emptyCompany = {
    name: "",
    short_name: "",
    type: "",
    parent_company_id: null as unknown,
    ntn: "",
    strn: "",
    weboc_id: "",
    psw_id: "",
    address: "",
    contact_number: "",
    fax_number: "",
    website: "",
    status: true,
    is_default: false,
};
export type CompanyFormData = typeof emptyCompany;
export function companyValues(record?: RecordData): CompanyFormData {
    return Object.fromEntries(
        Object.entries(emptyCompany).map(([key, fallback]) => [
            key,
            record?.[key] ?? fallback,
        ]),
    ) as CompanyFormData;
}
const tabs = [
    ["details", "Company Details"],
    ["contacts", "Contacts & Emails"],
    ["addresses", "Addresses"],
    ["owners", "Owners / Representatives"],
    ["tax", "Tax & Registrations"],
    ["banking", "Bank Accounts"],
] as const;

/** Read-only list of the company's accounts from the unified bank account register. */
function CompanyBankAccounts({ company }: { company: number }) {
    const accounts = useQuery({
        queryKey: ["company-bank-accounts", company],
        queryFn: () =>
            managementApi<PageResult>(
                `/api/v1/bank-accounts?${params({ company_id: company, per_page: 100, sort: "account_title" })}`,
            ),
    });
    const rows = accounts.data?.data ?? [];
    return (
        <section
            className="card company-bank-accounts"
            aria-label="Company bank accounts"
        >
            <div className="table-toolbar">
                <h3 className="company-card-title">Bank Accounts</h3>
                <Link className="btn secondary small" to="/bank-accounts">
                    Open Bank Accounts
                </Link>
            </div>
            {accounts.isLoading ? (
                <p className="muted">Loading bank accounts…</p>
            ) : accounts.isError ? (
                <p className="notice">{accounts.error.message}</p>
            ) : !rows.length ? (
                <p className="notice">
                    No bank accounts are linked to this company yet.
                </p>
            ) : (
                <div className="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Account Title</th>
                                <th>Bank / Branch</th>
                                <th>Account Number</th>
                                <th>IBAN</th>
                                <th>Address Used for Banking</th>
                                <th>Categories</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((account) => (
                                <tr key={account.id}>
                                    <td>
                                        <Link
                                            to={`/bank-accounts/${account.id}`}
                                        >
                                            {display(account.account_title)}
                                        </Link>
                                    </td>
                                    <td>
                                        {display(account.bank_name)}
                                        <br />
                                        <span className="muted">
                                            {display(account.branch_name)}
                                        </span>
                                    </td>
                                    <td className="code-value">
                                        {display(account.account_number)}
                                    </td>
                                    <td className="code-value">
                                        {display(account.iban)}
                                    </td>
                                    <td>
                                        {account.company_address_title ? (
                                            <>
                                                <strong>
                                                    {String(
                                                        account.company_address_title,
                                                    )}
                                                </strong>
                                                <br />
                                                <span className="muted">
                                                    {display(
                                                        account.company_address,
                                                    )}
                                                </span>
                                            </>
                                        ) : (
                                            "—"
                                        )}
                                    </td>
                                    <td>
                                        <div className="bank-account-categories">
                                            {bankAccountCategories
                                                .filter(([key]) => account[key])
                                                .map(([key, label]) => (
                                                    <span
                                                        key={key}
                                                        className={
                                                            key ===
                                                            "is_our_account"
                                                                ? "our-account-badge"
                                                                : "value-chip"
                                                        }
                                                    >
                                                        {label}
                                                    </span>
                                                ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

export function CompanyProfile({
    company,
    value,
    onChange,
    editable,
    busy,
    firstInputRef,
}: {
    company?: number;
    value: CompanyFormData;
    onChange: (value: CompanyFormData) => void;
    editable: boolean;
    busy: boolean;
    firstInputRef: Ref<HTMLInputElement>;
}) {
    const [tab, setTab] = useState("details");
    const { session } = useSession();
    const canViewBankAccounts = !!session.entities["bank-accounts"];
    const visibleTabs = tabs.filter(
        ([key]) => key !== "banking" || canViewBankAccounts,
    );
    const change = (key: keyof CompanyFormData, next: unknown) =>
        onChange({ ...value, [key]: next });
    const input = (
        key: keyof CompanyFormData,
        label: string,
        required = false,
    ) => (
        <div className="company-field" key={key}>
            <label htmlFor={`company-${key}`}>
                {label}
                {required && <span className="required"> *</span>}
            </label>
            <input
                id={`company-${key}`}
                aria-label={label}
                ref={key === "name" ? firstInputRef : undefined}
                readOnly={!editable}
                disabled={busy}
                required={required}
                value={String(value[key] ?? "")}
                maxLength={
                    key === "name"
                        ? 255
                        : key === "short_name" || key === "fax_number"
                          ? 50
                          : key === "website"
                            ? 255
                            : 100
                }
                onChange={(event) => change(key, event.target.value)}
            />
        </div>
    );
    const detailTable = (entity: string, title: string) =>
        company ? (
            <RelatedDetailTable
                key={`${company}-${entity}`}
                entity={entity}
                title={title}
                parent={{ entity: "companies", id: company }}
                filters={{}}
                createDefaults={{ status: true }}
                onSelect={() => {}}
            />
        ) : (
            <p className="notice">
                Save the company details before adding {title.toLowerCase()}.
            </p>
        );
    return (
        <div className="company-profile">
            <div
                className="person-tabs company-profile-tabs"
                role="tablist"
                aria-label="Company Information"
            >
                {visibleTabs.map(([key, title]) => (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        id={`company-tab-${key}`}
                        aria-selected={tab === key}
                        aria-controls={`company-panel-${key}`}
                        tabIndex={tab === key ? 0 : -1}
                        onClick={() => setTab(key)}
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
                            event.stopPropagation();
                            const index = visibleTabs.findIndex(
                                ([id]) => id === tab,
                            );
                            const next =
                                event.key === "Home"
                                    ? 0
                                    : event.key === "End"
                                      ? visibleTabs.length - 1
                                      : (index +
                                            (event.key === "ArrowRight"
                                                ? 1
                                                : -1) +
                                            visibleTabs.length) %
                                        visibleTabs.length;
                            setTab(visibleTabs[next][0]);
                            document
                                .getElementById(
                                    `company-tab-${visibleTabs[next][0]}`,
                                )
                                ?.focus();
                        }}
                    >
                        {title}
                    </button>
                ))}
            </div>
            <div
                role="tabpanel"
                id="company-panel-details"
                aria-labelledby="company-tab-details"
                hidden={tab !== "details"}
            >
                <div className="form-grid company-profile-fields">
                    {input("name", "Company Name", true)}
                    {input("short_name", "Short Name")}
                    <div className="company-field">
                        <label htmlFor="company-type">Type</label>
                        <input
                            id="company-type"
                            aria-label="Type"
                            list="company-type-options"
                            readOnly={!editable}
                            disabled={busy}
                            maxLength={80}
                            value={value.type}
                            onChange={(event) =>
                                change("type", event.target.value)
                            }
                        />
                        <datalist id="company-type-options">
                            {[
                                "PRIVATE LIMITED",
                                "PUBLIC LIMITED",
                                "PARTNERSHIP",
                                "SOLE PROPRIETORSHIP",
                                "OTHER",
                            ].map((type) => (
                                <option key={type} value={type} />
                            ))}
                        </datalist>
                    </div>
                    <div className="company-field">
                        <label htmlFor="company-parent">Parent Company</label>
                        <ReferenceSelect
                            id="company-parent"
                            label="Parent Company"
                            entity="companies"
                            value={value.parent_company_id}
                            readOnly={!editable}
                            disabled={busy}
                            clearUnavailable={false}
                            onChange={(next) =>
                                change("parent_company_id", next)
                            }
                        />
                    </div>
                    <div className="company-field">
                        <label>Status</label>
                        <div className="company-toggle-switch">
                            <button
                                type="button"
                                role="switch"
                                aria-label="Company status"
                                aria-checked={value.status}
                                disabled={!editable || busy}
                                className={`switch-track ${value.status ? "active" : ""}`}
                                onClick={() => change("status", !value.status)}
                            >
                                <span className="switch-knob" />
                            </button>
                            <span>{value.status ? "Active" : "Inactive"}</span>
                        </div>
                    </div>
                    <div className="company-field">
                        <label>Set As Default</label>
                        <div className="company-toggle-switch">
                            <button
                                type="button"
                                role="switch"
                                aria-label="Default company"
                                aria-checked={value.is_default}
                                disabled={!editable || busy || !value.status}
                                className={`switch-track ${value.is_default ? "active" : ""}`}
                                onClick={() =>
                                    change("is_default", !value.is_default)
                                }
                            >
                                <span className="switch-knob" />
                            </button>
                            <span>
                                {value.is_default ? "Default" : "Not Default"}
                            </span>
                        </div>
                    </div>
                    {input("website", "Website")}
                    {input("fax_number", "Fax Number")}
                </div>
            </div>
            <div
                role="tabpanel"
                id="company-panel-contacts"
                aria-labelledby="company-tab-contacts"
                hidden={tab !== "contacts"}
                className="section-stack"
            >
                {detailTable("company-contacts", "Contact Numbers")}
                {detailTable("company-emails", "Emails")}
            </div>
            <div
                role="tabpanel"
                id="company-panel-addresses"
                aria-labelledby="company-tab-addresses"
                hidden={tab !== "addresses"}
            >
                {detailTable("company-addresses", "Addresses")}
            </div>
            <div
                role="tabpanel"
                id="company-panel-owners"
                aria-labelledby="company-tab-owners"
                hidden={tab !== "owners"}
            >
                {detailTable("company-owners", "Owners / Representatives")}
            </div>
            <div
                role="tabpanel"
                id="company-panel-tax"
                aria-labelledby="company-tab-tax"
                hidden={tab !== "tax"}
            >
                <div className="form-grid company-profile-fields">
                    {input("ntn", "NTN")}
                    {input("strn", "STRN")}
                    {input("weboc_id", "WeBOC ID")}
                    {input("psw_id", "PSW ID")}
                </div>
            </div>
            {canViewBankAccounts && (
                <div
                    role="tabpanel"
                    id="company-panel-banking"
                    aria-labelledby="company-tab-banking"
                    hidden={tab !== "banking"}
                >
                    {company ? (
                        tab === "banking" && (
                            <CompanyBankAccounts company={company} />
                        )
                    ) : (
                        <p className="notice">
                            Save the company details before linking bank
                            accounts.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
