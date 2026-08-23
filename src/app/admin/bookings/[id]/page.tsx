import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminActionButton } from "@/app/admin/admin-action-button";
import { AdminPageHeader, AdminShell } from "@/app/admin/admin-shell";
import { AdminStatusBadge } from "@/app/admin/admin-table";
import { canAdminAccessPath, canAdminPerformAction, getAdminSession } from "@/lib/admin/session";
import { getAdminBookingDetail } from "@/lib/admin/modules";

export default async function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = getAdminSession(await cookies());
  if (!session) redirect("/admin/login");
  if (!canAdminAccessPath(session.role, "/admin/bookings")) redirect("/admin");

  const { id } = await params;
  const data = await getAdminBookingDetail(id);
  const booking = data.booking;
  const status = String(booking?.status ?? "CHO_DUYET");
  const canReview = ["CHO_DUYET", "CHO_DUYET_LAI"].includes(status);
  const canApprove = canAdminPerformAction(session.role, "approve_booking");
  const canCancel = canAdminPerformAction(session.role, "cancel_booking");

  return (
    <AdminShell username={session.username} role={session.role}>
      <AdminPageHeader
        eyebrow="Chi tiết đăng ký khám"
        title={String(booking?.ho_ten ?? booking?.ma_lich_hen ?? "Phiếu đăng ký khám")}
        description="Kiểm tra thông tin đăng ký, xác nhận hoặc hủy lịch khám kèm ghi chú quản trị."
        actions={<BackLink href="/admin/bookings" label="Quay lại danh sách" />}
      />

      {data.warnings.length > 0 && <WarningBox warnings={data.warnings} />}

      {booking ? (
        <div className="grid gap-5">
          <section className="rounded-md border border-cream-200 bg-cream-50 p-4 shadow-[0_8px_22px_rgba(7,60,57,0.055)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="clinical-mono text-xs font-black uppercase text-slate-500">{String(booking.ma_lich_hen ?? booking.id ?? "")}</p>
                <h3 className="mt-1 font-serif text-2xl font-black text-ink">{String(booking.ho_ten ?? "Chưa có tên")}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  {formatDateOnly(booking.ngay_kham)} · {String(booking.gio_kham ?? "Chưa chọn giờ")} · {String(booking.khoa_kham ?? "Chưa chọn khoa")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <AdminStatusBadge status={status} />
                {canReview && (canApprove || canCancel) && (
                  <>
                    {canApprove && <AdminActionButton action="approve_booking" label="Xác nhận" tone="primary" target={bookingTarget(booking)} />}
                    {canCancel && <AdminActionButton action="cancel_booking" label="Hủy lịch" tone="danger" target={bookingTarget(booking)} />}
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Số điện thoại" value={String(booking.so_dien_thoai ?? "Chưa ghi nhận")} />
              <Info label="Ngày sinh" value={formatDateOnly(booking.ngay_sinh)} />
              <Info label="Giới tính" value={String(booking.gioi_tinh ?? "Chưa ghi nhận")} />
              <Info label="Bảo hiểm" value={booking.co_bao_hiem ? "Có" : "Không/Chưa ghi"} />
              <Info label="CCCD/CMND" value={String(booking.cccd ?? booking.cmnd ?? booking.so_cccd ?? "Chưa ghi nhận")} />
              <Info label="Ngày cấp" value={formatDateOnly(booking.ngayCap ?? booking.ngay_cap ?? booking.cccd_ngay_cap)} />
              <Info label="Chi nhánh" value={String(booking.chi_nhanh ?? "Chưa chọn")} />
              <Info label="Tạo lúc" value={formatDate(booking.ngay_tao)} />
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <TextBlock label="Địa chỉ" value={String(booking.dia_chi ?? "Chưa ghi nhận")} />
              <TextBlock label="Triệu chứng / lý do khám" value={String(booking.trieu_chung ?? booking.ghichu ?? "Chưa ghi nhận")} />
            </div>
          </section>

          <section className="rounded-md border border-cream-200 bg-cream-50 p-4 shadow-[0_8px_22px_rgba(7,60,57,0.055)]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="font-serif text-xl font-black text-ink">Lịch sử xử lý</h3>
              <span className="clinical-mono text-sm font-black text-slate-500">{data.history.length}</span>
            </div>
            {data.history.length ? (
              <div className="divide-y divide-cream-200">
                {data.history.map((item, index) => {
                  const changedFields = parseJson(item.changed_fields);
                  return (
                    <div key={String(item.id ?? index)} className="py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-ink">{String(item.action ?? "Cập nhật")}</p>
                        <AdminStatusBadge status={String(item.new_status ?? "updated")} />
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        {String(item.old_status ?? "Chưa có")} → {String(item.new_status ?? "Chưa có")} · {String(item.performed_by ?? "system")}
                      </p>
                      {changedFields.note && <p className="mt-2 rounded-md bg-primary-50 px-3 py-2 text-sm font-semibold leading-6 text-primary-900">Ghi chú: {changedFields.note}</p>}
                      <p className="mt-1 clinical-mono text-xs font-bold text-slate-500">{formatDate(item.created_at)}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty text="Chưa có lịch sử xử lý." />
            )}
          </section>
        </div>
      ) : (
        <Empty text="Không tìm thấy phiếu đăng ký khám." />
      )}
    </AdminShell>
  );
}

function bookingTarget(booking: Record<string, unknown>) {
  return {
    bookingId: String(booking.id ?? ""),
    bookingCode: String(booking.ma_lich_hen ?? ""),
  };
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-cream-200 bg-cream-100/50 p-3">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 clinical-mono text-sm font-black text-ink">{value}</p>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-cream-200 bg-cream-100/50 p-3">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-6 text-ink">{value}</p>
    </div>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rounded-md border border-cream-200 bg-cream-50 px-3 py-2 text-sm font-black text-primary-800 shadow-sm transition hover:bg-primary-50">
      {label}
    </Link>
  );
}

function WarningBox({ warnings }: { warnings: string[] }) {
  return (
    <section className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
      <p className="font-black">Một số dữ liệu chưa sẵn sàng</p>
      <ul className="mt-2 list-inside list-disc">
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed border-cream-300 bg-cream-100/40 px-4 py-6 text-center text-sm font-semibold text-slate-500">{text}</p>;
}

function parseJson(value: unknown): Record<string, string> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, string>;
  try {
    const parsed = JSON.parse(String(value));
    return typeof parsed === "object" && parsed ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function formatDateOnly(value: unknown) {
  if (!value) return "Chưa ghi nhận";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDate(value: unknown) {
  if (!value) return "Chưa ghi nhận";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
