# Phiếu thay đổi gói / danh sách khám — bản thử 15/10/2026

**Module thật kế tiếp:** [Quản lý đoàn/gói/danh sách HIS](KSK_MANAGEMENT.md), URL `/admin/ksk-manage`. Đã có form/nguồn CN1 thật và API riêng; không dùng dữ liệu LAB bên dưới để ghi HIS. Trạng thái ghi xem tài liệu mới, mặc định tắt.

## Phạm vi và trạng thái triển khai

Đây là **LAB giả lập tách biệt**, không ghi Oracle và không chỉnh báo cáo HIS thật. Người dùng đã chọn phương án bản nháp → duyệt → ghi HIS. Đợt thử triển khai đầy đủ chuyển trạng thái và áp dụng vào **HIS giả lập**; bước ghi HIS thật chưa triển khai/chưa được bật. Không được đổi nhãn giả lập thành ghi thật chỉ bằng biến môi trường.

- Trang `/admin/ksk-changes`; API `/api/admin/ksk-changes`, chỉ nội bộ, không Vercel, private/no-store.
- Chỉnh gói: tên gói, danh sách dịch vụ giả lập, số lượng và đơn giá nguyên VND. Sửa gói không hồi tố chỉ định, kết quả, giá/phiếu thu cũ.
- Danh sách: sửa thông tin người giả lập, nhóm/gói và thêm người mới. Không xóa người, sửa bệnh nhân gốc BTDBN, sửa kết quả hoặc chứng từ.
- Người đã tiếp nhận bị khóa; gói đã có người tiếp nhận cũng khóa trong bản thử. Kiểm tra lại khi tạo, sửa, gửi duyệt, duyệt và áp dụng.
- Mỗi phiếu chỉ tác động một gói hoặc một người. Không có import hàng loạt hoặc ghi dây chuyền trong đợt này.

## Quyền và hai người kiểm soát

Menu `ksk_changes` chỉ cấp quyền xem LAB. Các quyền thao tác riêng, mặc định tắt cho tài khoản hiện có:

| Mã | Quyền |
| --- | --- |
| `ksk_package_draft` | Lập/sửa/gửi duyệt phiếu gói khám của mình |
| `ksk_roster_draft` | Lập/sửa/gửi duyệt phiếu danh sách của mình |
| `ksk_change_approve` | Duyệt hoặc từ chối phiếu đã gửi của người khác |
| `ksk_change_apply` | Áp dụng phiếu đã duyệt vào HIS giả lập |

Chỉ quản trị toàn quyền được cấp quyền. Có quyền thao tác nhưng thiếu menu vẫn bị chặn. Quyền xem KSK/báo cáo cũ không tự cấp quyền mới. Session lấy quyền từ kho nhân viên mỗi request, thay quyền thu hồi cookie cũ như hiện tại. Người tạo **không tự duyệt**, kể cả super_admin; cần hai tài khoản riêng, không có nút giả danh người duyệt. Người áp dụng có thể là người lập hoặc duyệt nếu được cấp quyền riêng.

## Chuyển trạng thái

`Nháp → Chờ duyệt → Đã duyệt → Đã áp dụng GIẢ LẬP`. Chờ duyệt có thể bị từ chối kèm lý do; chỉ người lập được sửa phiếu nháp/từ chối, rồi gửi lại, phải duyệt lại. Nội dung đã duyệt bất biến; muốn đổi phải lập phiếu mới.

- Lưu bản trước/sau, người lập, người duyệt, người áp dụng, UTC timestamp, lý do và lịch sử từng lần thay đổi.
- Revision phiếu chống mất cập nhật; hash dữ liệu nguồn chống duyệt/ghi nhầm khi dữ liệu đã đổi. Hash lấy từ server, không tin bản trước do browser gửi.
- Nguồn thay đổi hoặc phát sinh tiếp nhận khi chờ duyệt: chặn áp dụng, không tự ghi đè. Lập phiếu mới từ nguồn đã làm mới.
- Ghi giả lập + cập nhật trạng thái + lịch sử nằm trong cùng atomic file replacement, khóa file liên tiến trình. Gửi lại lệnh apply không tạo lần ghi thứ hai.

