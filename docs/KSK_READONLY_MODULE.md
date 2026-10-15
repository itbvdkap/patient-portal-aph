# Module KSK theo đoàn — bản chỉ đọc HIS

Module riêng [Quản lý đoàn/gói/danh sách HIS thật](KSK_MANAGEMENT.md) dùng `/admin/ksk-manage` và API/token/quyền riêng. Không thay endpoint báo cáo ở tài liệu này thành ghi. Đợt 15/10 đã đọc CN1 thật, ghi vẫn tắt chờ DB TEST/ledger/credential; không nhầm với LAB.

**15/10/2026:** [LAB phiếu thay đổi gói / danh sách](KSK_CHANGE_WORKFLOW.md) là module thử riêng, có quyền lập/duyệt/áp dụng giả lập. Không thay tính chỉ đọc của trang KSK hoặc ghi dữ liệu Oracle thật.

Ngày cập nhật: 14/10/2026 (đợt báo cáo đoàn/XN/CLS). Đường dẫn ứng dụng: `/admin/ksk`.

Cập nhật quyền/LAN: [CN1 HTTPS và tài khoản nhân viên riêng](KSK_LAN_STAFF_ACCESS.md). Ngoài super_admin, staff **được cấp menu KSK rõ ràng** có thể xem/báo cáo; các role cũ không tự được thêm KSK. Những đoạn chỉ-super_admin dưới đây mô tả bản ban đầu, không phải tự cấp staff quyền.

Bổ sung mới: [báo cáo danh sách/thu tiền theo đoàn và kết quả XN/CLS](KSK_REPORTS.md), hỗ trợ xem trước, Excel `.xlsx`, in/lưu PDF, theo bộ lọc người hoặc toàn bộ đợt. Bản này chỉ đổi web, dùng agent thanh toán sẵn có, không restart service hoặc ghi HIS.

Đợt kế tiếp: [báo cáo thu tiền tổng hợp nhiều đoàn](KSK_COLLECTIONS_REPORT.md), menu `/admin/ksk-collections` và quyền riêng `ksk_collections`. Lọc công ty/phụ trách/thu ngân/ngày thu/ngày đăng ký, Excel/in; đợt này thay cả web/agent và đã chạy lại tiến trình local CN1, không thay service bệnh viện. Các giới hạn 3000 dòng/phải chọn một đoàn trong phần cũ vẫn áp dụng endpoint chi tiết; tổng hợp có hợp đồng `all=1` và giới hạn riêng.

## Phạm vi đợt 1

**Sửa đối chiếu 15/10/2026:** [quy tắc MAVAOVIEN](KSK_EPISODE_PAYMENT_POLICY.md). Chỉ định phải đúng lần vào viện của đợt; đầu phiếu mã 0 chỉ được nhận khi đủ liên kết toàn bộ chi tiết. Agent cần `episodePolicy=2`; bản cũ không được tính tiền. Các tổng tiền/mô tả nối MAQL đơn thuần của các đợt trước không thay thế quy tắc này.

- Danh sách khách hàng/đợt theo ngày của `KSKDOAN`, hoặc chọn trực tiếp ID đợt.
- Phụ trách / CSKH lấy toàn bộ nội dung `KSKDOAN.GHICHU` theo quy ước người dùng xác nhận; hiển thị ở danh sách và đầu chi tiết. Không dùng `USERID`, người liên hệ hay tên trong ngoặc của đợt để suy ra nhân viên.
- Danh sách đợt có bộ lọc công ty và phụ trách / CSKH trong tập đợt đã đọc theo ngày. Công ty phân biệt bằng `ID_KSK_KHACHHANG`; ghi chú dùng toàn bộ nhãn, chỉ chuẩn hóa khoảng trắng để nhóm/lọc, không tự tách tên/điện thoại/nhiều người.
- Dashboard của đợt được chọn: số thành viên, người có lượt tiếp nhận trong khoảng ngày, có ít nhất một giá trị CLS, có kết luận và bác sĩ, tổng phát sinh trên chỉ định.
- Danh sách người theo nhóm, tìm tên/mã BN/mã NV, phân trang 50 người.
- Đợt tiếp theo đã bổ sung dashboard thanh toán màu, lọc trạng thái, chứng từ từng người và thanh lọc công ty/phụ trách/đợt có tìm kiếm; quy tắc và giới hạn ở cuối tài liệu.
- Mở hồ sơ một người trong giao diện: MAQL/MAVAOVIEN, chuyên khoa, kết luận, thông số xét nghiệm gốc, CDHA và từng dòng chi phí.
- Không nhập/sửa/xóa HIS, không tạo phiếu thu, không xác nhận ngân hàng, không tự tính công nợ hợp đồng. Cờ PAID chỉ hiển thị như dữ liệu nguồn để đối chiếu, không chứng minh đã thu.

