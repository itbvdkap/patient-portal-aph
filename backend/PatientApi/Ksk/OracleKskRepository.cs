using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;
using System.Globalization;
using System.Text.RegularExpressions;

namespace PatientApi.Ksk;

using Row = Dictionary<string, string?>;

public sealed record KskSnapshot(object Scope, List<Row> Cohorts, List<Row> Members,
    List<Row> Visits, List<Row> Charges, List<Row> Clinical, List<Row> Labs, List<Row> Imaging, List<Row> Payments,
    Dictionary<string, bool> Sections, List<string> Warnings);

/// <summary>Bounded, staff-only reporting. No HIS helper calls, DML or financial state changes.</summary>
public sealed class OracleKskRepository(IConfiguration config)
{
    private const int Limit = 3000;
    private static string Identifier(string? value)
    {
        if (value is null || !Regex.IsMatch(value, @"\A[A-Za-z][A-Za-z0-9_]{0,29}\z"))
            throw new InvalidOperationException("Invalid KSK Oracle identifier.");
        return value.ToUpperInvariant();
    }

    public async Task<KskSnapshot> ReadAsync(DateOnly from, DateOnly to, string cohort, CancellationToken ct,
        bool collections = false, DateOnly? collectedFrom = null, DateOnly? collectedTo = null)
    {
        var master = Identifier(config["Ksk:MasterSchema"] ?? config["PatientPortal:OracleMasterSchema"]);
        var prefix = Identifier(config["Ksk:MonthlySchemaPrefix"] ?? config["PatientPortal:OracleMonthlySchemaPrefix"]);
        var clsOwner = Identifier(config["Ksk:ClinicalSchema"] ?? master);
        // Deliberately never fall back to the worker's writable OracleHis credential.
        await using var connection = new OracleConnection(config.GetConnectionString("OracleKskReadOnly")
            ?? throw new InvalidOperationException("OracleKskReadOnly is required."));
        await connection.OpenAsync(ct);
        await using (var guard = connection.CreateCommand())
        {
            guard.CommandText = "SET TRANSACTION READ ONLY";
            guard.CommandTimeout = 8;
            await guard.ExecuteNonQueryAsync(ct);
        }
        var warnings = new List<string>();
        var rowLimit = collections ? 20000 : Limit;
        var sections = new Dictionary<string, bool>();
        var columns = new Dictionary<string, HashSet<string>>();
        var binds = new Dictionary<string, object> { ["cohort"] = cohort,
            ["startDate"] = from.ToDateTime(TimeOnly.MinValue),
            ["endDate"] = to.AddDays(1).ToDateTime(TimeOnly.MinValue),
            ["collectedFrom"] = (collectedFrom ?? from).ToDateTime(TimeOnly.MinValue),
            ["collectedTo"] = (collectedTo ?? to).AddDays(1).ToDateTime(TimeOnly.MinValue) };
        var registrationMonths = new List<string>();
        for (var day = new DateOnly(from.Year, from.Month, 1); day <= to; day = day.AddMonths(1))
            registrationMonths.Add(Identifier(prefix + day.ToString("MMyy", CultureInfo.InvariantCulture)));
        var registrationScope = string.Join(" union all ", registrationMonths.Select(owner =>
            $"select b.id_doan,b.madonvi,b.mabn from {owner}.bask_donvi b join {owner}.tiepdon t on t.maql=b.maql and t.mabn=b.mabn where t.ngay>=:startDate and t.ngay<:endDate"));

        async Task<List<Row>> Sql(string sql, Dictionary<string, object>? parameters = null, int cap = 0)
        {
            if (cap == 0) cap = rowLimit;
            await using var command = connection.CreateCommand();
            command.BindByName = true;
            command.CommandTimeout = 8;
            command.CommandText = $"select * from ({sql}) where rownum <= {cap + 1}";
            foreach (var item in parameters ?? binds)
                if (sql.Contains(":" + item.Key, StringComparison.Ordinal))
                    command.Parameters.Add(new OracleParameter(item.Key, item.Value));
            await using var reader = await command.ExecuteReaderAsync(ct);
            var result = new List<Row>();
            while (await reader.ReadAsync(ct))
            {
                var row = new Row();
                for (var i = 0; i < reader.FieldCount; i++)
                {
                    var value = reader.IsDBNull(i) ? null : reader.GetValue(i);
                    row[reader.GetName(i).ToLowerInvariant()] = value switch
                    {
                        null => null,
                        OracleClob clob => clob.Value,
                        DateTime date => date.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture),
                        IFormattable formatted => formatted.ToString(null, CultureInfo.InvariantCulture),
                        _ => value.ToString()
                    };
                }
                result.Add(row);
            }
            if (result.Count > cap) throw new KskLimitException();
            return result;
        }
        async Task<HashSet<string>> Cols(string owner, string table)
        {
            var key = owner + "." + table;
            if (!columns.TryGetValue(key, out var found))
            {
                var data = await Sql("select column_name from all_tab_columns where owner=:owner and table_name=:tableName",
                    new() { ["owner"] = owner, ["tableName"] = table });
                found = data.Select(r => r["column_name"]!).ToHashSet();
                columns[key] = found;
            }
            return found;
        }
        async Task Need(string owner, string table, params string[] required)
        {
            var found = await Cols(owner, table);
            if (required.Any(c => !found.Contains(c))) throw new KskSchemaException();
        }
        async Task<string> Fields(string owner, string table, string alias, params string[] fields)
        {
            var found = await Cols(owner, table);
            return string.Join(",", fields.Select(f => found.Contains(f.ToUpperInvariant())
                ? $"{alias}.{f} {f}" : $"cast(null as varchar2(1)) {f}"));
        }
        async Task<List<Row>> Section(string name, Func<Task<List<Row>>> read)
        {
            try
            {
                var rows = await read();
                sections[name] = true;
                return rows;
            }
            catch (Exception ex) when (ex is KskSchemaException or KskLimitException
                || ex is OracleException { Number: 942 or 904 or 1031 })
            {
                sections[name] = false;
                warnings.Add(ex is KskLimitException
                    ? $"{name}: vượt giới hạn {rowLimit} dòng; thu hẹp khoảng ngày/đợt. Không trả tổng số chưa đầy đủ."
                    : $"{name}: thiếu bảng/cột hoặc quyền đọc; dữ liệu chưa xác định.");
                return [];
            }
        }

