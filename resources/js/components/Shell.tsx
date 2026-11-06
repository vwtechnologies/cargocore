import { useState, useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
    NavLink,
    Outlet,
    Link,
    useLocation,
    useNavigate,
    useBlocker,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Box,
    ArrowLeft,
    Home,
    Database,
    SlidersHorizontal,
    Building2,
    Globe,
    Landmark,
    ShieldCheck,
    Contact,
    User,
    Tag,
    Tags,
    Users,
    History,
    ChevronDown,
    ChevronRight,
    LogOut,
    Menu,
    X,
    Search,
    Check,
} from "./icons";
import { useDirty } from "../lib/dirty";
import { uppercaseBusinessInput } from "../lib/uppercase-input";
import { useSession } from "../lib/session";
import { api, params } from "../lib/api";
import type { PageResult } from "../lib/types";
import { Modal, Loading, useDebounced, Empty } from "./ui";

const navigationGroups = [
    {
        title: "Master Data",
        dropdown: "master" as const,
        icon: Database,
        items: [
            {
                label: "Companies",
                path: "/companies",
                icon: Building2,
                module: "companies",
            },
            {
                label: "Countries",
                path: "/countries",
                icon: Globe,
                module: "geography",
            },
            { label: "Banks", path: "/banks", icon: Landmark, module: "banks" },
            {
                label: "Employee Types",
                path: "/employee-types",
                icon: Contact,
                module: "employee-types",
            },
            {
                label: "Person Information",
                path: "/people",
                icon: User,
                module: "people",
            },
            {
                label: "Business Roles",
                path: "/business-types",
                icon: Tag,
                module: "business-types",
            },
            { label: "Marka", path: "/markas", icon: Tags, module: "markas" },
        ],
    },
    {
        title: "Administration",
        dropdown: "admin" as const,
        icon: SlidersHorizontal,
        items: [
            { label: "Users", path: "/users", icon: Users, module: "users" },
            {
                label: "Role Permissions",
                path: "/roles",
                icon: ShieldCheck,
                module: "roles",
            },
            {
                label: "Audit History",
                path: "/audit",
                icon: History,
                module: "audit",
            },
        ],
    },
];

