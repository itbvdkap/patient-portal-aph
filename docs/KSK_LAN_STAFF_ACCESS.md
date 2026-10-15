# KSK CN1: LAN HTTPS và tài khoản nhân viên

## Test LAN cổng 3014 — cập nhật 15/10/2026

Theo yêu cầu mới, đã bổ sung gateway HTTPS riêng nghe **`192.168.2.8:3014`**, chỉ chấp nhận IP nguồn CN1 `192.168.2.0/24`. Web upstream vẫn HTTP loopback `127.0.0.1:3014`; agent `127.0.0.1:5094` không mở LAN. Không bind tất cả card mạng, không port-forward Internet. Cổng 3443 bên dưới vẫn là lựa chọn cũ, mặc định launcher không đổi.

Địa chỉ thử: **`https://192.168.2.8:3014/admin/login`** (phải dùng HTTPS, không HTTP). Dùng chứng chỉ CN1 sẵn có; IT xác minh/cài trust file `.cer` theo hướng dẫn bên dưới, không chia sẻ private key.

Phiên hiện tại không có quyền Administrator: gateway đã mở, **firewall chưa thay đổi; chưa xác nhận từ máy khách LAN**. Mở PowerShell 7 **Run as Administrator** trên máy 192.168.2.8, chạy:

```powershell
pwsh -NoProfile -File "E:\HIS\APP_BENHAN\tools\start-ksk-cn1-lan.ps1" -LanPort 3014 -ConfigureFirewall
```

Rule riêng `AnPhu-KSK-CN1-HTTPS-3014`: TCP inbound 3014, local `192.168.2.8`, remote `192.168.2.0/24`, profile Private. Không tắt firewall hoặc mở Oracle/agent. Máy khách cùng subnet kiểm tra `Test-NetConnection 192.168.2.8 -Port 3014`, rồi dùng URL HTTPS. Chỉ kiểm tra ngay trên server không chứng minh máy khách đi qua firewall được.

Khởi động lại gateway 3014 sau reboot (local web/agent cần chạy trước):

```powershell
pwsh -NoProfile -File "E:\HIS\APP_BENHAN\tools\start-ksk-cn1-lan.ps1" -LanPort 3014
# Dừng riêng gateway 3014; thêm -ConfigureFirewall trong PowerShell admin để disable rule:
pwsh -NoProfile -File "E:\HIS\APP_BENHAN\tools\start-ksk-cn1-lan.ps1" -LanPort 3014 -Stop
```

Kiểm thử TLS/login/phân quyền qua gateway: `node tools/test-ksk-cn1-lan.mjs --port3014`. Chỉ dùng CA explicit của chứng chỉ CN1, không tắt kiểm tra TLS. CN1 vẫn chỉ đọc và lưu nháp, không mở ghi HIS/worker/Zalo.

**Quản lý HIS thật — 15/10/2026:** [module `/admin/ksk-manage`](KSK_MANAGEMENT.md) có menu `ksk_manage` và 4 action riêng `ksk_manage_roster/package/approve/apply`. Không kế thừa quyền LAB hoặc báo cáo. Kho nháp mã hóa riêng, thu hồi phiên khi thay action, yêu cầu hai người. Dữ liệu đọc thật CN1; ghi server vẫn tắt, cần nghiệm thu DB TEST/ledger/credential trước. Các mô tả chỉ đọc bên dưới áp dụng các menu báo cáo cũ.

**Bổ sung 15/10/2026:** [Phiếu thay đổi gói / danh sách — LAB](KSK_CHANGE_WORKFLOW.md). Menu `ksk_changes` chỉ xem dữ liệu giả lập; 4 action riêng `ksk_package_draft`, `ksk_roster_draft`, `ksk_change_approve`, `ksk_change_apply` được quản trị bật/tắt từng user. Mặc định không cấp cho tài khoản cũ, không cho ghi Oracle thật. Các mô tả staff chỉ đọc bên dưới vẫn áp dụng menu HIS/báo cáo, không phủ nhận ngoại lệ LAB này.

Cập nhật 14/10/2026. Người dùng chọn **tài khoản nhân viên riêng**, mạng **CN1 192.168.2.8**. Không dùng tài khoản bệnh nhân, không thay Oracle/HIS hay service bệnh viện.

