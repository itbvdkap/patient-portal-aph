insert into portal_app_settings (setting_key, setting_group, label, setting_value, description, is_secret)
values
  (
    'booking.zalo_auto_send_enabled',
    'booking',
    'Tự động gửi Zalo khi HIS xác nhận',
    'false',
    'ON: worker tự gửi Zalo sau khi booking đã được HIS tiếp nhận và có STT/phòng khám. OFF: chỉ tạo tin pending để admin gửi thủ công.',
    false
  ),
  (
    'zalo.template.booking_his_confirmed',
    'zalo',
    'Template Zalo xác nhận đăng ký',
    '628108',
    'Template ID ZBS đã duyệt để gửi tin xác nhận đăng ký khám, gồm mã đăng ký, mã bệnh nhân, ngày giờ khám, khoa/phòng khám và số thứ tự.',
    false
  )
on conflict (setting_key) do update set
  setting_group = excluded.setting_group,
  label = excluded.label,
  setting_value = excluded.setting_value,
  description = excluded.description,
  is_secret = excluded.is_secret,
  updated_at = now();