## Lưu trữ và bật LAB

Giữ kiến trúc Next.js nội bộ và tài khoản nhân viên hiện có, không thêm provider auth hoặc Supabase cho LAB này. Dữ liệu LAB hoàn toàn nhân tạo, lưu JSON riêng ở đường dẫn tuyệt đối `KSK_CHANGE_STORE_PATH`, **không dưới public hoặc thư mục chia sẻ**. `KSK_CHANGE_LAB_ENABLED=true` mới cho hoạt động; mặc định tắt, Vercel luôn chặn. File và thư mục phải hạn chế ACL cho tài khoản chạy ứng dụng và SYSTEM; không lưu vào source/commit, không log nội dung phiếu.

Launcher CN1 thêm cờ opt-in `-EnableKskChangeLab`; chỉ đặt cấu hình vào process local, không sửa env/service thật. Không tạo/sửa tài khoản nhân viên thật để kiểm thử tự động. Tài khoản thử do người dùng tự tạo; unit/integration dùng kho tạm cô lập.

File lock còn sau crash phải kiểm tra tiến trình đã dừng trước khi IT xóa đúng file `.lock`; không tự phá khóa theo thời gian. Đây là LAB một máy/khối lượng nhỏ, không phải sổ audit chống quản trị máy sửa file; chưa dùng cho dữ liệu thật hoặc nhiều server.

### Thử local

```powershell
pwsh -NoProfile -File tools/start-ksk-cn1-local.ps1 -Stop
pwsh -NoProfile -File tools/start-ksk-cn1-local.ps1 -EnableKskChangeLab
```

Mở `http://127.0.0.1:3014/admin/ksk-changes`. Quản trị tạo/cấp quyền cho hai tài khoản khác nhau ở `/admin/staff`: người A có menu LAB + quyền lập phiếu, người B có menu LAB + quyền duyệt/áp dụng. Có thể dùng admin làm một trong hai người; không tự cấp/cài tài khoản thử thật bằng script. Không sửa env/service CN1/CN3.

1. Chọn gói `LAB-P01`, đổi giá/tên hoặc thêm dịch vụ → nhập lý do → **Lưu bản nháp**.
2. Mở phiếu, so sánh trước/sau, nhập lý do → **Gửi duyệt**.
3. Đăng nhập người B, mở phiếu → nhập lý do → **Duyệt phiếu** hoặc **Từ chối**.
4. Phiếu đã duyệt: nhập lý do, đánh dấu xác nhận → **Áp dụng HIS GIẢ LẬP**. Kiểm tra bảng nguồn và lịch sử; dữ liệu thật không đổi.
5. Thử người mẫu `LAB-M01` hoặc **Thêm người mới GIẢ LẬP**. Người `LAB-M02` và gói `LAB-P02` có tiếp nhận nên bị khóa.

Hash phiên bản trong LAB bảo thủ cho **toàn bộ nguồn giả lập**: áp dụng một phiếu có thể làm các phiếu khác cũ nguồn và phải lập lại. Không tự rebase/ghi đè. Phiếu đã duyệt không có sửa nội dung; phiếu bị từ chối sửa xong phải gửi/duyệt lại. Lịch sử UTC lưu nguyên, UI hiển thị giờ Việt Nam.

## Kiểm chứng và bàn giao đợt thử

