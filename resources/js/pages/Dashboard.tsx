import { Link } from "react-router-dom";
import {
    ArrowRight,
    Building2,
    Globe,
    Landmark,
    ShieldCheck,
    Contact,
    User,
    SlidersHorizontal,
    Tag,
    Users,
    KeyRound,
    Database,
} from "../components/icons";
import { useSession } from "../lib/session";

type DashboardCardDefinition = {
    label: string;
    path: string;
    icon: typeof Building2;
    module: string;
    superAdminOnly?: boolean;
};

const dashboardGroups = [
    {
        title: "Master Data",
        icon: Database,
        cards: [
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
            {
                label: "Banks",
                path: "/banks",
                icon: Landmark,
                module: "banks",
            },
            {
                label: "Employee Types",
                path: "/employee-types",
                icon: Contact,
                module: "employee-types",
            },
            { label: "Person", path: "/people", icon: User, module: "people" },
            {
                label: "Business Role",
                path: "/business-types",
                icon: Tag,
                module: "business-types",
            },
        ] satisfies DashboardCardDefinition[],
    },
    {
        title: "Administration",
        icon: SlidersHorizontal,
        cards: [
            {
                label: "Users",
                path: "/users",
                icon: Users,
                module: "users",
            },
            {
                label: "Roles",
                path: "/roles",
                icon: ShieldCheck,
                module: "roles",
                superAdminOnly: true,
            },
            {
                label: "Permissions",
                path: "/roles",
                icon: KeyRound,
                module: "roles",
                superAdminOnly: true,
            },
        ] satisfies DashboardCardDefinition[],
    },
];

function DashboardCard({ card }: { card: DashboardCardDefinition }) {
    return (
        <Link to={card.path} className="dash-card" aria-label={card.label}>
            <ArrowRight
                className="dash-card-arrow"
                size={18}
                aria-hidden="true"
            />
            <span className="dash-card-icon">
                <card.icon size={24} />
            </span>
            <span className="dash-card-label">{card.label}</span>
        </Link>
    );
}

export function Dashboard() {
    const { session, company } = useSession();
    const currentCompany = session.portal_companies.find(
        (item) => String(item.id) === company,
    );
    const today = new Date();
    const greeting =
        today.getHours() < 12
            ? "Good morning"
            : today.getHours() < 17
              ? "Good afternoon"
              : "Good evening";
    const firstName = session.user.name.trim().split(/\s+/)[0];
    const groups = dashboardGroups
        .map((group) => ({
            ...group,
            cards: (group.cards as DashboardCardDefinition[]).filter(
                (card) =>
                    session.permissions.includes(`${card.module}.view`) &&
                    (!card.superAdminOnly ||
                        session.user.role === "Super Admin"),
            ),
        }))
        .filter((group) => group.cards.length > 0);

    return (
        <div className="dash-container">
            <section
                className="dash-welcome"
                aria-labelledby="dashboard-greeting"
            >
                <div className="dash-welcome-content">
                    <p className="dash-welcome-date">
                        {today.toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                        })}
                    </p>
                    <h1 id="dashboard-greeting">
                        {greeting}, {firstName}
                    </h1>
                    <p className="dash-welcome-company">
                        {currentCompany ? (
                            <>
                                Working in{" "}
                                <strong>{currentCompany.name}</strong>
                            </>
                        ) : (
                            "Your workspace is ready."
                        )}
                    </p>
                </div>
                <span className="dash-welcome-role">{session.user.role}</span>
            </section>
            {groups.map((group) => (
                <section
                    className="dash-section"
                    key={group.title}
                    aria-labelledby={`dashboard-${group.title.replaceAll(" ", "-").toLowerCase()}`}
                >
                    <div className="dash-section-header">
                        <span className="dash-section-icon">
                            <group.icon size={16} />
                        </span>
                        <h2
                            className="dash-section-title"
                            id={`dashboard-${group.title.replaceAll(" ", "-").toLowerCase()}`}
                        >
                            {group.title}
                        </h2>
                        <div className="dash-section-divider" />
                    </div>
                    <div className="dash-grid">
                        {group.cards.map((card) => (
                            <DashboardCard key={card.label} card={card} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
