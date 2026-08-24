import Link from "next/link";
import { AccountEditForm } from "@/app/admin/accounts/account-edit-form";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminActionButton } from "@/app/admin/admin-action-button";
import { AdminPageHeader, AdminShell } from "@/app/admin/admin-shell";
import { AdminStatusBadge } from "@/app/admin/admin-table";
import { canAdminAccessPath, canAdminPerformAction, getAdminSession } from "@/lib/admin/session";
import { getAdminAccountDetail } from "@/lib/admin/modules";

export default async function AdminAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = getAdminSession(await cookies());
  if (!session) redirect("/admin/login");
  if (!canAdminAccessPath(session.role, "/admin/accounts")) redirect("/admin");

  const { id } = await params;
  const data = await getAdminAccountDetail(id);
  const account = data.account;
  const canLock = canAdminPerformAction(session.role, "lock_account");
  const canUnlock = canAdminPerformAction(session.role, "unlock_account");
  const canDelete = canAdminPerformAction(session.role, "delete_account");
  const canEdit = canAdminPerformAction(session.role, "edit_account");

  return (
    <AdminShell username={session.username} role={session.role}>
      <AdminPageHeader
        eyebrow="Chi tiết tài khoản"
        title={String(account?.full_name ?? account?.display_name ?? "Tài khoản portal")}
        description="Xem thông tin tài khoản, hồ sơ y tế đã liên kết, phiên đăng nhập và lịch sử xác thực."
        actions={<BackLink href="/admin/accounts" label="Quay lại danh sách" />}
      />

      {data.warnings.length > 0 && <WarningBox warnings={data.warnings} />}

      {account ? (
        <div className="grid gap-5">
          <section className="rounded-md border border-cream-200 bg-cream-50 p-4 shadow-[0_8px_22px_rgba(7,60,57,0.055)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="clinical-mono text-xs font-black uppercase text-slate-500">{String(account.account_key ?? account.id ?? "")}</p>
                <h3 className="mt-1 font-serif text-2xl font-black text-ink">{String(account.full_name ?? account.display_name ?? "Chưa đặt tên")}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-600">{String(account.phone_masked ?? account.phone ?? "Chưa có SĐT")}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <AdminStatusBadge status={String(account.status ?? "active")} />
                {String(account.status ?? "active") === "deleted" ? null : String(account.status ?? "active") === "locked" && canUnlock ? (
                  <AdminActionButton action="unlock_account" label="Mở khóa" tone="primary" target={accountTarget(account)} />
                ) : (
                  <>
                    {canLock ? (
                      <AdminActionButton
                        action="lock_account"
                        label="Khóa tài khoản"
                        tone="danger"
                        target={accountTarget(account)}
                      />
                    ) : null}
                    {canDelete ? (
                      <AdminActionButton
                        action="delete_account"
                        label="Xóa mềm"
                        tone="danger"
                        target={accountTarget(account)}
                      />
                    ) : null}
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Xác minh SĐT" value={formatDate(account.phone_verified_at)} />
              <Info label="Mật khẩu" value={account.password_set_at ? `Đặt ${formatDate(account.password_set_at)}` : "Chưa đặt"} />
              <Info label="Đăng nhập gần nhất" value={formatDate(account.last_login_at)} />
              <Info label="Hồ sơ mặc định" value={String(account.primary_mabn ?? "Chưa chọn")} />
              <Info label="Lý do khóa" value={account.locked_reason ? `${String(account.locked_reason)} (${String(account.locked_by ?? "admin")})` : "Không"} />
              <Info label="Lý do xóa mềm" value={account.deleted_reason ? `${String(account.deleted_reason)} (${String(account.deleted_by ?? "admin")})` : "Không"} />
            </div>

            {canEdit && String(account.status ?? "active") !== "deleted" ? (
              <AccountEditForm
                accountId={String(account.id ?? "")}
                accountKey={String(account.account_key ?? "")}
                fullName={String(account.full_name ?? "")}
                displayName={String(account.display_name ?? account.full_name ?? "")}
                phoneVerified={Boolean(account.phone_verified_at)}
              />
            ) : null}
          </section>

          <DetailSection title="Hồ sơ y tế liên kết" count={data.profiles.length}>
            <div className="divide-y divide-cream-200">
              {data.profiles.map((profile) => (
                <ProfileRow key={`${profile.account_id ?? profile.account_key}-${profile.mabn}`} profile={profile} account={account} canUnlink={canAdminPerformAction(session.role, "unlink_profile")} />
              ))}
              {!data.profiles.length && <Empty text="Tài khoản này chưa liên kết hồ sơ y tế." />}
            </div>
          </DetailSection>

          <DetailSection title="Phiên đăng nhập / thiết bị" count={data.sessions.length}>
            <DeviceRows rows={data.sessions} />
          </DetailSection>

          <DetailSection title="Lịch sử đăng nhập" count={data.loginEvents.length}>
            <SimpleRows rows={data.loginEvents} primary="event_type" secondary={["device_label", "ip_address"]} date="created_at" fallback="Chưa có lịch sử đăng nhập." />
          </DetailSection>
        </div>
      ) : (
        <Empty text="Không tìm thấy tài khoản." />
      )}
    </AdminShell>
  );
}

function DeviceRows({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <Empty text="Chưa có phiên đăng nhập." />;
  return (
    <div className="grid gap-2">
      {rows.map((row, index) => {
        const status = sessionStatus(row);
        return (
          <div key={String(row.session_id ?? index)} className="grid gap-2 rounded-md border border-cream-200 bg-cream-100/50 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-ink">{String(row.device_label ?? "Thiết bị")}</p>
              <p className="mt-1 break-words text-xs font-semibold leading-5 text-slate-600">
                {[row.ip_address ? `IP ${row.ip_address}` : "", row.current_mabn ? `MABN ${row.current_mabn}` : "", row.last_seen_at ? `Hoạt động ${formatDate(row.last_seen_at)}` : ""]
                  .filter(Boolean)
                  .join(" · ") || "Chưa ghi nhận thông tin thiết bị"}
              </p>
            </div>
            <AdminStatusBadge status={status} />
          </div>
        );
      })}
    </div>
  );
}

function sessionStatus(row: Record<string, unknown>) {
  if (row.revoked_at) return "đã thu hồi";
  const expiresAt = row.expires_at ? new Date(String(row.expires_at)) : null;
  if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) return "hết hạn";
  return "đang hoạt động";
}

function ProfileRow({ profile, account, canUnlink }: { profile: Record<string, unknown>; account: Record<string, unknown>; canUnlink: boolean }) {
  const isActive = Boolean(profile.is_active);
  const isDefault = Boolean(profile.is_default);

  return (
    <div className="grid gap-3 py-3 lg:grid-cols-[1fr_auto] lg:items-center">
      <div>
        <p className="font-black text-ink">{String(profile.display_name ?? profile.patient_name ?? "Hồ sơ chưa có tên")}</p>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          Mã BN <span className="clinical-mono">{String(profile.mabn ?? "?")}</span> · {String(profile.relationship ?? "Chưa ghi quan hệ")}
        </p>
        <p className="mt-1 text-xs font-bold text-slate-500">
          {profile.verified_at ? `Xác minh ${formatDate(profile.verified_at)}` : "Chưa xác minh"} · Liên kết {formatDate(profile.linked_at)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {isActive && <AdminStatusBadge status="đang xem" />}
        {isDefault && <AdminStatusBadge status="mặc định" />}
        {!isDefault && canUnlink && (
          <AdminActionButton
            action="unlink_profile"
            label="Gỡ liên kết"
            tone="danger"
            target={{ ...accountTarget(account), mabn: String(profile.mabn ?? "") }}
            confirm="Gỡ liên kết hồ sơ y tế này khỏi tài khoản?"
          />
        )}
      </div>
    </div>
  );
}

function accountTarget(account: Record<string, unknown>) {
  return {
    accountId: String(account.id ?? ""),
    accountKey: String(account.account_key ?? ""),
  };
}

function DetailSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-cream-200 bg-cream-50 p-4 shadow-[0_8px_22px_rgba(7,60,57,0.055)]">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="font-serif text-xl font-black text-ink">{title}</h3>
        <span className="clinical-mono text-sm font-black text-slate-500">{count}</span>
      </div>
      {children}
    </section>
  );
}

function SimpleRows({
  rows,
  primary,
  secondary,
  date,
  fallback,
}: {
  rows: Record<string, unknown>[];
  primary: string;
  secondary: string[];
  date: string;
  fallback: string;
}) {
  if (!rows.length) return <Empty text={fallback} />;
  return (
    <div className="divide-y divide-cream-200">
      {rows.map((row, index) => (
        <div key={String(row.session_id ?? row.id ?? index)} className="py-3">
          <p className="font-black text-ink">{String(row[primary] ?? "Thiết bị")}</p>
          <p className="mt-1 break-words text-sm font-semibold text-slate-600">{secondary.map((key) => row[key]).filter(Boolean).join(" · ") || "Chưa ghi nhận"}</p>
          <p className="mt-1 clinical-mono text-xs font-bold text-slate-500">{formatDate(row[date])}</p>
        </div>
      ))}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-cream-200 bg-cream-100/50 p-3">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 clinical-mono text-sm font-black text-ink">{value}</p>
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
