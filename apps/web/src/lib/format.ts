import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";

/** Primary marketplace currency — Metical moçambicano */
export function formatMZN(cents: number): string {
  return formatMoney(cents, "MZN", "pt-MZ");
}

/** @deprecated Prefer formatMZN — kept as alias for Moçambique */
export function formatBRL(cents: number): string {
  return formatMZN(cents);
}

export function formatMoney(
  cents: number,
  currency: string = "MZN",
  locale = "pt-MZ",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function formatDate(
  value: string | Date,
  pattern = "dd MMM yyyy",
): string {
  const date = typeof value === "string" ? parseISO(value) : value;
  return format(date, pattern, { locale: pt });
}

export function formatDateTime(value: string | Date): string {
  return formatDate(value, "dd MMM yyyy, HH:mm");
}