- Vitest **181/181** đạt, Next.js production build đạt, gồm schema/tiền gói, phân quyền chính xác menu + action, tương thích tài khoản cũ, thu hồi phiên khi đổi action; tự duyệt kể cả super_admin bị chặn, chỉ người lập sửa/gửi, từ chối/sửa/gửi lại, khóa người/gói đã tiếp nhận, nguồn đổi/revision cũ, thêm người mẫu, không áp dụng lặp, không mở ghi thật bằng env.
- Lịch sử giữ cả nội dung đề nghị lúc tạo và mỗi lần lưu sửa; UI mở xem lại từng lần lưu, không chỉ có lý do thao tác cuối.
- `node tools/test-ksk-change-browser.mjs`: production server độc lập, hai staff **tạm** ở kho tạm ACL riêng, Edge headless riêng. Thao tác giao diện tạo nháp → gửi → đăng nhập người khác → duyệt → xác nhận/áp dụng → kiểm tra file giả lập và 4 sự kiện audit; gọi duyệt thiếu quyền trả 403, áp dụng lại trả 409. Không tạo/sửa nhân viên thật, không nối HIS trong server kiểm thử. Dừng tiến trình thử và xóa dữ liệu tạm sau kiểm tra; chỉ giữ ảnh màn hình dữ liệu nhân tạo.
- Đã xem ảnh `artifacts/ksk-change-lab-1366.png`, `ksk-change-lab-682.png`; không tràn ngang toàn trang, không lỗi runtime trong trình duyệt kiểm thử. Bảng có cuộn ngang riêng khi cần.
- `node tools/check-ksk-change-local.mjs`: local 3014, anonymous 401, API/page 200, no-store, đúng `mode=simulation`, 4 đối tượng mẫu/0 phiếu lúc bàn giao, `realHisWriteEnabled=false`. Đây chỉ GET, không lập phiếu hoặc sửa tài khoản người dùng.
- Đã chạy lại đúng process local bằng launcher `-EnableKskChangeLab`, không sửa env/service CN1/CN3. Hồi quy `tools/test-ksk-cn1-web.mjs` vẫn đọc thật CN1 13 người/13 lượt/127 chỉ định/540 thông số XN/21 CLS, đủ nguồn và 13 người thanh toán đủ như trước; xuất Excel trong RAM đạt, không ghi HIS.
- Hướng dẫn auth/React giữ quyền ở server trên từng request, form có nhãn/nút rõ, client chỉ nhận contract dữ liệu LAB và action được cấp, không nhận credential/env. Không thay nhà cung cấp auth, không thêm phụ thuộc hoặc public/Vercel.
- Source chính: `src/lib/ksk/change-contract.ts`, `change-lab-store.ts`, `change-lab-seed.ts`; page/UI `src/app/admin/ksk-changes`, route `src/app/api/admin/ksk-changes/route.ts`. Đợt này chỉ thay web và launcher/tài liệu, **không cần publish ZIP agent**.
- Chưa nghiệm thu nghiệp vụ kế toán/HIS thật, chưa có Oracle DML/ledger/idempotency giao dịch thật. Không được dùng kết quả LAB để khẳng định đã sửa HIS.

## Điều kiện trước khi ghi HIS thật

1. Khảo sát đầy đủ `KSKMUC`, `KSKMUCCT`, gói mẫu, `KSKBTDBN`, các helper cập nhật, trigger/sequence và liên kết `BASK_DONVI` theo schema CN1. Signature trong code reverse không chứng minh nội dung DML đúng.
2. Xác nhận nghiệp vụ đổi gói/giá cho người đã tiếp nhận; không suy ra từ PAID, phải kiểm tra chỉ định/kết quả/chứng từ đúng MAQL/MAVAOVIEN và các tháng liên quan.
3. Agent nội bộ có endpoint lệnh riêng, credential ghi tối thiểu, token riêng, không dùng tài khoản read-only hoặc endpoint báo cáo để ghi.
4. Oracle transaction, kiểm tra lại/khóa nguồn, idempotency ledger trong Oracle cùng transaction với DML; timeout mất kết quả phải tra ledger, không tự retry mù.
5. Bind parameters/allowlist, giới hạn một đối tượng, version/hash, xác minh người duyệt và chữ ký lệnh; đối chiếu sau ghi với HIS và kiểm thử rollback trên database test.
6. Nghiệm thu bởi người phụ trách HIS/kế toán, sao lưu và mở quyền thật có chủ đích. Không được bật ghi chỉ vì LAB đã chạy đạt.
