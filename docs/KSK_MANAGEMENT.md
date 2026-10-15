# Quản lý đoàn khám thật qua web — 15/10/2026

## Mục tiêu / phạm vi

**Quyết định bàn giao ngày 15/10/2026:** chưa có Oracle TEST. CN1 tiếp tục chỉ đọc; web được lưu nháp mã hóa và kiểm tra/duyệt nội bộ, không áp dụng vào HIS. Không cài ledger/sequence, không cấp kết nối ghi và không bật `WriteEnabled` trên CN1/CN3. Chỉ xem xét mở ghi sau khi có môi trường TEST và nghiệm thu riêng.

Thay màn hình tạo/sửa đoàn trong HIS bằng `/admin/ksk-manage`. Dữ liệu đọc từ Oracle CN1 thật, không phải LAB. API riêng: Next.js xác thực/phân quyền, lưu nháp mã hóa → người khác duyệt → PatientApi kiểm tra và ghi Oracle bằng transaction. Không gọi helper HIS hoặc SQL từ browser. LAB cũ vẫn độc lập, không chuyển dữ liệu mẫu sang HIS.

Cho thêm/sửa khách hàng, đợt, nhóm, mục/gói dịch vụ và thành viên có MABN thật; sửa gói kèm danh sách dịch vụ/giá nội viện–ngoại viện. Không xóa đoàn/người, không đổi khóa của dòng hiện hữu, không sửa BTDBN, chỉ định, kết quả hoặc phiếu thu. Thêm người chưa có MABN phải chờ tích hợp bộ cấp mã thật; không dùng MAX+1 hoặc mã giả.

Nguồn xác minh bằng metadata CN1: `KSK_KHACHHANG`, `KSKDOAN`, `KSKDONVI`, `KSKBTDBN`, `KSKMUC`, `KSKMUCCT`, `V_GIAVP`. MABN VARCHAR2(8), khóa thành viên `(IDDONVI,MABN)`. `KSKMUC.ID_GOI_KSKMUC` và `KSKBTDBN.ID_GOI_KSKMUC` là NUMBER(2), khác ID NUMBER(18) của dòng KSKMUC. KSKMUCCT không có số lượng: mỗi dịch vụ một dòng, giá GIA_NV/GIA_NGV. Không áp mô hình quantity của LAB vào bảng thật.

## Quyền

Menu mới `ksk_manage` (độc lập menu báo cáo và LAB). Action mới, mặc định không cấp: `ksk_manage_roster` (khách hàng/đợt/nhóm/người), `ksk_manage_package` (gói), `ksk_manage_approve`, `ksk_manage_apply`. API kiểm tra lại session mỗi lần, CSRF cùng nguồn, schema strict, revision; người lập không tự duyệt, kể cả admin. Chỉ super_admin quản lý quyền.

## Bảo vệ dữ liệu / ghi

- Nháp lưu ở đường dẫn tuyệt đối riêng, AES-256-GCM bằng key server; ACL operator/SYSTEM, không public/shared. Không log tên/ngày sinh/phiếu JSON/credential. Không thay kho LAB/staff.
- Mỗi phiếu chỉ một đối tượng. Bản trước và phiên bản lấy từ agent, không tin client. Duyệt phải đối chiếu nguồn lại. Ghi bằng một command UUID ổn định, body đã duyệt không đổi; ledger trong Oracle cùng transaction với DML để tránh nhân đôi khi timeout.
- Không tự ghi khi tạo hoặc duyệt; người có quyền bấm áp dụng có xác nhận. Bật write cần credential riêng, USERID HIS được chỉ định và ledger đã cài. Mặc định đọc thật/lưu nháp được, ghi tắt. Không tự chạy migration lên CN1/CN3 trong quá trình xây dựng.
- Khóa thận trọng khi đã tiếp nhận trong BASK_DONVI ở bất kỳ schema tháng nào tìm được; đọc thiếu nguồn/qua giới hạn phải chặn, không coi là chưa khám. Không dựa PAID để cho sửa. Khi ghi khóa các bảng cấu hình và nguồn tiếp nhận bằng NOWAIT trong transaction ngắn; không đợi/giết session HIS đang bận. Giới hạn này cần nghiệm thu tải trước bật production.
- Không tự đổi/ghi hồi tố chỉ định hoặc giá đã phát sinh. Thêm thành viên phải khớp họ tên/năm sinh/giới tính BTDBN, không lén sửa hồ sơ bệnh nhân gốc.
- Ghi mới ID cấu hình bằng sequence riêng có PK chống trùng, không MAX+1. Không sử dụng sequence này để cấp MABN.
- Web/appsettings/SQL triển khai chỉ là template không secret; chỉ cấu hình vào process thử local, không sửa env hoặc service thật.

