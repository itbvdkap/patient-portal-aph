# Báo cáo thu tiền khám đoàn tổng hợp

## Hiển thị ngày giờ — 15/10/2026

- Cột **Ngày giờ thu (HIS)** và **Ngày giờ đăng ký (HIS)** hiển thị `dd/MM/yyyy HH:mm:ss`, ví dụ `14/10/2026 08:35:42`, thay chuỗi ISO có `T`. Áp dụng bảng tổng hợp, hồ sơ chứng từ, Excel và bản in/PDF; ngày hoàn cũng cùng định dạng.
- Dữ liệu Oracle là giờ địa phương, không tự chuyển múi giờ theo máy người xem. Giữ nguyên ISO trong domain/API để lọc, sắp xếp và đối chiếu; không thay quy tắc tiền hay MAVAOVIEN.
- Nguồn `2026-10-14T00:00:00` hiển thị `14/10/2026 00:00:00`. Không suy đoán đây là giờ thu thực tế hay giờ bị thiếu; cần đối chiếu HIS. Nguồn chỉ có ngày ghi **chưa có giờ**, thiếu giây ghi **chưa có giây**; không tự thêm giờ giả.
- Chỉ thay web; không cần cập nhật agent, env hoặc ghi dữ liệu HIS cho thay đổi định dạng này.
- Kiểm chứng đợt định dạng: **160/160 test đạt**, production build đạt. CN1 thật trong phạm vi 01–14/10/2026: 1.173 phiếu; API/SSR 200, ngày giờ hiển thị và ô Excel khớp chuỗi nguồn tới giây, tạo bản in đạt. Không lưu báo cáo cá nhân ra artifact, không ghi HIS; 1.161 phiếu đối chiếu được và 12 chưa xác định giữ nguyên.

**Bổ sung 15/10/2026:** [đối chiếu MAVAOVIEN phiên bản 2](KSK_EPISODE_PAYMENT_POLICY.md), loại chỉ định/phiếu khác lần vào viện; ngoại lệ đầu phiếu mã 0 chỉ khi toàn bộ chi tiết đúng đợt. Cần cả web và agent mới; package đợt 15/10 riêng, không dùng bản 14/10 để có quy tắc này.

Cập nhật 14/10/2026. Module nội bộ **chỉ đọc HIS**, thử CN1. Không cần mở từng công ty/đoàn trước khi xem báo cáo.

## Sử dụng và quyền

- Local: `http://127.0.0.1:3014/admin/ksk-collections`. LAN: `https://192.168.2.8:3443/admin/ksk-collections`; điều kiện firewall/trust chứng chỉ vẫn theo [hướng dẫn LAN](KSK_LAN_STAFF_ACCESS.md).
- Menu **Báo cáo thu tiền**. Super_admin được xem. Staff cần cấp riêng menu **Báo cáo thu tiền khám đoàn** (`ksk_collections`) tại `/admin/staff`, rồi đăng nhập lại. Quyền KSK cũ không tự cấp báo cáo tài chính tổng hợp.
- Chọn **Đăng ký từ/đến ngày**, **Thu từ/đến ngày**, bấm **Đọc / Làm mới HIS**. Mặc định đầu tháng đến hôm nay theo ngày Việt Nam.
- Lọc công ty, người phụ trách/CSKH, thu ngân HIS và trạng thái chứng từ. Bộ lọc tên có tìm kiếm và lọc ngay dữ liệu đã đọc. Đổi ngày cần Đọc/Làm mới; phạm vi đã đọc hiện riêng dưới form.
- Mỗi trang 50 phiếu. **Xuất Excel theo bộ lọc** và **In / PDF** lấy toàn bộ phiếu đã lọc, không chỉ trang hiện tại. Excel có bảng phạm vi/cảnh báo, phiếu chi tiết và bản in hẹp. Cho phép pop-up để in.

## Nguồn và ý nghĩa

