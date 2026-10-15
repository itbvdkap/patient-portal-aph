using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;
using System.Data;
using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace PatientApi.Ksk;
using Row = Dictionary<string, string>;

public sealed class OracleKskManagementRepository(IConfiguration config)
{
    private string Master => KskManagementModel.Identifier(config["Ksk:MasterSchema"] ?? "");
    private string Prefix => KskManagementModel.Identifier(config["Ksk:MonthlySchemaPrefix"] ?? "");
    private string Branch => config["PatientPortal:BranchCode"] ?? "";
    public bool WriteConfigured => config.GetValue("KskManagement:WriteEnabled", false)
        && !string.IsNullOrWhiteSpace(config.GetConnectionString("OracleKskWrite")) && int.TryParse(config["KskManagement:HisUserId"], out var id) && id > 0 && id <= 99999;
    private static object DbValue(string key, string value) => string.IsNullOrEmpty(value) ? DBNull.Value
        : key is "ngay" or "tu" or "den" ? DateTime.ParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture) : value;
    private async Task<OracleConnection> Open(bool write, CancellationToken ct)
    {
        var cs = config.GetConnectionString(write ? "OracleKskWrite" : "OracleKskReadOnly");
        if (string.IsNullOrWhiteSpace(cs)) throw new ManagementError("Thiếu kết nối Oracle quản lý riêng.", 503);
        var connection = new OracleConnection(cs);
        try { await connection.OpenAsync(ct); return connection; } catch { await connection.DisposeAsync(); throw; }
    }
    private static OracleCommand Command(OracleConnection connection, OracleTransaction? tx, string sql, Dictionary<string, object>? args = null)
    {
        var command = connection.CreateCommand(); command.Transaction = tx; command.CommandText = sql; command.BindByName = true; command.CommandTimeout = 8;
        foreach (var (key, value) in args ?? []) {
            if (!sql.Contains(":" + key, StringComparison.Ordinal)) continue;
            var parameter = new OracleParameter(key, value);
            // Explicit national character binds, not lossy database VARCHAR conversion.
            if (value is string) parameter.OracleDbType = OracleDbType.NVarchar2;
            command.Parameters.Add(parameter);
        }
        return command;
    }
    private static async Task<List<Row>> Sql(OracleConnection c, OracleTransaction? tx, string sql, Dictionary<string, object>? args, CancellationToken ct, int cap = 3000)
    {
        using var command = Command(c, tx, $"select * from ({sql}) where rownum<={cap + 1}", args);
        using var reader = await command.ExecuteReaderAsync(ct); var rows = new List<Row>();
        while (await reader.ReadAsync(ct)) {
            var row = new Row();
            for (var i = 0; i < reader.FieldCount; i++) row[reader.GetName(i).ToLowerInvariant()] = reader.IsDBNull(i) ? "" : reader.GetValue(i) switch {
                OracleClob clob => clob.Value,
                DateTime date => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                IFormattable number => number.ToString(null, CultureInfo.InvariantCulture), var value => value.ToString() ?? "" };
            rows.Add(row);
        }
        if (rows.Count > cap) throw new ManagementError("Phạm vi quản lý vượt giới hạn. Thu hẹp ngày/đợt; không trả danh sách bị cắt.", 422);
        return rows;
    }
    private async Task<List<(string Owner, bool HasCohort)>> VisitOwners(OracleConnection c, OracleTransaction? tx, CancellationToken ct)
    {
        var rows = await Sql(c, tx, "select t.owner,max(case when c.column_name='ID_DOAN' then 1 else 0 end) hascohort,count(distinct case when c.column_name in ('MADONVI','MABN') then c.column_name end) linkcols from all_tables t join all_tab_columns c on c.owner=t.owner and c.table_name=t.table_name where t.table_name='BASK_DONVI' and t.owner like :prefix group by t.owner order by t.owner", new() { ["prefix"] = Prefix + "%" }, ct, 300);
        rows = rows.Where(r => Regex.IsMatch(r["owner"], "^" + Regex.Escape(Prefix) + "[0-9]{4}$")).ToList();
        if (rows.Any(r => r["linkcols"] != "2")) throw new ManagementError("Nguồn tiếp nhận cũ thiếu khóa nhóm/người; chưa thể mở quản lý an toàn.", 503);
        var owners = rows.Select(r => (Owner: r["owner"], HasCohort: r["hascohort"] == "1")).ToList();
        if (owners.Count == 0) throw new ManagementError("Không xác minh được nguồn tiếp nhận các tháng; khóa quản lý.", 503);
        return owners;
    }
    private async Task<ManagementSnapshot> Read(OracleConnection c, OracleTransaction? tx, string cohort, DateOnly from, DateOnly to, CancellationToken ct)
    {
        var args = new Dictionary<string, object> { ["cohort"] = cohort, ["fromDate"] = from.ToDateTime(TimeOnly.MinValue), ["toDate"] = to.AddDays(1).ToDateTime(TimeOnly.MinValue) };
        var customers = await Sql(c, tx, $"select id,ten,stt from {Master}.ksk_khachhang order by ten,id", null, ct, 5000);
        var cohorts = await Sql(c, tx, $"select id,id_ksk_khachhang,ten,sohd,ngay,loai,ma,diachi,dienthoai,fax,email,masothue,nguoilienhe,ghichu,done from {Master}.kskdoan where "
            + (cohort.Length > 0 ? "id=:cohort" : "ngay>=:fromDate and ngay<:toDate") + " order by ngay desc,id", args, ct);
        if (cohort.Length > 0 && cohorts.Count != 1) throw new ManagementError("Không tìm thấy đợt khám.", 404);
        var groups = cohort.Length == 0 ? [] : await Sql(c, tx, $"select id,stt,ma,ten,tu,den,so_hop_dong from {Master}.kskdonvi where iddoan=:cohort order by id", args, ct);
        var members = cohort.Length == 0 ? [] : await Sql(c, tx, $"select b.iddonvi,b.mabn,b.stt,b.hoten,b.namsinh,b.phai,b.dienthoai,b.diachi,b.manv,b.bo_phan,b.id_goi_kskmuc,b.tinhtrang_honnhan,b.done,b.ngaykham from {Master}.kskbtdbn b join {Master}.kskdonvi g on g.id=b.iddonvi where g.iddoan=:cohort order by b.iddonvi,b.mabn", args, ct);
        var packages = cohort.Length == 0 ? [] : await Sql(c, tx, $"select id,stt,phai,tt,namsinh,ghichu,namsinh_tu,namsinh_den,id_goi_kskmuc,tinhtrang_honnhan from {Master}.kskmuc where iddoan=:cohort order by id", args, ct);
        var items = cohort.Length == 0 ? [] : await Sql(c, tx, $"select x.id,x.mavp,x.stt,x.gia_nv,x.gia_ngv,x.ghichu from {Master}.kskmucct x join {Master}.kskmuc p on p.id=x.id where p.iddoan=:cohort order by x.id,x.mavp", args, ct, 10000);
        var services = await Sql(c, tx, $"select id,ma,ten,hide from {Master}.v_giavp order by id", null, ct, 20000);
        var visits = new List<Row>();
        if (cohort.Length > 0) {
            var owners = await VisitOwners(c, tx, ct);
            visits = await Sql(c, tx, string.Join(" union ", owners.Select(o => $"select to_char(b.madonvi) groupid,b.mabn from {o.Owner}.bask_donvi b where "
                + (o.HasCohort ? "b.id_doan=:cohort or " : "") + $"exists(select 1 from {Master}.kskdonvi g where g.id=b.madonvi and g.iddoan=:cohort)")), args, ct, 10000);
        }
        var visitedMembers = visits.Select(v => v["groupid"] + ":" + v["mabn"]).Distinct().Order().ToList();
        var visitedGroups = visits.Select(v => v["groupid"]).Distinct().Order().ToList();
        var version = KskManagementModel.Hash(new { Branch, cohort, customers, cohorts, groups, members, packages, items, services, visitedMembers });
        return new(Branch, version, WriteConfigured, cohort, customers, cohorts, groups, members, packages, items, services, visits.Count > 0, visitedMembers, visitedGroups);
    }
    public async Task<ManagementSnapshot> ReadAsync(string cohort, DateOnly from, DateOnly to, CancellationToken ct)
    {
        await using var c = await Open(false, ct);
        using (var guard = Command(c, null, "SET TRANSACTION READ ONLY")) await guard.ExecuteNonQueryAsync(ct);
        return await Read(c, null, cohort, from, to, ct);
    }
    public async Task<Row> PatientAsync(string mabn, CancellationToken ct)
    {
        if (!Regex.IsMatch(mabn, "^[0-9]{8}$")) throw new ManagementError("Mã BN phải đủ 8 số.", 400);
        await using var c = await Open(false, ct);
        using (var guard = Command(c, null, "SET TRANSACTION READ ONLY")) await guard.ExecuteNonQueryAsync(ct);
        return (await Sql(c, null, $"select mabn,hoten,namsinh,phai from {Master}.btdbn where mabn=:mabn", new() { ["mabn"] = mabn }, ct, 1)).SingleOrDefault()
            ?? throw new ManagementError("Không tìm thấy mã BN trong HIS. Chưa tự cấp mã BN mới.", 404);
    }
    private async Task ValidatePatient(OracleConnection c, OracleTransaction? tx, ManagementProposal p, ManagementSnapshot data, CancellationToken ct)
    {
        if (p.Kind != "member") return;
        var mabn = p.Key == "NEW" ? p.Fields["mabn"] : KskManagementModel.Original(data, p)!["mabn"];
        var patient = await Sql(c, tx, $"select hoten,namsinh,phai from {Master}.btdbn where mabn=:mabn", new() { ["mabn"] = mabn }, ct, 1);
        if (patient.Count != 1 || new[] { "hoten", "namsinh", "phai" }.Any(k => !string.Equals(patient[0][k].Trim(), p.Fields[k].Trim(), StringComparison.OrdinalIgnoreCase)))
            throw new ManagementError("Mã BN chưa tồn tại hoặc họ tên/năm sinh/giới tính không khớp BTDBN. Không tự sửa hồ sơ bệnh nhân gốc.");
    }
    public async Task ValidateAsync(ManagementCommand input, CancellationToken ct)
    {
        ValidateEnvelope(input);
        await using var c = await Open(false, ct);
        using (var guard = Command(c, null, "SET TRANSACTION READ ONLY")) await guard.ExecuteNonQueryAsync(ct);
        var data = await Read(c, null, input.CohortId, DateOnly.ParseExact(input.From, "yyyy-MM-dd"), DateOnly.ParseExact(input.To, "yyyy-MM-dd"), ct);
        if (data.Version != input.ExpectedVersion) throw new ManagementError("Nguồn HIS đã thay đổi. Lập lại phiếu từ nguồn mới; không ghi đè.");
        KskManagementModel.Validate(data, input.Proposal); await ValidatePatient(c, null, input.Proposal, data, ct);
    }
    private static void ValidateEnvelope(ManagementCommand input)
    {
        if (input is null || !Guid.TryParseExact(input.CommandId, "D", out _) || input.CohortId.Length > 20 || (input.CohortId.Length > 0 && !KskManagementModel.Id(input.CohortId))
            || !Regex.IsMatch(input.ExpectedVersion, "^[a-f0-9]{64}$") || !DateOnly.TryParseExact(input.From, "yyyy-MM-dd", out var from) || !DateOnly.TryParseExact(input.To, "yyyy-MM-dd", out var to)
            || to < from || to.DayNumber - from.DayNumber > 92 || input.Author.Length is < 1 or > 50 || input.Reviewer.Length is < 1 or > 50 || input.AppliedBy.Length is < 1 or > 50
            || input.Author.Equals(input.Reviewer, StringComparison.OrdinalIgnoreCase) || input.Reason.Trim().Length is < 5 or > 500 || input.Proposal is null)
            throw new ManagementError("Lệnh ghi/duyệt không hợp lệ.", 400);
    }
    public async Task<object> ApplyAsync(ManagementCommand input, CancellationToken ct)
    {
        ValidateEnvelope(input);
        if (!WriteConfigured) throw new ManagementError("Ghi HIS đang tắt. Cần kết nối ghi riêng, USERID và ledger đã được IT chuẩn bị.", 503);
        await using var c = await Open(true, ct);
        using var tx = c.BeginTransaction(IsolationLevel.Serializable);
        var commandHash = KskManagementModel.Hash(input);
        // The ledger is checked BEFORE source version checks, including replay after a lost response.
        var replay = await Sql(c, tx, $"select command_hash,result_json from {Master}.portal_ksk_commands where command_id=:commandId", new() { ["commandId"] = input.CommandId }, ct, 1);
        if (replay.Count > 0) {
            if (replay[0]["command_hash"] != commandHash) throw new ManagementError("Mã lệnh đã dùng với nội dung khác.");
            using var doc = JsonDocument.Parse(replay[0]["result_json"]); return doc.RootElement.Clone();
        }
        // Short, fail-fast safety locks protect membership phantoms and concurrent legacy HIS edits.
        // These are enabled ONLY on explicit apply, never report/read/validate requests.
        foreach (var table in new[] { "KSK_KHACHHANG", "KSKDOAN", "KSKDONVI", "KSKBTDBN", "KSKMUC", "KSKMUCCT" }) {
            using var command = Command(c, tx, $"lock table {Master}.{table} in exclusive mode nowait"); await command.ExecuteNonQueryAsync(ct);
        }
        foreach (var owner in await VisitOwners(c, tx, ct)) {
            using var command = Command(c, tx, $"lock table {owner.Owner}.bask_donvi in share mode nowait"); await command.ExecuteNonQueryAsync(ct);
        }
        foreach (var table in new[] { "BTDBN", "V_GIAVP" }) { using var command = Command(c, tx, $"lock table {Master}.{table} in share mode nowait"); await command.ExecuteNonQueryAsync(ct); }
        var data = await Read(c, tx, input.CohortId, DateOnly.ParseExact(input.From, "yyyy-MM-dd"), DateOnly.ParseExact(input.To, "yyyy-MM-dd"), ct);
        if (data.Version != input.ExpectedVersion) throw new ManagementError("Nguồn HIS đã thay đổi. Không ghi đè.");
        var p = input.Proposal; KskManagementModel.Validate(data, p); await ValidatePatient(c, tx, p, data, ct);
        var def = KskManagementModel.Definitions[p.Kind]; var adding = p.Key == "NEW";
        var id = p.Key;
        if (adding && p.Kind != "member") {
            using var sequence = Command(c, tx, $"select {Master}.portal_ksk_id_seq.nextval from dual");
            id = Convert.ToString(await sequence.ExecuteScalarAsync(ct), CultureInfo.InvariantCulture)!;
        }
        var args = p.Fields.ToDictionary(x => x.Key, x => DbValue(x.Key, x.Value));
        args["id"] = id; args["cohort"] = input.CohortId; args["userid"] = int.Parse(config["KskManagement:HisUserId"]!);
        string where;
        if (p.Kind == "member") {
            var row = adding ? p.Fields : KskManagementModel.Original(data, p)!;
            args["iddonvi"] = row["iddonvi"]; args["mabn"] = row["mabn"]; id = row["iddonvi"] + ":" + row["mabn"];
            where = "iddonvi=:iddonvi and mabn=:mabn";
            args["hotenkdau"] = StripAccents(p.Fields["hoten"]);
        } else where = "id=:id";
        var columns = def.Fields.ToList();
        if (p.Kind == "member") columns.Add("hotenkdau");
        if (p.Kind is "cohort" or "group" or "member") columns.Add("userid");
        string sql;
        if (adding) {
            columns.InsertRange(0, p.Kind == "member" ? ["iddonvi", "mabn"] : ["id"]);
            if (p.Kind is "group" or "package") { columns.Add("iddoan"); args["iddoan"] = input.CohortId; }
            sql = $"insert into {Master}.{def.Table} ({string.Join(',', columns)}) values ({string.Join(',', columns.Select(name => ":" + name))})";
        } else sql = $"update {Master}.{def.Table} set {string.Join(',', columns.Select(name => name + "=:" + name))} where {where}";
        using (var dml = Command(c, tx, sql, args)) if (await dml.ExecuteNonQueryAsync(ct) != 1) throw new ManagementError("Số dòng cập nhật không đúng; đã hủy transaction.");
        if (p.Kind is "cohort" or "group" or "member") { using var stamp = Command(c, tx, $"update {Master}.{def.Table} set ngayud=sysdate where {where}", args); await stamp.ExecuteNonQueryAsync(ct); }
        if (p.Kind == "package") {
            using (var remove = Command(c, tx, $"delete from {Master}.kskmucct where id=:id", new() { ["id"] = id })) await remove.ExecuteNonQueryAsync(ct);
            foreach (var item in p.Items) {
                var values = item.ToDictionary(x => x.Key, x => DbValue(x.Key, x.Value)); values["id"] = id;
                using var insert = Command(c, tx, $"insert into {Master}.kskmucct(id,mavp,stt,gia_nv,gia_ngv,ghichu) values(:id,:mavp,:stt,:gia_nv,:gia_ngv,:ghichu)", values);
                await insert.ExecuteNonQueryAsync(ct);
            }
        }
        var result = new { commandId = input.CommandId, branch = Branch, kind = p.Kind, key = id, applied = true, appliedAt = DateTimeOffset.UtcNow };
        using (var ledger = Command(c, tx, $"insert into {Master}.portal_ksk_commands(command_id,command_hash,cohort_id,actor,reviewer,applied_by,request_json,before_json,result_json,created_at) values(:commandId,:hash,:cohort,:actor,:reviewer,:applier,:request,:before,:result,systimestamp)", new() {
            ["commandId"] = input.CommandId, ["hash"] = commandHash, ["cohort"] = input.CohortId, ["actor"] = input.Author, ["reviewer"] = input.Reviewer, ["applier"] = input.AppliedBy,
            ["request"] = JsonSerializer.Serialize(input), ["before"] = JsonSerializer.Serialize(new { row = KskManagementModel.Original(data, p), items = data.Items.Where(i => i["id"] == p.Key) }), ["result"] = JsonSerializer.Serialize(result) })) {
            foreach (var name in new[] { "request", "before" }) ledger.Parameters[name].OracleDbType = OracleDbType.Clob;
            await ledger.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct); return result;
    }
    private static string StripAccents(string value) => new string(value.Normalize(NormalizationForm.FormD).Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).ToArray()).Replace('đ', 'd').Replace('Đ', 'D').ToUpperInvariant();
}
