import type { ReactNode } from "react";
import { display, money } from "../lib/api";
import type { RecordData } from "../lib/types";

export const bankAccountCategories = [
    ["is_our_account", "Our Account"],
    ["is_cheque", "Cheque"],
    ["is_beneficiary", "Beneficiary"],
    ["is_employee", "Employee"],
    ["is_company", "Company"],
    ["is_other", "Other"],
] as const;

function withCode(name: unknown, code: unknown): string {
    const label = display(name);
    return code ? `${label} (${String(code)})` : label;
}

/** Read-only view of one record from the unified bank account register. */
export function BankAccountSummary({ record }: { record: RecordData }) {
    const categories = bankAccountCategories.filter(([key]) => record[key]);
    const rows: [string, ReactNode, string?][] = [
        ["Bank", withCode(record.bank_name, record.bank_code)],
        ["Branch", withCode(record.branch_name, record.branch_code)],
        [
            "Country / City",
            `${display(record.country_name)} / ${display(record.city_name)}`,
        ],
        ["Account Number", display(record.account_number), "code-value"],
        ["IBAN", display(record.iban), "code-value"],
        ["Account Title", display(record.account_title)],
        ["Short Title", display(record.short_title)],
        ["Account Type", display(record.account_type)],
        ["Status", record.status === false ? "Inactive" : "Active"],
        ["Account Holder", display(record.account_holder_name)],
        ["Holder CNIC / NIC", display(record.account_holder_cnic), "code-value"],
        ["Authorized Signatory", display(record.authorized_signatory_name)],
        [
            "Signatory CNIC",
            display(record.authorized_signatory_cnic),
            "code-value",
        ],
        ["Linked Person", display(record.person_name)],
        ["Opening Balance Date", display(record.opening_balance_date)],
        ["Opening Balance", money(record.opening_balance)],
    ];
    return (
        <div className="bank-account-summary">
            <div className="bank-account-categories">
                {record.is_our_account === true && (
                    <span className="our-account-badge">
                        Our Company Account
                    </span>
                )}
                {categories.map(([key, label]) => (
                    <span key={key} className="value-chip">
                        {label}
                    </span>
                ))}
                {!categories.length && (
                    <span className="muted">No category selected</span>
                )}
            </div>
            {!!record.company_id && (
                <section
                    className="bank-account-company"
                    aria-label="Account company"
                >
                    <dl className="detail-grid">
                        <div>
                            <dt>Company</dt>
                            <dd>{display(record.company_name)}</dd>
                        </div>
                        <div>
                            <dt>Address Used for Banking</dt>
                            <dd>
                                {record.company_address_title ? (
                                    <>
                                        <strong>
                                            {String(
                                                record.company_address_title,
                                            )}
                                        </strong>
                                        <br />
                                        {display(record.company_address)}
                                    </>
                                ) : (
                                    "—"
                                )}
                            </dd>
                        </div>
                    </dl>
                </section>
            )}
            <dl className="detail-grid">
                {rows.map(([label, value, className]) => (
                    <div key={label}>
                        <dt>{label}</dt>
                        <dd className={className}>{value}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}
