# Báo cáo đoàn khám — bản nội bộ chỉ đọc HIS

**15/10/2026:** tiền và chi phí trong báo cáo áp dụng [MAVAOVIEN phiên bản 2](KSK_EPISODE_PAYMENT_POLICY.md); loại dòng ngoài đợt/mã 0, xác minh ngoại lệ đầu phiếu mã 0 qua toàn bộ chi tiết. Không chỉ nối theo MAQL/PAID.

Cập nhật 14/10/2026. App: `http://127.0.0.1:3014/admin/ksk`. Bổ sung vào module KSK hiện có, không đổi HIS, Oracle schema, worker, service hoặc chức năng gửi Zalo.

Đợt LAN mới: [HTTPS CN1 và phân quyền nhân viên](KSK_LAN_STAFF_ACCESS.md). Staff được super_admin cấp menu KSK có thể xem và xuất báo cáo; quyền xem/xuất chưa tách riêng, chưa giới hạn theo từng đoàn.

**Đợt tiếp theo:** [báo cáo thu tiền tổng hợp](KSK_COLLECTIONS_REPORT.md) không cần mở từng đoàn, menu/quyền riêng, lọc công ty/phụ trách/thu ngân/ngày thu/ngày đăng ký. Thay cả web và agent; ghi chú “không đổi backend/ZIP” dưới đây chỉ áp dụng báo cáo từng đoàn ban đầu.

## Cách dùng

1. Chọn ngày, công ty/phụ trách/đợt rồi Đọc/Làm mới. Mở chi tiết một đợt.
2. Trong `Báo cáo theo đoàn`, chọn **Danh sách & thu tiền** hoặc **Kết quả XN / CLS**.
3. Mặc định lấy toàn bộ người khớp bộ lọc nhóm/tìm người/thanh toán hiện tại, không chỉ 50 người của trang đang xem. Có thể chuyển sang `Toàn bộ đợt`. Báo cáo kết quả còn có lọc có giá trị, chưa có giá trị, chưa có lượt hoặc chưa xác định nguồn.
4. Chọn `Bảng xem / in` để xem bảng cần dùng. Xem trước tối đa 50 dòng; ô dài hơn 1.000 ký tự chỉ được rút gọn ở preview, có ghi chú rõ.
5. **Xuất Excel đầy đủ**: tải file `.xlsx` có tất cả bảng thuộc loại báo cáo và sheet phạm vi/cảnh báo, không chỉ bảng đang xem.
6. **In bảng đang chọn / PDF**: mở bảng đã chọn trong cửa sổ in. Cho phép pop-up từ app nếu bị chặn; có thể chọn máy in hoặc Save as PDF. Không tự gửi báo cáo cho công ty/người bệnh.

## Báo cáo danh sách và thu tiền

- Sheet `Danh sách và thu`: STT, mã BN/NV (giữ số 0 đầu), họ tên, năm sinh, nhóm, ngày tiếp nhận, thanh toán HIS, phát sinh, phải thu, đã thu ròng, còn chưa thu và ghi chú.
- Sheet `Chứng từ nguồn`: người, schema/loại/ID phiếu, quyển/số/ngày, tiền gốc cả phiếu, miễn giảm nguồn, trả thiếu/trả sau, hoàn/ngày hoàn, tạm ứng, dịch vụ liên kết và trạng thái đối chiếu.
- Sheet `Chi phí chỉ định`: từng dòng ID/schema/MAQL/dịch vụ/số lượng/đơn giá/thành tiền; PAID chỉ là cờ nguồn, không xác nhận đã nhận tiền.
- Quy tắc đối chiếu dùng nguyên `payment.ts`, giống dashboard. Khoản chưa xác định xuất thành chữ, không thay bằng số 0. Tổng trong phần phạm vi là **đã thu ròng ở các người đối chiếu được**, kèm số người bị loại khỏi tổng vì chưa xác định.
- Tiền gốc cả phiếu không phải tiền đã phân bổ nếu đối chiếu chưa đủ; không cộng bảng chứng từ một lần nữa vào tiền bảng danh sách.
- Không coi số này là công nợ hợp đồng hoặc bằng chứng ngân hàng. Chưa phân bổ chắc chắn hủy/hoàn/miễn giảm/BHYT/tạm ứng qua nguồn vẫn chưa xác định, như module trước.

## Báo cáo kết quả XN / CLS

- `Danh sách kết quả`: thông tin người, trạng thái nguồn, số thông số XN/số kết quả CLS có giá trị, kết luận nguồn và bác sĩ.
- `XN theo danh sách`: mỗi người một dòng, mỗi thông số một cột, có mã thông số và đơn vị. Thông số cùng tên nhưng khác ID/đơn vị không được gộp. Ô có nhiều giá trị giữ tất cả, kèm phiếu và MAQL; không tự chọn một giá trị “cuối”.
- `XN chi tiết`: mỗi quan sát/thông số một dòng, kèm người, MAQL, phiếu, mã thông số, giá trị, đơn vị, cờ bất thường nguồn và ghi chú chưa xác minh duyệt/ký.
- `CLS chi tiết`: mỗi quan sát CLS một dòng, kèm phiếu/MAQL/dịch vụ/nguồn, nội dung kết quả và đề nghị gốc. Đang dùng nguồn CLS hiện có: CDHA/siêu âm/X-quang; không khẳng định đã có đầy đủ mọi loại CLS trong HIS.
- `CLS bản in`: nội dung văn bản có thể in trực tiếp. Với RTF, bản in chỉ ghi tham chiếu phiếu, **không chuyển/đoán thành văn bản y khoa**. Nội dung RTF gốc giữ ở CLS chi tiết trong Excel để đối chiếu HIS. Đây chưa phải phiếu kết quả phát hành chính thức có duyệt/ký.
- Chỉ loại dòng lặp khi toàn bộ trường nguồn giống nhau. Các giá trị khác nhau ở cùng thông số/phiếu/lượt vẫn giữ để đối chiếu.
- Người không có lượt vẫn xuất trong danh sách đợt nếu không bị lọc. Nguồn thiếu không bị báo thành “chưa có kết quả”; dữ liệu có giá trị không đồng nghĩa đủ dịch vụ/đã duyệt/ký. Số thông số không phải số dịch vụ.