## Trước khi mở ghi CN1

IT xác nhận credential ghi tối thiểu và USERID audit; cài ledger/sequence bằng script riêng sau kiểm tra backup/quyền. Thử database test có schema tương đương, rollback/lặp lệnh/mất phản hồi/concurrent HIS. Sau đó chọn một đoàn thử và nội dung cụ thể để người có quyền lập/duyệt/áp dụng. Không tự sửa một đoàn bệnh nhân thật để làm test tự động.

## Cấu hình / vận hành

Web nội bộ: `KSK_MANAGEMENT_ENABLED=true`, `KSK_MANAGEMENT_BRANCH=CN1`, `KSK_MANAGEMENT_TOKEN` riêng tối thiểu 32 ký tự, `KSK_MANAGEMENT_STORE_PATH` là file tuyệt đối trong thư mục ACL riêng. Khóa nháp derive HMAC từ `KSK_MANAGEMENT_STORE_SECRET` (nếu có) hoặc `PORTAL_SESSION_SECRET`, tối thiểu 32 ký tự; phải giữ ổn định/sao lưu cùng kho. Đổi secret không có migration sẽ không đọc được phiếu cũ; không xóa kho khi lỗi giải mã. Không đưa token/key vào NEXT_PUBLIC.

Web cloud: `ADMIN_DATA_MODE=supabase`, `ADMIN_CLOUD_STORE_SECRET` ổn định và `KSK_DATA_MODE=supabase`. Nháp được mã hóa AES-256-GCM trước khi lưu Supabase và dùng compare-and-swap chống hai người ghi đè. Cloud chỉ cho lập/kiểm tra/gửi/duyệt/từ chối nháp; action `apply` luôn trả 403, bất kể quyền người dùng. Việc này không thay quyết định CN1 chỉ đọc.

Agent: `KskManagement__Enabled=true`, `KskManagement__ServerToken` khớp web. Đọc dùng `ConnectionStrings__OracleKskReadOnly` hiện có; không fallback tự động từ kết nối ghi worker. Ghi cần **đủ** `KskManagement__WriteEnabled=true`, `KskManagement__HisUserId` (1–99999), `ConnectionStrings__OracleKskWrite` riêng và schema đã có `PORTAL_KSK_COMMANDS`, `PORTAL_KSK_ID_SEQ`. Script `deploy/oracle/ksk_management_ledger.sql` không tự chạy; DDL Oracle có commit, chỉ chạy sau IT kiểm tra schema/backup và trên DB TEST trước. USERID là tài khoản tích hợp HIS, người lập/duyệt/áp dụng web lưu riêng ở ledger, không giả danh USERID của nhân viên portal.

Local đã bật đọc/nháp bằng launcher, **ghi luôn false**:

```powershell
pwsh -NoProfile -File tools/start-ksk-cn1-local.ps1 -Stop
pwsh -NoProfile -File tools/start-ksk-cn1-local.ps1 -EnableKskChangeLab -EnableKskManagement
```

