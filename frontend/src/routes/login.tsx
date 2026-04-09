import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginForm } from "@/features/auth/components/login-form";

export const Route = createFileRoute("/login")({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LoginPage,
});

function HeartbeatIcon() {
  return (
    <svg width="60" height="64" viewBox="0 0 60 64" fill="none" className="opacity-60">
      <path
        d="M 0 32 L 15 32 L 20 18 L 26 46 L 32 24 L 36 38 L 40 32 L 60 32"
        stroke="var(--color-primary-deep)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className="[stroke-dasharray:200] [stroke-dashoffset:200] animate-[draw-line_2s_ease-out_0.5s_forwards]"
      />
      <style>{`
        @keyframes draw-line {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </svg>
  );
}

function FloatingOrb({ className }: { className: string }) {
  return (
    <div
      className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
    />
  );
}

function LoginPage() {
  return (
    <div className="min-h-screen login-bg relative overflow-hidden flex items-center justify-center">
      {/* Floating decorative orbs */}
      <FloatingOrb className="w-[500px] h-[500px] -top-48 -left-48 bg-primary/20 animate-[pulse-ring_8s_ease-in-out_infinite]" />
      <FloatingOrb className="w-[400px] h-[400px] -bottom-32 -right-32 bg-secondary/10 animate-[pulse-ring_10s_ease-in-out_infinite_1s]" />
      <FloatingOrb className="w-[300px] h-[300px] top-1/3 right-1/4 bg-primary/8 animate-[pulse-ring_12s_ease-in-out_infinite_2s]" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(var(--color-text-primary) 1px, transparent 1px),
            linear-gradient(90deg, var(--color-text-primary) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
        }}
      />

      <div className="relative z-10 w-full max-w-[440px] px-6">
        {/* Logo & Branding */}
        <div className="text-center mb-10 animate-float-up" style={{ animationDelay: '0.1s', opacity: 0 }}>
          <div className="inline-flex items-center justify-center mb-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-deep flex items-center justify-center shadow-lg shadow-primary/20">
                <svg className="w-8 h-8 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg bg-secondary flex items-center justify-center shadow-sm">
                <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>

          <h1 className="text-[28px] font-bold tracking-tight text-foreground">
            MedCore <span className="text-secondary">KG</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-[15px]">
            Система управления клиникой
          </p>

          <div className="flex items-center justify-center mt-5">
            <HeartbeatIcon />
          </div>
        </div>

        {/* Login Card */}
        <div
          className="glass-card rounded-2xl p-8 animate-float-up"
          style={{ animationDelay: '0.3s', opacity: 0 }}
        >
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">Вход в систему</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Введите данные для доступа к панели
            </p>
          </div>

          <LoginForm />
        </div>

        {/* Footer */}
        <div
          className="text-center mt-8 animate-float-up"
          style={{ animationDelay: '0.5s', opacity: 0 }}
        >
          <p className="text-xs text-[var(--color-text-tertiary)]">
            MedCore KG v1.0 &middot; Бишкек, Кыргызстан
          </p>
        </div>
      </div>
    </div>
  );
}
