const viDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const viDateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatDate(value: string | Date) {
  return viDateFormatter.format(new Date(value));
}

export function formatDateTime(value: string | Date) {
  return viDateTimeFormatter.format(new Date(value)).replace(",", "");
}

export function maskPatientCode(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return trimmed;
  return `${trimmed.slice(0, 2)}${"*".repeat(Math.max(2, trimmed.length - 4))}${trimmed.slice(-2)}`;
}