        var cohorts = await Section("cohorts", async () =>
        {
            await Need(master, "KSKDOAN", "ID", "ID_KSK_KHACHHANG", "TEN", "NGAY", "GHICHU");
            await Need(master, "KSK_KHACHHANG", "ID", "TEN");
            if (collections) foreach (var owner in registrationMonths)
            {
                await Need(owner, "BASK_DONVI", "ID_DOAN", "MADONVI", "MABN", "MAQL");
                await Need(owner, "TIEPDON", "MAQL", "NGAY");
            }
            return await Sql($"select to_char(d.id) id, to_char(d.id_ksk_khachhang) customerid, d.ten name, k.ten customer, d.ngay \"date\", "
                + await Fields(master, "KSKDOAN", "d", "sohd", "loai", "ghichu")
                + $" from {master}.kskdoan d left join {master}.ksk_khachhang k on k.id=d.id_ksk_khachhang "
                + (collections ? $"where d.id in (select id_doan from ({registrationScope})) "
                    : "where (:cohort is not null and d.id=:cohort) or (:cohort is null and d.ngay>=:startDate and d.ngay<:endDate) ")
                + "order by d.ngay desc,d.id desc");
        });
        var members = new List<Row>(); var visits = new List<Row>(); var charges = new List<Row>();
        var clinical = new List<Row>(); var labs = new List<Row>(); var imaging = new List<Row>(); var payments = new List<Row>();
        if ((!collections && cohort.Length == 0) || !sections.GetValueOrDefault("cohorts") || cohorts.Count == 0)
        {
            if (collections && sections.GetValueOrDefault("cohorts") && cohorts.Count == 0)
                foreach (var name in new[] { "members", "visits", "charges", "payments" }) sections[name] = true;
            return Snapshot();
        }
        members = await Section("members", async () =>
        {
            await Need(master, "KSKDONVI", "ID", "IDDOAN", "TEN");
            await Need(master, "KSKBTDBN", "IDDONVI", "MABN", "HOTEN");
            return await Sql($"select to_char(g.iddoan) cohortid, to_char(b.iddonvi) groupid, g.ten groupname, b.mabn, b.hoten name, "
                + await Fields(master, "KSKBTDBN", "b", "namsinh", "manv", "bo_phan", "phai", "id_goi_kskmuc")
                + $" from {master}.kskbtdbn b join {master}.kskdonvi g on g.id=b.iddonvi "
                + (collections ? $"where exists(select 1 from ({registrationScope}) s where s.madonvi=g.id and s.id_doan=g.iddoan and s.mabn=b.mabn) " : "where g.iddoan=:cohort ")
                + "order by g.id,b.stt,b.mabn");
        });
        var months = new List<string>();
        var scanFrom = collections && collectedFrom < from ? collectedFrom.Value : from;
        var scanTo = collections && collectedTo > to ? collectedTo.Value : to;
        for (var day = new DateOnly(scanFrom.Year, scanFrom.Month, 1); day <= scanTo; day = day.AddMonths(1))
            months.Add(Identifier(prefix + day.ToString("MMyy", CultureInfo.InvariantCulture)));
        foreach (var owner in registrationMonths)
        {
            visits.AddRange(await Section("visits:" + owner, async () =>
            {
                await Need(owner, "BASK_DONVI", "MAQL", "MABN", "MADONVI", "ID_DOAN");
                await Need(owner, "TIEPDON", "MAQL", "MAVAOVIEN", "NGAY");
                return await Sql($"select distinct to_char(v.maql) maql, to_char(t.mavaovien) episodeid, "
                    + "b.mabn, to_char(b.id_doan) cohortid, to_char(b.madonvi) groupid, v.ngay \"date\", t.ngay registereddate, "
                    + await Fields(owner, "TIEPDON", "v", "makp")
                    + $" from {owner}.bask_donvi b join {owner}.tiepdon t on t.maql=b.maql and t.mabn=b.mabn "
                    + $"join {owner}.tiepdon v on v.mabn=t.mabn and (v.maql=t.maql or (t.mavaovien>0 and v.mavaovien=t.mavaovien)) "
                    + (collections ? $"where exists(select 1 from {master}.kskdoan d where d.id=b.id_doan) " : "where b.id_doan=:cohort ")
                    + "and t.ngay>=:startDate and t.ngay<:endDate");
            }));
        }
        var ids = visits.Select(v => v["maql"]!).Distinct().ToArray();
        var episodes = visits.Select(v => v["episodeid"]!).Where(v => v != "0").Distinct().ToArray();
        async Task<List<Row>> ByIds(string select, string predicate, string[] values)
        {
            var all = new List<Row>();
            foreach (var chunk in values.Chunk(200))
            {
                var parameters = chunk.Select((id, i) => new KeyValuePair<string, object>("v" + i, id)).ToDictionary();
                var placeholders = string.Join(",", parameters.Keys.Select(k => ":" + k));
                foreach (var bind in binds) parameters.Add(bind.Key, bind.Value);
                all.AddRange(await Sql(select + predicate + " in (" + placeholders + ")", parameters));
                if (all.Count > rowLimit) throw new KskLimitException();
            }
            return all;
        }
        foreach (var owner in months)
        {
            if (!collections) charges.AddRange(await Section("charges:" + owner, async () =>
            {
                await Need(owner, "V_CHIDINH", "ID", "MAQL", "MABN", "MAVAOVIEN", "MAVP", "SOLUONG", "DONGIA");
                await Need(master, "V_GIAVP", "ID", "TEN");
                return await ByIds($"select '{owner}' source, to_char(c.id) id, to_char(c.maql) maql, "
                    + "c.mabn, to_char(c.mavaovien) mavaovien, c.loai, to_char(c.idchidinh) originid, "
                    + "to_char(c.mavp) serviceid, g.ten name, c.soluong quantity, c.dongia price, c.soluong*c.dongia amount, "
                    + await Fields(owner, "V_CHIDINH", "c", "ngay", "paid", "idttrv", "madoituong")
                    + $" from {owner}.v_chidinh c left join {master}.v_giavp g on g.id=c.mavp where ", "c.maql", ids);
            }));
            // Read the ENTIRE receipt, not only its KSK lines: cross-service receipts must not
            // have a global waiver, refund or deposit silently allocated to this cohort.
            foreach (var kind in new[] { "DIRECT", "SETTLEMENT" })
                payments.AddRange(await Section("payments:" + owner + ":" + kind, async () =>
                {
                    var header = kind == "DIRECT" ? "V_VIENPHILL" : "V_TTRVLL";
                    var detail = kind == "DIRECT" ? "V_VIENPHICT" : "V_TTRVCT";
                    await Need(owner, header, "ID", "MAVAOVIEN", "QUYENSO", "SOBIENLAI", "NGAY", "YTE_TRASAU", "DAHOANTRA", "MIEN_GIAM");
                    await Need(owner, detail, "ID", "STT", "IDCHIDINH", "TABLE_X", "MAVP", "SOLUONG", "DONGIA", "VATTU", "MIEN_GIAM");
                    await Need(owner, "V_HOANTRA", "ID", "QUYENSO", "SOBIENLAI", "MABN", "SOTIEN", "NGAY");
                    await Need(owner, "V_HOANTRACT", "ID", "SOTIEN");
                    string joins, patient, amount, waiver, debt, insurance, advance;
                    if (kind == "DIRECT")
                    {
                        await Need(owner, header, "MAQL", "MABN");
                        await Need(owner, detail, "MIEN", "THIEU");
                        await Need(owner, "V_MIENNGTRU", "ID", "SOTIEN");
                        joins = ""; patient = "h.mabn";
                        amount = $"(select sum(x.soluong*x.dongia) from {owner}.{detail} x where x.id=h.id)";
                        waiver = $"nvl((select sum(x.mien) from {owner}.{detail} x where x.id=h.id),0)+nvl((select w.sotien from {owner}.v_mienngtru w where w.id=h.id),0)";
                        debt = $"nvl((select sum(x.thieu) from {owner}.{detail} x where x.id=h.id),0)";
                        insurance = "0"; advance = "0";
                    }
                    else
                    {
                        await Need(owner, "V_TTRVDS", "ID", "MAQL", "MABN");
                        await Need(owner, "V_MIENNOITRU", "ID", "MIEN_THEM");
                        await Need(owner, header, "SOTIEN", "MIEN", "THIEU", "BHYT", "TAMUNG", "CHUA_THANH_TOAN");
                        await Need(owner, "V_TAMUNG", "IDTTRV", "SOTIEN", "SOBIENLAI", "QUYENSO", "DAHOANTRA", "DASUDUNG", "MABN");
                        joins = $"join {owner}.v_ttrvds ds on ds.id=h.id"; patient = "ds.mabn";
                        amount = "h.sotien"; waiver = "nvl(h.mien,0)"; debt = "nvl(h.thieu,0)";
                        insurance = "nvl(h.bhyt,0)"; advance = "nvl(h.tamung,0)";
                    }
                    var maql = kind == "DIRECT" ? "h.maql" : "ds.maql";
                    var unsettled = kind == "DIRECT" ? "0" : "h.chua_thanh_toan";
                    var verifiedAdvance = kind == "DIRECT" ? "0" : $"(select nvl(sum(t.sotien),0) from {owner}.v_tamung t where t.idttrv=h.id and t.mabn={patient} and t.sobienlai>0 and t.dasudung=1 and nvl(t.dahoantra,0)=0 and not exists(select 1 from {owner}.v_hoantra r where r.quyenso=t.quyenso and r.sobienlai=t.sobienlai))";
                    var extraWaiver = kind == "DIRECT" ? "0" : $"nvl((select w.mien_them from {owner}.v_miennoitru w where w.id=h.id),0)";
                    var headerColumns = await Cols(owner, header);
                    var cashierColumns = await Cols(master, "V_DLOGIN");
                    var cashierNameField = cashierColumns.Contains("HOTEN") ? "HOTEN" : cashierColumns.Contains("TEN") ? "TEN" : null;
                    var cashierId = headerColumns.Contains("USERID") ? "to_char(h.userid)" : "cast(null as varchar2(1))";
                    var cashierName = headerColumns.Contains("USERID") && cashierColumns.Contains("ID") && cashierNameField is not null
                        ? $"(select u.{cashierNameField} from {master}.v_dlogin u where u.id=h.userid)" : "cast(null as varchar2(1))";
                    return await ByIds($"select '{owner}' source, '{kind}' kind, to_char(h.id) receiptid, {patient} mabn, to_char({maql}) maql, "
                        + "to_char(h.mavaovien) mavaovien, "
                        + $"{cashierId} cashierid, {cashierName} cashiername, "
                        + "h.quyenso book, h.sobienlai \"number\", h.ngay \"date\", h.yte_trasau deferred, h.dahoantra refunded, h.mien_giam headerdiscount, "
                        + $"{amount} gross, {waiver} waiver, {debt} debt, {insurance} insurance, {advance} advance, {verifiedAdvance} verifiedadvance, {unsettled} unsettled, "
                        + $"{extraWaiver} extrawaiver, "
                        + $"(select nvl(sum(x.soluong*x.dongia),0) from {owner}.{detail} x where x.id=h.id) linegross, "
                        + $"(select nvl(sum(x.vattu*x.soluong),0) from {owner}.{detail} x where x.id=h.id) supplies, "
                        + $"(select count(*) from {owner}.{detail} x where x.id=h.id) linecount, "
                        + $"(select nvl(sum(r.sotien),0) from {owner}.v_hoantra r where r.quyenso=h.quyenso and r.sobienlai=h.sobienlai) refundamount, "
                        + $"(select count(*) from {owner}.v_hoantra r where r.quyenso=h.quyenso and r.sobienlai=h.sobienlai) refundcount, "
                        + $"(select nvl(sum(rc.sotien),0) from {owner}.v_hoantra r join {owner}.v_hoantract rc on rc.id=r.id where r.quyenso=h.quyenso and r.sobienlai=h.sobienlai) refunddetailamount, "
                        + $"(select max(r.ngay) from {owner}.v_hoantra r where r.quyenso=h.quyenso and r.sobienlai=h.sobienlai) refunddate, "
                        + "to_char(d.stt) lineid, to_char(d.idchidinh) chargeid, d.table_x chargetable, to_char(d.mavp) serviceid, d.soluong linequantity, d.dongia lineprice, d.soluong*d.dongia lineamount, d.mien_giam linediscount "
                        + $"from {owner}.{header} h {joins} left join {owner}.{detail} d on d.id=h.id where "
                        + (collections ? "h.ngay>=:collectedFrom and h.ngay<:collectedTo and " : ""), maql, ids);
                }));
            if (collections) continue; // Financial report must not load unrelated clinical/CLS payloads.
            foreach (var table in new[] { "BASK_NOIKHOA", "BASK_NGKHOA", "BASK_MAT", "BASK_RHM", "BASK_TMH", "BASK_SANPHU", "BASK_TONGKET" })
                clinical.AddRange(await Section((table == "BASK_TONGKET" ? "conclusions:" : "clinical:") + owner + "." + table, async () =>
                {
                    await Need(owner, table, "MAVAOVIEN");
                    return await ByIds($"select '{table}' kind, to_char(c.mavaovien) episodeid, "
                        + await Fields(owner, table, "c", "mabs", "ketluan", "nhanxet", "phanloai", "loai_kl", "denghi",
                            "timmach", "hohap", "tieuhoa", "than", "thankinh", "tongquat", "dalieu", "mat", "tmh", "san", "phu", "khac")
                        + $" from {owner}.{table} c where ", "c.mavaovien", episodes);
                }));
        }
        if (collections)
        {
            // Collection reports need only directives named by the selected receipts, not
            // every unbilled service for all registered patients (which can exceed the cap).
            var directiveIds = payments.Select(p => p.GetValueOrDefault("chargeid")).Where(id => !string.IsNullOrEmpty(id) && id != "0")
                .Cast<string>().Distinct().ToArray();
            foreach (var owner in months)
                charges.AddRange(await Section("charges:" + owner, async () =>
                {
                    await Need(owner, "V_CHIDINH", "ID", "MAQL", "MABN", "MAVAOVIEN", "MAVP", "SOLUONG", "DONGIA");
                    await Need(master, "V_GIAVP", "ID", "TEN");
                    return await ByIds($"select '{owner}' source, to_char(c.id) id, to_char(c.maql) maql, "
                        + "c.mabn, to_char(c.mavaovien) mavaovien, c.loai, to_char(c.idchidinh) originid, "
                        + "to_char(c.mavp) serviceid, g.ten name, c.soluong quantity, c.dongia price, c.soluong*c.dongia amount, "
                        + await Fields(owner, "V_CHIDINH", "c", "ngay", "paid", "idttrv", "madoituong")
                        + $" from {owner}.v_chidinh c left join {master}.v_giavp g on g.id=c.mavp where ", "c.id", directiveIds);
                }));
            foreach (var (name, rows) in new[] { ("visits", visits), ("charges", charges), ("payments", payments) })
                if (rows.Count > rowLimit)
                {
                    rows.Clear(); sections[name + ":aggregate"] = false;
                    warnings.Add($"{name}: tổng dữ liệu vượt {rowLimit} dòng; thu hẹp ngày. Không trả dữ liệu bị cắt.");
                }
            warnings.Add("Báo cáo phiếu thu KSK: giao của khoảng ngày đăng ký và ngày thu, chỉ đọc HIS. Không gồm thu tạm ứng riêng hoặc tiền công ty trả hợp đồng.");
            warnings.Add("Phiếu hủy/hoàn, trả sau, thiếu liên kết hoặc nguồn chưa đọc đủ không tự tính là tiền đã nhận. Tối đa 20000 dòng mỗi tập dữ liệu tổng hợp; vượt giới hạn phải thu hẹp ngày.");
            return Snapshot();
        }
        labs = await Section("labs", async () =>
        {
            await Need(clsOwner, "XN_PHIEU", "ID", "MAQL");
            await Need(clsOwner, "XN_KETQUA", "ID", "ID_TEN", "KETQUA", "XOA_MAU");
            await Need(clsOwner, "XN_BV_CHITIET", "ID", "ID_TEN", "ID_BV_TEN");
            await Need(clsOwner, "XN_TEN", "ID", "TEN", "DONVI");
            await Need(clsOwner, "XN_DONVI", "ID", "TEN");
            return await ByIds("select to_char(p.id) id, to_char(p.maql) maql, to_char(r.id_ten) parameterid, "
                + "n.ten name, r.ketqua value, u.ten unit, "
                + await Fields(clsOwner, "XN_KETQUA", "r", "kq_batthuong")
                + $" from {clsOwner}.xn_phieu p join {clsOwner}.xn_ketqua r on r.id=p.id "
                + $"join {clsOwner}.xn_bv_chitiet d on d.id=r.id_ten join {clsOwner}.xn_ten n on n.id=d.id_ten "
                + $"left join {clsOwner}.xn_donvi u on u.id=n.donvi where r.xoa_mau=0 and ", "p.maql", ids);
        });
        foreach (var (table, field) in new[] { ("SA_BNCDHA_CT", "KETQUA"), ("XQ_BNCDHA_CTXQ", "KETLUAN") })
            imaging.AddRange(await Section("imaging:" + table, async () =>
            {
                await Need(clsOwner, "SA_BNCDHA", "COUNT_CDHA", "MAQL");
                await Need(clsOwner, table, "COUNT_CDHA", "MAKT", field);
                await Need(clsOwner, "SA_KTCDHA", "IDVP", "TENKT");
                return await ByIds($"select '{table}' kind, to_char(p.count_cdha) id, to_char(p.maql) maql, "
                    + $"to_char(r.makt) serviceid, k.tenkt name, r.{field} value, "
                    + await Fields(clsOwner, table, "r", "denghi")
                    + $" from {clsOwner}.sa_bncdha p join {clsOwner}.{table} r on r.count_cdha=p.count_cdha "
                    + $"left join {clsOwner}.sa_ktcdha k on k.idvp=r.makt where ", "p.maql", ids);
            }));
        warnings.Add("Phạm vi chỉ gồm lượt liên kết trong khoảng ngày chọn. Có kết quả không đồng nghĩa đủ CLS hoặc đã duyệt/ký.");
        warnings.Add("Thanh toán theo chứng từ HIS, không phải công nợ hợp đồng. Phiếu ngoài phạm vi, hủy/hoàn, miễn giảm hoặc tạm ứng chưa nối đủ sẽ là Chưa xác định. Chứng từ ngoài các tháng chọn chưa được đọc.");
        return Snapshot();

        KskSnapshot Snapshot() => new(new { from = from.ToString("yyyy-MM-dd"), to = to.ToString("yyyy-MM-dd"),
            branch = config["PatientPortal:BranchCode"] ?? "UNKNOWN", mode = "his", asof = DateTimeOffset.UtcNow.ToString("O"),
            episodePolicy = 2, collections, collectedFrom = collectedFrom?.ToString("yyyy-MM-dd"), collectedTo = collectedTo?.ToString("yyyy-MM-dd") },
            cohorts, members, visits, charges, clinical, labs, imaging, payments, sections, warnings.Distinct().ToList());
    }
    private sealed class KskSchemaException : Exception;
    private sealed class KskLimitException : Exception;
}
