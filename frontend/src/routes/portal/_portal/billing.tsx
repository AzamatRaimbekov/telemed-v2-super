import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { portalApi } from "@/features/portal/api";
import { useState, useMemo } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/portal/_portal/billing")({
  component: BillingPage,
});

// ─── Constants ───────────────────────────────────────────────────────────────

const CHART_COLORS = [
  "#7E78D2",
  "#10B981",
  "#3B82F6",
  "#F59E0B",
  "#EC4899",
  "#14B8A6",
  "#EF4444",
];

const CATEGORY_LABELS: Record<string, string> = {
  CONSULTATION: "Консультации",
  PROCEDURE: "Процедуры",
  MEDICATION: "Лекарства",
  LAB: "Анализы",
  ROOM: "Палата",
  FOOD: "Питание",
  OTHER: "Прочее",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  ISSUED: "Выставлен",
  PAID: "Оплачен",
  PARTIALLY_PAID: "Частично",
  CANCELLED: "Отменён",
  OVERDUE: "Просрочен",
};

const STATUS_COLORS: Record<string, string> = {
  PAID: "bg-success/10 text-success",
  PARTIALLY_PAID: "bg-warning/10 text-warning",
  OVERDUE: "bg-destructive/10 text-destructive",
  ISSUED: "bg-secondary/10 text-secondary",
  DRAFT: "bg-[var(--color-muted)] text-[var(--color-text-tertiary)]",
  CANCELLED: "bg-[var(--color-muted)] text-[var(--color-text-tertiary)]",
};

// ─── Custom tooltip for charts ────────────────────────────────────────────────

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

function CurrencyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--color-surface)] border border-border rounded-xl shadow-lg p-3 text-sm">
      {label && <p className="text-[var(--color-text-secondary)] mb-1 text-xs">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="font-semibold" style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { fill: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="bg-[var(--color-surface)] border border-border rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-foreground">{item.name}</p>
      <p className="text-[var(--color-text-secondary)]">{formatCurrency(item.value)}</p>
    </div>
  );
}

// ─── Helper: derive category breakdown from invoices ─────────────────────────