| Mục | Nguồn |
| --- | --- |
| Công ty | `KSKDOAN.ID_KSK_KHACHHANG` → `KSK_KHACHHANG` |
| Đoàn / nhóm / người | `BASK_DONVI.ID_DOAN/MADONVI/MABN`, `KSKDONVI`, `KSKBTDBN` |
| Phụ trách / CSKH | Nguyên ghi chú `KSKDOAN.GHICHU`, không phải danh mục nhân viên chính thức |
| Ngày đăng ký | `TIEPDON.NGAY` của lượt nối `BASK_DONVI.MAQL`, **không phải ngày tạo đoàn** |
| Ngày thu | `NGAY` đầu phiếu `V_VIENPHILL` (DIRECT) / `V_TTRVLL` (SETTLEMENT) |
| Thu ngân | `USERID` đầu phiếu → `V_DLOGIN.ID`, tên `HOTEN`/`TEN` nếu có; không đọc mật khẩu |
| Đối chiếu dịch vụ | `V_CHIDINH` theo ID chi tiết phiếu tham chiếu, schema/MAQL/dịch vụ/IDTTRV/TABLE_X |

Hai khoảng ngày là **giao điều kiện**: ngày thu thuộc khoảng thu, lượt đăng ký thuộc khoảng đăng ký. Chọn đăng ký rộng hơn nếu thu cho lượt cũ; không tự tìm mọi lượt lịch sử. Danh sách đoàn tìm theo lượt đăng ký, không giới hạn bởi ngày tạo đoàn. Thu ngân là người lập/thu phiếu trong HIS, không phải nhân viên portal hoặc xác nhận ngân hàng.

URL chỉ chứa ngày, mã công ty, ID đoàn đại diện ghi chú phụ trách, mã thu ngân và trạng thái, không đưa tên người/ghi chú/token vào URL. Bộ lọc tên trên browser **không phải ranh giới phân quyền**; API trả toàn bộ phạm vi ngày được cấp. Quyền hiện theo toàn chi nhánh, chưa giới hạn từng công ty/thu ngân hoặc tách quyền xem/xuất.

## Tiền và trạng thái

- Đơn vị là phiếu duy nhất theo **schema + loại + ID**, không cộng lại theo dòng dịch vụ/người. Dùng quy tắc `payment.ts`, không chỉ PAID.
- **Đối chiếu được** (xanh): duy nhất người/đoàn, đủ dịch vụ/tổng tiền, quyển/số hợp lệ, không có dấu hiệu cần phân bổ bổ sung.
- **Trả sau — chưa nhận tiền** (cam): đủ bằng chứng phiếu trả sau; thu ngày phiếu bằng 0, không coi là nhận tiền.
- **Chưa xác định** (vàng): hủy/hoàn, thiếu liên kết, nhiều phiếu cùng chỉ định, trùng khác nội dung, thiếu ngày/nguồn, BHYT hoặc phân bổ chưa chứng minh được. Giữ phiếu/ghi chú, **không cộng vào tổng đối chiếu được**.
- Thu ngày phiếu = tiền qua phiếu sau miễn giảm/trả thiếu **trừ tạm ứng đã áp dụng có đối chiếu**, không nhận tiền tạm ứng hai lần. Không phải tổng thanh toán hồ sơ hoặc tổng dòng tiền toàn viện.
- Thiếu nguồn/vượt giới hạn: tổng và số phiếu **Chưa xác định**, khóa xuất/in; không tự dùng 0/demo thay lỗi HIS.
- Mỗi khoảng tối đa 93 ngày inclusive, toàn phạm vi hai khoảng tối đa 186 ngày. Giới hạn 20.000 dòng mỗi tập dữ liệu tổng hợp, kiểm tra nguồn tháng và tổng các tháng; vượt phải thu hẹp ngày. Chưa có job báo cáo bất đồng bộ.

**Không bao gồm:** thu tạm ứng riêng, loại thu chưa tích hợp, phiếu ngoài phạm vi tháng, tiền công ty thanh toán hợp đồng hoặc sổ công nợ. Chưa lập sổ hoàn theo ngày hoàn; phiếu hoàn giữ Chưa xác định. Chưa chứng minh đầy đủ hủy/thay phiếu ngoài phạm vi chọn. Cần đối chiếu kế toán trước khi dùng để chốt sổ/công nợ/xác nhận ngân hàng.