## Kiến trúc và bảo mật

```text
Trình duyệt → Next.js/Vercel (session + quyền menu)
  → Supabase service-only: job đọc ngắn hạn
  ← PatientApi trong bệnh viện chủ động poll HTTPS ra ngoài
  → API loopback /api/internal/ksk → OracleKskReadOnly
```

- Mặc định tắt cả web và agent. `KSK_DATA_MODE=his` vẫn chỉ dùng nội bộ; `KSK_DATA_MODE=supabase` là luồng public đã được phê duyệt ngày 15/10/2026. Oracle, token KSK và connection string không đưa lên Vercel.
- Cloud chỉ tạo bốn loại job allowlist: `report`, `management`, `patient`, `validate`; không có operation ghi/apply. Agent chỉ kết nối outbound HTTPS tới đúng Supabase và gọi API của chính nó qua loopback HTTP.
- Bảng hàng đợi/kho quản trị bật RLS, thu hồi quyền `anon`/`authenticated`; chỉ service role gọi RPC. Kết quả khám/chi phí có TTL phút và được cleanup, không là kho hồ sơ dài hạn. Tài khoản nhân viên và nháp được AES-256-GCM trước khi lưu; khóa chỉ ở môi trường server.
- Kiểm tra vai trò trực tiếp ở page, layout và API. Các role booking_admin/support/content_admin/auditor không được xem; không dựa vào kiểm tra prefix `/admin` của module cũ.
- Patient token/portal server token không thay được KSK token. Token KSK tối thiểu 32 ký tự, chỉ giữ phía server.
- HTTP chỉ cho loopback; agent khác máy phải qua HTTPS nội bộ và giới hạn firewall. Không publish endpoint agent ra Internet.
- Không cache response, không CORS cho API KSK, không dùng localStorage cho dữ liệu KSK; `noindex`, `no-referrer` cho trang/API.
- Backend dùng kết nối Oracle riêng, không fallback sang `OracleHis` của worker. Lệnh đầu tiên là `SET TRANSACTION READ ONLY`; các truy vấn nghiệp vụ chỉ SELECT, không gọi helper HIS. Xem [Oracle: SET TRANSACTION](https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/SET-TRANSACTION.html).
- Schema định danh được allowlist bằng regex; ID, ngày và danh sách MAQL dùng bind parameters. Truy vấn tối đa 93 ngày, từng SELECT tối đa 3.000 dòng; vượt giới hạn bỏ phần đó và đánh dấu chưa xác định, không trả tổng bị cắt.
- Cần cấp SELECT tối thiểu theo bảng được dùng; không cấp INSERT/UPDATE/DELETE/EXECUTE hoặc DDL cho tài khoản này. Quyền Oracle chỉ đọc là lớp bảo vệ chính, không chỉ dựa vào code.
- Agent log hoàn thành thao tác và loại lỗi, không log kết quả, họ tên, mật khẩu/SQL. Bản đầu chưa có sổ audit xem hồ sơ cấp từng người vì thao tác mở chi tiết chạy trên snapshot trong bộ nhớ trình duyệt; chỉ cấp cho quản trị nội bộ được phê duyệt.

## Cấu hình web

Trong `.env.local` hoặc environment của tiến trình Next.js; không commit secret:

```dotenv
KSK_ENABLED=true
KSK_DATA_MODE=his
KSK_API_BASE_URL=http://127.0.0.1:5080
KSK_API_SERVER_TOKEN=<secret ngẫu nhiên riêng, tối thiểu 32 ký tự>
```

