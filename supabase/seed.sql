insert into patients (id, his_patient_code, full_name, birth_date, gender, phone, address) values
('11111111-1111-4111-8111-111111111111', '23006552', 'NGUYỄN VĂN AN', '1985-05-15', 'Nam', '0901234567', 'TP. Hồ Chí Minh'),
('22222222-2222-4222-8222-222222222222', '23001001', 'TRẦN THỊ BÌNH', '1992-09-03', 'Nữ', '0912222333', 'Bình Dương'),
('33333333-3333-4333-8333-333333333333', '23001002', 'LÊ VĂN CƯỜNG', '1978-02-11', 'Nam', '0988123456', 'Đồng Nai'),
('44444444-4444-4444-8444-444444444444', '23001003', 'PHẠM THỊ DUNG', '1969-12-22', 'Nữ', '0909555666', 'TP. Hồ Chí Minh'),
('55555555-5555-4555-8555-555555555555', '23001004', 'VÕ MINH KHANG', '2001-07-19', 'Nam', '0933444555', 'Long An');

insert into insurance_cards (patient_id, card_number, benefit_code, registered_clinic, valid_from, valid_to, status) values
('11111111-1111-4111-8111-111111111111', 'DN4010123456789', '4', 'Bệnh viện Đa khoa An Phú', '2026-01-01', '2026-12-31', 'Còn hiệu lực');

insert into visits (id, patient_id, his_visit_id, visit_date, department_name, doctor_name, status, notes) values
('61111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'MAQL-20260812', '2026-08-12 08:30:00+07', 'Nội tổng quát', 'BS. Nguyễn Minh Thành', 'Đã hoàn tất', 'Theo dõi đường huyết định kỳ.'),
('62222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'MAQL-20260605', '2026-06-05 09:15:00+07', 'Tim mạch', 'BS. Trần Văn Hùng', 'Đã hoàn tất', 'Điều chỉnh thuốc huyết áp.'),
('63333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'MAQL-20260320', '2026-03-20 10:00:00+07', 'Nội tổng quát', 'BS. Nguyễn Minh Thành', 'Đã hoàn tất', 'Tư vấn dinh dưỡng.'),
('64444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'MAQL-20260118', '2026-01-18 07:45:00+07', 'Chẩn đoán hình ảnh', 'BS. Lê Hoàng Anh', 'Đã hoàn tất', 'Siêu âm bụng.'),
('65555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', 'MAQL-20251104', '2025-11-04 08:10:00+07', 'Hô hấp', 'BS. Phạm Quang Dũng', 'Đã hoàn tất', 'Điều trị ngoại trú.'),
('66666666-6666-4666-8666-666666666666', '11111111-1111-4111-8111-111111111111', 'MAQL-20250922', '2025-09-22 13:30:00+07', 'Cơ xương khớp', 'BS. Võ Thanh Tâm', 'Đã hoàn tất', 'Tập vật lý trị liệu.');

insert into diagnoses (visit_id, icd10_code, diagnosis_name, diagnosis_type) values
('61111111-1111-4111-8111-111111111111', 'E11.9', 'Đái tháo đường type 2', 'Chính'),
('62222222-2222-4222-8222-222222222222', 'I10', 'Tăng huyết áp', 'Chính'),
('63333333-3333-4333-8333-333333333333', 'E78.5', 'Rối loạn lipid máu', 'Chính');

insert into prescriptions (id, visit_id, prescribed_at, doctor_name) values
('81111111-1111-4111-8111-111111111111', '61111111-1111-4111-8111-111111111111', '2026-08-12 10:00:00+07', 'BS. Nguyễn Minh Thành'),
('82222222-2222-4222-8222-222222222222', '62222222-2222-4222-8222-222222222222', '2026-06-05 10:20:00+07', 'BS. Trần Văn Hùng');

insert into prescription_items (prescription_id, medicine_name, active_ingredient, strength, route, quantity, dosage, instruction) values
('81111111-1111-4111-8111-111111111111', 'Metformin 500mg', 'Metformin', '500mg', 'Uống', '30 viên', 'Sáng 1 viên - chiều 1 viên', 'Uống sau ăn'),
('82222222-2222-4222-8222-222222222222', 'Amlodipine 5mg', 'Amlodipine', '5mg', 'Uống', '30 viên', 'Ngày 1 viên', 'Uống buổi sáng');

insert into lab_results (visit_id, test_name, result, unit, reference_range, performed_at, flag) values
('61111111-1111-4111-8111-111111111111', 'Glucose', 8.2, 'mmol/L', '3.9 - 6.4', '2026-08-12 09:15:00+07', 'Cao'),
('61111111-1111-4111-8111-111111111111', 'HbA1c', 7.1, '%', '4.0 - 5.6', '2026-08-12 09:15:00+07', 'Cao'),
('61111111-1111-4111-8111-111111111111', 'Creatinine', 86, 'µmol/L', '62 - 106', '2026-08-12 09:15:00+07', 'Bình thường'),
('63333333-3333-4333-8333-333333333333', 'Cholesterol', 6.4, 'mmol/L', '< 5.2', '2026-03-20 10:45:00+07', 'Cao'),
('63333333-3333-4333-8333-333333333333', 'Triglyceride', 2.4, 'mmol/L', '< 1.7', '2026-03-20 10:45:00+07', 'Cao'),
('63333333-3333-4333-8333-333333333333', 'HDL-C', 0.9, 'mmol/L', '> 1.0', '2026-03-20 10:45:00+07', 'Thấp'),
('63333333-3333-4333-8333-333333333333', 'LDL-C', 3.8, 'mmol/L', '< 3.4', '2026-03-20 10:45:00+07', 'Cao');

insert into imaging_results (visit_id, date, technique_name, doctor_name, description, conclusion) values
('64444444-4444-4444-8444-444444444444', '2026-01-18 09:00:00+07', 'Siêu âm bụng', 'BS. Lê Hoàng Anh', 'Gan kích thước bình thường, nhu mô đồng nhất.', 'Chưa ghi nhận bất thường rõ.'),
('65555555-5555-4555-8555-555555555555', '2025-11-04 09:30:00+07', 'X-quang ngực', 'BS. Phạm Quang Dũng', 'Phổi sáng đều, tim không to.', 'Không thấy tổn thương cấp tính.'),
('64444444-4444-4444-8444-444444444444', '2026-01-18 10:30:00+07', 'CT bụng - tiểu khung', 'BS. Lê Hoàng Anh', 'Khảo sát ổ bụng và tiểu khung.', 'Chưa phát hiện khối bất thường.');

insert into appointments (patient_id, appointment_date, department_name, doctor_name, content) values
('11111111-1111-4111-8111-111111111111', '2026-09-12 08:30:00+07', 'Nội tổng quát', 'BS. Nguyễn Minh Thành', 'Tái khám đường huyết và xét nghiệm.'),
('11111111-1111-4111-8111-111111111111', '2026-10-05 09:00:00+07', 'Tim mạch', 'BS. Trần Văn Hùng', 'Kiểm tra huyết áp.');
