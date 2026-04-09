import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), "dd.MM.yyyy");
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), "dd.MM.yyyy HH:mm");
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ru-KG", {
    style: "currency",
    currency: "KGS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