function deriveCategoryData(invoices: Array<Record<string, unknown>>) {
  const totals: Record<string, number> = {};
  for (const inv of invoices) {
    const items = (inv.items as Array<Record<string, unknown>>) ?? [];
    for (const item of items) {
      const cat = (item.category as string) ?? (inv.category as string) ?? "OTHER";
      const amount = Number(item.total ?? item.amount ?? 0);
      totals[cat] = (totals[cat] ?? 0) + amount;
    }
    // Fall back to invoice-level category when no items
    if (items.length === 0 && inv.category) {
      const cat = inv.category as string;
      totals[cat] = (totals[cat] ?? 0) + Number(inv.total ?? 0);
    }
  }
  return Object.entries(totals).map(([key, value], i) => ({
    name: CATEGORY_LABELS[key] ?? key,
    value,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));
}

// ─── Helper: derive daily expense timeline from invoices ──────────────────────

function deriveTimelineData(invoices: Array<Record<string, unknown>>) {
  const byDate: Record<string, number> = {};
  for (const inv of invoices) {
    const raw = (inv.issued_at as string) ?? (inv.created_at as string) ?? "";
    if (!raw) continue;
    const day = raw.slice(0, 10);
    byDate[day] = (byDate[day] ?? 0) + Number(inv.total ?? 0);
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({
      date: new Date(date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
      amount,
    }));
}

// ─── Invoice row with expandable items ───────────────────────────────────────

function InvoiceRow({ inv }: { inv: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const items = (inv.items as Array<Record<string, unknown>>) ?? [];

  return (
    <div>
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-4 p-4 hover:bg-[var(--color-muted)]/40 transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
          <svg
            className="w-5 h-5 text-secondary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Счёт №{String(inv.invoice_number)}</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {new Date(String(inv.issued_at)).toLocaleDateString("ru-RU")}
            {items.length > 0 && ` · ${items.length} позиций`}
          </p>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            STATUS_COLORS[inv.status as string] ?? "bg-[var(--color-muted)] text-[var(--color-text-secondary)]"
          }`}
        >
          {STATUS_LABELS[inv.status as string] ?? String(inv.status)}
        </span>
        <p className="text-sm font-bold text-foreground flex-shrink-0">{formatCurrency(Number(inv.total))}</p>
        <svg
          className={`w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>

      {expanded && items.length > 0 && (
        <div className="mx-4 mb-3 rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--color-muted)]/60">
                <th className="text-left p-2.5 font-medium text-[var(--color-text-tertiary)]">Наименование</th>
                <th className="text-center p-2.5 font-medium text-[var(--color-text-tertiary)]">Кол-во</th>
                <th className="text-right p-2.5 font-medium text-[var(--color-text-tertiary)]">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item, idx) => (
                <tr key={idx} className="bg-[var(--color-surface)]">
                  <td className="p-2.5 text-foreground">{String(item.name ?? item.description ?? "—")}</td>
                  <td className="p-2.5 text-center text-[var(--color-text-secondary)]">
                    {String(item.quantity ?? 1)}
                  </td>
                  <td className="p-2.5 text-right font-medium text-foreground">
                    {formatCurrency(Number(item.total ?? item.amount ?? 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {expanded && items.length === 0 && (
        <p className="px-6 pb-3 text-xs text-[var(--color-text-tertiary)]">Состав счёта недоступен</p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function BillingPage() {
  const { data: summary } = useQuery({
    queryKey: ["portal-billing-summary"],
    queryFn: portalApi.getBillingSummary,
  });
  const { data: invoicesRaw, isLoading: invoicesLoading } = useQuery({
    queryKey: ["portal-invoices"],
    queryFn: portalApi.getInvoices,
  });
  const { data: paymentsRaw, isLoading: paymentsLoading } = useQuery({
    queryKey: ["portal-payments"],
    queryFn: portalApi.getPayments,
  });
  // Try the dedicated endpoint first; fall back to deriving from invoices
  const { data: categoriesRaw } = useQuery({
    queryKey: ["portal-billing-categories"],
    queryFn: portalApi.getBillingCategories,
    retry: false,
  });

  const [tab, setTab] = useState<"invoices" | "payments">("invoices");

  const invoices = (invoicesRaw as Array<Record<string, unknown>>) ?? [];
  const payments = (paymentsRaw as Array<Record<string, unknown>>) ?? [];
  const s = summary as Record<string, unknown> | undefined;

  // Category pie data: prefer API response, derive from invoices as fallback
  const categoryData = useMemo<Array<{ name: string; value: number; fill: string }>>(() => {
    if (Array.isArray(categoriesRaw) && categoriesRaw.length > 0) {
      return (categoriesRaw as Array<Record<string, unknown>>).map((c, i) => ({
        name: CATEGORY_LABELS[c.category as string] ?? String(c.category ?? "Прочее"),
        value: Number(c.total ?? c.amount ?? 0),
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }));
    }
    return deriveCategoryData(invoices);
  }, [categoriesRaw, invoices]);

  // Timeline line chart data
  const timelineData = useMemo(() => deriveTimelineData(invoices), [invoices]);

  const showCharts = categoryData.some((d) => d.value > 0) || timelineData.length > 0;

  return (
    <div className="max-w-4xl">
      <h1 className="text-[24px] font-bold text-foreground tracking-tight mb-6 animate-float-up">
        Финансы и счета
      </h1>

      {/* ── Summary cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Итого", value: s?.total_amount ?? 0, color: "text-foreground" },
          { label: "Оплачено", value: s?.total_paid ?? 0, color: "text-success" },
          { label: "Страховка", value: s?.insurance_covered ?? 0, color: "text-secondary" },
          {
            label: "К оплате",
            value: s?.patient_balance ?? 0,
            color:
              s?.patient_balance && Number(s.patient_balance) > 0
                ? "text-destructive"
                : "text-foreground",
          },
        ].map((item, i) => (
          <div
            key={item.label}
            className="bg-[var(--color-surface)] rounded-2xl border border-border p-4 animate-float-up"
            style={{ animationDelay: `${100 + i * 60}ms` }}
          >
            <p className="text-xs text-[var(--color-text-tertiary)] mb-1">{item.label}</p>
            <p className={`text-xl font-bold ${item.color}`}>{formatCurrency(Number(item.value))}</p>
          </div>
        ))}
      </div>

      {/* ── Charts ────────────────────────────────────────────────── */}
      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Pie: expense breakdown */}
          {categoryData.some((d) => d.value > 0) && (
            <div
              className="bg-[var(--color-surface)] rounded-2xl border border-border p-5 animate-float-up"
              style={{ animationDelay: "280ms" }}
            >
              <h2 className="text-sm font-semibold text-foreground mb-4">Расходы по категориям</h2>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend
                    formatter={(value) => (
                      <span className="text-xs text-[var(--color-text-secondary)]">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Line: expenses over time */}
          {timelineData.length > 1 && (
            <div
              className="bg-[var(--color-surface)] rounded-2xl border border-border p-5 animate-float-up"
              style={{ animationDelay: "340ms" }}
            >
              <h2 className="text-sm font-semibold text-foreground mb-4">Динамика расходов</h2>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={timelineData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) =>
                      new Intl.NumberFormat("ru-KG", {
                        notation: "compact",
                        maximumSignificantDigits: 3,
                      }).format(v)
                    }
                  />
                  <Tooltip
                    content={
                      <CurrencyTooltip />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    name="Сумма"
                    stroke="#7E78D2"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#7E78D2" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────── */}
      <div
        className="flex gap-1 p-1 bg-[var(--color-muted)] rounded-xl mb-4 animate-float-up"
        style={{ animationDelay: "400ms" }}
      >
        <button
          onClick={() => setTab("invoices")}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
            tab === "invoices"
              ? "bg-[var(--color-surface)] text-foreground shadow-sm"
              : "text-[var(--color-text-secondary)]"
          }`}
        >
          Счета
        </button>
        <button
          onClick={() => setTab("payments")}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
            tab === "payments"
              ? "bg-[var(--color-surface)] text-foreground shadow-sm"
              : "text-[var(--color-text-secondary)]"
          }`}
        >
          Платежи
        </button>
      </div>

      {/* ── Tab content ───────────────────────────────────────────── */}
      <div className="animate-float-up" style={{ animationDelay: "450ms" }}>
        {tab === "invoices" ? (
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border divide-y divide-border">
            {invoicesLoading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-[var(--color-muted)] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : invoices.length === 0 ? (
              <div className="p-8 text-center">
                <svg
                  className="w-10 h-10 mx-auto mb-3 text-[var(--color-text-tertiary)]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                  <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                </svg>
                <p className="text-[var(--color-text-secondary)]">Нет счетов</p>
              </div>
            ) : (
              invoices.map((inv) => <InvoiceRow key={String(inv.id)} inv={inv} />)
            )}
          </div>
        ) : (
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border divide-y divide-border">
            {paymentsLoading ? (
              <div className="space-y-3 p-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-14 bg-[var(--color-muted)] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : payments.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-[var(--color-text-secondary)]">Нет платежей</p>
              </div>
            ) : (
              payments.map((p) => (
                <div key={String(p.id)} className="flex items-center gap-4 p-4">
                  <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-success"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {formatCurrency(Number(p.amount))}
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {String(p.payment_method ?? "—")} ·{" "}
                      {new Date(String(p.paid_at)).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
                    Оплачен
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