Giữ cấu hình đăng nhập admin và `PORTAL_SESSION_SECRET` hiện có. Chỉ tài khoản `super_admin` được xem. Nếu Next.js và agent khác máy, thay base URL bằng HTTPS nội bộ có chứng chỉ được tin cậy.

Web nội bộ dùng cấu hình trên. Bản Vercel dùng cấu hình sau; các biến Supabase service-role và khóa mã hóa đều là server-only/sensitive:

```dotenv
ADMIN_STAFF_ENABLED=true
ADMIN_DATA_MODE=supabase
ADMIN_CLOUD_STORE_SECRET=<khóa ổn định 32+ ký tự, sao lưu riêng>
KSK_ENABLED=true
KSK_DATA_MODE=supabase
KSK_MANAGEMENT_ENABLED=true
KSK_MANAGEMENT_BRANCH=CN1
KSK_CHANGE_LAB_ENABLED=false
```

Web chỉ dùng một agent/chi nhánh cho mỗi cấu hình triển khai. Chưa có bộ chọn nhiều CN trong một snapshot.

## Cấu hình agent

Thêm vào env thật trên đúng máy chủ, giữ nguyên biến worker/auto-send đang có:

```dotenv
Ksk__Enabled=true
Ksk__ServerToken=<cùng secret KSK phía web>
ConnectionStrings__OracleKskReadOnly=User Id=<read_only_user>;Password=<secret>;Data Source=<host>:1521/<service>;
Ksk__MasterSchema=<owner danh mục có KSKDOAN/KSKBTDBN>
Ksk__MonthlySchemaPrefix=<prefix trước MMyy>
Ksk__ClinicalSchema=<owner có XN_PHIEU/SA_BNCDHA>
KskManagement__Enabled=true
KskManagement__ServerToken=<secret loopback riêng>
KskManagement__WriteEnabled=false
KskCloud__Enabled=true
KskCloud__LocalApiBase=http://127.0.0.1:5080
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SECRET_KEY=<server-only secret>
```

Không chép owner ví dụ sang CN khác nếu chưa kiểm tra. Module đọc trực tiếp owner, không tự tìm synonym hoặc đoán owner của từng bảng. Nếu XN và CDHA nằm ở owner khác nhau, cần bổ sung mapping trước khi xác nhận hoạt động đầy đủ.

Sau cập nhật agent, giữ env thật và làm theo hướng dẫn Windows service hiện có. Việc restart/cài đặt trên server không thực hiện tự động trong đợt phát triển này.

Cloud cần migration Supabase `20261015074227_ksk_cloud_reporting.sql`; không tạo/sửa bảng Oracle. File `ksk-readonly-discovery.sql` chỉ khảo sát metadata bằng SELECT; không phải script khởi tạo. Giữ nguyên trạng thái các worker và auto-send Zalo. ZIP được build từ working tree hiện tại (bao gồm thay đổi worker đã có trước đợt KSK), nên cần quy trình kiểm thử/cập nhật agent hiện hành trước khi thay bản production.

## Cấu trúc dữ liệu và cách tính

