import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth-store";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, isAuthenticated, fetchUser, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && !user) { fetchUser(); }
  }, [isAuthenticated, user, fetchUser]);

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-surface border-b border-border">
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <span className="font-semibold text-foreground">MedCore KG</span>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-sm text-muted-foreground">
                {user.first_name} {user.last_name}
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-secondary/10 text-secondary">{user.role}</span>
              </span>
            )}
            <button onClick={async () => { await logout(); navigate({ to: "/login" }); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Выйти</button>
          </div>
        </div>
      </header>
      <main className="p-6"><Outlet /></main>
    </div>
  );
}
