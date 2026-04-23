import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={28} className="text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Что-то пошло не так</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              {this.state.error?.message || "Произошла непредвиденная ошибка"}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="h-10 px-5 rounded-xl bg-[var(--color-secondary)] text-white text-sm font-semibold flex items-center gap-2 hover:opacity-90"
              >
                <RefreshCw size={14} /> Обновить страницу
              </button>
              <a
                href="/dashboard"
                className="h-10 px-5 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] flex items-center gap-2 hover:text-[var(--color-text-primary)]"
              >
                <Home size={14} /> На главную
              </a>
            </div>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="text-xs text-[var(--color-text-tertiary)] cursor-pointer">Детали ошибки</summary>
                <pre className="mt-2 p-3 rounded-lg bg-[var(--color-muted)] text-xs text-[var(--color-text-secondary)] overflow-auto max-h-40">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
