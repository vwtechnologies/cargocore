import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { subscribeToRecordChanges } from "./live-data";
import { ApiError, type Session } from "./types";
const Context = createContext<{
    session: Session;
    company: string;
    setCompany: (id: string) => void;
    refresh: () => Promise<unknown>;
}>({} as never);
export function defaultCompanyIds(companies: Session["companies"]): number[] {
    const company = companies.find((item) => item.is_default);
    return company ? [company.id] : [];
}
export function useSession() {
    return useContext(Context);
}
export function SessionProvider({
    children,
    loading,
    login,
}: {
    children: ReactNode;
    loading: ReactNode;
    login: ReactNode;
}) {
    const client = useQueryClient();
    const [selectedCompany, setSelectedCompany] = useState("");
    const query = useQuery({
        queryKey: ["session"],
        queryFn: async () => {
            try {
                return await api<Session>("/api/v1/session");
            } catch (error) {
                if (error instanceof ApiError && error.status === 401)
                    return null;
                throw error;
            }
        },
        retry: false,
        staleTime: 60000,
        refetchInterval: (query) => (query.state.data ? 15000 : false),
        refetchOnWindowFocus: (query) => !!query.state.data,
        refetchOnReconnect: (query) => !!query.state.data,
    });
    const isAuthenticated = !!query.data;
    const portalCompanies = query.data?.portal_companies ?? [];
    const company = portalCompanies.some(
        (item) => String(item.id) === selectedCompany,
    )
        ? selectedCompany
        : String(
              portalCompanies.find((item) => item.is_default)?.id ??
                  portalCompanies[0]?.id ??
                  "",
          );
    useEffect(() => {
        if (isAuthenticated) return subscribeToRecordChanges(client);
    }, [client, isAuthenticated]);
    useEffect(() => {
        const reset = () => {
            void client.cancelQueries({ queryKey: ["session"], exact: true });
            client.setQueryData(["session"], null);
            client.removeQueries({
                predicate: (query) => query.queryKey[0] !== "session",
            });
        };
        window.addEventListener("session-expired", reset);
        return () => window.removeEventListener("session-expired", reset);
    }, [client]);
    useEffect(() => {
        if (company !== selectedCompany) setSelectedCompany(company);
    }, [company, selectedCompany]);
    if (query.isPending) return loading;
    if (!query.data) return login;
    return (
        <Context.Provider
            value={{
                session: query.data,
                company,
                setCompany: (id) => {
                    if (portalCompanies.some((item) => String(item.id) === id))
                        setSelectedCompany(id);
                },
                refresh: () => query.refetch(),
            }}
        >
            {children}
        </Context.Provider>
    );
}
