import { createFileRoute } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Добро пожаловать{user ? `, ${user.first_name}` : ""}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Пациенты сегодня", value: "—", color: "bg-primary/10 text-primary" },
          { label: "Активные приёмы", value: "—", color: "bg-secondary/10 text-secondary" },
          { label: "Загрузка коек", value: "—", color: "bg-success/10 text-success" },
          { label: "Выручка сегодня", value: "—", color: "bg-warning/10 text-warning" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface rounded-xl border border-border p-5">
            <p className="text-sm text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <div className={`mt-3 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>Phase 2</div>
          </div>
        ))}
      </div>
    </div>
  );
}
