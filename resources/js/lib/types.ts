import type { CompaniesRecord } from "./contracts.generated";
export type RecordData = Pick<CompaniesRecord, "id" | "version" | "status"> & {
    code?: string;
    name?: string;
    [key: string]: unknown;
};
export type Field = {
    label: string;
    type?: string;
    required?: boolean;
    max?: number;
    min?: number;
    default?: unknown;
    entity?: string;
    depends?: string;
    options?: string[];
    virtual?: boolean;
    immutable?: boolean;
};
export type EntityDefinition = {
    label: string;
    module: string;
    prefix: string | null;
    fields: Record<string, Field>;
    parent: { entity: string; key: string } | null;
    capabilities: Record<"view" | "create" | "update" | "delete", boolean>;
};
export type SessionCompany = {
    id: number;
    name: string;
    short_name: string;
    is_default: boolean;
};
export type Session = {
    user: {
        id: number;
        name: string;
        username: string;
        role: string;
    };
    permissions: string[];
    companies: SessionCompany[];
    portal_companies: SessionCompany[];
    entities: Record<string, EntityDefinition>;
};
export type PageResult<T = RecordData> = {
    data: T[];
    meta: {
        current_page: number;
        last_page: number;
        total: number;
        per_page?: number;
        from?: number;
        to?: number;
    };
};
export class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public errors: Record<string, string[]> = {},
        public code?: string,
    ) {
        super(message);
    }
}
