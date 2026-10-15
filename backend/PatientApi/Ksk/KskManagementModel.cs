using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace PatientApi.Ksk;
using Row = Dictionary<string, string>;

public sealed record ManagementSnapshot(string Branch, string Version, bool WriteEnabled, string CohortId,
    List<Row> Customers, List<Row> Cohorts, List<Row> Groups, List<Row> Members, List<Row> Packages, List<Row> Items, List<Row> Services, bool HasVisits, List<string> VisitedMembers, List<string> VisitedGroups);
public sealed record ManagementProposal(string Kind, string Key, Row Fields, List<Row> Items);
public sealed record ManagementCommand(string CommandId, string CohortId, string From, string To, string ExpectedVersion, ManagementProposal Proposal,
    string Author, string Reviewer, string AppliedBy, string Reason);
public sealed class ManagementError(string message, int status = 409) : Exception(message) { public int Status { get; } = status; }

public static class KskManagementModel
{
    // Fixed SQL identifiers only. User input never becomes a column/table name.
    public static readonly Dictionary<string, (string Table, string[] Fields)> Definitions = new()
    {
        ["customer"] = ("KSK_KHACHHANG", ["ten", "stt"]),
        ["cohort"] = ("KSKDOAN", ["id_ksk_khachhang", "ten", "sohd", "ngay", "loai", "ma", "diachi", "dienthoai", "fax", "email", "masothue", "nguoilienhe", "ghichu"]),
        ["group"] = ("KSKDONVI", ["stt", "ma", "ten", "tu", "den", "so_hop_dong"]),
        ["member"] = ("KSKBTDBN", ["stt", "hoten", "namsinh", "phai", "dienthoai", "diachi", "manv", "bo_phan", "id_goi_kskmuc", "tinhtrang_honnhan"]),
        ["package"] = ("KSKMUC", ["stt", "phai", "tt", "namsinh", "ghichu", "namsinh_tu", "namsinh_den", "id_goi_kskmuc", "tinhtrang_honnhan"])
    };
    public static bool Id(string value) => Regex.IsMatch(value, @"\A[1-9][0-9]{0,19}\z");
    public static string Identifier(string value) => Regex.IsMatch(value, @"\A[A-Za-z][A-Za-z0-9_]{0,24}\z") ? value.ToUpperInvariant() : throw new ManagementError("Schema quản lý không hợp lệ.", 503);
    public static string Hash(object data) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(data)))).ToLowerInvariant();
    public static string[] RequiredFields(string kind) => Definitions.TryGetValue(kind, out var def) ? def.Fields : throw new ManagementError("Loại thay đổi không hợp lệ.", 400);
    public static Row? Original(ManagementSnapshot data, ManagementProposal proposal) => proposal.Kind switch
    {
        "customer" => data.Customers.SingleOrDefault(r => r["id"] == proposal.Key),
        "cohort" => data.Cohorts.SingleOrDefault(r => r["id"] == proposal.Key),
        "group" => data.Groups.SingleOrDefault(r => r["id"] == proposal.Key),
        "member" => data.Members.SingleOrDefault(r => r["iddonvi"] + ":" + r["mabn"] == proposal.Key),
        "package" => data.Packages.SingleOrDefault(r => r["id"] == proposal.Key), _ => null
    };
    public static void Validate(ManagementSnapshot data, ManagementProposal p)
    {
        var fields = RequiredFields(p.Kind);
        var adding = p.Key == "NEW";
        var extras = p.Kind == "member" && adding ? new[] { "iddonvi", "mabn" } : Array.Empty<string>();
        if (p.Fields is null || p.Items is null || !p.Fields.Keys.Order().SequenceEqual(fields.Concat(extras).Order())
            || p.Fields.Values.Any(v => v is null || v.Length > 2000 || v.Any(c => c == '\0')) || p.Items.Count > 100)
            throw new ManagementError("Các trường dữ liệu không hợp lệ.", 400);
        var original = adding ? null : Original(data, p);
        if (!adding && original is null) throw new ManagementError("Đối tượng không thuộc phạm vi đã đọc.", 404);
        if (p.Kind is "group" or "member" or "package" && !Id(data.CohortId)) throw new ManagementError("Chọn một đợt khám trước.", 400);
        if (p.Kind != "customer" && data.CohortId.Length > 0 && data.Cohorts.Any(r => r.GetValueOrDefault("done") is not ("" or "0" or null))) throw new ManagementError("Đợt đã hoàn tất; không cho thay đổi cấu hình.");
        if (p.Kind == "cohort" && !adding && p.Key != data.CohortId) throw new ManagementError("Đợt khám không đúng phạm vi.", 400);
        if (!adding && (original!.GetValueOrDefault("done") == "1" || (p.Kind is "cohort" or "package" && data.HasVisits)
            || (p.Kind == "member" && (original!.GetValueOrDefault("ngaykham", "") != "" || data.VisitedMembers.Contains(p.Key)))
            || (p.Kind == "group" && data.VisitedGroups.Contains(p.Key))))
            throw new ManagementError("Đã tiếp nhận/hoàn tất; khóa thay đổi để không tác động dữ liệu đã phát sinh.");
        foreach (var (name, value) in p.Fields)
        {
            if (name is "ngay" or "tu" or "den")
            { if (!DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _)) throw new ManagementError("Ngày không hợp lệ.", 400); }
            else if (name is "id_ksk_khachhang" or "iddonvi") { if (!Id(value)) throw new ManagementError("Mã liên kết không hợp lệ.", 400); }
            else if (name == "mabn") { if (!Regex.IsMatch(value, @"\A[0-9]{8}\z")) throw new ManagementError("Mã BN phải đủ 8 số và đã tồn tại trong HIS.", 400); }
            else if (name is "stt" or "phai" or "loai" or "namsinh_tu" or "namsinh_den" or "id_goi_kskmuc" or "tinhtrang_honnhan")
            {
                if (!Regex.IsMatch(value, @"\A[0-9]{1,10}\z") || !long.TryParse(value, out var n)) throw new ManagementError("Giá trị số không hợp lệ.", 400);
                var max = name switch { "phai" or "loai" => 1, "tinhtrang_honnhan" => 2, "id_goi_kskmuc" => 99,
                    "stt" => p.Kind == "customer" ? 9999999999L : p.Kind == "member" ? 9999999 : p.Kind == "group" ? 99 : 999, _ => 9999 };
                if (n > max) throw new ManagementError("Giá trị vượt giới hạn cột HIS.", 400);
            }
            var length = name switch { "sohd" or "masothue" => 20, "ma" => p.Kind == "cohort" ? 3 : 2, "dienthoai" or "fax" => 50,
                "hoten" or "manv" or "so_hop_dong" => 100, "bo_phan" => 200, "namsinh" => 4, "tt" => 2,
                "ten" when p.Kind == "customer" => 2000, _ => 254 };
            if (value.Length > length) throw new ManagementError("Nội dung vượt độ dài cột HIS.", 400);
        }
        if (p.Fields.TryGetValue("ten", out var ten) && string.IsNullOrWhiteSpace(ten) || p.Fields.TryGetValue("hoten", out var hoten) && string.IsNullOrWhiteSpace(hoten)) throw new ManagementError("Tên không được trống.", 400);
        if (p.Kind == "group" && string.CompareOrdinal(p.Fields["den"], p.Fields["tu"]) < 0) throw new ManagementError("Đến ngày phải sau từ ngày.", 400);
        if (p.Kind == "cohort" && !data.Customers.Any(r => r["id"] == p.Fields["id_ksk_khachhang"])) throw new ManagementError("Khách hàng không thuộc danh mục đã đọc.", 400);
        if (p.Kind == "package")
        {
            if (int.Parse(p.Fields["namsinh_tu"]) > int.Parse(p.Fields["namsinh_den"]) || p.Fields["tt"] is not ("" or "<" or ">" or "=" or "<=" or ">=")) throw new ManagementError("Điều kiện gói không hợp lệ.", 400);
            if (p.Items.Count == 0 || p.Items.Select(i => i.GetValueOrDefault("mavp")).Distinct().Count() != p.Items.Count) throw new ManagementError("Gói phải có dịch vụ, không lặp mã.", 400);
            if (data.Packages.Any(r => r["id"] != p.Key && r["id_goi_kskmuc"] == p.Fields["id_goi_kskmuc"] && r["phai"] == p.Fields["phai"])) throw new ManagementError("Đã có mục cùng mã nhóm gói/giới tính. Chưa cho tạo điều kiện chồng lấn qua web.");
            foreach (var item in p.Items)
                if (!item.Keys.Order().SequenceEqual(new[] { "mavp", "stt", "gia_nv", "gia_ngv", "ghichu" }.Order())
                    || !data.Services.Any(s => s["id"] == item["mavp"] && s.GetValueOrDefault("hide") != "1")
                    || !Regex.IsMatch(item["stt"], @"\A[0-9]{1,3}\z") || item["ghichu"].Length > 254
                    || new[] { "gia_nv", "gia_ngv" }.Any(k => !Regex.IsMatch(item[k], @"\A[0-9]{1,10}\z"))) throw new ManagementError("Dịch vụ/đơn giá gói không hợp lệ.", 400);
        }
        else if (p.Items.Count != 0) throw new ManagementError("Chỉ phiếu gói mới có chi tiết dịch vụ.", 400);
        if (p.Kind == "member")
        {
            if (!Regex.IsMatch(p.Fields["namsinh"], @"\A[0-9]{4}\z") || int.Parse(p.Fields["namsinh"]) < 1900 || int.Parse(p.Fields["namsinh"]) > DateTime.Today.Year) throw new ManagementError("Năm sinh không hợp lệ.", 400);
            if (adding && !data.Groups.Any(g => g["id"] == p.Fields["iddonvi"])) throw new ManagementError("Nhóm không thuộc đợt.", 400);
            if (adding && data.Members.Any(m => m["iddonvi"] == p.Fields["iddonvi"] && m["mabn"] == p.Fields["mabn"])) throw new ManagementError("Người đã nằm trong nhóm.");
            if (adding && data.VisitedMembers.Contains(p.Fields["iddonvi"] + ":" + p.Fields["mabn"])) throw new ManagementError("Người đã có tiếp nhận trong nhóm; không thêm lại.");
            if (p.Fields["id_goi_kskmuc"] != "0" && !data.Packages.Any(r => r["id_goi_kskmuc"] == p.Fields["id_goi_kskmuc"])) throw new ManagementError("Mã gói nhóm không thuộc đợt.", 400);
        }
    }
}
