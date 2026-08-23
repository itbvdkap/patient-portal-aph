# Portal Admin

Trang quan tri van hanh cong benh nhan nam tai:

```text
/admin
```

## Cau hinh bat buoc

Them bien moi truong server-side:

```env
PORTAL_SESSION_SECRET=...
ADMIN_PASSWORD=...
# Tuy chon neu can nhieu admin/phan quyen:
ADMIN_USERS_JSON=[{"username":"admin","password":"...","role":"super_admin"},{"username":"booking","password":"...","role":"booking_admin"}]
```

Co the dung `PORTAL_ADMIN_PASSWORD` thay cho `ADMIN_PASSWORD` neu can tach ten bien.
Neu cau hinh `ADMIN_USERS_JSON`, he thong se dung danh sach nay va bo qua fallback `ADMIN_PASSWORD`.

Vai tro hien co:

- `super_admin`: toan quyen.
- `booking_admin`: xu ly dang ky kham, retry sync, xem audit lien quan.
- `support`: ho tro tai khoan/ho so, go lien ket sai, retry sync.
- `content_admin`: quan tri noi dung va cau hinh khong bi mat.
- `auditor`: chi xem, khong co thao tac ghi.

Khong dat mat khau admin trong public env (`NEXT_PUBLIC_*`). Khong commit mat khau that.

## Schema Supabase

Apply migration:

```text
supabase/migrations/202608220001_portal_admin_foundation.sql
```

Migration nay tao cac bang nen:

- `portal_admin_audit_logs`
- `portal_app_settings`
- `portal_content_categories`
- `portal_content_posts`

Trang admin van doc duoc cac bang portal dang co:

- `portal_accounts`
- `portal_account_profiles`
- `portal_account_sessions`
- `portal_login_events`
- `portal_otp_attempts`
- `portal_sync_jobs`
- `portal_resource_snapshots`

Neu bang nao chua ton tai hoac chua cau hinh `BOOKING_DATABASE_URL`, dashboard se hien canh bao thay vi crash.

## Module hien co

- Tong quan KPI.
- `/admin/accounts`: Tai khoan portal, khoa/mo khoa.
- `/admin/accounts/[id]`: Chi tiet tai khoan, ho so lien ket, phien dang nhap va lich su dang nhap.
- `/admin/profiles`: Ho so y te lien ket, go lien ket sai.
- `/admin/profiles/[mabn]`: Chi tiet MABN, tai khoan lien ket, snapshot va sync jobs lien quan.
- `/admin/bookings`: Dang ky kham tu `portal.lich_hen_kham`, xac nhan/huy.
- `/admin/bookings/[id]`: Chi tiet phieu dang ky, lich su xu ly va ghi chu khi xac nhan/huy.
- `/admin/sync`: Sync HIS/Oracle tu `portal_sync_jobs`, retry job.
- `/admin/sync/[id]`: Chi tiet sync job, loi gan nhat, lock, snapshot va job cung MABN.
- `/admin/otp`: Dang nhap/OTP/Zalo gan day.
- `/admin/settings`: Thong so van hanh trong `portal_app_settings`.
- `/admin/content`: Tao bai viet nhap, xuat ban/an bai viet.
- `/admin/audit`: Nhat ky quan tri.

## Thao tac quan tri da co

Tat ca thao tac can dang nhap admin va goi qua:

```text
POST /api/admin/actions
```

Dang ho tro:

- Khoa tai khoan: cap nhat `portal_accounts.status = locked` va thu hoi phien dang mo trong `portal_account_sessions`.
- Mo khoa tai khoan: cap nhat `portal_accounts.status = active`.
- Go lien ket ho so nguoi than: xoa dong trong `portal_account_profiles`; khong cho xoa ho so cuoi cung va khong xoa nhanh ho so mac dinh.
- Retry sync job: dua `portal_sync_jobs` ve `queued`, xoa lock/error va reset `attempt_count`.
- Xac nhan dang ky kham: cap nhat `portal.lich_hen_kham.status = DA_XAC_NHAN`, ghi `portal.lich_hen_kham_history` kem ghi chu trong `changed_fields.note`. UI dung modal ghi chu, khong dung `window.prompt`.
- Huy dang ky kham: cap nhat `portal.lich_hen_kham.status = DA_HUY`, ghi `portal.lich_hen_kham_history` kem ghi chu trong `changed_fields.note`. UI dung modal ghi chu, khong dung `window.prompt`.
- Sua cau hinh khong bi mat trong `portal_app_settings`.
- Tao bai viet CMS dang `draft`.
- Xuat ban/an bai viet CMS.
- Ghi audit vao `portal_admin_audit_logs` neu migration admin da apply.

Neu `portal_admin_audit_logs` chua ton tai, thao tac van thuc hien nhung audit se bi bo qua tam thoi.

## Viec nen lam tiep

- Them man hinh chi tiet ho so lien ket neu can xem audit rieng theo MABN.
- Them CMS editor day du, FAQ, dich vu noi bat, upload anh.
- Them phan quyen admin nhieu vai tro thay vi 1 mat khau admin chung.
