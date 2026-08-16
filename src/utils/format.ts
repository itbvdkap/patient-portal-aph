import { format } from "date-fns";
import { vi } from "date-fns/locale/vi";

export function formatDate(value: string) {
  return format(new Date(value), "dd/MM/yyyy", { locale: vi });
}

export function formatDateTime(value: string) {
  return format(new Date(value), "dd/MM/yyyy HH:mm", { locale: vi });
}
