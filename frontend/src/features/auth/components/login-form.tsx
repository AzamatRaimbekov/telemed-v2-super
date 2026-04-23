import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import { APIError } from "@/types/api";
import { AxiosError } from "axios";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await login(email, password);
      toast.success("Добро пожаловать!");
      navigate({ to: "/dashboard" });
    } catch (error) {
      if (error instanceof APIError) {
        if (error.status === 401) {
          setErrorMessage("Неверный email или пароль");
          toast.error("Неверный email или пароль");
        } else {
          setErrorMessage(error.message);
          toast.error(error.message);
        }
      } else if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          setErrorMessage("Неверный email или пароль");
          toast.error("Неверный email или пароль");
        } else if (error.response?.data?.detail) {
          setErrorMessage(error.response.data.detail);
          toast.error(error.response.data.detail);
        } else {
          setErrorMessage("Ошибка подключения к серверу");
          toast.error("Ошибка подключения к серверу");
        }
      } else {
        setErrorMessage("Ошибка подключения к серверу");
        toast.error("Ошибка подключения к серверу");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Email */}
      <div className="space-y-2">
        <label
          htmlFor="email"
          className={`block text-[13px] font-semibold uppercase tracking-wider transition-colors duration-200 ${
            focusedField === "email" ? "text-secondary" : "text-[var(--color-text-tertiary)]"
          }`}
        >
          Email
        </label>
        <div className="relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg
              className={`w-[18px] h-[18px] transition-colors duration-200 ${
                focusedField === "email" ? "text-secondary" : "text-[var(--color-text-tertiary)]"
              }`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            >
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setFocusedField("email")}
            onBlur={() => setFocusedField(null)}
            placeholder="doctor@clinic.kg"
            required
            className="input-glow w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-[var(--color-muted)]/50 text-foreground placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-secondary/40 focus:bg-[var(--color-surface)] transition-all duration-200 text-[15px]"
          />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-2">
        <label
          htmlFor="password"
          className={`block text-[13px] font-semibold uppercase tracking-wider transition-colors duration-200 ${
            focusedField === "password" ? "text-secondary" : "text-[var(--color-text-tertiary)]"
          }`}
        >
          Пароль
        </label>
        <div className="relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg
              className={`w-[18px] h-[18px] transition-colors duration-200 ${
                focusedField === "password" ? "text-secondary" : "text-[var(--color-text-tertiary)]"
              }`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            >
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocusedField("password")}
            onBlur={() => setFocusedField(null)}
            placeholder="Введите пароль"
            required
            className="input-glow w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-[var(--color-muted)]/50 text-foreground placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-secondary/40 focus:bg-[var(--color-surface)] transition-all duration-200 text-[15px]"
          />
        </div>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20">
          <svg className="w-4 h-4 text-destructive flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span className="text-sm text-destructive font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading}
        className="group relative w-full py-3.5 px-6 rounded-xl font-semibold text-[15px] text-white overflow-hidden transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
        style={{
          background: 'linear-gradient(135deg, var(--color-secondary) 0%, var(--color-secondary-deep) 100%)',
        }}
      >
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: 'linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s linear infinite',
          }}
        />
        <span className="relative flex items-center justify-center gap-2">
          {isLoading ? (
            <>
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Входим...
            </>
          ) : (
            <>
              Войти в систему
              <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </>
          )}
        </span>
      </button>

      {/* Demo credentials hint */}
      <div className="pt-2">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <span>Демо: <span className="font-mono text-[var(--color-text-secondary)]">admin@medcore.kg</span> / <span className="font-mono text-[var(--color-text-secondary)]">Admin123!</span></span>
        </div>
      </div>
    </form>
  );
}
