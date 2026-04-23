import { motion } from "framer-motion";

export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-48 bg-[var(--color-muted)] rounded-lg" />
          <div className="h-4 w-32 bg-[var(--color-muted)] rounded-lg mt-2" />
        </div>
        <div className="h-10 w-32 bg-[var(--color-muted)] rounded-xl" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5">
            <div className="h-3 w-20 bg-[var(--color-muted)] rounded mb-3" />
            <div className="h-7 w-16 bg-[var(--color-muted)] rounded-lg" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="w-10 h-10 bg-[var(--color-muted)] rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-[var(--color-muted)] rounded-lg" style={{ width: `${60 + i * 5}%` }} />
              <div className="h-3 bg-[var(--color-muted)] rounded-lg" style={{ width: `${40 + i * 3}%` }} />
            </div>
            <div className="h-6 w-16 bg-[var(--color-muted)] rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-[var(--color-muted)] rounded-xl" />
        <div className="space-y-1.5 flex-1">
          <div className="h-4 w-3/4 bg-[var(--color-muted)] rounded" />
          <div className="h-3 w-1/2 bg-[var(--color-muted)] rounded" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-[var(--color-muted)] rounded" />
        <div className="h-3 bg-[var(--color-muted)] rounded w-4/5" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden animate-pulse">
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 bg-[var(--color-muted)]/50 border-b border-[var(--color-border)]">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 bg-[var(--color-muted)] rounded flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b border-[var(--color-border)]/50">
          {[1, 2, 3, 4].map((j) => (
            <div key={j} className="h-4 bg-[var(--color-muted)] rounded flex-1" style={{ opacity: 0.7 - i * 0.1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}