## Kỹ thuật và triển khai

- UI `/admin/ksk-collections`, GET `/api/admin/ksk-collections`, domain `src/lib/ksk/collections.ts`, repository `src/lib/ksk/repository.ts`.
- Agent vẫn GET `/api/internal/ksk`, thêm `all=1`, `collectedFrom`, `collectedTo`, `from`, `to`, `cohort=`. Response scope có `collections=true` và ngày thu; web từ chối agent cũ/sai scope, không lấy tổng từ một đoàn riêng.
- Thêm `cohortid` cho thành viên/lượt, `registereddate` cho lượt, `cashierid/cashiername` cho phiếu. Financial request **không tải clinical/labs/imaging**. Chỉ đọc chỉ định được phiếu tham chiếu thay vì tất cả chỉ định chưa thu của mọi người.
- Giữ Oracle `SET TRANSACTION READ ONLY`, bind parameters, schema allowlist, timeout, token riêng, no-store, server menu guards, chặn Vercel. Không thay schema/ghi HIS/nhân viên thật/Zalo.
- Cần cập nhật **web và agent**. Local CN1 đã chạy lại launcher riêng; không dừng/cài service bệnh viện. Worker sync/match/online/outbox vẫn tắt. Oracle credential cũ chỉ giữ trong child environment, là tài khoản người vận hành cho phép thử; chưa thay principal SELECT-only riêng.
- ZIP agent đợt này được đóng gói riêng; không tự chép CN1/CN3 production. Giữ env thật và chỉ cập nhật service theo yêu cầu vận hành. Xem [KSK](KSK_READONLY_MODULE.md), [Windows service](../deploy/windows-service/README.md).
- XLSX thật dựng trong RAM, không lưu tài chính/bệnh nhân vào artifact/log; chuỗi literal và HTML escape theo exporter hiện có. Ảnh kiểm tra chỉ chụp form lọc. Chưa audit export chi tiết, chưa nghiệm thu kế toán.

## Kiểm chứng

- CN1 thật, đăng ký và thu **01–14/10/2026**: 110 đoàn, 1.526 người, 1.620 dòng lượt, 11.144 chỉ định tham chiếu, 11.156 dòng chi tiết → **1.173 phiếu**, **1.161 đối chiếu được**, **12 chưa xác định**, 0 trả sau trong tập thử. Có mã/tên thu ngân. Số liệu tại thời điểm đọc, không cố định cho HIS về sau.
- API/page 200/no-store, anonymous API 401; Excel tạo/đọc lại trong RAM khớp số dòng, bản in HTML hẹp tạo được. Không lưu file tài chính thật/in/gửi ra ngoài để thử.
- Edge headless riêng 1366×768 và 682×1012: 4 ô ngày, bộ lọc công ty/phụ trách/thu ngân, nút Đọc rõ, không tràn ngang toàn trang, có thử thay thu ngân. Đã xem `artifacts/ksk-collections-filters-1366.png`, `ksk-collections-filters-682.png`, chỉ có form lọc.
- Hồi quy từng đoàn CN1: 13 người/13 phiếu/127 chỉ định, 540 dòng XN, 21 CLS, API/dashboard và Excel round-trip đạt.
- Tests `ksk-collections.test.ts`, `ksk-collections-route.test.ts`, `ksk-collections-ui.test.tsx`, bổ sung repository contract; integration `tools/test-ksk-collections-cn1.mjs`, browser `node tools/test-staff-button-browser.mjs --collections`.
- Toàn bộ **143/143 test đạt**, Next.js production build thành công. .NET build không cảnh báo/lỗi; package riêng `artifacts/patientapi-agent-ksk-collections-20261014.zip`. Không ghi đè ZIP agent chuẩn hoặc bản cũ, không tự triển khai service.
- Chưa nghiệm thu sổ thu ngân/đối soát kế toán, chưa thử từ máy LAN khác, chưa public/Vercel hoặc triển khai service bệnh viện.
