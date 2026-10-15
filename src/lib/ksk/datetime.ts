export const hisDateTimeNotice = "Ngày giờ theo dữ liệu HIS, định dạng ngày/tháng/năm giờ:phút:giây; không tự đổi múi giờ. Nếu nguồn là 00:00:00, giữ nguyên và chưa xác minh đây là giờ thu thực tế; thiếu giờ sẽ ghi rõ chưa có giờ.";

// Oracle DATE is a local wall-clock value, not a UTC instant. Never use Date.parse
// or the browser timezone here; format only the precision supplied by HIS.
export function formatHisDateTime(value: string | null | undefined): string {
  if (!value?.trim()) return "Chưa xác định";
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value.trim());
  if (!match) return "Ngày giờ nguồn không hợp lệ";
  const [, year, month, day, hour, minute, second] = match;
  const y = Number(year), m = Number(month), d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > days[m - 1]
    || (hour !== undefined && (Number(hour) > 23 || Number(minute) > 59 || Number(second ?? 0) > 59))) return "Ngày giờ nguồn không hợp lệ";
  const date = `${day}/${month}/${year}`;
  return hour === undefined ? `${date} (chưa có giờ)` : `${date} ${hour}:${minute}${second === undefined ? " (chưa có giây)" : `:${second}`}`;
}
