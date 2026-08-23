import { Activity, BadgeHelp, CalendarCheck, Camera, ClipboardCheck, HeartPulse, Pill, ShieldCheck, TestTube2 } from "lucide-react";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export type HealthGuidePost = {
  slug: string;
  title: string;
  category: string;
  categoryId?: string;
  summary: string;
  body?: string;
  coverImageUrl?: string;
  readMinutes: number;
  featured?: boolean;
  icon: typeof HeartPulse;
  tone: string;
  background: string;
  bullets: string[];
  ctaLabel: string;
  ctaHref: string;
  status?: string;
  publishedAt?: string;
  updatedAt?: string;
};

type ContentPostRow = {
  slug: string | null;
  title: string | null;
  excerpt: string | null;
  body: string | null;
  category: string | null;
  cover_image_url: string | null;
  status: string | null;
  is_featured: boolean | null;
  sort_order: number | null;
  published_at: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type ContentCategoryRow = {
  id: string | null;
  name: string | null;
  description: string | null;
  is_active: boolean | null;
};

const categoryThemes: Record<string, Pick<HealthGuidePost, "icon" | "tone" | "background" | "ctaLabel" | "ctaHref">> = {
  "huong-dan-kham": {
    icon: ClipboardCheck,
    tone: "bg-primary-50 text-primary-700 ring-primary-100",
    background:
      "linear-gradient(135deg, rgba(0, 91, 85, 0.13), rgba(255, 247, 237, 0.95)), repeating-linear-gradient(135deg, rgba(0, 91, 85, 0.08) 0 1px, transparent 1px 12px)",
    ctaLabel: "Đăng ký khám",
    ctaHref: "/booking",
  },
  "xet-nghiem": {
    icon: TestTube2,
    tone: "bg-violet-50 text-violet-700 ring-violet-100",
    background:
      "linear-gradient(135deg, rgba(124, 58, 237, 0.13), rgba(255, 247, 237, 0.96)), repeating-linear-gradient(90deg, rgba(124, 58, 237, 0.08) 0 1px, transparent 1px 14px)",
    ctaLabel: "Xem xét nghiệm",
    ctaHref: "/lab-results",
  },
  bhyt: {
    icon: ShieldCheck,
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    background:
      "linear-gradient(135deg, rgba(4, 120, 87, 0.14), rgba(255, 247, 237, 0.96)), repeating-linear-gradient(45deg, rgba(4, 120, 87, 0.08) 0 1px, transparent 1px 13px)",
    ctaLabel: "Xem BHYT",
    ctaHref: "/insurance",
  },
  cdha: {
    icon: Camera,
    tone: "bg-sky-50 text-sky-700 ring-sky-100",
    background:
      "linear-gradient(135deg, rgba(2, 132, 199, 0.13), rgba(255, 247, 237, 0.96)), repeating-linear-gradient(0deg, rgba(2, 132, 199, 0.08) 0 1px, transparent 1px 13px)",
    ctaLabel: "Xem CĐHA",
    ctaHref: "/imaging",
  },
  "dat-lich": {
    icon: CalendarCheck,
    tone: "bg-amber-50 text-amber-700 ring-amber-100",
    background:
      "linear-gradient(135deg, rgba(217, 119, 6, 0.14), rgba(255, 247, 237, 0.96)), repeating-linear-gradient(135deg, rgba(217, 119, 6, 0.08) 0 1px, transparent 1px 12px)",
    ctaLabel: "Đặt lịch",
    ctaHref: "/booking",
  },
  "don-thuoc": {
    icon: Pill,
    tone: "bg-orange-50 text-orange-700 ring-orange-100",
    background:
      "linear-gradient(135deg, rgba(234, 88, 12, 0.13), rgba(255, 247, 237, 0.96)), repeating-linear-gradient(90deg, rgba(234, 88, 12, 0.08) 0 1px, transparent 1px 14px)",
    ctaLabel: "Xem đơn thuốc",
    ctaHref: "/prescriptions",
  },
  faq: {
    icon: BadgeHelp,
    tone: "bg-rose-50 text-rose-700 ring-rose-100",
    background:
      "linear-gradient(135deg, rgba(225, 29, 72, 0.12), rgba(255, 247, 237, 0.96)), repeating-linear-gradient(90deg, rgba(225, 29, 72, 0.07) 0 1px, transparent 1px 14px)",
    ctaLabel: "Gọi hotline",
    ctaHref: "tel:0911071001",
  },
};

const defaultTheme = categoryThemes["huong-dan-kham"];

export const healthGuidePosts: HealthGuidePost[] = [
  {
    slug: "huong-dan-di-kham",
    title: "Hướng dẫn đi khám tại An Phú",
    category: "Hướng dẫn khám",
    summary: "Chuẩn bị giấy tờ, chọn hình thức đăng ký và theo dõi lượt khám ngay trên An Phú Care.",
    readMinutes: 3,
    featured: true,
    icon: ClipboardCheck,
    tone: "bg-primary-50 text-primary-700 ring-primary-100",
    background: "linear-gradient(135deg, rgba(0, 91, 85, 0.12), rgba(255, 247, 237, 0.95)), repeating-linear-gradient(135deg, rgba(0, 91, 85, 0.08) 0 1px, transparent 1px 12px)",
    bullets: [
      "Mang CCCD/CMND, thẻ BHYT nếu có và các kết quả khám cũ.",
      "Đăng ký trước giúp chủ động thời gian và giảm thời gian chờ.",
      "Theo dõi Khám hôm nay để biết trạng thái tiếp nhận, cận lâm sàng và hoàn tất.",
    ],
    ctaLabel: "Đăng ký khám",
    ctaHref: "/booking",
  },
  {
    slug: "chuan-bi-xet-nghiem",
    title: "Cần chuẩn bị gì trước khi xét nghiệm?",
    category: "Xét nghiệm",
    summary: "Một vài lưu ý giúp mẫu xét nghiệm chính xác hơn và bệnh nhân nhận kết quả thuận tiện.",
    readMinutes: 4,
    featured: true,
    icon: TestTube2,
    tone: "bg-violet-50 text-violet-700 ring-violet-100",
    background: "linear-gradient(135deg, rgba(124, 58, 237, 0.13), rgba(255, 247, 237, 0.96)), repeating-linear-gradient(90deg, rgba(124, 58, 237, 0.08) 0 1px, transparent 1px 14px)",
    bullets: [
      "Một số xét nghiệm cần nhịn ăn theo hướng dẫn của bác sĩ hoặc nhân viên y tế.",
      "Mang theo toa thuốc đang sử dụng để bác sĩ đánh giá kết quả phù hợp.",
      "Kết quả xét nghiệm trong app được nhóm theo phiếu, bấm từng phiếu để xem chi tiết.",
    ],
    ctaLabel: "Xem xét nghiệm",
    ctaHref: "/lab-results",
  },
  {
    slug: "kham-bhyt",
    title: "Khám BHYT cần lưu ý gì?",
    category: "BHYT",
    summary: "Kiểm tra hạn thẻ, mã thẻ và thông tin quyền lợi trước khi đến bệnh viện.",
    readMinutes: 3,
    featured: true,
    icon: ShieldCheck,
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    background: "linear-gradient(135deg, rgba(4, 120, 87, 0.14), rgba(255, 247, 237, 0.96)), repeating-linear-gradient(45deg, rgba(4, 120, 87, 0.08) 0 1px, transparent 1px 13px)",
    bullets: [
      "Kiểm tra thẻ BHYT điện tử trong app trước khi làm thủ tục.",
      "Mang giấy tờ tùy thân để đối chiếu khi cần.",
      "Nếu thẻ sắp hết hạn, nên cập nhật trước ngày khám để tránh gián đoạn quyền lợi.",
    ],
    ctaLabel: "Xem BHYT",
    ctaHref: "/insurance",
  },
  {
    slug: "quy-trinh-cdha",
    title: "Quy trình chẩn đoán hình ảnh",
    category: "CĐHA",
    summary: "Hiểu nhanh các bước khi được chỉ định X-quang, siêu âm hoặc thăm dò chức năng.",
    readMinutes: 4,
    icon: Camera,
    tone: "bg-sky-50 text-sky-700 ring-sky-100",
    background: "linear-gradient(135deg, rgba(2, 132, 199, 0.13), rgba(255, 247, 237, 0.96)), repeating-linear-gradient(0deg, rgba(2, 132, 199, 0.08) 0 1px, transparent 1px 13px)",
    bullets: [
      "Sau khi bác sĩ chỉ định, bệnh nhân đến đúng phòng theo hướng dẫn.",
      "Một số kỹ thuật cần chuẩn bị riêng, nhân viên y tế sẽ thông báo trước.",
      "Kết quả CĐHA trong app hiển thị theo từng lần khám và có thể mở để xem kết luận.",
    ],
    ctaLabel: "Xem CĐHA",
    ctaHref: "/imaging",
  },
  {
    slug: "dat-lich-kham-truc-tuyen",
    title: "Đặt lịch khám trực tuyến",
    category: "Đặt lịch",
    summary: "Chọn hồ sơ, xác minh thông tin và gửi đăng ký khám ngay trong cổng bệnh nhân.",
    readMinutes: 3,
    icon: CalendarCheck,
    tone: "bg-amber-50 text-amber-700 ring-amber-100",
    background: "linear-gradient(135deg, rgba(217, 119, 6, 0.14), rgba(255, 247, 237, 0.96)), repeating-linear-gradient(135deg, rgba(217, 119, 6, 0.08) 0 1px, transparent 1px 12px)",
    bullets: [
      "Bệnh nhân mới có thể quét QR CCCD để tự điền thông tin.",
      "Bệnh nhân cũ nên chọn hồ sơ đã liên kết để đăng ký nhanh hơn.",
      "Sau khi gửi đăng ký, kiểm tra Lịch hẹn hoặc Khám hôm nay để theo dõi trạng thái.",
    ],
    ctaLabel: "Đặt lịch",
    ctaHref: "/booking",
  },
  {
    slug: "cau-hoi-thuong-gap",
    title: "Câu hỏi thường gặp khi đến An Phú",
    category: "FAQ",
    summary: "Giờ làm việc, hotline, cấp cứu 24/7 và những thông tin thường cần trước khi đi khám.",
    readMinutes: 2,
    icon: BadgeHelp,
    tone: "bg-rose-50 text-rose-700 ring-rose-100",
    background: "linear-gradient(135deg, rgba(225, 29, 72, 0.12), rgba(255, 247, 237, 0.96)), repeating-linear-gradient(90deg, rgba(225, 29, 72, 0.07) 0 1px, transparent 1px 14px)",
    bullets: [
      "Bệnh viện có khung khám trong ngày và hỗ trợ cấp cứu 24/7.",
      "Hotline chính: 0911 071 001.",
      "Khi cần hỗ trợ nhanh, dùng nút gọi/Zalo nổi trong app.",
    ],
    ctaLabel: "Gọi hotline",
    ctaHref: "tel:0911071001",
  },
];

export const featuredHealthGuidePosts = healthGuidePosts.filter((post) => post.featured).slice(0, 3);

export async function getHealthGuidePosts(limit?: number): Promise<HealthGuidePost[]> {
  try {
    const supabase = createSupabaseServiceClient();
    const [postsResult, categoriesResult] = await Promise.all([
      supabase
        .from("portal_content_posts")
        .select("slug,title,excerpt,body,category,cover_image_url,status,is_featured,sort_order,published_at,updated_at,created_at")
        .eq("status", "published")
        .order("sort_order", { ascending: true })
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(limit ?? 50),
      supabase
        .from("portal_content_categories")
        .select("id,name,description,is_active")
        .eq("is_active", true),
    ]);

    if (postsResult.error || categoriesResult.error) {
      return limit ? healthGuidePosts.slice(0, limit) : healthGuidePosts;
    }

    const categoryNames = new Map(
      ((categoriesResult.data ?? []) as ContentCategoryRow[])
        .map((category) => [cleanText(category.id), cleanText(category.name)] as const)
        .filter(([id]) => Boolean(id)),
    );
    const mapped = ((postsResult.data ?? []) as ContentPostRow[])
      .map((row) => mapContentRowToHealthGuidePost(row, categoryNames))
      .filter((post): post is HealthGuidePost => Boolean(post));

    if (!mapped.length) {
      return limit ? healthGuidePosts.slice(0, limit) : healthGuidePosts;
    }

    return mapped;
  } catch {
    return limit ? healthGuidePosts.slice(0, limit) : healthGuidePosts;
  }
}

export async function getFeaturedHealthGuidePosts(limit = 3) {
  const posts = await getHealthGuidePosts(50);
  const featured = posts.filter((post) => post.featured).slice(0, limit);
  return featured.length ? featured : healthGuidePosts.filter((post) => post.featured).slice(0, limit);
}

export async function getHealthGuidePostBySlug(slug: string) {
  const posts = await getHealthGuidePosts(80);
  return posts.find((post) => post.slug === slug) ?? null;
}

function mapContentRowToHealthGuidePost(row: ContentPostRow, categoryNames: Map<string, string>): HealthGuidePost | null {
  const slug = cleanText(row.slug);
  const title = cleanText(row.title);
  if (!slug || !title) return null;

  const categoryId = cleanText(row.category) || "huong-dan-kham";
  const theme = resolveTheme(categoryId, title);
  const body = cleanText(row.body);
  const summary = cleanText(row.excerpt) || body.split(/\n+/)[0]?.slice(0, 180) || "Hướng dẫn từ Bệnh viện Đa khoa An Phú.";

  return {
    slug,
    title,
    category: categoryNames.get(categoryId) || categoryLabel(categoryId),
    categoryId,
    summary,
    body,
    coverImageUrl: cleanText(row.cover_image_url),
    readMinutes: estimateReadMinutes(body || summary),
    featured: row.is_featured === true,
    icon: theme.icon,
    tone: theme.tone,
    background: theme.background,
    bullets: extractBullets(body || summary),
    ctaLabel: theme.ctaLabel,
    ctaHref: theme.ctaHref,
    status: cleanText(row.status),
    publishedAt: cleanText(row.published_at),
    updatedAt: cleanText(row.updated_at || row.created_at),
  };
}

function resolveTheme(categoryId: string, title: string) {
  const normalized = `${categoryId} ${title}`.toLowerCase();
  if (categoryThemes[categoryId]) return categoryThemes[categoryId];
  if (normalized.includes("xét nghiệm") || normalized.includes("xet-nghiem")) return categoryThemes["xet-nghiem"];
  if (normalized.includes("bhyt") || normalized.includes("bảo hiểm")) return categoryThemes.bhyt;
  if (normalized.includes("cđha") || normalized.includes("cdha") || normalized.includes("hình ảnh")) return categoryThemes.cdha;
  if (normalized.includes("đặt lịch") || normalized.includes("dat-lich")) return categoryThemes["dat-lich"];
  if (normalized.includes("đơn thuốc") || normalized.includes("don-thuoc")) return categoryThemes["don-thuoc"];
  if (normalized.includes("faq") || normalized.includes("câu hỏi")) return categoryThemes.faq;
  return defaultTheme;
}

function extractBullets(value: string) {
  const lines = value
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);

  return lines.slice(0, 3).length ? lines.slice(0, 3) : ["Thông tin được biên tập ngắn gọn để người bệnh dễ chuẩn bị trước khi đến bệnh viện."];
}

function estimateReadMinutes(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.min(8, Math.ceil(words / 180)));
}

function categoryLabel(value: string) {
  const labels: Record<string, string> = {
    "huong-dan-kham": "Hướng dẫn khám",
    "xet-nghiem": "Xét nghiệm",
    bhyt: "BHYT",
    cdha: "CĐHA",
    "dat-lich": "Đặt lịch",
    "don-thuoc": "Đơn thuốc",
    faq: "FAQ",
  };
  return labels[value] ?? value;
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

export const serviceHighlights = [
  {
    title: "Khám sức khỏe tổng quát",
    summary: "Các gói khám từ cơ bản đến nâng cao, phù hợp cá nhân và doanh nghiệp.",
    icon: Activity,
  },
  {
    title: "Khám, điều trị đa chuyên khoa",
    summary: "Nội, ngoại, sản, nhi, tai mũi họng, răng hàm mặt, mắt và nhiều chuyên khoa khác.",
    icon: HeartPulse,
  },
  {
    title: "Cấp cứu và hỗ trợ 24/7",
    summary: "Luôn có kênh hotline để hỗ trợ khi cần tư vấn hoặc xử trí khẩn cấp.",
    icon: BadgeHelp,
  },
];
