# Đối chiếu phiếu thu theo MAVAOVIEN của đợt khám

Cập nhật **15/10/2026**. Quy tắc được người dùng chấp thuận sau khi rà Oracle CN1. Áp dụng thống nhất dashboard người khám, chi phí, báo cáo theo đoàn và báo cáo thu tổng hợp. Chỉ đọc; không sửa dữ liệu HIS.

## Quy tắc

1. Đợt khám → `BASK_DONVI` → `TIEPDON` theo **MAQL và MABN**. Lấy `TIEPDON.MAVAOVIEN` làm lần vào viện gốc. Mở rộng lượt cùng lần vào viện chỉ khi đúng MABN và mã gốc > 0; không mở rộng mọi dòng có mã 0.
2. Chỉ định chỉ được tính khi **MABN + MAQL + MAVAOVIEN** khớp một lượt thuộc lần vào viện của đợt; MAVAOVIEN phải là mã dương. Mã 0/trống/khác bị loại khỏi phải thu, chi phí phát sinh và đối chiếu. Không bỏ toàn bộ LOAI=0: dịch vụ LOAI=0 có lần vào viện đúng vẫn hợp lệ.
3. Đầu phiếu có MAVAOVIEN dương khác đợt: loại khỏi thu của đợt, không dùng cùng bệnh nhân/MAQL để bỏ qua bất đồng. Nếu chỉ định thuộc đợt vẫn có dấu thu nhưng không có phiếu hợp lệ tương ứng, trạng thái còn Chưa xác định, không tự chuyển thành đã thu.
4. **Ngoại lệ đầu phiếu MAVAOVIEN=0:** chỉ chấp nhận khi MAQL khớp lượt tiếp nhận cùng người, toàn bộ chi tiết đều nối được chỉ định đúng lần vào viện của đợt, cùng MAQL, dịch vụ, số lượng, đơn giá, tổng tiền và số dòng. Liên kết hai chiều: đầu phiếu.ID = chi tiết.ID; chi tiết.IDCHIDINH = chỉ định.ID; chỉ định.IDTTRV = đầu phiếu.ID. Vẫn kiểm tra schema/TABLE_X; không đoán theo cùng tên dịch vụ hoặc cùng PAID.
5. NULL/thiếu trường MAVAOVIEN ở đầu phiếu chưa được coi như ngoại lệ mã 0. Chi tiết thiếu, khác lượt, khác đơn giá/số lượng dù cùng thành tiền, nhiều phiếu tranh cùng chỉ định, đầu phiếu không nhất quán đều Chưa xác định. Một phiếu có cả dịch vụ ngoài đợt không được tính một phần tùy ý.
6. Giữ nguyên kiểm tra số/quyển biên lai, miễn giảm, hủy/hoàn, trả sau, BHYT và tạm ứng. Chứng từ HIS không phải bằng chứng ngân hàng hoặc tiền công ty thanh toán hợp đồng.

## Hợp đồng kỹ thuật

- Agent trả `scope.episodePolicy=2`. Chỉ định có `mabn`, `mavaovien`, `loai`, `originid`; phiếu có `mavaovien`, chi tiết có `linequantity/lineprice` ngoài thành tiền.
- Agent vẫn trả chỉ định nguồn để đối chiếu, nhưng mọi số tiền hiển thị/xuất chỉ dùng `chargeInVisits/scopedCharges/memberRecords` đã lọc. Ghi chú tài chính nêu số chỉ định/phiếu bị loại và phiếu mã 0 đã xác minh.
- `sectionComplete` không công nhận nguồn tài chính của agent cũ thiếu episodePolicy; không biến thiếu dữ liệu thành số 0. Báo cáo thu tổng hợp từ chối hợp đồng cũ; màn hình theo đoàn vẫn có thể xem kết quả nhưng tiền Chưa xác định, yêu cầu cập nhật agent.
- Code: `backend/PatientApi/Ksk/OracleKskRepository.cs`, `src/lib/ksk/domain.ts`, `payment.ts`, `collections.ts`, `repository.ts`.
- Unit tests kiểm tra chỉ định mã 0/khác/null, đầu phiếu dương khác đợt, ngoại lệ mã 0 đầy đủ/thiếu, khác số lượng/đơn giá, xung đột lần vào viện trên cùng phiếu, hai phiếu tranh chỉ định và agent cũ.

## Kết quả CN1 tại thời điểm kiểm tra

- Hai mã người dùng cung cấp `26177516`, `26177547`: mỗi người có 18 dòng nguồn. Giữ 9 dòng đúng lần vào viện, loại 9 dòng MAVAOVIEN=0. Phiếu đầu mã 0 được xác minh toàn bộ 9 chi tiết. **Phải thu 560.000 đ, đã thu 560.000 đ, còn 0**, trạng thái Đã thanh toán đủ.
- Cả đoàn Hải Phong được rà: 100 người; 1.853 dòng nguồn → **954 chỉ định được tính**, loại 899 dòng của 94 người; chi phí **51.320.000 đ**. Dashboard đối chiếu **100 đã thanh toán đủ**, không còn Chưa xác định trong tập này.
- Báo cáo thu tổng hợp CN1 01–14/10 đọc/xuất Excel trong RAM vẫn đạt: 1.173 phiếu, 1.161 đối chiếu được, 12 Chưa xác định. Số người/đoàn có thể thay đổi khi HIS bổ sung dữ liệu; không đóng cứng các tổng này.
- Integration: `node tools/test-ksk-episode-cn1.mjs <ID-đoàn> <mã-BN> ...`; tool chỉ in trạng thái/số dòng/tiền kiểm thử, không lưu tên/kết quả lâm sàng. API và trang trả 200, ghi chú loại dòng/ngoại lệ mã 0 có trong HTML.
- Toàn bộ **155/155 test đạt**. .NET build/publish không cảnh báo/lỗi. Package kiểm tra có agent và tài liệu quy tắc, không chứa env thật hoặc `appsettings.Development.json`.

## Triển khai

Local CN1 đã nạp agent/web mới bằng launcher riêng, workers sync/match/online/outbox giữ tắt, giao dịch Oracle READ ONLY. Không đổi tài khoản nhân viên thật, env thật hay service bệnh viện CN1/CN3. Cần cập nhật cả web và agent khi triển khai chính thức; package mới đóng riêng `artifacts/patientapi-agent-ksk-episode-20261015.zip`, không ghi đè ZIP đợt 14/10.

Liên quan: [module KSK](KSK_READONLY_MODULE.md), [thu tiền tổng hợp](KSK_COLLECTIONS_REPORT.md), [báo cáo đoàn](KSK_REPORTS.md).
