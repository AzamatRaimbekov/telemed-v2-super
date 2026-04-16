import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { usePortalAuthStore } from "@/stores/portal-auth-store";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/login")({
  beforeLoad: () => {
    if (usePortalAuthStore.getState().isAuthenticated) {
      throw redirect({ to: "/portal/dashboard" });
    }
  },
  component: PortalLoginPage,
});

function PortalLoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const login = usePortalAuthStore((s) => s.login);
  const navigate = useNavigate();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(phone, password);
      toast.success("Добро пожаловать!");
      await router.invalidate();
      navigate({ to: "/portal/dashboard" });
    } catch {
      toast.error("Неверный телефон или пароль");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen login-bg relative overflow-hidden flex items-center justify-center">
      <div className="absolute w-[500px] h-[500px] -top-48 -right-48 rounded-full blur-3xl bg-primary/20 animate-[pulse-ring_8s_ease-in-out_infinite] pointer-events-none" />
      <div className="absolute w-[400px] h-[400px] -bottom-32 -left-32 rounded-full blur-3xl bg-secondary/10 animate-[pulse-ring_10s_ease-in-out_infinite_1s] pointer-events-none" />

      <div className="relative z-10 w-full max-w-[440px] px-6">
        <div className="text-center mb-10 animate-float-up" style={{ animationDelay: '0.1s' }}>
          <div className="inline-flex items-center justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-[var(--color-primary-deep)] flex items-center justify-center shadow-lg shadow-primary/20">
              <svg className="w-8 h-8 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">
            Портал <span className="text-secondary">пациента</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-[15px]">MedCore KG</p>
        </div>

        <div className="glass-card rounded-2xl p-8 animate-float-up" style={{ animationDelay: '0.3s' }}>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">Вход</h2>
            <p className="text-sm text-muted-foreground mt-1">Введите номер телефона и пароль</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-[13px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Телефон</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-[18px] h-[18px] text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+996 555 123 456" required
                  className="input-glow w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-[var(--color-muted)]/50 text-foreground placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-secondary/40 focus:bg-[var(--color-surface)] transition-all duration-200 text-[15px]" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[13px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Пароль</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-[18px] h-[18px] text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Ваш пароль" required
                  className="input-glow w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-[var(--color-muted)]/50 text-foreground placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-secondary/40 focus:bg-[var(--color-surface)] transition-all duration-200 text-[15px]" />
              </div>
            </div>

            <button type="submit" disabled={isLoading}
              className="group relative w-full py-3.5 px-6 rounded-xl font-semibold text-[15px] text-white overflow-hidden transition-all duration-300 disabled:opacity-50 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, var(--color-secondary) 0%, var(--color-secondary-deep) 100%)' }}>
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
              <span className="relative flex items-center justify-center gap-2">
                {isLoading ? "Входим..." : "Войти"}
              </span>
            </button>
          </form>
        </div>

        <p className="text-center mt-8 text-xs text-[var(--color-text-tertiary)] animate-float-up" style={{ animationDelay: '0.5s' }}>
          Портал пациента MedCore KG v1.0
        </p>
      </div>
    </div>
  );
}
