// routes/_authenticated/patients.$patientId/billing.tsx
// Staff billing management — invoices, payments, CRUD operations for a specific patient

import { createFileRoute } from "@tanstack/react-router";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { patientsApi } from "@/features/patients/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

export const Route = createFileRoute(
  "/_authenticated/patients/$patientId/billing"
)({
  component: BillingPage,
});

// ─── Types ───────────────────────────────────────────────────────────────────

type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PAID"
  | "PARTIALLY_PAID"
  | "CANCELLED"
  | "OVERDUE";

type PaymentMethod =
  | "CASH"
  | "CARD"
  | "INSURANCE"
  | "BANK_TRANSFER"
  | "OTHER";

type InvoiceItemType =
  | "CONSULTATION"
  | "PROCEDURE"
  | "LAB"
  | "MEDICATION"
  | "ROOM"
  | "OTHER";

type Invoice = {
  id: string;
  invoice_number: string;
  patient_id: string;
  patient_name?: string;
  status: InvoiceStatus;
  total: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  notes?: string;
  issued_at?: string;
  created_at: string;
  items?: InvoiceItem[];
  payments?: Payment[];
};

type InvoiceItem = {
  id?: string;
  item_type: InvoiceItemType;
  description: string;
  quantity: number;
  unit_price: number;
  total?: number;
};

type Payment = {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: PaymentMethod;
  reference_number?: string;
  paid_at: string;
  received_by?: string;
};

type BillingStats = {
  total_invoiced: number;
  total_paid: number;
  outstanding: number;
  overdue: number;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Черновик",
  ISSUED: "Выставлен",
  PAID: "Оплачен",
  PARTIALLY_PAID: "Частично",
  CANCELLED: "Отменён",
  OVERDUE: "Просрочен",
};

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT: "bg-[var(--color-muted)] text-[var(--color-text-tertiary)]",
  ISSUED: "bg-secondary/10 text-secondary",
  PAID: "bg-success/10 text-success",
  PARTIALLY_PAID: "bg-warning/10 text-warning",
  CANCELLED: "bg-destructive/10 text-destructive",
  OVERDUE: "bg-destructive/10 text-destructive",
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Наличные",
  CARD: "Карта",
  INSURANCE: "Страховка",
  BANK_TRANSFER: "Перевод",
  OTHER: "Другое",
};

const METHOD_COLORS: Record<PaymentMethod, string> = {
  CASH: "bg-success/10 text-success",
  CARD: "bg-secondary/10 text-secondary",
  INSURANCE: "bg-purple-500/10 text-purple-400",
  BANK_TRANSFER: "bg-cyan-500/10 text-cyan-400",
  OTHER: "bg-[var(--color-muted)] text-[var(--color-text-tertiary)]",
};

const ITEM_TYPE_LABELS: Record<InvoiceItemType, string> = {
  CONSULTATION: "Консультация",
  PROCEDURE: "Процедура",
  LAB: "Анализ",
  MEDICATION: "Лекарство",
  ROOM: "Палата",
  OTHER: "Другое",
};

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Все" },
  { value: "DRAFT", label: "Черновик" },
  { value: "ISSUED", label: "Выставлен" },
  { value: "PAID", label: "Оплачен" },
  { value: "PARTIALLY_PAID", label: "Частично" },
  { value: "CANCELLED", label: "Отменён" },
  { value: "OVERDUE", label: "Просрочен" },
];

// ─── Invoice Row ─────────────────────────────────────────────────────────────

