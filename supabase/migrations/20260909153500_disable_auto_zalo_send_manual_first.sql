update portal_app_settings
set setting_value = 'false',
    updated_at = now()
where setting_key = 'booking.zalo_auto_send_enabled';