Đợt mới: [báo cáo thu tiền tổng hợp](KSK_COLLECTIONS_REPORT.md). Cấp riêng menu **Báo cáo thu tiền khám đoàn** (`ksk_collections`) để staff thấy `/admin/ksk-collections`; quyền KSK cũ không tự cấp. Đổi quyền thu hồi phiên cũ, cần đăng nhập lại. Chưa giới hạn từng công ty/thu ngân.

## Địa chỉ và trạng thái

- Local hiện có: `http://127.0.0.1:3014/admin/ksk`.
- LAN: **`https://192.168.2.8:3443/admin/login`**; KSK: `/admin/ksk`; quản lý nhân viên: `/admin/staff`; nhân viên tự đổi mật khẩu: `/admin/password`.
- Gateway TLS nghe duy nhất `192.168.2.8:3443`, chỉ nhận IP nguồn `192.168.2.0/24` và Host đúng. Không bind `0.0.0.0`, IP CN3, Tailscale hoặc chuyển tiếp Internet.
- Next.js vẫn loopback `127.0.0.1:3014`; PatientApi vẫn loopback `127.0.0.1:5094`. Gateway chỉ cho admin, API admin và tài nguyên Next, không mở `/api/me`, API agent hoặc portal bệnh nhân.
- Gateway đã chạy và HTTPS được kiểm tra ngay trên máy này. **Phiên công cụ không có quyền Administrator, nên chưa tạo/enable firewall rule; chưa xác nhận máy khác kết nối được.**

## Mở firewall một lần

Trên máy `192.168.2.8`, mở **PowerShell 7 (`pwsh`) Run as Administrator**, chạy:

```powershell
pwsh -NoProfile -File "E:\HIS\APP_BENHAN\tools\start-ksk-cn1-lan.ps1" -ConfigureFirewall
```

Rule tên `AnPhu-KSK-CN1-HTTPS-3443`: inbound TCP 3443, local 192.168.2.8, remote 192.168.2.0/24, profile Private. Không tắt firewall, không mở agent/Oracle hoặc profile Public. Launcher giữ listener hiện tại chỉ khi khớp PID/start time/path và địa chỉ; không expose tiến trình lạ chiếm cổng.

Từ một máy CN1 khác:

```powershell
Test-NetConnection 192.168.2.8 -Port 3443
```

Nếu không thông, kiểm tra máy cùng subnet, profile mạng Private/routing và rule; không mở rộng toàn bộ mạng một cách tự động. Truy cập bằng **HTTPS**, không `http://192.168.2.8:3014`.

## Chứng chỉ TLS nội bộ

