import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function formatDate(
  value: string | Date,
  pattern = "dd MMM yyyy",
): string {
  const date = typeof value === "string" ? parseISO(value) : value;
  return format(date, pattern, { locale: ptBR });
}

export function formatDateTime(value: string | Date): string {
  return formatDate(value, "dd MMM yyyy, HH:mm");
}
