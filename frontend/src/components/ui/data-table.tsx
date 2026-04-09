import { cn } from "@/lib/utils";

interface Column<T> {
  key: string;
  header: string;
  className?: string;
  render?: (item: T, index: number) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyIcon?: React.ReactNode;
  emptyText?: string;
  emptySubtext?: string;
  isLoading?: boolean;
  loadingRows?: number;
}

export function DataTable<T extends Record<string, any>>({
  columns, data, onRowClick, emptyIcon, emptyText = "Нет данных", emptySubtext, isLoading, loadingRows = 5,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 space-y-3">
        {Array.from({ length: loadingRows }).map((_, i) => (
          <div key={i} className="h-12 bg-[var(--color-muted)] rounded-xl animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-12 text-center">
        {emptyIcon && <div className="mb-3 flex justify-center text-[var(--color-text-tertiary)]">{emptyIcon}</div>}
        <p className="text-[var(--color-text-secondary)]">{emptyText}</p>
        {emptySubtext && <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{emptySubtext}</p>}
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {columns.map(col => (
                <th key={col.key} className={cn("text-left p-4 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider", col.className)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((item, rowIdx) => (
              <tr
                key={item.id || rowIdx}
                onClick={() => onRowClick?.(item)}
                className={cn(
                  "transition-colors",
                  onRowClick && "cursor-pointer hover:bg-[var(--color-muted)]/50",
                )}
              >
                {columns.map(col => (
                  <td key={col.key} className={cn("p-4 text-sm", col.className)}>
                    {col.render ? col.render(item, rowIdx) : item[col.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
