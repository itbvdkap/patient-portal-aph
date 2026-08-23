create table if not exists portal_admin_audit_logs (
  id bigserial primary key,
  admin_username text not null,
  action text not null,
  target_type text,
  target_id text,
  detail_json jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists portal_app_settings (
  setting_key text primary key,
  setting_value text,
  setting_group text not null default 'general',
  label text,
  description text,
  is_secret boolean not null default false,
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists portal_content_categories (
  id text primary key,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists portal_content_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  body text,
  category text references portal_content_categories(id),
  cover_image_url text,
  status text not null default 'draft',
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_portal_admin_audit_logs_created
  on portal_admin_audit_logs (created_at desc);

create index if not exists idx_portal_content_posts_listing
  on portal_content_posts (status, is_featured, sort_order, published_at desc);

alter table portal_admin_audit_logs enable row level security;
alter table portal_app_settings enable row level security;
alter table portal_content_categories enable row level security;
alter table portal_content_posts enable row level security;

revoke all on portal_admin_audit_logs from anon, authenticated;
revoke all on portal_app_settings from anon, authenticated;
revoke all on portal_content_categories from anon, authenticated;
revoke all on portal_content_posts from anon, authenticated;

insert into portal_content_categories (id, name, description, sort_order)
values
  ('huong-dan-kham', 'Hướng dẫn khám', 'Chuẩn bị trước khi đi khám tại An Phú.', 10),
  ('xet-nghiem', 'Xét nghiệm', 'Lưu ý trước và sau khi làm xét nghiệm.', 20),
  ('bhyt', 'BHYT', 'Thông tin bảo hiểm y tế và quyền lợi.', 30),
  ('cdha', 'Chẩn đoán hình ảnh', 'Hướng dẫn khi chụp X-quang, siêu âm, CT.', 40)
on conflict (id) do nothing;

insert into portal_app_settings (setting_key, setting_group, label, setting_value, description, is_secret)
values
  ('auth.otp_provider', 'auth', 'Nhà cung cấp OTP', 'zalo', 'test/zalo/off. Giá trị thật vẫn ưu tiên biến môi trường khi có.', false),
  ('auth.otp_ttl_minutes', 'auth', 'Thời hạn OTP', '5', 'Số phút OTP còn hiệu lực.', false),
  ('security.turnstile_enabled', 'security', 'Cloudflare Turnstile', 'true', 'Bật xác thực chống bot cho form nhạy cảm.', false),
  ('support.hotline_primary', 'support', 'Hotline chính', '0911 071 001', 'Số hotline hiển thị trong nút hỗ trợ.', false)
on conflict (setting_key) do nothing;
