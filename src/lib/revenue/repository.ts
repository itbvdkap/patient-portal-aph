import "server-only";
import { cloudBranch, cloudKskRequest, kskCloudEnabled } from "@/lib/ksk/cloud-repository";
import { revenueQuerySchema, revenueSnapshotSchema, type RevenueQuery } from "./domain";

export async function readRevenue(query: RevenueQuery) {
  if (process.env.KSK_ENABLED !== "true") throw new Error("Chưa bật kết nối báo cáo HIS.");
  const checked = revenueQuerySchema.parse(query); const input = { reportType: "cashier", from: checked.from, to: checked.to };
  let payload: unknown;
  if (kskCloudEnabled()) payload = await cloudKskRequest("report", input);
  else {
    if (process.env.VERCEL || process.env.KSK_DATA_MODE !== "his") throw new Error("Chưa cấu hình nguồn báo cáo viện phí.");
    const base = process.env.KSK_API_BASE_URL, token = process.env.KSK_API_SERVER_TOKEN;
    if (!base || !token || token.length < 32) throw new Error("Thiếu kết nối agent viện phí.");
    const url = new URL(base);
    if (url.username || url.password || url.search || url.hash || !["http:", "https:"].includes(url.protocol) || (url.protocol !== "https:" && !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))) throw new Error("URL agent không hợp lệ.");
    const endpoint = new URL(`${url.pathname.replace(/\/$/, "")}/api/internal/vienphi-revenue`, url.origin); endpoint.search = new URLSearchParams({ from: checked.from, to: checked.to }).toString();
    const response = await fetch(endpoint, { cache: "no-store", redirect: "error", headers: { "X-Ksk-Token": token }, signal: AbortSignal.timeout(55000) });
    if (!response.ok) throw new Error("Agent chưa hỗ trợ báo cáo viện phí hoặc chưa đọc được HIS. Cần cập nhật gói agent mới.");
    payload = await response.json();
  }
  const data = revenueSnapshotSchema.parse(payload);
  if (data.scope.from !== checked.from || data.scope.to !== checked.to || data.scope.branch !== cloudBranch()) throw new Error("Sai phạm vi báo cáo viện phí.");
  return data;
}
