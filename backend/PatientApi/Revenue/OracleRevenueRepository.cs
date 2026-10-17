using Oracle.ManagedDataAccess.Client;
using System.Globalization;
using System.Text.RegularExpressions;

namespace PatientApi.Revenue;
using Row = Dictionary<string, string?>;

public sealed record RevenueSnapshot(object Scope, List<Row> Receipts, Dictionary<string, bool> Sections, List<string> Warnings);

// Receipt-grain cash movement report, independent of registrations and KSK cohorts.
public sealed class OracleRevenueRepository(IConfiguration config, ILogger<OracleRevenueRepository> log)
{
    private const int Limit = 20000;
    private static string Identifier(string? value) => value is not null && Regex.IsMatch(value, @"\A[A-Za-z][A-Za-z0-9_]{0,29}\z")
        ? value.ToUpperInvariant() : throw new InvalidOperationException("Invalid reporting identifier.");

    public async Task<RevenueSnapshot> ReadAsync(DateTime from, DateTime to, CancellationToken ct)
    {
        var master = Identifier(config["Ksk:MasterSchema"] ?? config["PatientPortal:OracleMasterSchema"]);
        var prefix = Identifier(config["Ksk:MonthlySchemaPrefix"] ?? config["PatientPortal:OracleMonthlySchemaPrefix"]);
        var pharmacyPrefix = Identifier(config["Revenue:PharmacySchemaPrefix"] ?? prefix + "D");
        await using var connection = new OracleConnection(config.GetConnectionString("OracleKskReadOnly")
            ?? throw new InvalidOperationException("OracleKskReadOnly required."));
        await connection.OpenAsync(ct);
        await using (var guard = connection.CreateCommand())
        { guard.CommandText = "SET TRANSACTION READ ONLY"; guard.CommandTimeout = 8; await guard.ExecuteNonQueryAsync(ct); }
        var receipts = new List<Row>(); var sections = new Dictionary<string, bool>(); var warnings = new List<string>();
        async Task<List<Row>> Query(string sql)
        {
            await using var command = connection.CreateCommand(); command.BindByName = true; command.CommandTimeout = 12;
            command.CommandText = $"select * from ({sql}) where rownum <= {Limit + 1}";
            command.Parameters.Add(new OracleParameter("fromDate", from)); command.Parameters.Add(new OracleParameter("toDate", to.AddSeconds(1)));
            await using var reader = await command.ExecuteReaderAsync(ct); var rows = new List<Row>();
            while (await reader.ReadAsync(ct))
            {
                var row = new Row();
                for (var i = 0; i < reader.FieldCount; i++) row[reader.GetName(i).ToLowerInvariant()] = reader.IsDBNull(i) ? null
                    : reader.GetValue(i) is IFormattable f ? f.ToString(null, CultureInfo.InvariantCulture) : reader.GetValue(i).ToString();
                rows.Add(row);
            }
            if (receipts.Count + rows.Count > Limit) throw new RevenueLimitException();
            return rows;
        }
        async Task Section(string name, string sql)
        {
            try { receipts.AddRange(await Query(sql)); sections[name] = true; }
            catch (Exception ex) when (ex is OracleException or RevenueLimitException)
            { sections[name] = false; log.LogWarning("Revenue source incomplete: {Section}; Code={Code}", name, ex is OracleException oracle ? oracle.Number : (int?)null); warnings.Add($"Chưa đọc đủ {name}; thu hẹp ngày giờ hoặc kiểm tra quyền/bảng của agent. Tổng toàn bộ chưa xác định."); }
        }
        const string dates = "h.ngay>=:fromDate and h.ngay<:toDate";
        async Task<bool> OwnerExists(string owner)
        {
            await using var command = connection.CreateCommand(); command.BindByName = true; command.CommandTimeout = 8;
            command.CommandText = "select count(*) from all_users where username=:owner"; command.Parameters.Add(new OracleParameter("owner", owner));
            return Convert.ToInt32(await command.ExecuteScalarAsync(ct), CultureInfo.InvariantCulture) > 0;
        }
        var first = new DateTime(from.Year, from.Month, 1); var last = new DateTime(to.Year, to.Month, 1);
        // The HIS report scans adjacent storage months: late receipts can live in an earlier visit schema.
        for (var month = first.AddMonths(-1); month <= last.AddMonths(1); month = month.AddMonths(1))
        {
            var owner = Identifier(prefix + month.ToString("MMyy", CultureInfo.InvariantCulture));
            var pharmacy = Identifier(pharmacyPrefix + month.ToString("MMyy", CultureInfo.InvariantCulture));
            var core = month >= first && month <= last;
            var ownerExists = await OwnerExists(owner); var pharmacyExists = await OwnerExists(pharmacy);
            if (!ownerExists) foreach (var part in new[] { "direct", "settlement", "advance", "refund" }) sections[owner + ":" + part] = !core;
            if (!pharmacyExists) sections[pharmacy + ":pharmacy"] = !core;
            if (core && (!ownerExists || !pharmacyExists)) warnings.Add("Thiếu schema lưu phiếu trong tháng chọn; chưa xác định được tổng toàn bộ.");
            string Identity(string table, bool drug = false, string? patient = null) =>
                $"'{(drug ? pharmacy : owner)}.{table}' source, to_char(h.id) id, "
                + $"'{(drug ? "D" : "V")}:'||to_char(h.userid) cashierid, (select max(u.hoten) from {master}.{(drug ? "D_DLOGIN" : "V_DLOGIN")} u where u.id=h.userid) cashiername, "
                + $"'{(drug ? "D" : "V")}:'||to_char(h.makp) departmentid, (select max(k.{(drug ? "TEN" : "TENKP")}) from {master}.{(drug ? "D_DUOCKP" : "BTDKP_BV")} k where k.{(drug ? "ID" : "MAKP")}=h.makp) departmentname, "
                + $"to_char(h.ngay,'YYYY-MM-DD\"T\"HH24:MI:SS') occurredat, {patient ?? "h.mabn"} mabn, "
                + $"(select max(p.hoten) from {master}.btdbn p where p.mabn={patient ?? "h.mabn"}) patientname, "
                + "to_char(h.quyenso) book, to_char(h.sobienlai) receiptno";
            if (ownerExists) await Section(owner + ":direct", $"select {Identity("V_VIENPHILL")}, 'direct' kind, "
                + "d.gross, d.insurance, nvl(w.sotien,0) waiver, d.debt, 0 advance, h.mien_giam discount, h.yte_trasau deferred, 0 unsettled, h.dahoantra refunded, d.linecount "
                + $"from {owner}.v_vienphill h left join (select id,sum(soluong*dongia) gross,sum(case when madoituong=1 then nvl(mien,0) else 0 end) insurance,sum(nvl(thieu,0)) debt,count(*) linecount from {owner}.v_vienphict group by id) d on d.id=h.id "
                + $"left join {owner}.v_mienngtru w on w.id=h.id where {dates}");
            var patient = "(select max(ds.mabn) from " + owner + ".v_ttrvds ds where ds.id=h.id)";
            if (ownerExists) await Section(owner + ":settlement", $"select {Identity("V_TTRVLL", patient: patient)}, case when h.loaibn=3 then 'threshold' when h.loaibn is not null then 'discharge' else 'unclassified' end kind, "
                + "h.sotien gross, nvl(h.bhyt,0) insurance, nvl(h.mien,0) waiver, nvl(h.thieu,0) debt, nvl(h.tamung,0) advance, h.mien_giam discount, h.yte_trasau deferred, h.chua_thanh_toan unsettled, h.dahoantra refunded, "
                + $"(select count(*) from {owner}.v_ttrvct d where d.id=h.id) linecount, nvl(w.mien_them,0) extrawaiver "
                + $", (select nvl(sum(r.sotien),0) from {owner}.v_hoantra r where r.loai_ht=4 and r.idttrv=h.id and r.mabn={patient} and r.userid=h.userid and trunc(r.ngay)=trunc(h.ngay)) returnedadvance "
                + $"from {owner}.v_ttrvll h left join {owner}.v_miennoitru w on w.id=h.id where {dates}");
            if (ownerExists) await Section(owner + ":advance", $"select {Identity("V_TAMUNG")}, 'advance' kind, h.sotien gross, 0 insurance, 0 waiver, 0 debt, 0 advance, 0 discount, 0 deferred, 0 unsettled, h.dahoantra refunded, 1 linecount from {owner}.v_tamung h where {dates}");
            if (ownerExists) await Section(owner + ":refund", $"select {Identity("V_HOANTRA")}, case when h.loai_ht=4 then 'advance_refund' when h.loai_ht is not null then 'other_refund' else 'unclassified' end kind, "
                + $"h.sotien gross, 0 insurance, 0 waiver, 0 debt, 0 advance, 0 discount, 0 deferred, 0 unsettled, 0 refunded, 1 linecount from {owner}.v_hoantra h where {dates}");
            if (pharmacyExists) await Section(pharmacy + ":pharmacy", $"select {Identity("D_NGTRULL", true)}, 'pharmacy' kind, d.gross, 0 insurance, nvl(h.miengiam,0) waiver, 0 debt, 0 advance, 0 discount, h.yte_trasau deferred, 0 unsettled, 0 refunded, d.linecount, to_char(h.sotoa) prescriptionno "
                + $"from {pharmacy}.d_ngtrull h left join (select id,sum(soluong*giaban) gross,count(*) linecount from {pharmacy}.d_ngtruct group by id) d on d.id=h.id "
                + $"where {dates} and h.donthuoc_noitru=0 and h.id_v_vienphill<=0");
        }
        return new(new { reportType = "cashier", version = 1, branch = config["PatientPortal:BranchCode"] ?? "UNKNOWN", mode = "his",
            from = from.ToString("yyyy-MM-ddTHH:mm:ss"), to = to.ToString("yyyy-MM-ddTHH:mm:ss"), asof = DateTimeOffset.UtcNow.ToString("O"), departmentPolicy = "receipt_header", storagePolicy = "adjacent_months" }, receipts, sections, warnings);
    }
    private sealed class RevenueLimitException : Exception;
}