function InvoiceRow({
  invoice,
  onStatusChange,
  onDelete,
  isUpdating,
}: {
  invoice: Invoice;
  onStatusChange: (id: string, status: InvoiceStatus) => void;
  onDelete: (id: string) => void;
  isUpdating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const items = invoice.items ?? [];
  const payments = invoice.payments ?? [];

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-4 p-4 hover:bg-[var(--color-muted)]/40 transition-colors text-left"
      >
        {/* Icon */}
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

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            Счёт №{invoice.invoice_number}
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {formatDate(invoice.issued_at ?? invoice.created_at)}
            {items.length > 0 && ` · ${items.length} позиций`}
          </p>
        </div>

        {/* Status badge */}
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            STATUS_COLORS[invoice.status] ??
            "bg-[var(--color-muted)] text-[var(--color-text-secondary)]"
          }`}
        >
          {STATUS_LABELS[invoice.status] ?? invoice.status}
        </span>

        {/* Total */}
        <p className="text-sm font-bold text-foreground flex-shrink-0">
          {formatCurrency(invoice.total)}
        </p>

        {/* Chevron */}
        <svg
          className={`w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0 transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Items table */}
          {items.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[var(--color-muted)]/60">
                    <th className="text-left p-2.5 font-medium text-[var(--color-text-tertiary)]">
                      Тип
                    </th>
                    <th className="text-left p-2.5 font-medium text-[var(--color-text-tertiary)]">
                      Описание
                    </th>
                    <th className="text-center p-2.5 font-medium text-[var(--color-text-tertiary)]">
                      Кол-во
                    </th>
                    <th className="text-right p-2.5 font-medium text-[var(--color-text-tertiary)]">
                      Цена
                    </th>
                    <th className="text-right p-2.5 font-medium text-[var(--color-text-tertiary)]">
                      Сумма
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item, idx) => (
                    <tr key={item.id ?? idx} className="bg-[var(--color-surface)]">
                      <td className="p-2.5 text-[var(--color-text-secondary)]">
                        {ITEM_TYPE_LABELS[item.item_type] ?? item.item_type}
                      </td>
                      <td className="p-2.5 text-foreground">
                        {item.description || "—"}
                      </td>
                      <td className="p-2.5 text-center text-[var(--color-text-secondary)]">
                        {item.quantity}
                      </td>
                      <td className="p-2.5 text-right text-[var(--color-text-secondary)]">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="p-2.5 text-right font-medium text-foreground">
                        {formatCurrency(item.total ?? item.quantity * item.unit_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {items.length === 0 && (
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Состав счёта недоступен
            </p>
          )}

          {/* Payments on this invoice */}
          {payments.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">
                Платежи по счёту:
              </p>
              <div className="space-y-1">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 text-xs p-2 rounded-lg bg-[var(--color-muted)]/40"
                  >
                    <span className="font-medium text-foreground">
                      {formatCurrency(p.amount)}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                        METHOD_COLORS[p.payment_method] ?? ""
                      }`}
                    >
                      {METHOD_LABELS[p.payment_method] ?? p.payment_method}
                    </span>
                    <span className="text-[var(--color-text-tertiary)]">
                      {formatDate(p.paid_at)}
                    </span>
                    {p.reference_number && (
                      <span className="text-[var(--color-text-tertiary)]">
                        #{p.reference_number}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoice notes */}
          {invoice.notes && (
            <p className="text-xs text-[var(--color-text-secondary)] italic">
              {invoice.notes}
            </p>
          )}

          {/* Subtotal / discount / tax breakdown */}
          {(invoice.discount || invoice.tax) && (
            <div className="flex flex-col items-end gap-0.5 text-xs text-[var(--color-text-secondary)]">
              {invoice.subtotal != null && (
                <span>Подитог: {formatCurrency(invoice.subtotal)}</span>
              )}
              {invoice.discount != null && invoice.discount > 0 && (
                <span>Скидка: -{formatCurrency(invoice.discount)}</span>
              )}
              {invoice.tax != null && invoice.tax > 0 && (
                <span>Налог: +{formatCurrency(invoice.tax)}</span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {/* Status change */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowStatusMenu((p) => !p)}
                disabled={isUpdating}
              >
                Изменить статус
              </Button>
              {showStatusMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowStatusMenu(false)}
                  />
                  <div className="absolute left-0 top-full mt-1 z-50 bg-[var(--color-surface)] border border-border rounded-xl shadow-lg py-1 min-w-[160px]">
                    {(
                      ["DRAFT", "ISSUED", "PAID", "PARTIALLY_PAID", "CANCELLED", "OVERDUE"] as InvoiceStatus[]
                    ).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          onStatusChange(invoice.id, s);
                          setShowStatusMenu(false);
                        }}
                        disabled={invoice.status === s}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                          invoice.status === s
                            ? "text-[var(--color-text-tertiary)] cursor-default"
                            : "text-foreground hover:bg-[var(--color-muted)]"
                        }`}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Delete */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.confirm("Удалить счёт? Это действие необратимо.")) {
                  onDelete(invoice.id);
                }
              }}
              disabled={isUpdating}
              className="text-destructive hover:text-destructive"
            >
              Удалить
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create Invoice Modal ────────────────────────────────────────────────────