- Đợt/nhóm/thành viên: `KSK_KHACHHANG`, `KSKDOAN`, `KSKDONVI`, `KSKBTDBN`.
- Lượt: schema tháng `BASK_DONVI` nối `TIEPDON`; lấy cả các MAQL cùng MAVAOVIEN trong schema đang đọc. Người được gắn bằng cặp nhóm + MABN.
- Chi phí: `V_CHIDINH` nối `V_GIAVP`, dùng đơn giá/số lượng trên dòng chỉ định. Khử trùng theo schema nguồn + ID; không join trực tiếp với thông số xét nghiệm để SUM tiền.
- Lâm sàng/tổng kết: `BASK_NOIKHOA/NGKHOA/MAT/RHM/TMH/SANPHU/TONGKET` theo MAVAOVIEN. Bản ghi khởi tạo trống không được tính có kết luận; cần `KETLUAN` và `MABS`.
- Xét nghiệm: `XN_PHIEU`, `XN_KETQUA`, `XN_BV_CHITIET`, `XN_TEN`, `XN_DONVI`; loại `XOA_MAU<>0`. Hiển thị giá trị gốc, không tự thay bằng giá trị mặc định.
- CDHA: `SA_BNCDHA`, `SA_BNCDHA_CT`, `XQ_BNCDHA_CTXQ`, `SA_KTCDHA`. RTF hiển thị dạng nguồn để đối chiếu, không inject HTML.
- Đợt đầu chưa đồng bộ `BASK_CLS` là bản tổng hợp bác sĩ lưu riêng, chưa xác minh trạng thái duyệt/ký LIS/CDHA. Không gọi chỉ số “có kết quả” là “đủ CLS”.
- Khoảng ngày là phạm vi lượt đã đọc, không khẳng định người ngoài phạm vi chưa từng đến khám. Chưa làm trạng thái giao/trả hồ sơ.
- Đọc các schema tháng trong khoảng đã chọn; không quét tự động hết lịch sử hoặc theo ngày kết thúc nhóm rất xa. Lượt con kéo qua tháng ngoài phạm vi cần chọn lại phạm vi thích hợp và đối chiếu bằng HIS.
- Mỗi phần có cờ đầy đủ riêng. Thiếu bảng/cột/quyền hoặc vượt giới hạn → cảnh báo và chỉ số liên quan “Chưa xác định”, không trả số 0 như dữ liệu hoàn chỉnh. Không dùng dữ liệu demo để che lỗi HIS.
- Tổng phát sinh chưa loại hết chỉ định hủy/hoàn/điều chỉnh theo quy trình thực tế, chưa phân bổ trong/ngoài gói và người trả. Không dùng số này làm số phải thu kế toán chính thức.

## Kiểm thử local không dùng dữ liệu thật

Chỉ trên máy phát triển, đặt `KSK_ENABLED=true`, `KSK_DATA_MODE=demo`, rồi khởi động dev server và đăng nhập admin để mở `/admin/ksk`. Chọn đợt `900001`. Dữ liệu là giả lập hoàn toàn, không lấy tên/thông tin từ ảnh hoặc HIS. Production không cho bật demo.

Chạy kiểm tra:

```powershell
npm run test
npm run build
dotnet build backend/PatientApi/PatientApi.csproj
powershell -ExecutionPolicy Bypass -File .\deploy\windows-service\publish-patientapi-agent.ps1
```

## Nghiệm thu HIS bắt buộc trước khi sử dụng thật

1. Dùng tài khoản chỉ đọc riêng, xác minh owner/cột bằng `deploy/oracle/ksk_readonly_discovery.sql` (trong ZIP agent là `ksk-readonly-discovery.sql`).
2. So sánh một đoàn test: thành viên, lượt tiếp nhận, một hồ sơ chưa/đã có kết quả, kết luận và số tiền từng chỉ định.
3. Kiểm tra nhiều MAQL/MAVAOVIEN, qua tháng, dịch vụ chạy lại, mẫu hủy, kết quả chưa duyệt và sửa kết luận.
4. Thử thiếu một nguồn và khoảng ngày quá dài: phải báo chưa xác định/từ chối, không báo đã hoàn tất.
5. Xác nhận các role khác/không đăng nhập bị chặn; kiểm tra firewall, TLS và tài khoản Oracle không có quyền ghi.
6. Chỉ sau đối chiếu cách kế toán ghi tiền công ty mới thiết kế bảng phân bổ, công nợ hợp đồng, tạm ứng và đối soát.

Đợt phát triển ban đầu chưa kết nối Oracle thật. Ngày 14/10/2026 đã thử kết nối CN1 bằng cấu hình Oracle sẵn có theo yêu cầu người dùng, trong tiến trình local riêng và giao dịch chỉ đọc. Việc đọc dữ liệu thật thành công chưa thay thế nghiệm thu nghiệp vụ/hủy/hoàn/duyệt kết quả với HIS.

## Kết quả kiểm tra đợt 14/10/2026