## XLSX, in và dữ liệu dài

- ExcelJS 4.4.0 dùng document workbook browser, tải động chỉ khi nhấn xuất. XLSX thực sự, không đổi đuôi HTML/CSV. Có freeze hàng tiêu đề, lọc cột, wrap text, số tiền kiểu number và A4 landscape. Tham khảo [tài liệu ExcelJS](https://github.com/exceljs/exceljs#browser).
- Mã BN/NV, giá trị XN và nội dung nguồn được ghi kiểu chuỗi literal, không tạo formula/hyperlink dù bắt đầu bằng `=`. Tiền đã kiểm tra số được ghi numeric.
- Nội dung dài hơn 30.000 ký tự được giữ đủ ở sheet bổ sung `Nội dung dài`, chia phần có tham chiếu ô và số phần, không cắt cặp Unicode. Ghép nội dung theo số phần để khôi phục nguồn. Ô gốc chỉ dẫn đến sheet này.
- Giới hạn báo cáo: tối đa 1.000 cột hoặc 30.000 dòng mỗi bảng; XLSX tối đa 400.000 ô/20 triệu ký tự. Vượt ngưỡng từ chối và yêu cầu lọc thêm, không tạo báo cáo bị cắt.
- In tối đa 14 cột/2.000 dòng/2 triệu ký tự; không in trực tiếp ô RTF hoặc ô dài hơn 4.000 ký tự. Chọn bảng chi tiết phù hợp hoặc Excel. Bảng XN ngang có thể rất rộng; không tự bỏ thông số để ép vào một trang.

## Bảo mật và phạm vi

- Dùng snapshot đã trả cho super_admin nội bộ qua luồng KSK hiện có; không mở API export công khai hay quyền cho role khác. Vẫn chặn public/Vercel theo cấu hình module.
- Báo cáo dựng/tải trong bộ nhớ trình duyệt; không ghi localStorage, upload dịch vụ ngoài, lưu file người bệnh trên server hay gọi helper ghi Oracle. URL file tải chỉ chứa nhánh/loại/ID đợt, không chứa tên/ghi chú.
- Mọi file có công ty, đợt, phạm vi ngày/lượt, thời điểm đọc dữ liệu, bộ lọc/số người và cảnh báo. Đọc/Làm mới trước khi chốt để tránh nhầm thời điểm tạo file với thời điểm dữ liệu nguồn.
- Bản in escape HTML, không thực thi nội dung từ HIS và không tải tài nguyên ngoài. Cửa sổ in bỏ opener, có no-referrer và CSP hạn chế.
- File chứa dữ liệu sức khỏe cá nhân. Người xuất phải giữ trong hệ thống được phê duyệt và chỉ chuyển cho người có quyền. Chưa bổ sung audit export cấp từng người; chưa hỗ trợ lưu lịch sử/chữ ký báo cáo.

## Kiểm chứng và điểm tiếp tục

- Mô hình: `src/lib/ksk/reports.ts`. Excel/in: `src/lib/ksk/report-export.ts`. UI: `src/app/admin/ksk/reports.tsx`, được gắn vào `workspace.tsx` tại chi tiết đợt.
- Kiểm thử: `tests/ksk-reports.test.ts`, `tests/ksk-report-ui.test.tsx` và `tools/test-ksk-cn1-web.mjs`.
- Đã kiểm tra dữ liệu thật CN1: báo cáo thu 13 người/13 phiếu/127 chỉ định; báo cáo kết quả 13 người/540 dòng XN/21 dòng CLS. Hai XLSX đã tạo và đọc lại thành công trong RAM, không lưu nội dung cá nhân vào artifacts/log. HTTP dashboard/API 200/no-store.
- Unit/DOM tests kiểm tra loại bảng, bộ lọc, in/download, số tiền chưa xác định, lặp quan sát, ID số 0 đầu, chuỗi giống formula, escape HTML, dữ liệu dài/Unicode và browser bundle. Kiểm tra Node round-trip đã phát hiện khác biệt CJS/ESM của ExcelJS và sửa lấy Workbook từ default export khi cần.
- Kiểm tra cuối: **102/102 test qua**, Next.js production build thành công. Kiểm tra workbook browser bundle cũng qua; ExcelJS chỉ tải động khi xuất, không nằm trong tải đầu dashboard. Không thay agent/backend trong đợt này.
- Chưa kiểm tra hộp thoại in, bố cục PDF hay click download trên trình duyệt thật; cần người dùng thử trên Chrome/Edge tại app local. Tests DOM/memory không thay thế bước này.
- Đợt này chỉ đổi web/dependency và tài liệu; dùng agent KSK thanh toán đã có, không cần thay ZIP/restart agent bệnh viện.
- Tiếp theo nếu cần: mẫu in cố định của bệnh viện, đọc thêm nguồn CLS, chuyển RTF bằng parser đã kiểm chứng, ngày kết quả/duyệt thật, phân quyền/audit export và nghiệm thu kế toán. Không bổ sung công nợ công ty hoặc diễn giải lâm sàng từ báo cáo này.
