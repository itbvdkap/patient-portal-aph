insert into portal_app_settings (setting_key, setting_group, label, setting_value, description, is_secret)
values
  (
    'booking.zalo_auto_send_enabled',
    'booking',
    'Tự động gửi Zalo khi HIS xác nhận',
    'false',
    'OFF: chỉ tạo tin nhắn pending để admin kiểm tra và gửi thủ công. ON: worker tự gửi khi booking đã match HIS.',
    false
  ),
  (
    'zalo.template.booking_his_confirmed',
    'zalo',
    'Template Zalo xác nhận HIS',
    null,
    'Template ID dùng cho tin nhắn xác nhận đăng ký đã vào HIS, có STT và phòng khám.',
    false
  )
on conflict (setting_key) do update set
  setting_group = excluded.setting_group,
  label = excluded.label,
  description = excluded.description,
  is_secret = excluded.is_secret,
  updated_at = now();