- Vitest: 41 test (28 test mới KSK và 13 test hiện có).
- Next.js production build và .NET build thành công.
- `tools/test-ksk-agent.ps1`: HTTP kiểm tra tắt module, token, chỉ GET, tham số ngày/ID sai, lỗi cấu hình được che; dùng cấu hình Oracle cố ý không hợp lệ, không liên hệ HIS.
- `tools/test-ksk-web.ps1`: HTTP kiểm tra đăng nhập/role, response private/no-store, snapshot giả lập và HTML dashboard. Tài khoản kiểm thử/secret chỉ tồn tại trong tiến trình; server kiểm thử được dừng khi xong.
- Chưa kiểm thử thao tác tương tác bằng trình duyệt tự động và chưa nghiệm thu nghiệp vụ trên toàn bộ dữ liệu Oracle. Không sửa env thật hoặc restart service bệnh viện.

## Bản thử CN1 bằng tài khoản sẵn có — 14/10/2026

- Nguồn cấu hình: file CN1 `artifacts/patientapi-service.env` sẵn có; không sao chép mật khẩu vào source, báo cáo hoặc file cấu hình mới.
- Đã kiểm tra danh tính kết nối và metadata. Master/CLS owner là `HGSOFT_BV`; schema tháng là `HGSOFT_BV0826`, `HGSOFT_BV0926`, `HGSOFT_BV1026` trong khoảng thử.
- Tài khoản `HGSOFT_BV` có quyền ghi rộng. Đây là ngoại lệ tái sử dụng rõ ràng cho **thử local** theo yêu cầu người dùng, không phải tài khoản Oracle chỉ đọc về mặt quyền. Repository vẫn không có fallback tự động sang OracleHis; launcher gắn kết nối có sẵn vào biến kết nối KSK của tiến trình thử. Khi triển khai chính thức vẫn nên cấp tài khoản SELECT tối thiểu riêng.
- Agent local: `http://127.0.0.1:5094`. Web local: `http://127.0.0.1:3014/admin/ksk`. Cả hai chỉ bind loopback; dùng thông tin đăng nhập quản trị web hiện có.
- Các worker sync/match/online/outbox đều tắt trong agent thử. Không thay service CN1/CN3 và không sửa `.env.local`/env service thật.
- Đợt kiểm tra tương ứng ảnh người dùng: ID `260819155634396016`, phạm vi 01/08–14/10/2026. Đọc được 13 thành viên, 13 lượt, 127 dòng chỉ định, 88 bản ghi chuyên khoa/tổng kết, 540 thông số xét nghiệm, 21 dòng CDHA. Mọi phần truy vấn không báo thiếu bảng/cột/quyền.
- `node tools/test-ksk-cn1-web.mjs` đã xác nhận đường đi đăng nhập admin → Next API → agent → Oracle, response dữ liệu thật CN1 và HTML dashboard HTTP 200, `no-store`. Không in/lưu hồ sơ cá nhân hoặc giá trị xét nghiệm vào log kiểm thử.
- Các số trên là số dòng phát sinh trong phạm vi; không suy ra đủ kết quả, 540 dịch vụ xét nghiệm, số phiếu thu hoặc thanh toán hợp đồng.

Các helper local dùng PowerShell 7.4+ (`pwsh`, không phải Windows PowerShell 5 trên server cũ):

```powershell
pwsh -NoProfile -File tools/probe-ksk-cn1.ps1
pwsh -NoProfile -File tools/start-ksk-cn1-local.ps1
node tools/test-ksk-cn1-web.mjs
# Dừng đúng hai cây tiến trình local do launcher tạo:
pwsh -NoProfile -File tools/start-ksk-cn1-local.ps1 -Stop
```

Secret KSK ngẫu nhiên chỉ nằm trong environment của hai tiến trình con. File `artifacts/ksk-cn1-local-processes.json` chỉ lưu PID/thời điểm/path để dừng an toàn; `audit-counts.json` chỉ lưu cờ nguồn và số lượng. Không commit các file env/artifacts này.

## Bổ sung nguồn Phụ trách / CSKH — 14/10/2026