type DraftItem = {
  item_type: InvoiceItemType;
  description: string;
  quantity: number;
  unit_price: number;
};

const EMPTY_ITEM: DraftItem = {
  item_type: "CONSULTATION",
  description: "",
  quantity: 1,
  unit_price: 0,
};

function CreateInvoiceModal({
  open,
  onClose,
  patientId,
}: {
  open: boolean;
  patientId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<DraftItem[]>([{ ...EMPTY_ITEM }]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [notes, setNotes] = useState("");

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.quantity * i.unit_price, 0),
    [items]
  );
  const total = subtotal - discount + tax;

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      patientsApi.createInvoice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["billing-invoices", patientId],
      });
      toast.success("Счёт создан");
      handleReset();
      onClose();
    },
    onError: () => toast.error("Не удалось создать счёт"),
  });

  const handleReset = useCallback(() => {
    setItems([{ ...EMPTY_ITEM }]);
    setDiscount(0);
    setTax(0);
    setNotes("");
  }, []);

  const handleAddItem = useCallback(() => {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }, []);

  const handleRemoveItem = useCallback((idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleItemChange = useCallback(
    (idx: number, field: keyof DraftItem, value: string | number) => {
      setItems((prev) =>
        prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
      );
    },
    []
  );

  const handleSubmit = useCallback(() => {
    const validItems = items.filter(
      (i) => i.description.trim() && i.unit_price > 0
    );
    if (validItems.length === 0) {
      toast.error("Добавьте хотя бы одну позицию");
      return;
    }
    createMutation.mutate({
      patient_id: patientId,
      items: validItems.map((i) => ({
        item_type: i.item_type,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
      discount,
      tax,
      notes: notes || undefined,
    });
  }, [items, discount, tax, notes, patientId, createMutation]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-[var(--color-surface)] border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
        <h2 className="text-lg font-bold text-foreground mb-4">
          Создать счёт
        </h2>

        {/* Items */}
        <div className="space-y-3 mb-4">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">
            Позиции
          </p>
          {items.map((item, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[120px_1fr_70px_100px_32px] gap-2 items-end"
            >
              {/* Type */}
              <div>
                {idx === 0 && (
                  <label className="text-[10px] text-[var(--color-text-tertiary)] mb-1 block">
                    Тип
                  </label>
                )}
                <select
                  value={item.item_type}
                  onChange={(e) =>
                    handleItemChange(idx, "item_type", e.target.value)
                  }
                  className="w-full h-9 px-2 rounded-lg border border-border bg-[var(--color-muted)] text-xs text-foreground"
                >
                  {Object.entries(ITEM_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                {idx === 0 && (
                  <label className="text-[10px] text-[var(--color-text-tertiary)] mb-1 block">
                    Описание
                  </label>
                )}
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) =>
                    handleItemChange(idx, "description", e.target.value)
                  }
                  placeholder="Наименование услуги"
                  className="w-full h-9 px-3 rounded-lg border border-border bg-[var(--color-muted)] text-xs text-foreground placeholder:text-[var(--color-text-tertiary)]"
                />
              </div>

              {/* Quantity */}
              <div>
                {idx === 0 && (
                  <label className="text-[10px] text-[var(--color-text-tertiary)] mb-1 block">
                    Кол-во
                  </label>
                )}
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) =>
                    handleItemChange(idx, "quantity", Number(e.target.value) || 1)
                  }
                  className="w-full h-9 px-2 rounded-lg border border-border bg-[var(--color-muted)] text-xs text-foreground text-center"
                />
              </div>

              {/* Unit price */}
              <div>
                {idx === 0 && (
                  <label className="text-[10px] text-[var(--color-text-tertiary)] mb-1 block">
                    Цена
                  </label>
                )}
                <input
                  type="number"
                  min={0}
                  value={item.unit_price || ""}
                  onChange={(e) =>
                    handleItemChange(
                      idx,
                      "unit_price",
                      Number(e.target.value) || 0
                    )
                  }
                  placeholder="0"
                  className="w-full h-9 px-2 rounded-lg border border-border bg-[var(--color-muted)] text-xs text-foreground text-right"
                />
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => handleRemoveItem(idx)}
                disabled={items.length <= 1}
                className="h-9 w-8 flex items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={handleAddItem}
            className="text-xs text-secondary hover:text-secondary/80 font-medium"
          >
            + Добавить позицию
          </button>
        </div>

        {/* Discount / Tax */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[10px] text-[var(--color-text-tertiary)] mb-1 block">
              Скидка (KGS)
            </label>
            <input
              type="number"
              min={0}
              value={discount || ""}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              placeholder="0"
              className="w-full h-9 px-3 rounded-lg border border-border bg-[var(--color-muted)] text-xs text-foreground"
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--color-text-tertiary)] mb-1 block">
              Налог (KGS)
            </label>
            <input
              type="number"
              min={0}
              value={tax || ""}
              onChange={(e) => setTax(Number(e.target.value) || 0)}
              placeholder="0"
              className="w-full h-9 px-3 rounded-lg border border-border bg-[var(--color-muted)] text-xs text-foreground"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="text-[10px] text-[var(--color-text-tertiary)] mb-1 block">
            Примечания
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Комментарий к счёту..."
            className="w-full px-3 py-2 rounded-lg border border-border bg-[var(--color-muted)] text-xs text-foreground placeholder:text-[var(--color-text-tertiary)] resize-none"
          />
        </div>

        {/* Totals */}
        <div className="flex flex-col items-end gap-1 text-sm mb-5 border-t border-border pt-3">
          <span className="text-[var(--color-text-secondary)]">
            Подитог: {formatCurrency(subtotal)}
          </span>
          {discount > 0 && (
            <span className="text-[var(--color-text-secondary)]">
              Скидка: -{formatCurrency(discount)}
            </span>
          )}
          {tax > 0 && (
            <span className="text-[var(--color-text-secondary)]">
              Налог: +{formatCurrency(tax)}
            </span>
          )}
          <span className="text-base font-bold text-foreground">
            Итого: {formatCurrency(total)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Сохранение..." : "Создать счёт"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Record Payment Modal ────────────────────────────────────────────────────

function RecordPaymentModal({
  open,
  onClose,
  patientId,
  invoices,
}: {
  open: boolean;
  onClose: () => void;
  patientId: string;
  invoices: Invoice[];
}) {
  const queryClient = useQueryClient();
  const unpaidInvoices = useMemo(
    () =>
      invoices.filter(
        (inv) =>
          inv.status === "ISSUED" ||
          inv.status === "PARTIALLY_PAID" ||
          inv.status === "OVERDUE"
      ),
    [invoices]
  );

  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");

  // When invoice selection changes, default amount to the invoice total (remaining)
  const selectedInvoice = unpaidInvoices.find(
    (inv) => inv.id === selectedInvoiceId
  );
  const remainingBalance = selectedInvoice
    ? selectedInvoice.total -
      (selectedInvoice.payments ?? []).reduce((s, p) => s + p.amount, 0)
    : 0;

  const paymentMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      patientsApi.recordPayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["billing-invoices", patientId],
      });
      queryClient.invalidateQueries({
        queryKey: ["billing-payments", patientId],
      });
      toast.success("Оплата записана");
      setSelectedInvoiceId("");
      setAmount(0);
      setMethod("CASH");
      setReference("");
      onClose();
    },
    onError: () => toast.error("Не удалось записать оплату"),
  });

  const handleSubmit = useCallback(() => {
    if (!selectedInvoiceId) {
      toast.error("Выберите счёт");
      return;
    }
    if (amount <= 0) {
      toast.error("Укажите сумму");
      return;
    }
    paymentMutation.mutate({
      invoice_id: selectedInvoiceId,
      amount,
      payment_method: method,
      reference_number: reference || undefined,
    });
  }, [selectedInvoiceId, amount, method, reference, paymentMutation]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-[var(--color-surface)] border border-border rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-foreground mb-4">
          Записать оплату
        </h2>

        {/* Invoice selector */}
        <div className="mb-3">
          <label className="text-[10px] text-[var(--color-text-tertiary)] mb-1 block">
            Счёт
          </label>
          <select
            value={selectedInvoiceId}
            onChange={(e) => {
              setSelectedInvoiceId(e.target.value);
              const inv = unpaidInvoices.find((i) => i.id === e.target.value);
              if (inv) {
                const paid = (inv.payments ?? []).reduce(
                  (s, p) => s + p.amount,
                  0
                );
                setAmount(inv.total - paid);
              }
            }}
            className="w-full h-9 px-3 rounded-lg border border-border bg-[var(--color-muted)] text-xs text-foreground"
          >
            <option value="">Выберите счёт</option>
            {unpaidInvoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                №{inv.invoice_number} — {formatCurrency(inv.total)} (
                {STATUS_LABELS[inv.status]})
              </option>
            ))}
          </select>
          {selectedInvoice && (
            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">
              Остаток: {formatCurrency(remainingBalance)}
            </p>
          )}
        </div>

        {/* Amount */}
        <div className="mb-3">
          <label className="text-[10px] text-[var(--color-text-tertiary)] mb-1 block">
            Сумма (KGS)
          </label>
          <input
            type="number"
            min={0}
            value={amount || ""}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            placeholder="0"
            className="w-full h-9 px-3 rounded-lg border border-border bg-[var(--color-muted)] text-xs text-foreground"
          />
        </div>

        {/* Payment method */}
        <div className="mb-3">
          <label className="text-[10px] text-[var(--color-text-tertiary)] mb-1 block">
            Способ оплаты
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            className="w-full h-9 px-3 rounded-lg border border-border bg-[var(--color-muted)] text-xs text-foreground"
          >
            {Object.entries(METHOD_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {/* Reference number */}
        <div className="mb-5">
          <label className="text-[10px] text-[var(--color-text-tertiary)] mb-1 block">
            Номер ссылки (необязательно)
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Номер чека, транзакции..."
            className="w-full h-9 px-3 rounded-lg border border-border bg-[var(--color-muted)] text-xs text-foreground placeholder:text-[var(--color-text-tertiary)]"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={paymentMutation.isPending}
          >
            {paymentMutation.isPending ? "Сохранение..." : "Записать"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

function BillingPage() {
  const { patientId } = Route.useParams();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"invoices" | "payments">("invoices");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);

  // ── Queries ──

  const { data: invoicesRaw, isLoading: invoicesLoading } = useQuery({
    queryKey: ["billing-invoices", patientId],
    queryFn: () => patientsApi.getInvoices(patientId),
  });

  const { data: paymentsRaw, isLoading: paymentsLoading } = useQuery({
    queryKey: ["billing-payments", patientId],
    queryFn: () => patientsApi.getPayments(patientId),
  });

  const invoices = (invoicesRaw as Invoice[] | undefined) ?? [];
  const payments = (paymentsRaw as Payment[] | undefined) ?? [];

  // ── Derived stats ──

  const stats = useMemo<BillingStats>(() => {
    const totalInvoiced = invoices.reduce((s, inv) => s + inv.total, 0);
    const totalPaid = invoices
      .filter((inv) => inv.status === "PAID")
      .reduce((s, inv) => s + inv.total, 0);
    const partiallyPaid = invoices
      .filter((inv) => inv.status === "PARTIALLY_PAID")
      .reduce(
        (s, inv) =>
          s + (inv.payments ?? []).reduce((ps, p) => ps + p.amount, 0),
        0
      );
    const allPaid = totalPaid + partiallyPaid;
    // Also add standalone payments not reflected in invoice status
    const standalonePaymentsTotal = payments.reduce(
      (s, p) => s + p.amount,
      0
    );
    const paid = Math.max(allPaid, standalonePaymentsTotal);
    const outstanding = Math.max(0, totalInvoiced - paid);
    const overdue = invoices
      .filter((inv) => inv.status === "OVERDUE")
      .reduce((s, inv) => s + inv.total, 0);

    return {
      total_invoiced: totalInvoiced,
      total_paid: paid,
      outstanding,
      overdue,
    };
  }, [invoices, payments]);

  // ── Filtered invoices ──

  const filteredInvoices = useMemo(
    () =>
      statusFilter
        ? invoices.filter((inv) => inv.status === statusFilter)
        : invoices,
    [invoices, statusFilter]
  );

  // ── Mutations ──

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: InvoiceStatus }) =>
      patientsApi.updateInvoice(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["billing-invoices", patientId],
      });
      toast.success("Статус обновлён");
    },
    onError: () => toast.error("Не удалось обновить статус"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => patientsApi.deleteInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["billing-invoices", patientId],
      });
      toast.success("Счёт удалён");
    },
    onError: () => toast.error("Не удалось удалить счёт"),
  });

  const handleStatusChange = useCallback(
    (id: string, status: InvoiceStatus) => {
      updateStatusMutation.mutate({ id, status });
    },
    [updateStatusMutation]
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation]
  );

  const isUpdating =
    updateStatusMutation.isPending || deleteMutation.isPending;

  // ── Loading state ──

  if (invoicesLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {/* Stats skeletons */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-20 bg-[var(--color-muted)] rounded-2xl"
            />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-16 bg-[var(--color-muted)] rounded-2xl"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Summary Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Всего выставлено",
            value: stats.total_invoiced,
            color: "text-foreground",
            icon: (
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            ),
            iconColor: "text-secondary",
            iconBg: "bg-secondary/10",
          },
          {
            label: "Оплачено",
            value: stats.total_paid,
            color: "text-success",
            icon: <path d="M5 13l4 4L19 7" />,
            iconColor: "text-success",
            iconBg: "bg-success/10",
          },
          {
            label: "Задолженность",
            value: stats.outstanding,
            color:
              stats.outstanding > 0 ? "text-warning" : "text-foreground",
            icon: (
              <>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </>
            ),
            iconColor:
              stats.outstanding > 0
                ? "text-warning"
                : "text-[var(--color-text-tertiary)]",
            iconBg:
              stats.outstanding > 0
                ? "bg-warning/10"
                : "bg-[var(--color-muted)]",
          },
          {
            label: "Просрочено",
            value: stats.overdue,
            color:
              stats.overdue > 0 ? "text-destructive" : "text-foreground",
            icon: (
              <>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </>
            ),
            iconColor:
              stats.overdue > 0
                ? "text-destructive"
                : "text-[var(--color-text-tertiary)]",
            iconBg:
              stats.overdue > 0
                ? "bg-destructive/10"
                : "bg-[var(--color-muted)]",
          },
        ].map((card, i) => (
          <div
            key={card.label}
            className="bg-[var(--color-surface)] rounded-2xl border border-border p-4 animate-float-up"
            style={{ animationDelay: `${80 + i * 60}ms` }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`w-8 h-8 rounded-lg ${card.iconBg} flex items-center justify-center`}
              >
                <svg
                  className={`w-4 h-4 ${card.iconColor}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {card.icon}
                </svg>
              </div>
              <p className="text-[10px] text-[var(--color-text-tertiary)] leading-tight">
                {card.label}
              </p>
            </div>
            <p className={`text-xl font-bold ${card.color}`}>
              {formatCurrency(card.value)}
            </p>
          </div>
        ))}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 p-1 bg-[var(--color-muted)] rounded-xl">
          <button
            type="button"
            onClick={() => setTab("invoices")}
            className={`py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              tab === "invoices"
                ? "bg-[var(--color-surface)] text-foreground shadow-sm"
                : "text-[var(--color-text-secondary)]"
            }`}
          >
            Счета
            {invoices.length > 0 && (
              <span className="ml-1.5 text-[10px] text-[var(--color-text-tertiary)]">
                {invoices.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab("payments")}
            className={`py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              tab === "payments"
                ? "bg-[var(--color-surface)] text-foreground shadow-sm"
                : "text-[var(--color-text-secondary)]"
            }`}
          >
            Оплаты
            {payments.length > 0 && (
              <span className="ml-1.5 text-[10px] text-[var(--color-text-tertiary)]">
                {payments.length}
              </span>
            )}
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {tab === "invoices" ? (
            <Button size="sm" onClick={() => setShowCreateInvoice(true)}>
              + Создать счёт
            </Button>
          ) : (
            <Button size="sm" onClick={() => setShowRecordPayment(true)}>
              + Записать оплату
            </Button>
          )}
        </div>
      </div>

      {/* ── Tab: Invoices ──────────────────────────────────────────── */}
      {tab === "invoices" && (
        <>
          {/* Status filter */}
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_OPTIONS.map((opt) => {
              const count = opt.value
                ? invoices.filter((inv) => inv.status === opt.value).length
                : invoices.length;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatusFilter(opt.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    statusFilter === opt.value
                      ? "bg-secondary text-white"
                      : "bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:text-foreground"
                  }`}
                >
                  {opt.label}
                  {count > 0 && (
                    <span className="ml-1.5 text-[10px] opacity-70">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Invoice list */}
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border divide-y divide-border">
            {filteredInvoices.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[var(--color-muted)] flex items-center justify-center mx-auto mb-3">
                  <svg
                    className="w-6 h-6 text-[var(--color-text-tertiary)]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  Нет счетов
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {statusFilter
                    ? "Нет счетов с выбранным статусом"
                    : "Создайте первый счёт для пациента"}
                </p>
              </div>
            ) : (
              filteredInvoices.map((inv) => (
                <InvoiceRow
                  key={inv.id}
                  invoice={inv}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  isUpdating={isUpdating}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* ── Tab: Payments ──────────────────────────────────────────── */}
      {tab === "payments" && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border divide-y divide-border">
          {paymentsLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 bg-[var(--color-muted)] rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[var(--color-muted)] flex items-center justify-center mx-auto mb-3">
                <svg
                  className="w-6 h-6 text-[var(--color-text-tertiary)]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" x2="12" y1="2" y2="22" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <p className="text-sm font-medium text-foreground mb-1">
                Нет оплат
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Платежи появятся после записи оплаты по счетам
              </p>
            </div>
          ) : (
            payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-4 p-4"
              >
                {/* Icon */}
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

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {formatCurrency(p.amount)}
                  </p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {formatDate(p.paid_at)}
                    {p.received_by && ` · ${p.received_by}`}
                    {p.reference_number && ` · #${p.reference_number}`}
                  </p>
                </div>

                {/* Method badge */}
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    METHOD_COLORS[p.payment_method] ??
                    "bg-[var(--color-muted)] text-[var(--color-text-secondary)]"
                  }`}
                >
                  {METHOD_LABELS[p.payment_method] ?? p.payment_method}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────── */}
      <CreateInvoiceModal
        open={showCreateInvoice}
        onClose={() => setShowCreateInvoice(false)}
        patientId={patientId}
      />
      <RecordPaymentModal
        open={showRecordPayment}
        onClose={() => setShowRecordPayment(false)}
        patientId={patientId}
        invoices={invoices}
      />
    </div>
  );
}
