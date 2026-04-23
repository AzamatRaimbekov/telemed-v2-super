import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { loyaltyApi } from "@/features/loyalty/api";
import { useState } from "react";

export const Route = createFileRoute("/portal/_portal/loyalty")({
  component: LoyaltyPage,
});

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  bronze: { label: "Бронза", color: "text-amber-700", bg: "bg-amber-100" },
  silver: { label: "Серебро", color: "text-gray-500", bg: "bg-gray-100" },
  gold: { label: "Золото", color: "text-yellow-600", bg: "bg-yellow-100" },
  platinum: { label: "Платина", color: "text-purple-600", bg: "bg-purple-100" },
};

function LoyaltyPage() {
  const [historyLimit] = useState(50);

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ["loyalty-balance"],
    queryFn: () => loyaltyApi.getBalance(),
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["loyalty-history", historyLimit],
    queryFn: () => loyaltyApi.getHistory(historyLimit),
  });

  const tier = TIER_CONFIG[balance?.tier ?? "bronze"] ?? TIER_CONFIG.bronze;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Бонусная программа</h1>

      {/* Balance card */}
      <div className="rounded-2xl border border-border bg-[var(--color-surface)] p-6 space-y-4">
        {balanceLoading ? (
          <div className="animate-pulse h-20 bg-muted rounded-xl" />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-secondary)]">Ваш баланс</p>
                <p className="text-4xl font-bold text-foreground">{balance?.balance ?? 0} <span className="text-lg font-normal text-[var(--color-text-tertiary)]">баллов</span></p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${tier.color} ${tier.bg}`}>
                {tier.label}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-3">
                <p className="text-[var(--color-text-secondary)]">Всего начислено</p>
                <p className="text-lg font-semibold text-green-700 dark:text-green-400">+{balance?.total_earned ?? 0}</p>
              </div>
              <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3">
                <p className="text-[var(--color-text-secondary)]">Всего потрачено</p>
                <p className="text-lg font-semibold text-red-700 dark:text-red-400">-{balance?.total_spent ?? 0}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* How to earn */}
      <div className="rounded-2xl border border-border bg-[var(--color-surface)] p-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">Как заработать баллы</h2>
        <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">+50</span>
            <span>За каждый визит к врачу</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">+100</span>
            <span>За прохождение полного обследования</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">+10</span>
            <span>За каждые 1000 сом оплаты</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">+200</span>
            <span>Промо-акции и праздничные бонусы</span>
          </li>
        </ul>
        <div className="mt-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-sm">
          <p className="font-medium text-blue-700 dark:text-blue-400">Уровни:</p>
          <p className="text-[var(--color-text-secondary)]">Бронза (0) → Серебро (500) → Золото (2000) → Платина (5000)</p>
        </div>
      </div>

      {/* Transaction history */}
      <div className="rounded-2xl border border-border bg-[var(--color-surface)] p-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">История операций</h2>
        {historyLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted rounded-xl" />
            ))}
          </div>
        ) : !history || history.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)] py-4 text-center">Нет операций</p>
        ) : (
          <div className="space-y-2">
            {history.map((txn: { id: string; amount: number; transaction_type: string; description: string; created_at: string }) => (
              <div key={txn.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm text-foreground">{txn.description}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {txn.created_at ? new Date(txn.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                  </p>
                </div>
                <span className={`text-sm font-semibold ${txn.amount > 0 ? "text-green-600" : "text-red-500"}`}>
                  {txn.amount > 0 ? "+" : ""}{txn.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