- Theo yêu cầu người dùng, cột ghi chú đầu đợt (`KSKDOAN.GHICHU`) là nguồn Phụ trách / CSKH. Ghi chú dài/nhiều dòng được hiển thị nguyên văn (bỏ khoảng trắng ngoài cùng), không parse thành hồ sơ nhân viên hay tự lấy người nhập.
- Ghi chú null/trống: `Chưa ghi phụ trách`. Agent cũ chưa trả trường: `Chưa đọc được ghi chú`, không đánh đồng với dữ liệu trống. Agent mới kiểm tra có cột GHICHU trước khi đọc danh sách.
- Có cột Phụ trách / CSKH ở danh sách, nhãn tương ứng ở đầu đợt, bộ chọn công ty/CSKH kết hợp, số đợt khớp và nút xóa bộ lọc. Bộ lọc chỉ áp vào danh sách đã tải, không ghi HIS và không lưu nội dung ghi chú vào URL/localStorage.
- Nội dung ghi chú được render dạng text có escape HTML; không thực thi markup. Thay đổi này không bổ sung trạng thái đã/chưa thu hoặc tính tiền công ty thanh toán: phần tài chính vẫn phải khảo sát chứng từ riêng.
- Cập nhật bộ dừng local để so sánh chính xác timestamp/PID/path khi PowerShell đã deserialize chuỗi ISO thành DateTime; không dừng tiến trình không khớp.
- 47 test web (thêm quy tắc nguồn ghi chú, lọc và render an toàn) đã qua; build Next.js và .NET thành công. Kiểm tra API/HTML CN1 đã xác nhận GHICHU + customerid, nhãn chi tiết và bộ lọc công ty/CSKH, HTTP 200/no-store. Chưa kiểm thử chọn bộ lọc bằng trình duyệt tự động; quy tắc lọc đã có unit test.

## Đợt tiếp theo: thanh toán chứng từ và bộ lọc — 14/10/2026

### Giao diện hiện tại

- Thanh đầu trang: từ/đến ngày, công ty, nhân viên phụ trách / CSKH, đợt khám, Đọc/Làm mới. Ô chọn có ô tìm kiếm và chọn bằng bàn phím; công ty/phụ trách thu hẹp đợt trước khi gửi form. ID nằm trong `Lọc nâng cao`.
- Bộ lọc chỉ áp vào tập đợt trong khoảng đã đọc. Chọn khoảng ngày mới rồi Đọc/Làm mới để cập nhật lựa chọn; đợt chi tiết ngoài ngày vẫn được thêm vào lựa chọn. Các ngày phải hợp lệ, tối đa 93 ngày.
- Link mở đợt/quay lại giữ ngày, công ty và phụ trách. URL chỉ chứa ID công ty và ID đợt đại diện cho ghi chú phụ trách, **không chứa nội dung ghi chú**. Nhãn vẫn lấy toàn bộ GHICHU; không phải ID nhân viên thật. Đổi ngày khiến ID đại diện không còn trong tập lựa chọn có thể cần chọn lại phụ trách.
- Hai nhóm dashboard: `Tiến độ khám` và `Thanh toán theo chứng từ HIS`. Nhóm tiền có 5 ô nhấn để lọc, mỗi ô là số người theo khóa nhóm + MABN; màu luôn kèm chữ. Thiếu danh sách thành viên không hiển thị tổng 0.
- Đã đủ (xanh lá), chưa thu (đỏ), một phần (cam), chưa phát sinh (xám), chưa xác định (xám/cảnh báo). Bộ chọn trạng thái đồng bộ với ô màu; kết hợp nhóm/tìm người, phân trang 50. Trạng thái một phần có ghi chú màu cam.
- Bảng người có phải thu, đã thu ròng, còn chưa thu, ghi chú. Hồ sơ mở ngay trên trang giữ bộ lọc và có `Chứng từ thanh toán`: loại, quyển/số/ID, ngày, tiền gốc, miễn giảm, trả thiếu/trả sau, hoàn ghi nhận và liên kết chỉ định. Dòng tiền gốc của **cả phiếu** không phải số đã phân bổ cho người nếu trạng thái chưa xác định.
- Bảng nhiều cột cuộn ngang trên màn hình hẹp; không nhét các cột tiền vào chiều rộng nhỏ đến mức mất nút Xem hồ sơ.

### Nguồn và quy tắc đối chiếu

