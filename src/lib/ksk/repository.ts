import "server-only";
import { querySchema, snapshotSchema, type KskQuery, type KskSnapshot } from "./domain";
import { demoKskSnapshot } from "./sample";
import { collectionQuerySchema, type CollectionQuery } from "./collections";
import { kskCloudEnabled, createCloudKskRepository } from "./cloud-repository";

export interface KskRepository { read(query: KskQuery): Promise<KskSnapshot>; readCollections(query: CollectionQuery): Promise<KskSnapshot> }
export function kskEnabled() { return process.env.KSK_ENABLED === "true"; }
export function kskDemo() { return process.env.KSK_DATA_MODE === "demo" && process.env.NODE_ENV !== "production"; }

export function createKskRepository(): KskRepository {
  if (!kskEnabled()) throw new Error("Module KSK chưa bật. Cấu hình KSK_ENABLED trên máy chủ nội bộ.");
  if (kskCloudEnabled()) return createCloudKskRepository();
  if (process.env.VERCEL) throw new Error("Module chỉ đọc HIS chỉ chạy trên máy chủ nội bộ, chưa hỗ trợ public/Vercel.");
  if (kskDemo()) return { read: async query => demoKskSnapshot(querySchema.parse(query)), readCollections: async query => {
    const q = collectionQuerySchema.parse(query), data = demoKskSnapshot({ from: q.from, to: q.to, cohort: "900001" });
    data.scope = { ...data.scope, collections: true, collectedFrom: q.collectedFrom, collectedTo: q.collectedTo };
    data.members.forEach(m => m.cohortid = "900001"); data.visits.forEach(v => { v.cohortid = "900001"; v.registereddate = v.date; });
    return data;
  } };
  if (process.env.KSK_DATA_MODE !== "his") throw new Error("Cấu hình KSK_DATA_MODE=his để đọc HIS; không tự dùng dữ liệu mẫu.");
  const base = process.env.KSK_API_BASE_URL;
  const token = process.env.KSK_API_SERVER_TOKEN;
  if (!base || !token || token.length < 32) throw new Error("Thiếu cấu hình agent KSK nội bộ hoặc token riêng (tối thiểu 32 ký tự).");
  const url = new URL(base);
  if (url.username || url.password || url.search || url.hash || !["http:", "https:"].includes(url.protocol))
    throw new Error("URL agent KSK không hợp lệ.");
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("Kết nối agent khác máy phải dùng HTTPS.");
  return {
    async readCollections(query) {
      const checked = collectionQuerySchema.parse(query);
      const endpoint = new URL(`${url.pathname.replace(/\/$/, "")}/api/internal/ksk`, url.origin);
      endpoint.search = new URLSearchParams({ from: checked.from, to: checked.to, cohort: "", all: "1", collectedFrom: checked.collectedFrom, collectedTo: checked.collectedTo }).toString();
      let response: Response;
      try { response = await fetch(endpoint, { cache: "no-store", redirect: "error", headers: { "X-Ksk-Token": token }, signal: AbortSignal.timeout(55000) }); }
      catch { throw new Error("Không kết nối được agent KSK để đọc báo cáo thu tiền."); }
      if (!response.ok) throw new Error(`Agent báo cáo thu tiền chưa sẵn sàng (HTTP ${response.status}).`);
      const parsed = snapshotSchema.safeParse(await response.json().catch(() => null));
      if (!parsed.success || parsed.data.scope.mode !== "his" || parsed.data.scope.episodePolicy !== 2 || parsed.data.scope.collections !== true || parsed.data.scope.from !== checked.from || parsed.data.scope.to !== checked.to
        || parsed.data.scope.collectedFrom !== checked.collectedFrom || parsed.data.scope.collectedTo !== checked.collectedTo)
        throw new Error("Agent chưa hỗ trợ hoặc trả sai phạm vi báo cáo thu tổng hợp. Cần cập nhật agent; không dùng tổng từ dữ liệu đợt riêng.");
      return parsed.data;
    },
    async read(query) {
      const checked = querySchema.parse(query);
      const endpoint = new URL(`${url.pathname.replace(/\/$/, "")}/api/internal/ksk`, url.origin);
      endpoint.search = new URLSearchParams(checked).toString();
      let response: Response;
      try {
        response = await fetch(endpoint, { cache: "no-store", redirect: "error", headers: { "X-Ksk-Token": token }, signal: AbortSignal.timeout(55000) });
      } catch { throw new Error("Không kết nối được agent KSK nội bộ. Chưa có dữ liệu HIS để hiển thị."); }
      if (!response.ok) throw new Error(`Agent KSK chưa sẵn sàng (HTTP ${response.status}). Kiểm tra cấu hình và quyền đọc trên agent.`);
      const parsed = snapshotSchema.safeParse(await response.json().catch(() => null));
      if (!parsed.success || parsed.data.scope.mode !== "his" || parsed.data.scope.from !== checked.from || parsed.data.scope.to !== checked.to)
        throw new Error("Dữ liệu agent không đúng hợp đồng/phạm vi yêu cầu; không hiển thị kết quả chưa xác minh.");
      if (checked.cohort && parsed.data.cohorts.some(r => r.id !== checked.cohort))
        throw new Error("Agent trả dữ liệu khác đợt yêu cầu.");
      if (checked.cohort && parsed.data.cohorts.length === 0 &&
          [parsed.data.members, parsed.data.visits, parsed.data.charges, parsed.data.clinical, parsed.data.labs, parsed.data.imaging].some(rows => rows.length > 0))
        throw new Error("Không có đợt tương ứng với dữ liệu chi tiết.");
      return parsed.data;
    }
  };
}
