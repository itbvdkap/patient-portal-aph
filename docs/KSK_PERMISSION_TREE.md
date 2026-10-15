# Menu và phân quyền quản lý khám sức khoẻ — 15/10/2026

## Cấu trúc

```text
Quản lý khám sức khoẻ (menu cha, không phải quyền truy cập)
├─ Khám đoàn · chỉ đọc                  [ksk]
│  └─ Xem tiến độ, hồ sơ, kết quả XN/CLS và xuất báo cáo
├─ Báo cáo thu tiền                     [ksk_collections]
│  └─ Xem / lọc / xuất báo cáo chứng từ HIS
├─ Phiếu thay đổi · LAB                 [ksk_changes]
│  ├─ Lập / sửa nháp gói                [ksk_package_draft]
│  ├─ Lập / sửa nháp danh sách           [ksk_roster_draft]
│  ├─ Duyệt / từ chối phiếu người khác  [ksk_change_approve]
│  └─ Áp dụng GIẢ LẬP                   [ksk_change_apply]
└─ Quản lý đoàn / gói HIS                [ksk_manage]
   ├─ Lập phiếu khách hàng/đợt/nhóm/người [ksk_manage_roster]
   ├─ Lập phiếu gói / dịch vụ            [ksk_manage_package]
   ├─ Duyệt / từ chối phiếu người khác   [ksk_manage_approve]
   └─ Áp dụng HIS thật                   [ksk_manage_apply]
      └─ Còn cần mở ghi server; CN1 hiện TẮT, chưa có Oracle TEST
```

## Quy tắc giữ nguyên

- Nhân viên chỉ thấy menu cha nếu có ít nhất một mục con được cấp; bên trong chỉ hiện các mục con được phép. Trang đang mở tự mở nhóm và đánh dấu đúng mục; có thể thu gọn/mở rộng trên desktop và mobile.
- Không tạo quyền cha cấp tất cả, không đổi ID quyền/path, không migration kho tài khoản. Nhóm giao diện không mở quyền cho tài khoản cũ.
- Quyền xem từng mục độc lập. Có menu báo cáo không được vào LAB/quản lý HIS; có LAB không được ghi HIS thật. API/trang vẫn kiểm tra quyền server, không chỉ ẩn menu.
- Quyền thao tác yêu cầu cả menu tương ứng và action cụ thể. Bỏ chọn menu trong form sẽ bỏ các action của đúng menu đó; không tự khôi phục khi tích lại. Lưu quyền vẫn thu hồi phiên cũ theo revision.
- Người lập không tự duyệt, kể cả quản trị. Có action ghi không vượt qua khóa ghi server; CN1 vẫn chỉ đọc và lưu nháp/duyệt nội bộ.
- Quyền hiện theo chi nhánh đang cấu hình, chưa giới hạn từng công ty/đoàn. Chỉ cấp quyền dữ liệu sức khoẻ cho người được phép.

Quản trị cấp quyền tại **Nhân viên & phân quyền → Menu được phép xem → Quản lý khám sức khoẻ**; tích từng mục con và action cần thiết bên dưới LAB/HIS. Chưa nên cấp action áp dụng HIS thật trong giai đoạn chỉ đọc này.

## Kiểm chứng cập nhật

- `npm run test`: 204/204 đạt; `npm run build`: đạt. Không thay backend/Oracle nên không cần xuất lại agent.
- Test mới `admin-navigation.test.tsx`: nhóm đang mở/đánh dấu đúng mục, mở/thu bằng nút, sidebar compact và mobile. Bổ sung test nhóm quyền vào `admin-staff-ui.test.tsx`: chỉ mục được cấp, ẩn cha khi không có con, gỡ action khi bỏ menu, không cấp lại action khi tích lại.
- Edge cô lập `node tools/test-staff-button-browser.mjs --navigation`: 1366×768 và 682×1012, đúng 1 cha/4 con, đường dẫn không lặp, thu gọn ẩn được mục con, không tràn ngang, nhóm phân quyền 4 menu + 8 action. Không tạo/sửa tài khoản hay nháp HIS.
- Test nút lưu nhân viên bằng Edge cả hai kích thước đạt; ảnh chỉ menu/form trống trong `artifacts/ksk-grouped-navigation-1366.png`, `ksk-grouped-navigation-682.png`, `staff-save-visible-1366.png`, `staff-save-visible-682.png`. Không lưu ảnh dữ liệu bệnh nhân.
