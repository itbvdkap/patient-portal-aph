import { Activity, BadgeHelp, CalendarCheck, Camera, ClipboardCheck, HeartPulse, ShieldCheck, TestTube2 } from "lucide-react";

export type HealthGuidePost = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  readMinutes: number;
  featured?: boolean;
  icon: typeof HeartPulse;
  tone: string;
  bullets: string[];
  ctaLabel: string;
  ctaHref: string;
};

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
