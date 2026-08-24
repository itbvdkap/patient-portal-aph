import Link from "next/link";
import {
  Activity,
  Bell,
  CalendarCheck,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  Home,
  Hospital,
  Image as ImageIcon,
  MessageCircle,
  Pill,
  QrCode,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TestTube2,
  UserRound,
  UsersRound,
} from "lucide-react";

const shortcuts = [
  { label: "Khám hôm nay", meta: "Đang chờ", icon: Stethoscope, tone: "bg-emerald-50 text-primary-700" },
  { label: "Lịch sử", meta: "34 lần", icon: FileText, tone: "bg-sky-50 text-sky-700" },
  { label: "Xét nghiệm", meta: "15 phiếu", icon: TestTube2, tone: "bg-violet-50 text-violet-700" },
  { label: "CĐHA", meta: "20 kết quả", icon: ImageIcon, tone: "bg-cyan-50 text-cyan-700" },
  { label: "Đơn thuốc", meta: "12 đơn", icon: Pill, tone: "bg-orange-50 text-orange-700" },
  { label: "Người thân", meta: "2 hồ sơ", icon: UsersRound, tone: "bg-rose-50 text-rose-700" },
];

const specialties = ["Nội tổng quát", "Nhi", "Tim mạch", "Sản phụ khoa"];
const doctors = ["BS. Minh An", "BS. Thu Hằng", "BS. Quốc Việt"];
const times = ["08:00", "08:30", "09:00", "09:30", "10:15", "14:00"];

export default function UiDemoPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(0,111,103,0.14),transparent_32%),linear-gradient(180deg,#f1faf7,#fffaf1_360px)] px-4 py-5 text-ink">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-3 border-b border-cream-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-700">An Phú Care UI Demo</p>
            <h1 className="mt-1 font-serif text-3xl font-black tracking-normal text-ink">So sánh 2 hướng giao diện</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Demo tĩnh, dùng dữ liệu giả để chọn hướng thiết kế trước khi áp dụng vào portal thật.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-primary-100 bg-white/75 px-4 text-sm font-black text-primary-800 shadow-sm"
          >
            Quay lại portal
          </Link>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <DemoColumn
            eyebrow="Template 2"
            title="Modern Portal"
            description="Phù hợp app bệnh nhân dùng hằng ngày: tra cứu nhanh, kết nối hỗ trợ, quản lý người thân."
          >
            <ModernPortalMockup />
          </DemoColumn>
          <DemoColumn
            eyebrow="Template 3"
            title="Express Booking"
            description="Phù hợp mục tiêu tăng chuyển đổi đặt lịch: toàn bộ màn hình ưu tiên chọn chuyên khoa, bác sĩ, giờ khám."
          >
            <ExpressBookingMockup />
          </DemoColumn>
        </div>
      </div>
    </main>
  );
}

function DemoColumn({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-cream-200 bg-white/60 p-3 shadow-[0_24px_70px_rgba(7,60,57,0.12)] backdrop-blur sm:p-4">
      <div className="mb-4 px-2">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-700">{eyebrow}</p>
        <h2 className="font-serif text-2xl font-black text-ink">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {children}
    </section>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[410px] overflow-hidden rounded-[34px] border border-slate-200 bg-cream-50 shadow-[0_18px_60px_rgba(15,23,42,0.16)]">
      <div className="flex items-center justify-between bg-primary-900 px-5 py-3 text-white">
        <span className="clinical-mono text-xs font-black">09:41</span>
        <span className="h-5 w-20 rounded-full bg-white/15" />
        <span className="text-xs font-black">5G</span>
      </div>
      <div className="relative min-h-[720px] pb-20">{children}</div>
    </div>
  );
}