- Backend bổ sung `payments` và cờ `payments:<owner>:DIRECT/SETTLEMENT` trong cùng giao dịch READ ONLY.
- Thu trực tiếp: `V_VIENPHILL` + `V_VIENPHICT`, đọc đủ tất cả chi tiết của phiếu; miễn giảm `V_MIENNGTRU` và các trường MIEN/MIEN_GIAM; trả thiếu THIEU, trả sau YTE_TRASAU.
- Thanh toán tổng hợp: `V_TTRVDS` + `V_TTRVLL` + `V_TTRVCT`; đọc SOTIEN, MIEN, MIEN_GIAM, BHYT, TAMUNG, THIEU, CHUA_THANH_TOAN, YTE_TRASAU; kiểm tra miễn thêm `V_MIENNOITRU.MIEN_THEM`.
- Hủy/hoàn: DAHOANTRA, biên lai không dương, `V_HOANTRA` theo quyển/số, tổng chi tiết `V_HOANTRACT`, ngày hoàn. Tạm ứng: `V_TAMUNG` theo IDTTRV/người, số biên lai hợp lệ, DASUDUNG, không hoàn và không có phiếu hoàn.
- Chỉ nhận một chứng từ khi khớp người, dịch vụ, IDCHIDINH, schema nguồn, số lượng/đơn giá/thành tiền, tổng và số chi tiết; không phân bổ âm thầm phiếu chứa dịch vụ ngoài phạm vi. Không SUM trên join CLS.
- CN1 có TABLE_X null: chỉ cho phép khi **đồng thời** cùng schema tháng, cùng MAQL và có liên kết ngược `V_CHIDINH.IDTTRV = receiptid` cùng IDCHIDINH. Nếu TABLE_X có giá trị thì phải xác định đúng nguồn V_CHIDINH. Cùng ID ở tháng khác, lệch dịch vụ hoặc thiếu liên kết không được xem đã thu.
- Đầu/chi tiết phiếu trùng chỉ khử khi giống toàn bộ nội dung; khác tiền/cờ hoặc một chỉ định nối nhiều phiếu → chưa xác định. Lượt đồng thời gắn nhiều nhóm chưa phân bổ cũng chưa xác định.
- Tiền được kiểm tra số và tính bằng đơn vị 1/100 đồng nguyên an toàn; không chấp nhận NaN, số mũ, âm, lẻ hơn 2 số thập phân hoặc vượt giới hạn.
- Với phiếu đã nối đủ: phải thu = phát sinh chỉ định − miễn giảm đối chiếu; đã thu = tổng phiếu − miễn giảm − trả thiếu (trả sau không tính thu); tạm ứng chỉ tính trong phần thu khi chứng từ sử dụng đã đối chiếu, không cộng hai lần. Còn chưa thu = phải thu − đã thu.
- Chưa có lượt/chưa có chi phí đọc đầy đủ không bị gom vào chưa thu. Miễn 100% không gọi là đã thu tiền, hiển thị không còn phải thu kèm giải thích.
- Agent cũ thiếu payments/cờ tài chính: chi tiết vẫn đọc được nhưng các ca có phát sinh sẽ chưa xác định, không coi mảng rỗng là không có phiếu.

### Giới hạn tài chính cần nghiệm thu

- Đây **không phải công nợ hợp đồng**, không xác nhận ngân hàng, không ghi HIS hoặc sửa chứng từ. Thông tin trả sau chỉ là ghi nhận HIS.
- Hiện chưa phân bổ chắc chắn hoàn/hủy, miễn giảm đầu/chi tiết MIEN_GIAM, miễn thêm, vật tư tính thêm, BHYT hoặc tạm ứng lệch nguồn. Những phiếu này được đọc và hiển thị nhưng **trạng thái/số tiền đối chiếu là Chưa xác định**, không gán đã thu hay chưa thu. Có miễn giảm đơn giản MIEN đã nối đủ và không xung đột thì tính theo công thức trên.
- Với hoàn trả, hiển thị số hoàn gốc nhưng không tự trừ toàn bộ cho một dịch vụ; cần kế toán xác nhận quan hệ phiếu gốc/phiếu thay/hủy dịch vụ và quy tắc phân bổ trước khi mở rộng tính ròng.
- Chỉ đọc chứng từ trong các schema tháng chọn, gắn MAQL của lượt trong đợt. PAID/IDTTRV có bằng chứng thu nhưng không tìm được phiếu → chưa xác định, có thể thu khác tháng hoặc phiếu gốc dùng MAQL khác. Không quét toàn bộ lịch sử để đoán.
- Chỉ định PAID=0/IDTTRV trống, không thấy chứng từ, nguồn đọc đầy đủ và không phải khoản BHYT chưa phân bổ mới hiển thị chưa thu. Tổng phát sinh vẫn chưa phải giá hợp đồng chính thức; cần đối chiếu chỉ định hủy và khoản thu ngoài gói.
- Khoảng ngày chọn xác định lượt; chứng từ là trạng thái đang ghi nhận ở các tháng đã đọc, không phải báo cáo sổ quỹ thu trong riêng từng ngày của khoảng.