Không sửa `.env.local` hoặc env service thật; không đổi Zalo/worker. File nháp local `artifacts/admin-staff/ksk-management.enc` dùng thư mục ACL operator/SYSTEM. Kho đơn máy, khóa `.lock` liên process. Sau crash, IT phải xác nhận process đã dừng trước xóa đúng file lock; không tự phá khóa theo tuổi. Sao lưu riêng kho nháp mã hóa và secret, không đồng bộ cloud công cộng.

## Thao tác web

1. Vào `http://127.0.0.1:3014/admin/ksk-manage`, hoặc menu **Quản lý đoàn / gói HIS**. Màn hình này đọc HIS thật; LAB vẫn có URL/menu riêng.
2. Chọn ngày tạo đợt, xem **Đợt khám**, bấm **Mở quản lý** ở dòng đoàn. Nếu biết ID có thể nhập ID và đọc trực tiếp. Mỗi phạm vi ngày tối đa 93 ngày.
3. Các tab: Khách hàng / Đợt khám / Nhóm khám / Người khám / Gói–mục dịch vụ. Chọn **Thêm** hoặc **Sửa / lập phiếu**. Khóa ID của dòng hiện hữu không sửa được; nhóm/người/gói phải trong đợt đang mở.
4. Người mới trong nhóm: nhập mã BN 8 số, **Tra mã BN / điền họ tên từ HIS**. Tra cứu dùng POST, không đưa mã BN lên URL. Chưa có MABN thì chưa thêm từ web trong đợt này; không cấp số mới, không tự sửa nhân khẩu BTDBN. Có thể sửa mã NV/bộ phận/điện thoại/địa chỉ/gán mã nhóm gói cho người chưa tiếp nhận.
5. Gói: chọn dịch vụ từ danh mục HIS bằng ô tìm, giá nội viện/ngoại viện nguyên đồng, tối đa 100 dịch vụ/phiếu; không chấp nhận trùng mã hoặc dịch vụ HIDE=1. Giá 0 không được tự coi là miễn giảm/đã thanh toán. Không thêm cột số lượng không tồn tại trong nguồn.
6. Nhập lý do → **Kiểm tra trước — chưa lưu** (chỉ READ ONLY) hoặc **Lưu bản nháp**. Chưa ghi HIS. Mỗi phiếu một đối tượng, không import Excel hàng loạt trong đợt này.
7. Mở phiếu, so sánh bản trước/sau → người lập **Gửi duyệt** → tài khoản khác có quyền **Duyệt phiếu HIS** hoặc **Từ chối**. Nội dung phiếu bất biến; cần sửa sau từ chối thì lập phiếu mới từ form nguồn đã làm mới, không ghi đè bản đã duyệt.
8. Ghi server đang tắt thì giữ phiếu đã duyệt, không gửi apply. Khi được IT mở ghi sau nghiệm thu: người có action ghi xác nhận và bấm **Áp dụng vào HIS thật**, rồi **Đọc/Làm mới** đối chiếu. Phiếu có UUID lệnh riêng.
9. Mất phản hồi: xem trạng thái `Chưa rõ kết quả`, làm mới và dùng **Kiểm tra / áp dụng lại ĐÚNG mã lệnh**. Cùng UUID + body bất biến được agent tra ledger trước kiểm tra phiên bản; không tạo phiếu khác để thử ghi lại. File/app crash ở `Đang áp dụng` cũng dùng đúng cơ chế này sau xử lý khóa có kiểm soát.

## Giới hạn ghi cần nghiệm thu

