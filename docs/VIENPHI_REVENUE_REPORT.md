# Doanh thu viện phí theo thu ngân

Trang `/admin/vienphi-revenue`, API web `/api/admin/vienphi-revenue`, API agent `/api/internal/vienphi-revenue`.
Quyền menu độc lập `revenue`; quyền khám đoàn và báo cáo thu đoàn không cấp quyền này.

Bộ lọc: từ/đến ngày giờ HIS (đến giây, bao gồm giây cuối), thu ngân, khoa/phòng trên đầu phiếu, loại thu. Khoảng tối đa 31 ngày; tối đa 20.000 phiếu. Chỉ tải khi bấm Đọc/Làm mới. Lọc thu ngân/khoa/loại trên toàn bộ tập phiếu đã đọc. Excel xuất toàn bộ dòng đang lọc, không giới hạn bởi trang xem.

## Nguồn và cách tính

| Loại | Nguồn | Quy tắc |
| --- | --- | --- |
| Trực tiếp | `V_VIENPHILL`, tổng chi tiết `V_VIENPHICT`, `V_MIENNGTRU` | Tổng SL × đơn giá − phần BHYT (`MIEN` khi MADOITUONG=1) − miễn giảm − trả thiếu |
| Vượt ngưỡng / đồng chi trả | `V_TTRVLL`, `V_TTRVDS`, LOAIBN=3 | SOTIEN − BHYT − MIEN − THIEU − tạm ứng thực dùng |
| Ra viện | `V_TTRVLL`, `V_TTRVDS`, LOAIBN khác 3 | Cùng công thức trên |
| Tạm ứng | `V_TAMUNG` | +SOTIEN, kể cả đã dùng/hoàn sau ngày thu |
| Hoàn ứng | `V_HOANTRA`, LOAI_HT=4 | −SOTIEN theo ngày và người lập phiếu hoàn |
| Thu thuốc | schema dược `D_NGTRULL`, `D_NGTRUCT` | Tổng SL × giá bán − MIENGIAM; DONTHUOC_NOITRU=0, ID_V_VIENPHILL<=0 để tránh tính hai lần |
| Hoàn thu khác | `V_HOANTRA`, LOAI_HT khác 4 | −SOTIEN |

Đối chiếu cách phân loại với `Vienphi_Report.frmBangKeThuTien` trong bản Viện phí CN1. Thu ngân `V:<ID>` thuộc `V_DLOGIN`; `D:<ID>` thuộc `D_DLOGIN`, không gộp chỉ vì trùng ID/tên. Khoa viện phí lấy `h.MAKP` → `BTDKP_BV`; khoa dược lấy `h.MAKP` → `D_DUOCKP`. Một phiếu thuộc một khoa trên đầu phiếu; không phân bổ tiền theo khoa của từng dịch vụ.

CN1 có chế độ hoàn toàn bộ ứng khi thanh toán: V_HOANTRA liên kết IDTTRV, cùng MABN, ngày và USERID, tổng hoàn bằng TAMUNG. Trường hợp này tiền ra viện không trừ ứng lần nữa; hoàn ứng vẫn có dòng riêng. Nếu không có liên kết hoàn đủ thì trừ TAMUNG khỏi tiền thu. Hoàn ứng liên kết một phần/không rõ, tiền âm do khấu trừ vượt tổng, miễn giảm bổ sung chưa đối chiếu, phiếu không có số biên lai hợp lệ được ghi Chưa xác định, loại khỏi số tiền đã xác định và đếm riêng.

Phiếu trả sau/chưa thanh toán ghi nhận 0 tiền nhận. Cờ DAHOANTRA không xóa tiền thu lịch sử; hoàn tính thành sự kiện theo ngày hoàn. Mã nguồn + ID đầu phiếu là khóa; không cộng lặp tiền đầu phiếu khi có nhiều chi tiết. Ngày giờ nguồn 00:00:00 giữ nguyên, không suy đoán giờ thực thu. Không dùng PAID và không liên kết danh sách đoàn/tiếp nhận để quyết định đưa phiếu vào báo cáo.

Theo cách quét của app Viện phí, đọc tháng lưu trữ liền trước/liền sau khoảng chọn và lọc NGAY phiếu. Schema liền kề chưa được tạo có thể bỏ qua; thiếu bảng/quyền trong schema có tồn tại đánh dấu nguồn chưa đủ. Phạm vi xa hơn tháng liền kề chưa được hỗ trợ; đối chiếu HIS trước khi dùng làm số chốt kế toán.

Thu ròng trong trang là dòng tiền phiếu đã xác định, gồm tạm ứng và hoàn. Không gộp tạm ứng vào doanh thu dịch vụ trong kế toán. Khi nguồn lỗi/vượt giới hạn hoặc có phiếu cần đối chiếu, trang và Excel nêu rõ chưa phải tổng chốt toàn bộ.

## Kết nối và triển khai

Dùng `OracleKskReadOnly`, `Ksk:Enabled`, `Ksk:ServerToken`, `Ksk:MasterSchema`, `Ksk:MonthlySchemaPrefix` hiện có. Giao dịch Oracle luôn `SET TRANSACTION READ ONLY`.
`Revenue__PharmacySchemaPrefix` tùy chọn; mặc định prefix viện phí + `D` (CN1: `HGSOFT_BVD`). Không thay env Oracle nếu cấu hình KSK hiện đã đúng.

Bản public dùng hàng đợi Supabase hiện có, operation `report`, input cố định `{reportType:"cashier",from,to}`. Worker mới chuyển tới API loopback mới. Không cần migration hoặc mở cổng Oracle/API ra Internet. Phải cập nhật agent đang bật `KskCloud__Enabled=true` trước khi lấy dữ liệu trên public. Agent cũ từ chối yêu cầu mới và trang báo cần cập nhật.

Sau khi giải nén gói mới ở máy chủ, giữ nguyên file env thực và sao lưu thư mục cũ. Trong PowerShell Administrator tại `C:\PatientPortalAgent`:

```powershell
Stop-Service AnPhuPatientPortalSyncAgent -Force
# Chép các file gói mới vào C:\PatientPortalAgent; giữ patientapi-service.env hiện có.
.\install-patientapi-service.ps1
Get-Service AnPhuPatientPortalSyncAgent
Invoke-RestMethod http://127.0.0.1:5080/health
```

Cấp quyền Doanh thu viện phí cho từng tài khoản nhân viên. Không tự cấp cho toàn bộ người đang xem đoàn khám.

## Kiểm thử

- Vitest: `tests/revenue.test.ts`, `tests/revenue-route.test.ts`, `tests/revenue-ui.test.tsx`.
- Build agent và test phiên riêng trên CN1 (PowerShell 7): `tools/test-revenue-cn1.ps1 -AgentDll <đường dẫn DLL mới>`. Không dừng service chính. Script chỉ in số phiếu, trạng thái nguồn và số phiếu cần đối chiếu; dữ liệu bệnh nhân chỉ qua bộ nhớ.
- Đã đọc CN1 14/10/2026: 1.219 phiếu, 1.218 xác định được tiền, 1 phiếu vượt ngưỡng thiếu số biên lai nên để đối chiếu; đủ 15 trạng thái nguồn qua ba tháng lưu trữ. Đây là kiểm thử kỹ thuật, chưa phải biên bản đối chiếu kế toán.
