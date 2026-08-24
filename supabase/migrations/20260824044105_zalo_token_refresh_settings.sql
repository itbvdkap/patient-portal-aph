insert into portal_app_settings (setting_key, setting_group, label, setting_value, description, is_secret)
values
  ('zalo.zns_endpoint', 'zalo', 'Zalo ZNS endpoint', 'https://business.openapi.zalo.me/message/template', 'Endpoint gửi ZNS template message.', false),
  ('zalo.token_endpoint', 'zalo', 'Zalo token endpoint', 'https://oauth.zaloapp.com/v4/oa/access_token', 'Endpoint refresh OA access token.', false),
  ('zalo.template_id', 'zalo', 'Zalo template ID', null, 'Template ID dùng để gửi OTP.', false),
  ('zalo.app_id', 'zalo', 'Zalo App ID', null, 'App ID của ứng dụng Zalo OA.', false),
  ('zalo.secret_key', 'zalo', 'Zalo secret key', null, 'App secret key dùng khi refresh token.', true),
  ('zalo.access_token', 'zalo', 'Zalo access token', null, 'OA access token hiện hành. Hệ thống tự cập nhật khi refresh thành công.', true),
  ('zalo.refresh_token', 'zalo', 'Zalo refresh token', null, 'OA refresh token hiện hành. Zalo có thể trả refresh token mới sau mỗi lần refresh.', true),
  ('zalo.access_token_expires_at', 'zalo', 'Zalo access token hết hạn', null, 'Thời điểm dự kiến access token hết hạn.', false),
  ('zalo.refresh_token_expires_at', 'zalo', 'Zalo refresh token hết hạn', null, 'Thời điểm dự kiến refresh token hết hạn.', false)
on conflict (setting_key) do update set
  setting_group = excluded.setting_group,
  label = excluded.label,
  description = excluded.description,
  is_secret = excluded.is_secret,
  updated_at = now();