- Ghi thật đã có mã DML và ledger transaction, **chưa chạy/commit DML hay cài ledger trên CN1 trong đợt phát triển này**. Unit/mock và preflight không thay thế nghiệm thu transaction Oracle.
- Kiểm tra tiếp nhận quét các BASK_DONVI của owner theo prefix hợp lệ, tối đa 300 tháng; nguồn cũ không có ID_DOAN nối theo MADONVI → KSKDONVI.IDDOAN. Không bỏ qua schema thiếu MADONVI/MABN. Thiếu quyền/cột/qua giới hạn báo lỗi, không tự coi chưa tiếp nhận. Package/đợt đã có bất kỳ lượt thì khóa sửa bảo thủ; có thể thêm cấu hình mới chưa tác động lượt cũ.
- Write transaction dùng SERIALIZABLE và khóa bảng cấu hình EXCLUSIVE NOWAIT, các BASK_DONVI/BTDBN/V_GIAVP SHARE NOWAIT; có thể tranh chấp hoặc cần quyền khác tài khoản SELECT. Gặp bận trả lỗi, không kill session/đợi vô hạn. Do khóa có phạm vi rộng, **chưa mở ghi production trước kiểm thử tải với HIS và IT đồng ý cửa sổ vận hành**.
- Không hỗ trợ xóa người/đoàn, đổi khóa/di chuyển người sang nhóm khác, cấp MABN, import Excel, giá lẻ, hoặc tự xử lý điều kiện gói chồng lấn. Mục cùng giới tính/mã nhóm gói đã tồn tại sẽ chặn tạo thêm bảo thủ. `TT`/`NAMSINH` là điều kiện nguồn, không tự diễn giải lại quy tắc kế toán.
- Phiên bản nguồn bảo thủ bao gồm khách hàng/danh mục và cấu hình đợt: thay đổi ngoài đối tượng có thể yêu cầu lập lại phiếu. Không tự rebase.
- Quyền hiện theo toàn chi nhánh, chưa theo từng công ty/đoàn; UI tìm kiếm không là ranh giới quyền. Tài khoản có menu quản lý đọc được danh sách thành viên thuộc đợt đã chọn.

## Kiểm chứng đợt này

- .NET build không lỗi/cảnh báo; `backend/KskManagement.Tests` 24 assertion trên dữ liệu nhân tạo, không nối Oracle; transport `tools/test-ksk-management-agent.ps1` 6 checks (token, tham số, khóa ghi, chặn tự duyệt, JSON lạ), tiến trình cô lập, không Oracle.
- Vitest 198/198 đạt, Next.js production build đạt. Tests mới: `ksk-management.test.ts`, `ksk-management-route.test.ts`, `ksk-management-ui.test.tsx`. Kiểm tra mã hóa/phiên bản/phân quyền khác LAB/hai người duyệt/ghi tắt/timeout/retry UUID-body giống hệt, không thực thi Oracle DML để test.
- `tools/check-ksk-management-local.mjs`: CN1 thật anonymous 401, API/page 200, READ ONLY preflight 200, writeEnabled=false. Tập đoàn đối chiếu: 467 khách hàng, 1 đợt/1 nhóm/13 người, 2 mục gói/19 dịch vụ gói, danh mục 3.929 dịch vụ, hasVisits=true. Chỉ in số lượng, không lưu payload PHI hoặc tạo nháp rác trong kho người dùng.
- Edge riêng qua `tools/test-staff-button-browser.mjs --management`: 1366×768 và 682×1012, đủ 5 tab, form 14 trường, nút lưu nháp rõ, write-off hiển thị, không tràn ngang toàn trang. Chỉ mở form trống, không gửi tạo/ghi. Ảnh chỉ form lọc `artifacts/ksk-management-filters-1366.png`, `-682.png`, không tên bệnh nhân/công ty.
- Backend `Ksk/KskManagementModel.cs`, `OracleKskManagementRepository.cs`, `KskManagementEndpoints.cs`; web `src/lib/ksk/management-*`, `/admin/ksk-manage`, `/api/admin/ksk-manage`, route POST `/api/admin/ksk-manage/patient`. Ghi server tắt là cấu hình bàn giao hiện tại, không phải đã sửa dữ liệu HIS.
