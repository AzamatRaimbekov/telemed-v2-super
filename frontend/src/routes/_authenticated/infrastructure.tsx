import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/infrastructure")({
  component: InfrastructureLayout,
});

const SUB_TABS = [
  { path: "/infrastructure/dashboard", label: "Дашборд" },
  { path: "/infrastructure/map", label: "Карта здания" },
  { path: "/infrastructure/equipment", label: "Оборудование" },
  { path: "/infrastructure/automation", label: "Автоматизация" },
  { path: "/infrastructure/settings", label: "Настройки" },
];

function InfrastructureLayout() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <div className="space-y-6">
      {/* Sub-navigation tabs */}
      <div className="flex items-center gap-1 bg-[var(--color-muted)] rounded-xl p-1 overflow-x-auto">
        {SUB_TABS.map((tab) => {
          const isActive = currentPath.startsWith(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                isActive
                  ? "bg-[var(--color-surface)] shadow-sm text-foreground"
                  : "text-[var(--color-text-secondary)] hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Page content */}
      <Outlet />
    </div>
  );
}