function ModernPortalMockup() {
  return (
    <PhoneFrame>
      <div className="px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-sm">
              <Hospital className="h-6 w-6 text-primary-700" />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-primary-700">An Phú Care</p>
              <p className="text-sm font-black">Chào anh Dũng</p>
            </div>
          </div>
          <button className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-primary-800 shadow-sm">
            <Bell className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 rounded-[26px] bg-gradient-to-br from-primary-900 via-primary-700 to-emerald-500 p-4 text-white shadow-soft">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-black uppercase text-white/70">Hồ sơ đang xem</p>
              <h3 className="mt-1 font-serif text-2xl font-black">ĐẶNG DUY LỢI</h3>
              <p className="clinical-mono text-xs font-bold text-white/80">Mã BN: 17085023</p>
            </div>
            <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-black">BHYT OK</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {["Hôm nay", "Lịch hẹn", "Kết quả mới"].map((item, index) => (
              <div key={item} className="rounded-2xl bg-white/14 p-3">
                <p className="clinical-mono text-lg font-black">{index === 0 ? "1" : index === 1 ? "3" : "7"}</p>
                <p className="text-[11px] font-bold text-white/78">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-[22px] border border-primary-100 bg-white p-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-50 text-primary-700">
              <Activity className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-lg font-black">Hôm nay</p>
              <p className="truncate text-sm text-slate-600">Phòng Ngoại 2 đang gọi STT 08</p>
            </div>
            <span className="clinical-mono rounded-full bg-amber-100 px-2 py-1 text-xs font-black text-amber-900">STT 12</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {shortcuts.map((item) => (
            <button
              key={item.label}
              className="group rounded-[22px] border border-cream-200 bg-white p-3 text-left shadow-sm transition duration-200 hover:-translate-y-0.5"
            >
              <span className={`mb-3 grid h-10 w-10 place-items-center rounded-2xl ${item.tone}`}>
                <item.icon className="h-5 w-5" />
              </span>
              <span className="block font-black">{item.label}</span>
              <span className="mt-1 block text-xs font-semibold text-slate-500">{item.meta}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-[24px] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-serif text-lg font-black">Cẩm nang sức khỏe</h3>
            <span className="text-xs font-black text-primary-700">3 bài</span>
          </div>
          <div className="flex gap-3 overflow-hidden">
            {["BHYT", "Xét nghiệm", "CĐHA"].map((item) => (
              <div key={item} className="min-w-[118px] rounded-2xl bg-gradient-to-br from-primary-50 to-cream-100 p-3">
                <Sparkles className="mb-5 h-5 w-5 text-primary-700" />
                <p className="text-sm font-black">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-20 right-4">
        <button className="flex h-14 items-center gap-2 rounded-full bg-primary-700 px-4 text-sm font-black text-white shadow-[0_14px_30px_rgba(0,91,85,0.28)]">
          <MessageCircle className="h-5 w-5" />
          Hỗ trợ
        </button>
      </div>
      <BottomNav active="Trang chủ" />
    </PhoneFrame>
  );
}

function ExpressBookingMockup() {
  return (
    <PhoneFrame>
      <div className="bg-primary-900 px-4 pb-5 pt-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase text-white/70">Đặt lịch nhanh</p>
            <h3 className="font-serif text-2xl font-black">Chọn lịch khám</h3>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/14">
            <CalendarCheck className="h-6 w-6" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[10px] font-black">
          {["Khoa", "Bác sĩ", "Giờ", "Xác nhận"].map((step, index) => (
            <div key={step} className="space-y-1">
              <div className={`mx-auto grid h-7 w-7 place-items-center rounded-full ${index < 2 ? "bg-white text-primary-800" : "bg-white/18 text-white"}`}>
                {index < 2 ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <p className="text-white/78">{step}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="-mt-3 rounded-t-[30px] bg-cream-50 px-4 py-4">
        <div className="flex items-center gap-2 rounded-2xl border border-cream-200 bg-white px-3 py-3 shadow-sm">
          <Search className="h-5 w-5 text-primary-700" />
          <span className="text-sm font-semibold text-slate-500">Tìm chuyên khoa, bác sĩ, dịch vụ</span>
        </div>

        <section className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-serif text-lg font-black">1. Chọn chuyên khoa</h4>
            <span className="text-xs font-black text-primary-700">4 khoa</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {specialties.map((item, index) => (
              <button
                key={item}
                className={`rounded-2xl border p-3 text-left text-sm font-black ${
                  index === 0 ? "border-primary-700 bg-primary-50 text-primary-900" : "border-cream-200 bg-white text-ink"
                }`}
              >
                <Stethoscope className="mb-2 h-5 w-5 text-primary-700" />
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-4">
          <h4 className="mb-2 font-serif text-lg font-black">2. Chọn bác sĩ</h4>
          <div className="space-y-2">
            {doctors.map((doctor, index) => (
              <button
                key={doctor}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${
                  index === 0 ? "border-primary-700 bg-white shadow-sm" : "border-cream-200 bg-white/80"
                }`}
              >
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-50 text-primary-700">
                  <UserRound className="h-5 w-5" />
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block font-black">{doctor}</span>
                  <span className="text-xs font-semibold text-slate-500">Còn lịch hôm nay</span>
                </span>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </button>
            ))}
          </div>
        </section>

        <section className="mt-4">
          <h4 className="mb-2 font-serif text-lg font-black">3. Chọn giờ</h4>
          <div className="grid grid-cols-3 gap-2">
            {times.map((time, index) => (
              <button
                key={time}
                className={`clinical-mono rounded-2xl border px-3 py-3 text-sm font-black ${
                  index === 2 ? "border-primary-700 bg-primary-700 text-white" : "border-cream-200 bg-white text-ink"
                }`}
              >
                {time}
              </button>
            ))}
          </div>
        </section>

        <div className="mt-4 rounded-2xl border border-primary-100 bg-primary-50 p-3">
          <div className="flex items-center gap-2 text-sm font-black text-primary-900">
            <ShieldCheck className="h-5 w-5" />
            Hồ sơ đã xác minh
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-600">ĐẶNG DUY LỢI · 0908***187 · 20/11/1961</p>
        </div>
      </div>

      <div className="absolute bottom-20 left-4 right-4">
        <button className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary-700 text-sm font-black text-white shadow-[0_16px_32px_rgba(0,91,85,0.26)]">
          <Clock3 className="h-5 w-5" />
          Xác nhận lịch 09:00
        </button>
      </div>
      <button className="absolute bottom-40 right-4 grid h-12 w-12 place-items-center rounded-full bg-white text-primary-700 shadow-lg">
        <QrCode className="h-5 w-5" />
      </button>
      <button className="absolute bottom-40 right-20 grid h-12 w-12 place-items-center rounded-full bg-white text-primary-700 shadow-lg">
        <Camera className="h-5 w-5" />
      </button>
      <BottomNav active="Đặt lịch" />
    </PhoneFrame>
  );
}

function BottomNav({ active }: { active: string }) {
  const items = [
    { label: "Trang chủ", icon: Home },
    { label: "Hôm nay", icon: Clock3 },
    { label: "Đặt lịch", icon: CalendarCheck },
    { label: "Hồ sơ", icon: UserRound },
  ];

  return (
    <nav className="absolute bottom-0 left-0 right-0 grid grid-cols-4 border-t border-cream-200 bg-white/92 px-2 pb-3 pt-2 backdrop-blur">
      {items.map((item) => (
        <span
          key={item.label}
          className={`flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-black ${
            item.label === active ? "bg-primary-50 text-primary-700" : "text-slate-500"
          }`}
        >
          <item.icon className="h-5 w-5" />
          {item.label}
        </span>
      ))}
    </nav>
  );
}
