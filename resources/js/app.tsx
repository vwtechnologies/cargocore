import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
    createBrowserRouter,
    RouterProvider,
    Navigate,
    useParams,
} from "react-router-dom";
import { Toaster } from "sonner";
import "@fontsource-variable/inter";
import "../css/app.css";
import { SessionProvider, useSession } from "./lib/session";
import { DirtyProvider } from "./lib/dirty";
import { Shell } from "./components/Shell";
import { Loading, ErrorState } from "./components/ui";
import { Login } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import { CompaniesPage } from "./pages/CompaniesPage";
import { CountriesPage } from "./pages/CountriesPage";
import { BanksPage } from "./pages/BanksPage";
import { EmployeeTypesPage } from "./pages/EmployeeTypesPage";
import { BusinessTypesPage } from "./pages/BusinessTypesPage";
import { MarkasPage } from "./pages/MarkasPage";
import { PeoplePage } from "./pages/PeoplePage";
import { ModulePage } from "./pages/Modules";
import { UsersPage, RolesPage, AuditPage } from "./pages/Administration";
function BusinessRoleRedirect() {
    const { id } = useParams();
    return <Navigate replace to={`/business-types${id ? `/${id}` : ""}`} />;
}
function PermissionPage({
    permission,
    children,
}: {
    permission: string;
    children: React.ReactNode;
}) {
    const { session } = useSession();
    return session.permissions.includes(permission) ? (
        children
    ) : (
        <ErrorState
            error={new Error("You do not have permission to view this page.")}
        />
    );
}
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            refetchOnWindowFocus: true,
            staleTime: 15000,
            refetchInterval: (query) => {
                const data = query.state.data as { data?: unknown } | undefined;
                return (data && "data" in data) ||
                    ["session", "dashboard"].includes(String(query.queryKey[0]))
                    ? 15000
                    : false;
            },
        },
    },
});
const router = createBrowserRouter([
    {
        path: "/",
        element: <Shell />,
        errorElement: (
            <ErrorState
                error={
                    new Error(
                        "This page could not be loaded. Refresh to try again.",
                    )
                }
            />
        ),
        children: [
            { index: true, element: <Dashboard /> },
            { path: "login", element: <Dashboard /> },
            { path: "security", element: <Navigate replace to="/" /> },
            {
                path: "users",
                element: (
                    <PermissionPage permission="users.view">
                        <UsersPage />
                    </PermissionPage>
                ),
            },
            {
                path: "roles",
                element: (
                    <PermissionPage permission="roles.view">
                        <RolesPage />
                    </PermissionPage>
                ),
            },
            {
                path: "audit",
                element: (
                    <PermissionPage permission="audit.view">
                        <AuditPage />
                    </PermissionPage>
                ),
            },
            {
                path: "companies/:id?",
                element: (
                    <PermissionPage permission="companies.view">
                        <CompaniesPage />
                    </PermissionPage>
                ),
            },
            {
                path: "countries/:id?",
                element: (
                    <PermissionPage permission="geography.view">
                        <CountriesPage />
                    </PermissionPage>
                ),
            },
            {
                path: "banks/:id?",
                element: (
                    <PermissionPage permission="banks.view">
                        <BanksPage />
                    </PermissionPage>
                ),
            },
            {
                path: "employee-types/:id?",
                element: (
                    <PermissionPage permission="employee-types.view">
                        <EmployeeTypesPage />
                    </PermissionPage>
                ),
            },
            {
                path: "people/:id?",
                element: (
                    <PermissionPage permission="people.view">
                        <PeoplePage />
                    </PermissionPage>
                ),
            },
            {
                path: "business-types/:id?",
                element: (
                    <PermissionPage permission="business-types.view">
                        <BusinessTypesPage key="business-roles" />
                    </PermissionPage>
                ),
            },
            {
                path: "classifications/:id?",
                element: <BusinessRoleRedirect />,
            },
            {
                path: "markas/:id?",
                element: (
                    <PermissionPage permission="markas.view">
                        <MarkasPage />
                    </PermissionPage>
                ),
            },
            { path: ":entity/:id?", element: <ModulePage /> },
        ],
    },
]);
createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <SessionProvider loading={<Loading />} login={<Login />}>
                <DirtyProvider>
                    <RouterProvider router={router} />
                </DirtyProvider>
            </SessionProvider>
            <Toaster position="top-right" richColors closeButton />
        </QueryClientProvider>
    </React.StrictMode>,
);
