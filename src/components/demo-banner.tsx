export function DemoBanner() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return null;
  }

  return (
    <div className="bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-900">
      PHIÊN BẢN THỬ NGHIỆM - DỮ LIỆU MÔ PHỎNG
    </div>
  );
}