- Đợt thử dùng chứng chỉ tự ký cho IP `192.168.2.8`, RSA 3072/SHA256, mục đích server authentication, hạn 6 tháng. Đây là bản thử nội bộ; khi sử dụng thường xuyên nên dùng chứng chỉ do IT/CA của bệnh viện cấp và tên DNS nội bộ.
- File công khai có thể chép đến máy được phê duyệt: `E:\HIS\APP_BENHAN\artifacts\ksk-cn1-lan\cn1-server.cer`.
- SHA256 của file CER tạo đợt này: `212DD117D79837B4C263DEB7D872B317D3E41638CF0BC8D64CE030F26E374AF5`.
- IT/người vận hành xác minh fingerprint qua kênh tin cậy trước khi cài vào kho chứng chỉ tin cậy của máy khách. Không coi việc bấm bỏ qua cảnh báo mọi chứng chỉ là cấu hình triển khai. Tham khảo [Microsoft về chứng chỉ tự ký cho thử nghiệm](https://learn.microsoft.com/en-us/powershell/module/pki/new-selfsignedcertificate?view=windowsserver2025-ps).
- Tuyệt đối **không chép `cn1-server.key.pem`**, không chia sẻ toàn bộ thư mục artifacts. Key lưu trong thư mục bị giới hạn ACL cho operator và SYSTEM, không commit. Không tự cài trust lên máy khác trong đợt này.

## Tạo nhân viên và phân quyền

1. Đăng nhập tài khoản quản trị server hiện có trên `/admin/login`.
2. Mở menu **Nhân viên & phân quyền** (`/admin/staff`), bấm Thêm nhân viên.
3. Nhập username riêng (chữ/số/chấm/gạch), họ tên và mật khẩu tối thiểu 12 ký tự có chữ và số, **nhập lại mật khẩu lần thứ hai**. Máy chủ cũng kiểm tra xác nhận, không chỉ giao diện. Không dùng tên admin/server, không tạo tài khoản bệnh nhân làm nhân viên.
4. Tích **Cho phép vào trang admin** và các menu cần cấp. Mặc định gợi ý chỉ **Khám đoàn và báo cáo XN / CLS**; người quản trị quyết định.
5. Bấm **Lưu nhân viên** ở đầu form (thanh thao tác sticky trên màn hình nhỏ); cuối form vẫn có nút Lưu. Bấm **Sửa** ở dòng nhân viên để sửa tên hiển thị/quyền/menu, rồi **Lưu thay đổi**. Username không đổi. Để reset mật khẩu, nhập mật khẩu mới và nhập lại; nếu giữ mật khẩu, để trống cả hai ô. **Hủy** bỏ nội dung chỉnh sửa chưa lưu, không xóa tài khoản.
6. Bấm **Xóa** ở dòng nhân viên, nhập đúng username, rồi **Xác nhận xóa**. Đây là xóa mềm: gỡ khỏi danh sách, chặn đăng nhập, thu hồi phiên cũ nhưng giữ bản ghi `deletedAt/deletedBy` và backup. **Không xóa HIS, hồ sơ bệnh nhân hoặc tài khoản admin cấu hình server.** Username đã xóa không tự được tái sử dụng. Có thể chọn **Không xóa** để hủy xác nhận.

**Hạn chế đã xác định:** API hiện vẫn dùng upsert chung cho tạo/sửa, nên tạo mới bằng username đã có (không phân biệt hoa/thường) có thể cập nhật đè tài khoản đó. Chưa triển khai tách create/update và cảnh báo trùng; khi tạo mới phải chọn tên chưa có, khi sửa dùng nút Sửa. Chính sách mật khẩu hiện kiểm tra độ dài/chữ/số và xác nhận khớp, chưa chặn danh sách mật khẩu phổ biến. Đợt sửa nút Lưu không thay đổi các quy tắc này.

## Nhân viên tự đổi mật khẩu

- Đăng nhập bằng tài khoản nhân viên riêng, mở menu **Đổi mật khẩu** (`/admin/password`). Menu này luôn có cho staff đang được phép đăng nhập, kể cả chưa được cấp menu nghiệp vụ.
- Nhập mật khẩu hiện tại, mật khẩu mới và nhập lại mật khẩu mới. Mật khẩu mới phải khác mật khẩu cũ, ít nhất 12 ký tự có chữ và số.
- Bấm **Lưu mật khẩu mới**. Thành công: cookie hiện tại được xóa, revision thay đổi khiến tất cả phiên cũ không còn hợp lệ, chuyển về trang đăng nhập. Đăng nhập lại bằng mật khẩu mới. Quyền/menu/tên nhân viên không đổi.
- API lấy danh tính từ session server, không nhận username/role/menu từ client. Kiểm tra cùng Origin/Host, giới hạn payload; tối đa 8 lần sai mật khẩu hiện tại trong 15 phút cho mỗi tài khoản/revision của tiến trình local.
- Tài khoản bootstrap trong `ADMIN_USERS_JSON` hoặc `ADMIN_PASSWORD` **không** được đổi bằng form staff; quản trị hệ thống vẫn đổi cấu hình server theo quy trình riêng. Không sửa `.env.local`, auth tài khoản bệnh nhân hoặc Supabase trong đợt này.

Nhân viên chỉ đọc các menu được cấp. Trang `/admin` là trang lựa chọn phân hệ, không còn đọc toàn bộ dashboard mọi mô-đun cho tài khoản giới hạn. Menu settings và quản lý nhân viên không cấp cho staff. Các role cũ giữ các path cụ thể; sửa lỗi `/admin` không còn cấp wildcard mọi trang con.

- Kiểm tra quyền ở server layout, từng trang và API; ẩn menu chỉ là một phần UI. Gõ URL trực tiếp không vượt quyền.
- Staff không có action sửa/xóa nghiệp vụ/thu tiền/đồng bộ/gửi Zalo/nội dung hoặc quản lý nhân viên khác. API mutation nghiệp vụ trả 403; UI ẩn editor nội dung cho staff. Ngoại lệ có chủ đích: staff được đổi mật khẩu **của chính mình** sau khi xác minh mật khẩu hiện tại. Role quản trị cũ giữ quyền thao tác đã cấu hình.
- Quyền KSK bao gồm toàn bộ đoàn/đối tượng/kết quả/tài chính và xuất báo cáo ở chi nhánh mà server đang nối. **Chưa phân quyền theo từng công ty/đoàn hoặc tách quyền xuất khỏi quyền xem**. Chỉ cấp cho nhân viên được phép xem phạm vi này.
- Khóa/xóa/đổi menu/đổi action LAB/đổi mật khẩu nhân viên làm thay revision và thu hồi phiên cũ ngay lần yêu cầu server tiếp theo. Nhân viên đăng nhập lại để nhận quyền mới. Dữ liệu/file đã xem/tải trước đó không thể thu hồi khỏi máy khách.

## Kho tài khoản và bảo mật

- Server nội bộ bật `ADMIN_STAFF_ENABLED=true`, `ADMIN_STAFF_STORE_PATH` là file tuyệt đối riêng. Launcher local đã gắn `artifacts/admin-staff/users.json` vào environment child-process, không sửa `.env.local` thật.
- Chỉ lưu mật khẩu dạng `scrypt` có salt riêng, không plaintext. API danh sách không trả hash/revision/password. Cookie HttpOnly/SameSite Lax, Secure khi qua HTTPS; phiên staff 8 giờ, revision đọc lại từ server.
- File và backup chứa hash và quyền vẫn là dữ liệu nhạy cảm: ACL cho operator/SYSTEM, nằm ngoài `public`, không shared folder, không Git. Backup tạo trước atomic replacement, giữ để khôi phục có kiểm soát; operator quản lý lưu trữ, không xóa tự động.
- Tài khoản quản trị bootstrap vẫn dùng `ADMIN_USERS_JSON` hoặc fallback username chính xác `admin` + mật khẩu environment hiện có. JSON sai không fallback sang global password, và global password không còn đăng nhập bất kỳ username nào thành super_admin.
- Login throttle tại một Node process: tối đa 8 lỗi/tên trong 15 phút. Đây không phải rate-limit phân tán/MFA; cần bổ sung nếu triển khai nhiều tiến trình hoặc ngoài mạng bệnh viện.
- API quản lý nhân viên chỉ cho super_admin, kiểm tra cùng Host/Origin, input/menu allowlist, không tạo role super_admin từ UI. File store bị chặn khi `VERCEL` hoặc module tắt.
- Đây là kho single-node để thử LAN, không thay auth portal hoặc làm migration Supabase. Đã có đổi mật khẩu tự phục vụ cho staff; chưa có SSO/MFA, audit chuẩn cho login/xem/export. `updatedBy/updatedAt`, dấu xóa và backup chưa thay thế nhật ký audit nghiệp vụ. Giới hạn 200 bản ghi bao gồm bản ghi xóa mềm.
- Khôi phục nhân viên là thao tác IT có kiểm soát, chưa có nút tự động: sao lưu kho hiện tại, đối chiếu backup để khôi phục **riêng bản ghi được phê duyệt**, không ghi đè toàn bộ kho làm mất các thay đổi mới. Bỏ dấu xóa, để tài khoản khóa, tạo revision ngẫu nhiên mới 32 ký tự hex; sau đó dùng UI đặt lại mật khẩu/quyền và mở khóa. Không khôi phục revision cũ vì có thể làm cookie cũ hoạt động lại.

## Chạy/dừng và khôi phục

```powershell
# Vẫn dùng local launcher CN1, worker tắt, Oracle giao dịch read only:
pwsh -NoProfile -File "E:\HIS\APP_BENHAN\tools\start-ksk-cn1-local.ps1"
# Start gateway (không sửa firewall nếu không có switch):
pwsh -NoProfile -File "E:\HIS\APP_BENHAN\tools\start-ksk-cn1-lan.ps1"
# Dừng gateway do launcher tạo (không dừng HIS/local agent):
pwsh -NoProfile -File "E:\HIS\APP_BENHAN\tools\start-ksk-cn1-lan.ps1" -Stop
# Với quyền admin, dừng và disable rule riêng:
pwsh -NoProfile -File "E:\HIS\APP_BENHAN\tools\start-ksk-cn1-lan.ps1" -Stop -ConfigureFirewall
```

Thư mục TLS được giữ sau stop để không đổi fingerprint; không tái tạo/xóa key tự động. Các tiến trình thử không phải service tự khởi động sau reboot. Cần khởi động local trước gateway; gateway không thay database hoặc service bệnh viện.

## Kiểm thử và điểm tiếp tục

- Chức năng: `src/lib/admin/permissions.ts`, `staff-store.ts`, `session.ts`; UI/API `/admin/staff`, `/api/admin/staff`, POST `/api/admin/staff/delete`; UI `/admin/password`, POST `/api/admin/password`.
- Tất cả page/action dùng subject session để kiểm tra path/menu; AdminShell lấy đúng menus session. Staff không nhận quyền chỉ từ role string hoặc menu do request gửi.
- LAN: `tools/start-ksk-cn1-lan.ps1`, `tools/ksk-lan-proxy.mjs`, `tools/test-ksk-cn1-lan.mjs`. TLS test dùng CA explicit của chính chứng chỉ, không `rejectUnauthorized=false`.
- Đã kiểm tra HTTPS login/staff UI/API 200, cookie Secure/HttpOnly, anonymous KSK 401, API ngoài admin 404, staff API không trả private fields, listener chỉ IP/port đã chọn. Chưa có nhân viên thực được tạo vì chưa nhận username; người dùng tự tạo trên UI.
- Gateway chuẩn hóa chuyển hướng admin về đúng HTTPS LAN (đăng nhập lại/đăng xuất), không trả localhost/HTTP cho máy khách. Luồng logout đã kiểm tra HTTP 303. Toàn bộ API admin không bật CORS public/mobile.
- **127/127 test qua**, production build Next.js thành công. Các thay đổi UI/API mới được kiểm tra HTTP qua gateway HTTPS đang chạy; không đổi service/HIS hoặc khởi động lại agent.
- Unit/DOM tests kiểm tra hash/backup/mật khẩu, deny path/admin wildcard, menu và action, phiên thu hồi, khóa/xóa mềm, cùng origin, superadmin-only, thanh Lưu đầu form, mật khẩu nhập lại và xác nhận Xóa. Lifecycle tests gọi route/session/kho file thật trên thư mục tạm độc lập, kiểm tra đổi mật khẩu sai/đúng, không đổi quyền, cookie cũ bị thu hồi, chống đổi tài khoản khác và rate limit. Không tạo/sửa/xóa nhân viên thực để chạy test.
- HTTPS smoke kiểm tra form mới có Lưu/xác nhận mật khẩu, API chặn xác nhận tạo/xóa không khớp (400), đổi mật khẩu chưa đăng nhập (401), tài khoản bootstrap (403); các probe bị từ chối trước ghi file. Đợt KSK/report CN1 trước vẫn qua 13 người/540 XN/21 CLS, không ghi HIS.
- Sửa lỗi nút Lưu chìm vào nền: `primary-800` không có trong `tailwind.config.ts`, khiến chữ trắng trên nền trong suốt. Ba nút Lưu của staff/password đã chuyển sang `bg-primary-700` có định nghĩa, thêm border/hover/focus. Không chỉ kiểm tra chữ trong HTML: `tests/admin-button-styles.test.ts` biên dịch CSS Tailwind thật, còn `tools/test-staff-button-browser.mjs` dùng Edge headless độc lập kiểm tra màu hiển thị, tương phản và vị trí nút trong viewport 1366×768 và 682×1012. Nền thực tế `rgb(0, 91, 85)`, chữ trắng, tỷ lệ tương phản 7,99:1; đã xem ảnh `artifacts/staff-save-visible-1366.png` và `staff-save-visible-682.png`. Không nhập/lưu nhân viên thật, không thay cửa sổ browser hiện có. Nút KSK `Đọc/Làm mới` và `Xuất Excel đầy đủ` vẫn dùng token `primary-800` cũ, cần xử lý ở đợt riêng hoặc chuẩn hóa palette chung.
- Chưa kiểm tra từ máy khách LAN thật do còn bước firewall Administrator và trust cert; cần người dùng/IT hoàn tất. Chưa đưa public/Vercel hoặc thay agent ZIP.
