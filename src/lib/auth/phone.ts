export function normalizeVietnamPhone(input: string) {
  const raw = input.trim();
  const digits = raw.replace(/\D/g, "");

  if (!digits) return "";
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("84")) return `+${digits}`;
  if (digits.startsWith("0")) return `+84${digits.slice(1)}`;
  return `+84${digits}`;
}

export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, 3)}****${digits.slice(-3)}`;
}