### Kiểm thử và bàn giao

- Kiểm tra thật CN1 qua đăng nhập → Next API → agent → Oracle → HTML: 13 thành viên, 13 lượt, 127 chỉ định và 127 dòng chứng từ. Các nguồn tài chính đủ bảng/cột/quyền. 127 dòng đều nối hai chiều IDTTRV/IDCHIDINH cùng tháng/lượt; không có trả sau, hoàn hoặc miễn giảm trong đoàn này. Kết quả 13 đã thanh toán đủ, 0 ở 4 nhóm còn lại, không suy từ PAID.
- Unit/DOM tests kiểm tra số tiền lẻ, đã đủ/chưa thu/một phần/chưa phát sinh/chưa xác định, trả sau, miễn giảm, hủy/hoàn, tạm ứng, thiếu nguồn, trùng/khác chứng từ, nhấn ô màu, dropdown, mở/đóng hồ sơ, thu hẹp đợt và giữ ID lọc. Kiểm thử DOM không thay thế kiểm tra bố cục bằng trình duyệt thật.
- `tools/test-ksk-cn1-web.mjs` chỉ in số lượng/tổng trạng thái và metadata khóa liên kết; không in họ tên, MAQL, phiếu cụ thể, kết quả xét nghiệm hoặc credentials. Không lưu snapshot người bệnh.
- Bản agent mới: `artifacts/patientapi-agent-ksk-payments-20261014.zip`. Web là thay đổi source local, không có trong ZIP .NET. Không thay ZIP production cũ và không restart/copy service bệnh viện.
- Tiếp theo cần nghiệm thu với kế toán: một phiếu trả sau, trả thiếu, miễn giảm, hoàn từng dịch vụ, phiếu thay/hủy, tạm ứng qua tháng và thu gộp nhiều người/ngoài gói. Chỉ sau đó mới tự phân bổ các ca hiện chưa xác định và bổ sung công nợ công ty chính thức.

### Điểm tiếp tục cho chat khác

- Tính thanh toán: `src/lib/ksk/payment.ts`; đọc nguồn: `backend/PatientApi/Ksk/OracleKskRepository.cs`.
- Bộ lọc đầu trang: `src/app/admin/ksk/filters.tsx`; chọn/giữ bộ lọc: `page.tsx`; dashboard, người và hồ sơ: `workspace.tsx` cùng thư mục.
- Snapshot contract: `src/lib/ksk/domain.ts` (`payments` tương thích agent cũ nhưng cờ nguồn bắt buộc để xác nhận). Các test tài chính: `tests/ksk-payment.test.ts`; tương tác DOM: `tests/ksk-interactions.test.tsx`; kiểm tra dữ liệu thật: `tools/test-ksk-cn1-web.mjs`.
- Kiểm tra cuối: 86/86 test qua; build Next.js và .NET thành công; luồng dữ liệu thật CN1/API/HTML HTTP 200 và no-store. Không có kiểm thử bố cục/hydration bằng trình duyệt thật trong đợt này.
- ZIP 50.759.288 byte, SHA-256 `AE2DCD1FE902F6D87ED54C19744677460CCB9C52A70C4E99CD12DB18F518131B`, có PatientApi.dll và tài liệu KSK, không chứa `patientapi-service.env` thật. Chưa triển khai server/public, không sửa dữ liệu HIS.