export function Shell() {
    const { session, company, setCompany } = useSession();
    const [mobile, setMobile] = useState(false);
    const mobileMenuRef = useRef<HTMLButtonElement>(null);
    const [search, setSearch] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<
        "master" | "admin" | "company" | "user" | null
    >(null);

    const cache = useQueryClient();
    const location = useLocation();
    const pagePath = location.pathname.split("/")[1];
    const navigate = useNavigate();
    const guard = useDirty();
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            guard.dirty && currentLocation.pathname !== nextLocation.pathname,
    );

    useEffect(() => {
        if (blocker.state === "blocked") {
            if (guard.discard()) blocker.proceed();
            else blocker.reset();
        }
    }, [blocker, guard]);

    // Selecting the initial record updates the URL without changing the page.
    useEffect(() => {
        setOpenDropdown(null);
        setMobile(false);
    }, [pagePath]);

    useEffect(() => {
        const desktop = window.matchMedia("(min-width: 1024px)");
        function closeOnDesktop() {
            if (desktop.matches) setMobile(false);
        }
        desktop.addEventListener("change", closeOnDesktop);
        return () => desktop.removeEventListener("change", closeOnDesktop);
    }, []);

    // Close dropdowns on click outside or escape key
    useEffect(() => {
        if (!openDropdown) return;
        function handleClickOutside(e: MouseEvent) {
            const target = e.target as HTMLElement | null;
            if (!target?.closest(".topbar-dropdown-container")) {
                setOpenDropdown(null);
            }
        }
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") setOpenDropdown(null);
        }
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [openDropdown]);

    // Keyboard shortcut for search
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setSearch((prev) => !prev);
            }
        }
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, []);

    async function logout() {
        await api("/logout", { method: "POST" });
        cache.clear();
        window.location.assign("/login");
    }

    const permittedGroups = navigationGroups
        .map((group) => ({
            ...group,
            items: group.items.filter(
                (item) =>
                    session.permissions.includes(`${item.module}.view`) &&
                    (item.module !== "roles" ||
                        session.user.role === "Super Admin"),
            ),
        }))
        .filter((group) => group.items.length > 0);

    const navigationPage = permittedGroups
        .flatMap((group) => group.items)
        .find((item) => item.path === `/${pagePath}`);
    const entityPage = session.entities[pagePath];
    const mobilePageTitle = navigationPage
        ? pagePath === "users"
            ? "User Management"
            : navigationPage.label
        : entityPage?.capabilities.view
          ? entityPage.label
          : undefined;
    const MobilePageIcon = navigationPage?.icon ?? Database;

    const currentCompany = session.portal_companies.find(
        (c) => String(c.id) === String(company),
    );
    const companyDisplayName = currentCompany
        ? currentCompany.short_name
            ? `${currentCompany.name} (${currentCompany.short_name})`
            : currentCompany.name
        : "No portal company access";

    const userName = session.user.name || "Ahmed Raza";
    const userRole = session.user.role || "Super Admin";
    const initials =
        userName
            .split(" ")
            .filter(Boolean)
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase() || "AR";

    return (
        <div
            className="app-shell"
            data-mobile-page-heading={mobilePageTitle ? "" : undefined}
            onInputCapture={uppercaseBusinessInput}
            onCompositionEndCapture={uppercaseBusinessInput}
        >
            {/* Top Navigation Bar Header */}
            <header className="topbar-header">
                <div className="topbar-left">
                    <button
                        className="mobile-menu-btn"
                        ref={mobileMenuRef}
                        onClick={() => {
                            setOpenDropdown(null);
                            setMobile(true);
                        }}
                        aria-label="Open navigation"
                        aria-haspopup="dialog"
                        aria-expanded={mobile}
                        aria-controls={mobile ? "mobile-navigation" : undefined}
                    >
                        <Menu size={20} />
                    </button>

                    <Link to="/" className="topbar-brand">
                        <span className="topbar-brand-icon">
                            <Box size={18} />
                        </span>
                        <span className="topbar-brand-text">
                            Cargo<span>Core</span>
                        </span>
                    </Link>

                    {mobilePageTitle && (
                        <div className="mobile-page-heading">
                            <span
                                className="topbar-brand-icon"
                                aria-hidden="true"
                            >
                                <MobilePageIcon size={20} />
                            </span>
                            <h1>{mobilePageTitle}</h1>
                        </div>
                    )}

                    <nav className="topbar-nav">
                        <NavLink
                            to="/"
                            end
                            className={({ isActive }) =>
                                `topbar-nav-pill ${isActive ? "active" : ""}`
                            }
                        >
                            <Home size={15} />
                            <span>Home</span>
                        </NavLink>

                        {permittedGroups.map((group) => (
                            <div
                                className="topbar-dropdown-container"
                                key={group.dropdown}
                            >
                                <button
                                    className={`topbar-nav-pill ${openDropdown === group.dropdown ? "dropdown-open" : ""}`}
                                    onClick={() =>
                                        setOpenDropdown(
                                            openDropdown === group.dropdown
                                                ? null
                                                : group.dropdown,
                                        )
                                    }
                                    aria-expanded={
                                        openDropdown === group.dropdown
                                    }
                                >
                                    <group.icon size={15} />
                                    <span>{group.title}</span>
                                    <ChevronDown size={13} />
                                </button>
                                {openDropdown === group.dropdown && (
                                    <div className="topbar-dropdown-popover left">
                                        {group.items.map((item) => (
                                            <NavLink
                                                key={item.path}
                                                to={item.path}
                                                className={({ isActive }) =>
                                                    `topbar-dropdown-link ${isActive ? "active-item" : ""}`
                                                }
                                                onClick={() =>
                                                    setOpenDropdown(null)
                                                }
                                            >
                                                <item.icon size={16} />
                                                <span>{item.label}</span>
                                            </NavLink>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </nav>
                </div>

                <div className="topbar-right">
                    {/* Company Switcher Pill */}
                    <div className="topbar-dropdown-container">
                        <button
                            className={`topbar-company-pill ${openDropdown === "company" ? "dropdown-open" : ""}`}
                            onClick={() =>
                                setOpenDropdown(
                                    openDropdown === "company"
                                        ? null
                                        : "company",
                                )
                            }
                            aria-expanded={openDropdown === "company"}
                            aria-label="Current company"
                        >
                            <Building2 size={14} />
                            <span className="company-name-text">
                                {companyDisplayName}
                            </span>
                            <ChevronDown size={12} />
                        </button>

                        {openDropdown === "company" && (
                            <div className="topbar-dropdown-popover right">
                                <div className="topbar-dropdown-header">
                                    <strong>Switch Company</strong>
                                    <small>
                                        Select active workspace company
                                    </small>
                                </div>
                                {session.portal_companies.length ? (
                                    session.portal_companies.map((c) => {
                                        const isSelected =
                                            String(c.id) === String(company);
                                        return (
                                            <button
                                                key={c.id}
                                                className={`topbar-dropdown-link ${isSelected ? "active-item" : ""}`}
                                                onClick={() => {
                                                    setCompany(String(c.id));
                                                    setOpenDropdown(null);
                                                }}
                                            >
                                                <Building2 size={15} />
                                                <span style={{ flex: 1 }}>
                                                    {c.name}
                                                </span>
                                                {isSelected && (
                                                    <Check size={14} />
                                                )}
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div
                                        style={{
                                            padding: "8px 12px",
                                            fontSize: "12px",
                                            color: "#888",
                                        }}
                                    >
                                        No active companies have portal access
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* User Profile Badge */}
                    <div className="topbar-dropdown-container">
                        <button
                            className={`topbar-user-badge ${openDropdown === "user" ? "dropdown-open" : ""}`}
                            onClick={() =>
                                setOpenDropdown(
                                    openDropdown === "user" ? null : "user",
                                )
                            }
                            aria-expanded={openDropdown === "user"}
                            aria-label="User profile menu"
                        >
                            <span className="user-avatar-circle">
                                {initials}
                            </span>
                            <div className="user-profile-details">
                                <span className="user-profile-name">
                                    {userName}
                                </span>
                                <span className="user-profile-role">
                                    {userRole}
                                </span>
                            </div>
                        </button>

                        {openDropdown === "user" && (
                            <div className="topbar-dropdown-popover right">
                                <div className="topbar-dropdown-header">
                                    <strong>{userName}</strong>
                                    <small>
                                        {session.user.username
                                            ? `@${session.user.username}`
                                            : userRole}
                                    </small>
                                </div>
                                <button
                                    onClick={logout}
                                    className="topbar-dropdown-link"
                                    style={{ color: "#873d3d" }}
                                >
                                    <LogOut size={15} />
                                    <span>Sign out</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <Dialog.Root open={mobile} onOpenChange={setMobile}>
                <Dialog.Portal>
                    <Dialog.Overlay className="sidebar-shade" />
                    <Dialog.Content
                        asChild
                        onCloseAutoFocus={(event) => {
                            event.preventDefault();
                            mobileMenuRef.current?.focus({
                                preventScroll: true,
                            });
                        }}
                    >
                        <aside className="sidebar" id="mobile-navigation">
                            <Dialog.Title className="visually-hidden">
                                Navigation
                            </Dialog.Title>
                            <Dialog.Description className="visually-hidden">
                                Choose a page from the application menu.
                            </Dialog.Description>
                            <div className="sidebar-header">
                                <Link
                                    to="/"
                                    className="topbar-brand"
                                    onClick={() => setMobile(false)}
                                >
                                    <span className="topbar-brand-icon">
                                        <Box size={18} />
                                    </span>
                                    <span className="topbar-brand-text">
                                        Cargo<span>Core</span>
                                    </span>
                                </Link>
                                <Dialog.Close asChild>
                                    <button
                                        className="sidebar-close"
                                        aria-label="Close navigation"
                                        title="Close Navigation"
                                    >
                                        <ArrowLeft size={18} />
                                    </button>
                                </Dialog.Close>
                            </div>
                            <nav
                                className="sidebar-navigation"
                                aria-label="Main navigation"
                            >
                                <NavLink
                                    to="/"
                                    end
                                    onClick={() => setMobile(false)}
                                    className={({ isActive }) =>
                                        `sidebar-link ${isActive ? "active" : ""}`
                                    }
                                >
                                    <Home size={18} />
                                    <span>Home</span>
                                </NavLink>
                                {permittedGroups.map((group) => (
                                    <div
                                        className="sidebar-group"
                                        key={group.dropdown}
                                    >
                                        <h2 className="sidebar-group-title">
                                            {group.title}
                                        </h2>
                                        {group.items.map((item) => (
                                            <NavLink
                                                key={item.path}
                                                to={item.path}
                                                onClick={() => setMobile(false)}
                                                className={({ isActive }) =>
                                                    `sidebar-link ${isActive ? "active" : ""}`
                                                }
                                            >
                                                <item.icon size={18} />
                                                <span>{item.label}</span>
                                            </NavLink>
                                        ))}
                                    </div>
                                ))}
                            </nav>
                            <div className="sidebar-user">
                                <span className="user-avatar-circle">
                                    {initials}
                                </span>
                                <div className="user-profile-details">
                                    <span className="user-profile-name">
                                        {userName}
                                    </span>
                                    <span className="user-profile-role">
                                        {userRole}
                                    </span>
                                </div>
                            </div>
                        </aside>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            {/* Main Content Area */}
            <div className="main-area">
                <main>
                    <Outlet />
                </main>
                <footer className="app-footer">
                    <span>
                        CargoCore ERP <span className="footer-dot">·</span>{" "}
                        Connected business management
                    </span>
                    <span>
                        <span className="live-dot" /> Your data stays on your
                        server
                    </span>
                </footer>
            </div>

            <WorkspaceSearch open={search} onClose={() => setSearch(false)} />
        </div>
    );
}

function WorkspaceSearch({
    open,
    onClose,
}: {
    open: boolean;
    onClose: () => void;
}) {
    const { session } = useSession();
    const [search, setSearch] = useState("");
    const term = useDebounced(search);
    const navigate = useNavigate();
    const entities = ["companies", "people", "banks", "markas"].filter(
        (e) => session.entities[e].capabilities.view,
    );
    const query = useQuery({
        queryKey: ["global-search", term],
        queryFn: () =>
            Promise.all(
                entities.map(async (e) => ({
                    entity: e,
                    ...(await api<PageResult>(
                        `/api/v1/${e}?${params({ search: term, per_page: 5 })}`,
                    )),
                })),
            ),
        enabled: open && term.length >= 2,
    });
    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Search Your Workspace"
            description="Find companies, people, banks, or MARKA codes."
        >
            <div className="command-search">
                <div className="search-input">
                    <Search size={18} />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Type at least two characters…"
                        autoFocus
                    />
                </div>
                {term.length >= 2 &&
                    (query.isPending ? (
                        <Loading />
                    ) : (
                        <div className="command-results">
                            {query.data?.map((group) => (
                                <div key={group.entity}>
                                    {group.data.length > 0 && (
                                        <h4>
                                            {
                                                session.entities[group.entity]
                                                    .label
                                            }
                                        </h4>
                                    )}
                                    {group.data.map((r) => (
                                        <button
                                            key={r.id}
                                            onClick={() => {
                                                navigate(
                                                    `/${group.entity}/${r.id}`,
                                                );
                                                onClose();
                                            }}
                                        >
                                            <span>
                                                {String(r.name ?? r.code)}
                                                <small>
                                                    {String(
                                                        r.code ??
                                                            r.description ??
                                                            "",
                                                    )}
                                                </small>
                                            </span>
                                            <ChevronRight size={15} />
                                        </button>
                                    ))}
                                </div>
                            ))}
                            {query.data?.every((g) => !g.data.length) && (
                                <Empty
                                    title="No Matching Records"
                                    description="Try another name or code."
                                />
                            )}
                        </div>
                    ))}
            </div>
        </Modal>
    );
}
