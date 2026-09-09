using Dapper;
using Oracle.ManagedDataAccess.Client;
using PatientApi.Models;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace PatientApi.Repositories;

public sealed class OracleHisPatientRepository(IConfiguration configuration, ILogger<OracleHisPatientRepository> logger) : IPatientRepository
{
    private readonly string _connectionString = configuration.GetConnectionString("OracleHis")
        ?? throw new InvalidOperationException("ConnectionStrings:OracleHis is not configured.");
    private readonly string _branchCode = configuration["PatientPortal:BranchCode"]?.Trim().ToUpperInvariant() ?? "CN1";
    private readonly string _branchName = configuration["PatientPortal:BranchName"]?.Trim()
        ?? (configuration["PatientPortal:BranchCode"]?.Trim().ToUpperInvariant() == "CN3"
            ? "Phòng khám An Phú - Chi nhánh 3"
            : "Bệnh viện An Phú - Chi nhánh 1");
    private readonly string _oracleMasterSchema = NormalizeOracleIdentifier(
        configuration["PatientPortal:OracleMasterSchema"],
        "HGSOFT_BV");
    private readonly string _oracleMonthlySchemaPrefix = NormalizeOracleIdentifier(
        configuration["PatientPortal:OracleMonthlySchemaPrefix"] ?? configuration["PatientPortal:OracleSchemaPrefix"],
        NormalizeOracleIdentifier(configuration["PatientPortal:OracleMasterSchema"], "HGSOFT_BV"));
    private static readonly string[] PayerTypeColumnCandidates =
    [
        "MADOITUONG",
        "MA_DOITUONG",
        "DOITUONG",
        "DOITUONG_ID",
        "MADOITUONGBN",
        "MADOITUONG_BN",
        "MADOITUONGKCB",
        "MADOITUONG_KCB",
        "MADOITUONGVP",
        "MADOITUONG_VP",
        "MADOITUONGCLS",
        "MADOITUONG_CLS",
        "MADT"
    ];

    private sealed record VisitClinicalInfo(string DepartmentName, string DoctorName);

    public async Task<string?> FindPatientCodeByCitizenIdAsync(string citizenId, CancellationToken cancellationToken)
    {
        var sql = $"""
            select HisPatientCode
            from (
              select b.MABN as HisPatientCode
              from {_oracleMasterSchema}.BTDBN b
              left join {_oracleMasterSchema}.DIENTHOAI dt on dt.MABN = b.MABN
              where regexp_replace(nvl(b.CMND, ''), '[^0-9]', '') = :CitizenId
                 or regexp_replace(nvl(b.CMND_BN, ''), '[^0-9]', '') = :CitizenId
                 or regexp_replace(nvl(dt.CMND, ''), '[^0-9]', '') = :CitizenId
              order by b.MABN desc
            )
            where rownum = 1
            """;

        var normalizedCitizenId = NormalizeDigits(citizenId);
        if (normalizedCitizenId.Length < 9)
        {
            return null;
        }

        await using var connection = CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<string?>(new CommandDefinition(
            sql,
            new { CitizenId = normalizedCitizenId },
            cancellationToken: cancellationToken,
            commandTimeout: 20));
    }

    public async Task<PatientLoginVerificationDto?> VerifyLoginAsync(string phone, string citizenId, CancellationToken cancellationToken)
    {
        var sql = $"""
            select
              b.MABN as HisPatientCode,
              b.HOTEN as FullName,
              coalesce(dt.DIDONG, dt.NHA, dt.COQUAN) as Phone
            from {_oracleMasterSchema}.BTDBN b
            inner join {_oracleMasterSchema}.DIENTHOAI dt on dt.MABN = b.MABN
            where (
                regexp_replace(nvl(dt.DIDONG, ''), '[^0-9]', '') = :Phone
                or regexp_replace(nvl(dt.NHA, ''), '[^0-9]', '') = :Phone
                or regexp_replace(nvl(dt.COQUAN, ''), '[^0-9]', '') = :Phone
              )
              and (
                regexp_replace(nvl(b.CMND, ''), '[^0-9]', '') = :CitizenId
                or regexp_replace(nvl(b.CMND_BN, ''), '[^0-9]', '') = :CitizenId
                or regexp_replace(nvl(dt.CMND, ''), '[^0-9]', '') = :CitizenId
              )
            order by b.MABN desc
            """;

        var normalizedPhone = NormalizeDigits(phone);
        var normalizedCitizenId = NormalizeDigits(citizenId);

        if (normalizedPhone.Length < 9 || normalizedCitizenId.Length < 9)
        {
            return null;
        }

        await using var connection = CreateConnection();
        var rows = (await connection.QueryAsync(new CommandDefinition(
            sql,
            new { Phone = normalizedPhone, CitizenId = normalizedCitizenId },
            cancellationToken: cancellationToken,
            commandTimeout: 20))).ToList();

        if (rows.Count == 0)
        {
            return null;
        }

        var profiles = rows
            .Select(row => new PatientLinkedProfileDto(
                HisPatientCode: Convert.ToString(row.HISPATIENTCODE) ?? string.Empty,
                BranchCode: _branchCode,
                BranchName: _branchName,
                FullName: Convert.ToString(row.FULLNAME) ?? string.Empty,
                Relationship: "Liên quan"))
            .Where(profile => !string.IsNullOrWhiteSpace(profile.HisPatientCode))
            .GroupBy(profile => profile.HisPatientCode)
            .Select(group => group.First())
            .ToList();

        if (profiles.Count == 0)
        {
            return null;
        }

        var primary = profiles[0] with { Relationship = "Bản thân" };
        profiles[0] = primary;

        return new PatientLoginVerificationDto(
            HisPatientCode: primary.HisPatientCode,
            FullName: primary.FullName,
            Phone: Convert.ToString(rows[0].PHONE) ?? normalizedPhone,
            Profiles: profiles);
    }

    public async Task<PatientLoginVerificationDto?> VerifyLinkedProfileAsync(string hisPatientCode, string phone, string citizenId, DateOnly birthDate, CancellationToken cancellationToken)
    {
        var sql = $"""
            select
              b.MABN as HisPatientCode,
              b.HOTEN as FullName,
              coalesce(dt.DIDONG, dt.NHA, dt.COQUAN) as Phone
            from {_oracleMasterSchema}.BTDBN b
            inner join {_oracleMasterSchema}.DIENTHOAI dt on dt.MABN = b.MABN
            where b.MABN = :HisPatientCode
              and trunc(b.NGAYSINH) = :BirthDate
              and (
                regexp_replace(nvl(dt.DIDONG, ''), '[^0-9]', '') = :Phone
                or regexp_replace(nvl(dt.NHA, ''), '[^0-9]', '') = :Phone
                or regexp_replace(nvl(dt.COQUAN, ''), '[^0-9]', '') = :Phone
              )
              and (:SkipCitizenId = 1 or (
                regexp_replace(nvl(b.CMND, ''), '[^0-9]', '') = :CitizenId
                or regexp_replace(nvl(b.CMND_BN, ''), '[^0-9]', '') = :CitizenId
                or regexp_replace(nvl(dt.CMND, ''), '[^0-9]', '') = :CitizenId
              ))
              and rownum = 1
            """;

        var normalizedPhone = NormalizeDigits(phone);
        var normalizedCitizenId = NormalizeDigits(citizenId);
        var normalizedMabn = hisPatientCode.Trim();

        if (normalizedMabn.Length == 0 || normalizedPhone.Length < 9)
        {
            return null;
        }

        await using var connection = CreateConnection();
        var row = await connection.QuerySingleOrDefaultAsync(new CommandDefinition(
            sql,
            new
            {
                HisPatientCode = normalizedMabn,
                Phone = normalizedPhone,
                CitizenId = normalizedCitizenId,
                SkipCitizenId = normalizedCitizenId.Length == 0 ? 1 : 0,
                BirthDate = birthDate.ToDateTime(TimeOnly.MinValue)
            },
            cancellationToken: cancellationToken,
            commandTimeout: 20));

        if (row is null)
        {
            return null;
        }

        var profile = new PatientLinkedProfileDto(
            HisPatientCode: Convert.ToString(row.HISPATIENTCODE) ?? normalizedMabn,
            BranchCode: _branchCode,
            BranchName: _branchName,
            FullName: Convert.ToString(row.FULLNAME) ?? string.Empty,
            Relationship: "Người thân");

        return new PatientLoginVerificationDto(
            HisPatientCode: profile.HisPatientCode,
            FullName: profile.FullName,
            Phone: Convert.ToString(row.PHONE) ?? normalizedPhone,
            Profiles: new[] { profile });
    }

    public async Task<PatientDto?> GetPatientAsync(string hisPatientCode, CancellationToken cancellationToken)
    {
        var sql = $"""
            select
              b.MABN as HisPatientCode,
              b.HOTEN as FullName,
              b.NGAYSINH as BirthDate,
              b.PHAI as Gender,
              coalesce(
                cast(dt.DIDONG as varchar2(50)),
                cast(dt.NHA as varchar2(50)),
                cast(dt.COQUAN as varchar2(50))
              ) as Phone,
              b.DIACHI_HIENTAI as Address,
              coalesce(
                cast(b.CMND as varchar2(50)),
                cast(b.CMND_BN as varchar2(50)),
                cast(dt.CMND as varchar2(50))
              ) as CitizenId,
              cast(null as date) as CitizenIssueDate
            from {_oracleMasterSchema}.BTDBN b
            left join {_oracleMasterSchema}.DIENTHOAI dt on dt.MABN = b.MABN
            where b.MABN = :HisPatientCode
              and rownum = 1
            """;

        var insuranceSql = $"""
            select
              coalesce(
                cast(kcb_bh.MA_THE_BHYT as varchar2(50)),
                cast(bh.SOTHE as varchar2(50))
              ) as CardNumber,
              case
                when kcb_bh.GT_THE_TU is not null then cast(kcb_bh.GT_THE_TU as varchar2(30))
                else cast(bh.TUNGAY as varchar2(30))
              end as ValidFrom,
              case
                when kcb_bh.GT_THE_DEN is not null then cast(kcb_bh.GT_THE_DEN as varchar2(30))
                else cast(bh.DENNGAY as varchar2(30))
              end as ValidTo
            from (select :HisPatientCode as MABN from dual) p
            left join {_oracleMasterSchema}.BHYT bh on bh.MABN = p.MABN
            left join (
              select MABN, MA_THE_BHYT, GT_THE_TU, GT_THE_DEN
              from (
                select
                  MABN,
                  MA_THE_BHYT,
                  GT_THE_TU,
                  GT_THE_DEN,
                  row_number() over (
                    partition by MABN
                    order by NGAY_TIEPDON desc nulls last, MAVAOVIEN desc nulls last
                  ) as rn
                from {_oracleMasterSchema}.THEODOI_KCB
                where MA_THE_BHYT is not null
              )
              where rn = 1
            ) kcb_bh on kcb_bh.MABN = p.MABN
            where rownum = 1
            """;

        await using var connection = CreateConnection();
        var row = await connection.QuerySingleOrDefaultAsync(sql, new { HisPatientCode = hisPatientCode });

        if (row is null)
        {
            return null;
        }

        string patientCode = Convert.ToString(row.HISPATIENTCODE) ?? hisPatientCode;
        string patientId = $"his-{patientCode}";

        InsuranceCardDto insurance;
        try
        {
            var insuranceRow = await connection.QuerySingleOrDefaultAsync(new CommandDefinition(
                insuranceSql,
                new { HisPatientCode = patientCode },
                cancellationToken: cancellationToken,
                commandTimeout: 20));

            var cardNumber = Convert.ToString(insuranceRow?.CARDNUMBER) ?? string.Empty;
            var validFrom = ToDateOnlyOrDefault(insuranceRow?.VALIDFROM);
            var validTo = ToDateOnlyOrDefault(insuranceRow?.VALIDTO);

            insurance = new InsuranceCardDto(
                Id: $"ins-{cardNumber}",
                PatientId: patientId,
                CardNumber: cardNumber,
                BenefitCode: DeriveBenefitCode(cardNumber),
                RegisteredClinic: "Bệnh viện Đa khoa An Phú",
                ValidFrom: validFrom,
                ValidTo: validTo,
                Status: validTo >= DateOnly.FromDateTime(DateTime.UtcNow) ? "Còn hiệu lực" : "Hết hiệu lực");
        }
        catch (OracleException exception) when (exception.Number is 1481 or 12704)
        {
            insurance = new InsuranceCardDto(
                Id: $"ins-{patientCode}",
                PatientId: patientId,
                CardNumber: string.Empty,
                BenefitCode: string.Empty,
                RegisteredClinic: "Bệnh viện Đa khoa An Phú",
                ValidFrom: DateOnly.MinValue,
                ValidTo: DateOnly.MinValue,
                Status: "Chưa ghi nhận");
        }

        return new PatientDto(
            Id: patientId,
            HisPatientCode: patientCode,
            FullName: row.FULLNAME ?? string.Empty,
            BirthDate: ToDateOnlyOrDefault(row.BIRTHDATE),
            Gender: MapGender(row.GENDER),
            Phone: row.PHONE ?? string.Empty,
            Address: row.ADDRESS ?? string.Empty,
            Insurance: insurance,
            CitizenId: row.CITIZENID ?? string.Empty,
            CitizenIssueDate: null);
    }

    public async Task<PatientSummaryDto> GetSummaryAsync(string hisPatientCode, CancellationToken cancellationToken)
    {
        await using var connection = CreateConnection();

        var visitsSql = $"select count(*) from {_oracleMasterSchema}.THEODOI_KCB where MABN = :HisPatientCode";
        var visitsCount = Convert.ToInt32(await connection.ExecuteScalarAsync(visitsSql, new { HisPatientCode = hisPatientCode }));

        var labSql = $"""
            select count(*)
            from {_oracleMasterSchema}.XN_PHIEU
            where MABN = :HisPatientCode
            """;

        var imagingSql = $"""
            select count(*)
            from {_oracleMasterSchema}.SA_BNCDHA
            where MABN = :HisPatientCode
              and NGAYCDHA is not null
            """;

        var labResultsCount = Convert.ToInt32(await connection.ExecuteScalarAsync(labSql, new { HisPatientCode = hisPatientCode }));
        var imagingResultsCount = Convert.ToInt32(await connection.ExecuteScalarAsync(imagingSql, new { HisPatientCode = hisPatientCode }));
        var prescriptionsCount = (await GetPrescriptionsAsync(hisPatientCode, cancellationToken)).Count;
        var appointmentsCount = (await GetAppointmentsAsync(hisPatientCode, cancellationToken)).Count;

        return new PatientSummaryDto(
            VisitsCount: visitsCount,
            LabResultsCount: labResultsCount,
            ImagingResultsCount: imagingResultsCount,
            PrescriptionsCount: prescriptionsCount,
            AppointmentsCount: appointmentsCount);
    }

    public async Task<IReadOnlyList<VisitDto>> GetVisitsAsync(string hisPatientCode, CancellationToken cancellationToken)
    {
        var sql = $"""
            select
              kcb.MAVAOVIEN as Id,
              kcb.MAVAOVIEN as HisVisitId,
              kcb.NGAY_TIEPDON as VisitDate,
              N'Tiếp đón/KCB' as DepartmentName,
              null as DoctorName,
              kcb.MA_BENH_CHINH as PrimaryIcd,
              kcb.CHAN_DOAN_RV as DiagnosisOut,
              kcb.MA_BENH_KT as SecondaryIcd,
              kcb.CHANDOAN_CHITIET as DiagnosisDetail,
              kcb.LY_DO_VV as Reason,
              coalesce(kcb.GHI_CHU, kcb.PP_DIEU_TRI, kcb.LY_DO_VNT) as Notes
            from {_oracleMasterSchema}.THEODOI_KCB kcb
            where kcb.MABN = :HisPatientCode
            order by kcb.NGAY_TIEPDON desc
            """;

        await using var connection = CreateConnection();
        var rows = await connection.QueryAsync(sql, new { HisPatientCode = hisPatientCode });
        var materializedRows = rows.ToList();
        if (materializedRows.Count == 0)
        {
            return await GetVisitsFromClinicalOrdersAsync(connection, hisPatientCode, cancellationToken);
        }

        var visitIds = materializedRows
            .Select(row => Convert.ToString(row.ID) ?? string.Empty)
            .Where(id => id.Length > 0)
            .Cast<string>()
            .ToList();
        var schemas = await GetPatientVisitMonthlySchemasAsync(connection, hisPatientCode);
        var dispositions = await GetVisitDispositionsAsync(connection, schemas, hisPatientCode, visitIds);
        var clinicalInfo = await GetVisitClinicalInfoAsync(connection, schemas, hisPatientCode, visitIds);

        return materializedRows.Select(row =>
        {
            string visitId = Convert.ToString(row.ID) ?? string.Empty;
            clinicalInfo.TryGetValue(visitId, out var info);

            return new VisitDto(
            Id: visitId,
            PatientId: $"his-{hisPatientCode}",
            HisVisitId: Convert.ToString(row.HISVISITID) ?? string.Empty,
            VisitDate: ToDateTimeOffsetOrDefault(row.VISITDATE),
            DepartmentName: FirstNonEmpty(info?.DepartmentName, row.DEPARTMENTNAME),
            DoctorName: FirstNonEmpty(info?.DoctorName, row.DOCTORNAME),
            Status: GetDispositionStatus(dispositions, visitId),
            PrimaryDiagnosis: BuildPrimaryDischargeDiagnosis(row.PRIMARYICD, row.DIAGNOSISOUT, row.DIAGNOSISDETAIL, row.REASON),
            SecondaryDiagnosis: BuildSecondaryDiagnosis(row.DIAGNOSISOUT, row.SECONDARYICD),
            Notes: Convert.ToString(row.NOTES) ?? string.Empty);
        }).ToList();
    }

    private async Task<IReadOnlyList<VisitDto>> GetVisitsFromClinicalOrdersAsync(
        OracleConnection connection,
        string hisPatientCode,
        CancellationToken cancellationToken)
    {
        var visits = new List<VisitDto>();
        var schemas = await GetPatientClinicalMonthlySchemasAsync(connection, hisPatientCode);

        foreach (var schema in schemas)
        {
            var performedAtExpression = await BuildPerformedAtExpressionAsync(connection, schema, cancellationToken);
            if (performedAtExpression == "null")
            {
                continue;
            }

            var sql = $"""
                select
                  coalesce(to_char(cd.MAVAOVIEN), to_char(cd.MAQL), to_char(cd.ID)) as Id,
                  coalesce(to_char(cd.MAVAOVIEN), to_char(cd.MAQL), to_char(cd.ID)) as HisVisitId,
                  min({performedAtExpression}) as VisitDate,
                  max(kp.TENKP) as DepartmentName,
                  max(bs.HOTEN) as DoctorName,
                  max(coalesce(cd.TENVP_CHITIET, vp.TEN)) as ServiceName
                from {schema}.V_CHIDINH cd
                left join {_oracleMasterSchema}.V_GIAVP vp on vp.ID = cd.MAVP
                left join {_oracleMasterSchema}.BTDKP_BV kp on kp.MAKP = cd.MAKP
                left join {_oracleMasterSchema}.DMBS bs on bs.MA = cd.MABS
                where cd.MABN = :HisPatientCode
                  and {performedAtExpression} is not null
                group by coalesce(to_char(cd.MAVAOVIEN), to_char(cd.MAQL), to_char(cd.ID))
                order by min({performedAtExpression}) desc
                """;

            try
            {
                var rows = await connection.QueryAsync(
                    new CommandDefinition(
                        sql,
                        new { HisPatientCode = hisPatientCode },
                        cancellationToken: cancellationToken,
                        commandTimeout: 30));

                visits.AddRange(rows.Select(row =>
                {
                    var visitId = Convert.ToString(row.ID) ?? string.Empty;

                    return new VisitDto(
                        visitId,
                        $"his-{hisPatientCode}",
                        Convert.ToString(row.HISVISITID) ?? visitId,
                        ToDateTimeOffsetOrDefault(row.VISITDATE, visitId),
                        FirstNonEmpty(row.DEPARTMENTNAME, "Cận lâm sàng"),
                        FirstNonEmpty(row.DOCTORNAME),
                        "Đã khám",
                        FirstNonEmpty(row.SERVICENAME, "Có dữ liệu cận lâm sàng"),
                        string.Empty,
                        "Lần khám được tổng hợp từ dữ liệu cận lâm sàng HIS.");
                }));
            }
            catch (OracleException exception) when (IsMissingMonthlySchema(exception) || IsMissingColumnOrTable(exception))
            {
                continue;
            }
        }

        return visits
            .Where(visit => visit.VisitDate > DateTimeOffset.MinValue)
            .GroupBy(visit => visit.Id)
            .Select(group => group.First())
            .OrderByDescending(visit => visit.VisitDate)
            .ToList();
    }
    public async Task<VisitDetailDto?> GetVisitDetailAsync(string hisPatientCode, string visitId, CancellationToken cancellationToken)
    {
        var sql = $"""
            select
              kcb.MAVAOVIEN as Id,
              kcb.MAVAOVIEN as HisVisitId,
              kcb.NGAY_TIEPDON as VisitDate,
              kcb.NGAY_XUATVIEN as DischargeDate,
              kcb.NGAY_THANHTOAN as PaidDate,
              N'Tiếp đón/KCB' as DepartmentName,
              null as DoctorName,
              kcb.LY_DO_VV as Reason,
              kcb.LY_DO_VNT as ReasonReferral,
              kcb.CAN_NANG as Weight,
              kcb.CHIEU_CAO as Height,
              kcb.CHAN_DOAN_VAO as DiagnosisIn,
              kcb.CHAN_DOAN_RV as DiagnosisOut,
              kcb.CHANDOAN_CHITIET as DiagnosisDetail,
              kcb.MA_BENH_CHINH as PrimaryIcd,
              kcb.MA_BENH_KT as SecondaryIcd,
              kcb.PP_DIEU_TRI as TreatmentMethod,
              kcb.GHI_CHU as Note,
              kcb.NGAY_TAI_KHAM as FollowUpDateText,
              null as PrimaryDiagnosis
            from {_oracleMasterSchema}.THEODOI_KCB kcb
            where kcb.MABN = :HisPatientCode
              and to_char(kcb.MAVAOVIEN) = :VisitId
              and rownum = 1
            """;

        await using var connection = CreateConnection();
        var row = await connection.QuerySingleOrDefaultAsync(sql, new { HisPatientCode = hisPatientCode, VisitId = visitId });

        if (row is null)
        {
            return null;
        }

        var visitDate = ToDateTimeOffsetOrDefault(row.VISITDATE);
        var visit = new VisitDto(
            Id: Convert.ToString(row.ID) ?? string.Empty,
            PatientId: $"his-{hisPatientCode}",
            HisVisitId: Convert.ToString(row.HISVISITID) ?? string.Empty,
            VisitDate: visitDate,
            DepartmentName: Convert.ToString(row.DEPARTMENTNAME) ?? string.Empty,
            DoctorName: Convert.ToString(row.DOCTORNAME) ?? string.Empty,
            Status: Convert.ToString(row.STATUS) ?? string.Empty,
            PrimaryDiagnosis: BuildPrimaryDischargeDiagnosis(row.PRIMARYICD, row.DIAGNOSISOUT, row.DIAGNOSISDETAIL, row.REASON),
            SecondaryDiagnosis: BuildSecondaryDiagnosis(row.DIAGNOSISOUT, row.SECONDARYICD),
            Notes: BuildVisitNotes(row));

        var diagnoses = BuildDiagnoses(visit.Id, row);
        var weight = ParseDecimal(row.WEIGHT);
        var height = ParseDecimal(row.HEIGHT);
        var vitalSigns = new VitalSignsDto(string.Empty, 0, 0, weight, height, CalculateBmi(weight, height));
        var startDate = ToNullableDateTime(row.VISITDATE) ?? DateTime.Now;
        var endDate = ToNullableDateTime(row.DISCHARGEDATE) ?? ToNullableDateTime(row.PAIDDATE) ?? startDate;
        var schemas = GetMonthlySchemasForPeriod(startDate, endDate);
        var dispositions = await GetVisitDispositionsAsync(connection, schemas, hisPatientCode, new[] { visit.Id });
        visit = visit with { Status = GetDispositionStatus(dispositions, visit.Id) };
        var clinicalInfo = await GetVisitClinicalInfoAsync(connection, schemas, hisPatientCode, new[] { visit.Id });
        if (clinicalInfo.TryGetValue(visit.Id, out VisitClinicalInfo info))
        {
            visit = visit with
            {
                DepartmentName = FirstNonEmpty(info.DepartmentName, visit.DepartmentName),
                DoctorName = FirstNonEmpty(info.DoctorName, visit.DoctorName),
            };
        }
        var services = await GetVisitServicesAsync(connection, schemas, hisPatientCode, visit.Id);
        var prescription = await GetVisitPrescriptionAsync(connection, schemas, hisPatientCode, visit.Id, visit.VisitDate, visit.DoctorName);
        var labResults = (await GetLabResultsAsync(hisPatientCode, cancellationToken)).Where(result => result.VisitId == visit.Id).ToList();
        var imagingResults = (await GetImagingResultsAsync(hisPatientCode, cancellationToken)).Where(result => result.VisitId == visit.Id).ToList();

        return new VisitDetailDto(
            visit.Id,
            visit.PatientId,
            visit.HisVisitId,
            visit.VisitDate,
            visit.DepartmentName,
            visit.DoctorName,
            visit.Status,
            visit.PrimaryDiagnosis,
            visit.SecondaryDiagnosis,
            visit.Notes,
            diagnoses,
            vitalSigns,
            services,
            prescription,
            labResults,
            imagingResults,
            FirstNonEmpty(row.TREATMENTMETHOD, row.NOTE, row.REASONREFERRAL),
            ParseFollowUpDate(row.FOLLOWUPDATETEXT));
    }

    public async Task<IReadOnlyList<LabResultDto>> GetLabResultsAsync(string hisPatientCode, CancellationToken cancellationToken, string? visitId = null)
    {
        var results = new List<LabResultDto>();
        await using var connection = CreateConnection();
        var schemas = !string.IsNullOrWhiteSpace(visitId)
            ? await GetPatientVisitMonthlySchemasAsync(connection, hisPatientCode)
            : await GetPatientMonthlySchemasAsync(connection, "XN_PHIEU", "NGAY", hisPatientCode);

        foreach (var schema in schemas)
        {
            var procedureIdColumn = await SchemaHasColumnAsync(connection, schema, "V_CHIDINH", "ID_THUCHIEN", cancellationToken)
                ? "cd.ID_THUCHIEN"
                : "cd.THUCHIEN";
            var performedAtExpression = await BuildPerformedAtExpressionAsync(connection, schema, cancellationToken);

            var sql = $"""
                select
                  to_char(cd.ID) || '-' || to_char(kq.ID_TEN) as Id,
                  coalesce(to_char(cd.MAVAOVIEN), to_char(cd.MAQL), to_char(cd.ID)) as VisitId,
                  vp.TEN as ServiceName,
                  tenxn.TEN as TestName,
                  kq.KETQUA as Result,
                  dv.TEN as Unit,
                  case when bn.PHAI = 0 then tenxn.CSBT_NAM else tenxn.CSBT_NU end as ReferenceRange,
                  {performedAtExpression} as PerformedAt,
                  kq.KQ_BATTHUONG as Abnormal,
                  kq.KQ_BATTHUONG_THAP_CAO as LowHigh
                from {schema}.v_chidinh cd
                inner join {_oracleMasterSchema}.BTDBN bn on bn.MABN = cd.MABN
                left join {_oracleMasterSchema}.V_GIAVP vp on vp.ID = cd.MAVP
                inner join {_oracleMasterSchema}.XN_PHIEU p on {procedureIdColumn} = p.ID
                inner join {_oracleMasterSchema}.XN_KETQUA kq on {procedureIdColumn} = kq.ID and cd.ID = kq.IDCHIDINH
                left join {_oracleMasterSchema}.XN_BV_CHITIET xnct on kq.ID_TEN = xnct.ID
                left join {_oracleMasterSchema}.XN_TEN tenxn on tenxn.ID = coalesce(xnct.ID_TEN, kq.ID_TEN)
                left join {_oracleMasterSchema}.XN_DONVI dv on dv.ID = tenxn.DONVI
                where cd.MABN = :HisPatientCode
                  and kq.KETQUA is not null
                  and (:VisitId is null or to_char(cd.MAVAOVIEN) = :VisitId)
                order by {performedAtExpression} desc, tenxn.STT
                """;

            try
            {
                var rows = await connection.QueryAsync(sql, new { HisPatientCode = hisPatientCode, VisitId = visitId });
                results.AddRange(rows.Select(row => new LabResultDto(
                    Id: Convert.ToString(row.ID) ?? string.Empty,
                    VisitId: Convert.ToString(row.VISITID) ?? string.Empty,
                    ServiceName: Convert.ToString(row.SERVICENAME) ?? "Xét nghiệm",
                    TestName: Convert.ToString(row.TESTNAME) ?? string.Empty,
                    Result: Convert.ToString(row.RESULT) ?? string.Empty,
                    Unit: Convert.ToString(row.UNIT) ?? string.Empty,
                    ReferenceRange: Convert.ToString(row.REFERENCERANGE) ?? string.Empty,
                    PerformedAt: ToDateTimeOffsetOrDefault(row.PERFORMEDAT),
                    Flag: MapLabFlag(row.ABNORMAL, row.LOWHIGH))));
            }
            catch (OracleException exception) when (IsMissingMonthlySchema(exception))
            {
                continue;
            }
        }

        return results.OrderByDescending(result => result.PerformedAt).ToList();
    }

    public async Task<IReadOnlyList<ImagingResultDto>> GetImagingResultsAsync(string hisPatientCode, CancellationToken cancellationToken)
    {
        var results = new List<ImagingResultDto>();
        await using var connection = CreateConnection();
        var schemas = await GetPatientMonthlySchemasAsync(connection, "SA_BNCDHA", "NGAYCDHA", hisPatientCode);

        foreach (var schema in schemas)
        {
            var procedureIdColumn = await SchemaHasColumnAsync(connection, schema, "V_CHIDINH", "ID_THUCHIEN", cancellationToken)
                ? "cd.ID_THUCHIEN"
                : "cd.THUCHIEN";
            var performedDoctorColumn = await SchemaHasColumnAsync(connection, schema, "V_CHIDINH", "MABS_THUCHIEN", cancellationToken)
                ? "cd.MABS_THUCHIEN"
                : "cd.MABS";
            var performedAtExpression = await BuildPerformedAtExpressionAsync(connection, schema, cancellationToken);
            var performedAtFilter = performedAtExpression == "null" ? "and 1 = 0" : $"and {performedAtExpression} is not null";

            var sql = $"""
                select
                  to_char(cd.ID) as Id,
                  coalesce(to_char(cd.MAVAOVIEN), to_char(cd.MAQL), to_char(cd.ID)) as VisitId,
                  {performedAtExpression} as PerformedAt,
                  vp.TEN as TechniqueName,
                  bs_cls.HOTEN as DoctorName,
                  sam.MOTA as SaDescription,
                  sam.KETQUA as SaConclusion,
                  xq.KETQUA as XqDescription,
                  xq.KETQUA1 as XqDescriptionExtra,
                  xq.KETQUA2 as XqDescription2,
                  xq.KETQUA3 as XqDescription3,
                  xq.KETQUA4 as XqDescription4,
                  xq.KETQUA5 as XqDescription5,
                  xq.KETLUAN as XqConclusion
                from {schema}.v_chidinh cd
                inner join {_oracleMasterSchema}.V_GIAVP vp on vp.ID = cd.MAVP
                left join {_oracleMasterSchema}.V_LOAIVP loaivp on loaivp.ID = vp.ID_LOAI
                left join {_oracleMasterSchema}.DMBS bs_cls on bs_cls.MA = {performedDoctorColumn}
                left join {_oracleMasterSchema}.SA_BNCDHA sa on sa.COUNT_CDHA = {procedureIdColumn}
                left join {_oracleMasterSchema}.SA_BNCDHA_CT sam on sam.COUNT_CDHA = {procedureIdColumn}
                left join {_oracleMasterSchema}.XQ_BNCDHA_CTXQ xq on xq.COUNT_CDHA = coalesce(sa.COUNT_CDHA, {procedureIdColumn})
                where cd.MABN = :HisPatientCode
                  and loaivp.ID_NHOM in (5, 22)
                  {performedAtFilter}
                order by {performedAtExpression} desc
                """;

            try
            {
                var rows = await connection.QueryAsync(sql, new { HisPatientCode = hisPatientCode });
                results.AddRange(rows.Select(row =>
                {
                    var description = CleanRtf(MergeText(row.SADESCRIPTION, row.XQDESCRIPTION, row.XQDESCRIPTIONEXTRA, row.XQDESCRIPTION2, row.XQDESCRIPTION3, row.XQDESCRIPTION4, row.XQDESCRIPTION5));
                    var conclusion = CleanRtf(MergeText(row.SACONCLUSION, row.XQCONCLUSION));

                    return new ImagingResultDto(
                        Id: Convert.ToString(row.ID) ?? string.Empty,
                        VisitId: Convert.ToString(row.VISITID) ?? string.Empty,
                        Date: ToDateTimeOffsetOrDefault(row.PERFORMEDAT),
                        TechniqueName: Convert.ToString(row.TECHNIQUENAME) ?? "Chẩn đoán hình ảnh",
                        DoctorName: Convert.ToString(row.DOCTORNAME) ?? string.Empty,
                        Description: description,
                        Conclusion: conclusion);
                }));
            }
            catch (OracleException exception) when (IsMissingMonthlySchema(exception))
            {
                continue;
            }
        }

        return results.OrderByDescending(result => result.Date).ToList();
    }

    public async Task<IReadOnlyList<PrescriptionDto>> GetPrescriptionsAsync(string hisPatientCode, CancellationToken cancellationToken)
    {
        var rows = new List<dynamic>();
        await using var connection = CreateConnection();
        var schemas = await GetPatientVisitMonthlySchemasAsync(connection, hisPatientCode);

        foreach (var schema in schemas)
        {
            var sql = $"""
                select
                  to_char(ll.ID) as PrescriptionId,
                  coalesce(to_char(ll.MAVAOVIEN), to_char(ll.MAQL), to_char(ll.ID)) as VisitId,
                  ll.NGAY as PrescribedAt,
                  bs.HOTEN as DoctorName,
                  to_char(ct.ID) || '-' || to_char(ct.STT) || '-' || to_char(ct.MABD) as ItemId,
                  bd.TEN as MedicineName,
                  coalesce(bd.TENHC, bd.GENERIC) as ActiveIngredient,
                  bd.HAMLUONG as Strength,
                  bd.DUONGDUNG as Route,
                  to_char(coalesce(ct.SLTHUC, ct.SLYEUCAU)) as Quantity,
                  coalesce(ct.CACHDUNG, ct.CACHDUNG_0) as Dosage,
                  coalesce(dt.DOITUONG, case coalesce(ct.MADOITUONG, ll.MADOITUONG) when 1 then N'BHYT' when 2 then N'Dịch vụ' end) as PayerType
                from {schema}.D_THUOCBHYTLL ll
                inner join {schema}.D_THUOCBHYTCT ct on ct.ID = ll.ID
                left join {_oracleMasterSchema}.D_DMBD bd on bd.ID = ct.MABD
                left join {_oracleMasterSchema}.DMBS bs on bs.MA = ll.MABS
                left join {_oracleMasterSchema}.DOITUONG dt on dt.MADOITUONG = coalesce(ct.MADOITUONG, ll.MADOITUONG)
                where ll.MABN = :HisPatientCode
                order by ll.NGAY desc, ll.ID, ct.STT
                """;

            try
            {
                rows.AddRange(await connection.QueryAsync(sql, new { HisPatientCode = hisPatientCode }));
            }
            catch (OracleException exception) when (IsMissingMonthlySchema(exception) || IsMissingColumnOrTable(exception))
            {
                continue;
            }
        }

        return rows
            .GroupBy(row => Convert.ToString(row.PRESCRIPTIONID) ?? string.Empty)
            .Where(group => !string.IsNullOrWhiteSpace(group.Key))
            .Select(group =>
            {
                var first = group.First();
                var prescriptionId = Convert.ToString(first.PRESCRIPTIONID) ?? string.Empty;
                var payerType = FirstNonEmpty(group.Select(row => row.PAYERTYPE).ToArray());

                return new PrescriptionDto(
                    Id: prescriptionId,
                    VisitId: Convert.ToString(first.VISITID) ?? string.Empty,
                    PrescribedAt: ToDateTimeOffsetOrDefault(first.PRESCRIBEDAT, prescriptionId),
                    DoctorName: Convert.ToString(first.DOCTORNAME) ?? string.Empty,
                    PayerType: payerType,
                    Items: group
                        .Select((row, index) =>
                        {
                            var dosage = Convert.ToString(row.DOSAGE) ?? string.Empty;
                            return new PrescriptionItemDto(
                                Id: Convert.ToString(row.ITEMID) ?? $"{prescriptionId}-{index + 1}",
                                MedicineName: Convert.ToString(row.MEDICINENAME) ?? string.Empty,
                                ActiveIngredient: Convert.ToString(row.ACTIVEINGREDIENT) ?? string.Empty,
                                Strength: Convert.ToString(row.STRENGTH) ?? string.Empty,
                                Route: Convert.ToString(row.ROUTE) ?? string.Empty,
                                Quantity: Convert.ToString(row.QUANTITY) ?? string.Empty,
                                Dosage: dosage,
                                Instruction: dosage,
                                PayerType: Convert.ToString(row.PAYERTYPE) ?? payerType);
                        })
                        .GroupBy(item => item.Id)
                        .Select(itemGroup => itemGroup.First())
                        .ToList());
            })
            .OrderByDescending(prescription => prescription.PrescribedAt)
            .ToList();
    }

    public async Task<InsuranceCardDto?> GetInsuranceAsync(string hisPatientCode, CancellationToken cancellationToken) =>
        (await GetPatientAsync(hisPatientCode, cancellationToken))?.Insurance;

    public async Task<IReadOnlyList<AppointmentDto>> GetAppointmentsAsync(string hisPatientCode, CancellationToken cancellationToken)
    {
        await using var connection = CreateConnection();
        var schemas = await GetPatientVisitMonthlySchemasAsync(connection, hisPatientCode);
        var appointments = new List<AppointmentDto>();

        foreach (var schema in schemas)
        {
            var sql = $"""
                select
                  to_char(coalesce(ba.HEN_MAQL, ba.MAQL)) as Id,
                  ba.HEN_NGAY as AppointmentDate,
                  kp.TENKP as DepartmentName,
                  bs.HOTEN as DoctorName,
                  h.SONGAY as DayCount,
                  h.GHICHU as AppointmentNote,
                  ba.CHANDOAN as Diagnosis,
                  ba.CHANDOAN_BANDAU as InitialDiagnosis,
                  ba.CHANDOAN_CHITIET as DiagnosisDetail
                from {schema}.BENHANDT ba
                left join {schema}.HEN h on h.MAQL = ba.HEN_MAQL
                left join {_oracleMasterSchema}.BTDKP_BV kp on kp.MAKP = coalesce(h.MAKP, ba.MAKP)
                left join {_oracleMasterSchema}.DMBS bs on bs.MA = ba.MABS
                where ba.MABN = :HisPatientCode
                  and ba.HEN_NGAY is not null
                  and ba.HEN_NGAY > date '1900-01-01'
                order by ba.HEN_NGAY desc, ba.MAQL desc
                """;

            try
            {
                var rows = await connection.QueryAsync(sql, new { HisPatientCode = hisPatientCode });

                appointments.AddRange(rows.Select(row =>
                {
                    var id = Convert.ToString(row.ID) ?? string.Empty;
                    return new AppointmentDto(
                        Id: string.IsNullOrWhiteSpace(id) ? $"{schema}-appointment-{appointments.Count + 1}" : id,
                        PatientId: $"his-{hisPatientCode}",
                        AppointmentDate: ToDateTimeOffsetOrDefault(row.APPOINTMENTDATE),
                        DepartmentName: FirstNonEmpty(row.DEPARTMENTNAME, "Chưa ghi nhận phòng khám"),
                        DoctorName: FirstNonEmpty(row.DOCTORNAME),
                        Content: BuildAppointmentContent(row));
                }));
            }
            catch (OracleException exception) when (IsMissingMonthlySchema(exception) || IsMissingColumnOrTable(exception))
            {
                continue;
            }
        }

        return appointments
            .Where(appointment => appointment.AppointmentDate > DateTimeOffset.MinValue)
            .GroupBy(appointment => new { appointment.Id, appointment.AppointmentDate })
            .Select(group => group.First())
            .OrderByDescending(appointment => appointment.AppointmentDate)
            .ToList();
    }

    public async Task<IReadOnlyList<RegistrationDto>> GetRegistrationsAsync(string hisPatientCode, CancellationToken cancellationToken)
    {
        await using var connection = CreateConnection();
        var schemas = await GetPatientVisitMonthlySchemasAsync(connection, hisPatientCode);
        schemas = schemas.Concat(await GetPatientClinicalMonthlySchemasAsync(connection, hisPatientCode)).Distinct().ToList();
        schemas = GetRegistrationCandidateSchemas().Concat(schemas).Distinct().ToList();

        var registrations = new List<RegistrationDto>();

        foreach (var schema in schemas)
        {
            var payerTypeColumn = await FindFirstExistingColumnAsync(connection, schema, "TIEPDON", cancellationToken, PayerTypeColumnCandidates);
            var payerTypeSelect = string.IsNullOrWhiteSpace(payerTypeColumn)
                ? "null as PayerTypeCode, null as PayerTypeName"
                : $"to_char(td.{payerTypeColumn}) as PayerTypeCode, {PayerTypeNameSqlExpression("td", payerTypeColumn, "dt")} as PayerTypeName";
            var payerTypeJoin = string.IsNullOrWhiteSpace(payerTypeColumn)
                ? string.Empty
                : $"left join {_oracleMasterSchema}.DOITUONG dt on dt.MADOITUONG = td.{payerTypeColumn}";
            var hasDoctorColumn = await SchemaHasColumnAsync(connection, schema, "TIEPDON", "MABS", cancellationToken);
            var hasReasonColumn = await SchemaHasColumnAsync(connection, schema, "TIEPDON", "LY_DO_VV", cancellationToken);
            var hasNotesColumn = await SchemaHasColumnAsync(connection, schema, "TIEPDON", "GHICHU", cancellationToken);
            var hasVisitIdColumn = await SchemaHasColumnAsync(connection, schema, "TIEPDON", "MAVAOVIEN", cancellationToken);
            var hasTicketColumn = await SchemaHasColumnAsync(connection, schema, "TIEPDON", "STT_KHAM", cancellationToken);
            var hasDepartmentColumn = await SchemaHasColumnAsync(connection, schema, "TIEPDON", "MAKP", cancellationToken);
            var hasDoneColumn = await SchemaHasColumnAsync(connection, schema, "TIEPDON", "DONE", cancellationToken);
            var visitIdSelect = hasVisitIdColumn ? "to_char(td.MAVAOVIEN) as VisitId" : "to_char(td.MAQL) as VisitId";
            var ticketSelect = hasTicketColumn ? "to_char(td.STT_KHAM) as TicketNumber" : "null as TicketNumber";
            var departmentCodeSelect = hasDepartmentColumn ? "to_char(td.MAKP) as DepartmentCode" : "null as DepartmentCode";
            var departmentNameSelect = hasDepartmentColumn ? "kp.TENKP as DepartmentName" : "null as DepartmentName";
            var departmentJoin = hasDepartmentColumn ? $"left join {_oracleMasterSchema}.BTDKP_BV kp on kp.MAKP = td.MAKP" : string.Empty;
            var doneSelect = hasDoneColumn ? "td.DONE as DoneStatus" : "null as DoneStatus";
            var doctorSelect = hasDoctorColumn ? "bs.HOTEN as DoctorName" : "null as DoctorName";
            var doctorJoin = hasDoctorColumn ? $"left join {_oracleMasterSchema}.DMBS bs on bs.MA = td.MABS" : string.Empty;
            var reasonSelect = hasReasonColumn ? "td.LY_DO_VV as Reason" : "null as Reason";
            var notesSelect = hasNotesColumn ? "td.GHICHU as Notes" : "null as Notes";

            var sql = $"""
                select
                  to_char(td.MAQL) as Id,
                  {visitIdSelect},
                  td.NGAY as RegisteredAt,
                  {ticketSelect},
                  {departmentCodeSelect},
                  {departmentNameSelect},
                  {doctorSelect},
                  {doneSelect},
                  {reasonSelect},
                  {notesSelect},
                  {payerTypeSelect}
                from {schema}.TIEPDON td
                {departmentJoin}
                {doctorJoin}
                {payerTypeJoin}
                where td.MABN = :HisPatientCode
                order by td.NGAY desc, td.MAQL desc
                """;

            try
            {
                var rows = await connection.QueryAsync(sql, new { HisPatientCode = hisPatientCode });
                foreach (var row in rows)
                {
                    registrations.Add(MapRegistration(row, hisPatientCode));
                }
            }
            catch (OracleException exception) when (IsMissingMonthlySchema(exception) || IsMissingColumnOrTable(exception))
            {
                continue;
            }
        }

        if (registrations.Count > 0)
        {
            registrations = (await EnrichRegistrationsWithClinicalInfoAsync(connection, schemas, hisPatientCode, registrations, cancellationToken)).ToList();
        }

        return registrations
            .Where(registration => registration.RegisteredAt > DateTimeOffset.MinValue)
            .GroupBy(registration => registration.Id)
            .Select(group => group.First())
            .OrderByDescending(registration => registration.RegisteredAt)
            .ToList();
    }

    private async Task<IReadOnlyList<RegistrationDto>> EnrichRegistrationsWithClinicalInfoAsync(
        OracleConnection connection,
        IReadOnlyList<string> schemas,
        string hisPatientCode,
        IReadOnlyList<RegistrationDto> registrations,
        CancellationToken cancellationToken)
    {
        var genericRegistrations = registrations
            .Where(registration => IsGenericRegistrationDepartment(registration.DepartmentName) || string.IsNullOrWhiteSpace(registration.DoctorName))
            .ToList();

        if (genericRegistrations.Count == 0)
        {
            return registrations;
        }

        var visitIds = genericRegistrations
            .Select(registration => registration.VisitId)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct()
            .ToList();
        var infoByVisit = await GetVisitClinicalInfoFromOrdersAsync(connection, schemas, hisPatientCode, visitIds, cancellationToken);

        if (infoByVisit.Count == 0)
        {
            return registrations;
        }

        return registrations
            .Select(registration =>
            {
                if (!infoByVisit.TryGetValue(registration.VisitId, out var info))
                {
                    return registration;
                }

                return registration with
                {
                    DepartmentName = IsGenericRegistrationDepartment(registration.DepartmentName)
                        ? FirstNonEmpty(info.DepartmentName, registration.DepartmentName)
                        : registration.DepartmentName,
                    DoctorName = FirstNonEmpty(registration.DoctorName, info.DoctorName)
                };
            })
            .ToList();
    }

    private IReadOnlyList<string> GetRegistrationCandidateSchemas()
    {
        return Enumerable
            .Range(-2, 6)
            .Select(offset => $"{_oracleMonthlySchemaPrefix}{DateTime.Now.AddMonths(offset):MMyy}")
            .ToList();
    }

    public async Task<TodayVisitStatusDto> GetTodayVisitStatusAsync(string hisPatientCode, CancellationToken cancellationToken)
    {
        await using var connection = CreateConnection();
        var today = DateTime.Today;
        var tomorrow = today.AddDays(1);
        var schema = $"{_oracleMonthlySchemaPrefix}{today:MMyy}";

        RegistrationDto? registration = null;
        var services = new List<ActiveServiceDto>();
        var registrationPayerTypeColumn = await FindFirstExistingColumnAsync(connection, schema, "TIEPDON", cancellationToken, PayerTypeColumnCandidates);
        var registrationPayerTypeSelect = string.IsNullOrWhiteSpace(registrationPayerTypeColumn)
            ? "null as PayerTypeCode, null as PayerTypeName"
            : $"to_char(td.{registrationPayerTypeColumn}) as PayerTypeCode, {PayerTypeNameSqlExpression("td", registrationPayerTypeColumn, "dt")} as PayerTypeName";
        var registrationPayerTypeJoin = string.IsNullOrWhiteSpace(registrationPayerTypeColumn)
            ? string.Empty
            : $"left join {_oracleMasterSchema}.DOITUONG dt on dt.MADOITUONG = td.{registrationPayerTypeColumn}";
        var registrationHasDoctorColumn = await SchemaHasColumnAsync(connection, schema, "TIEPDON", "MABS", cancellationToken);
        var registrationHasReasonColumn = await SchemaHasColumnAsync(connection, schema, "TIEPDON", "LY_DO_VV", cancellationToken);
        var registrationHasNotesColumn = await SchemaHasColumnAsync(connection, schema, "TIEPDON", "GHICHU", cancellationToken);
        var registrationHasVisitIdColumn = await SchemaHasColumnAsync(connection, schema, "TIEPDON", "MAVAOVIEN", cancellationToken);
        var registrationHasTicketColumn = await SchemaHasColumnAsync(connection, schema, "TIEPDON", "STT_KHAM", cancellationToken);
        var registrationHasDepartmentColumn = await SchemaHasColumnAsync(connection, schema, "TIEPDON", "MAKP", cancellationToken);
        var registrationHasDoneColumn = await SchemaHasColumnAsync(connection, schema, "TIEPDON", "DONE", cancellationToken);
        var registrationVisitIdSelect = registrationHasVisitIdColumn ? "to_char(td.MAVAOVIEN) as VisitId" : "to_char(td.MAQL) as VisitId";
        var registrationTicketSelect = registrationHasTicketColumn ? "to_char(td.STT_KHAM) as TicketNumber" : "null as TicketNumber";
        var registrationDepartmentCodeSelect = registrationHasDepartmentColumn ? "to_char(td.MAKP) as DepartmentCode" : "null as DepartmentCode";
        var registrationDepartmentNameSelect = registrationHasDepartmentColumn ? "kp.TENKP as DepartmentName" : "null as DepartmentName";
        var registrationDepartmentJoin = registrationHasDepartmentColumn ? $"left join {_oracleMasterSchema}.BTDKP_BV kp on kp.MAKP = td.MAKP" : string.Empty;
        var registrationDoctorSelect = registrationHasDoctorColumn ? "bs.HOTEN as DoctorName" : "null as DoctorName";
        var registrationDoctorJoin = registrationHasDoctorColumn ? $"left join {_oracleMasterSchema}.DMBS bs on bs.MA = td.MABS" : string.Empty;
        var registrationDoneSelect = registrationHasDoneColumn ? "td.DONE as DoneStatus" : "null as DoneStatus";
        var registrationReasonSelect = registrationHasReasonColumn ? "td.LY_DO_VV as Reason" : "null as Reason";
        var registrationNotesSelect = registrationHasNotesColumn ? "td.GHICHU as Notes" : "null as Notes";

        var registrationSql = $"""
            select *
            from (
              select
                to_char(td.MAQL) as Id,
                {registrationVisitIdSelect},
                td.NGAY as RegisteredAt,
                {registrationTicketSelect},
                {registrationDepartmentCodeSelect},
                {registrationDepartmentNameSelect},
                {registrationDoctorSelect},
                {registrationDoneSelect},
                {registrationReasonSelect},
                {registrationNotesSelect},
                {registrationPayerTypeSelect}
              from {schema}.TIEPDON td
              {registrationDepartmentJoin}
              {registrationDoctorJoin}
              {registrationPayerTypeJoin}
              where td.MABN = :HisPatientCode
                and td.NGAY >= :Today
                and td.NGAY < :Tomorrow
              order by td.NGAY desc, td.MAQL desc
            )
            where rownum = 1
            """;

        try
        {
            var row = await connection.QuerySingleOrDefaultAsync(registrationSql, new { HisPatientCode = hisPatientCode, Today = today, Tomorrow = tomorrow });
            registration = row is null ? null : MapRegistration(row, hisPatientCode);
        }
        catch (OracleException exception) when (IsMissingMonthlySchema(exception) || IsMissingColumnOrTable(exception))
        {
            logger.LogWarning(
                exception,
                "Skipping today registration from schema {Schema} for patient {HisPatientCode} because Oracle returned ORA-{OracleErrorNumber}.",
                schema,
                hisPatientCode,
                exception.Number);
            registration = null;
        }

        var servicePayerTypeColumn = await FindFirstExistingColumnAsync(connection, schema, "V_CHIDINH", cancellationToken, PayerTypeColumnCandidates);
        var servicePayerTypeSelect = string.IsNullOrWhiteSpace(servicePayerTypeColumn)
            ? "null as PayerTypeCode, null as PayerTypeName"
            : $"to_char(cd.{servicePayerTypeColumn}) as PayerTypeCode, {PayerTypeNameSqlExpression("cd", servicePayerTypeColumn, "dt_cls")} as PayerTypeName";
        var servicePayerTypeJoin = string.IsNullOrWhiteSpace(servicePayerTypeColumn)
            ? string.Empty
            : $"left join {_oracleMasterSchema}.DOITUONG dt_cls on dt_cls.MADOITUONG = cd.{servicePayerTypeColumn}";

        var servicesSql = $"""
            select
              to_char(cd.ID) as Id,
              to_char(coalesce(cd.MAVAOVIEN, cd.MAQL)) as VisitId,
              cd.NGAY_YL as OrderedAt,
              cd.NGAY_TH_YL as StartedAt,
              cd.NGAY_KQ as ResultAt,
              kp.TENKP as DepartmentName,
              coalesce(cd.TENVP_CHITIET, vp.TEN) as ServiceName,
              lvp.TEN as ServiceGroup,
              vp.ID_LOAI as ServiceGroupId,
              {servicePayerTypeSelect}
            from {schema}.V_CHIDINH cd
            left join {_oracleMasterSchema}.V_GIAVP vp on vp.ID = cd.MAVP
            left join {_oracleMasterSchema}.V_LOAIVP lvp on lvp.ID = vp.ID_LOAI
            left join {_oracleMasterSchema}.BTDKP_BV kp on kp.MAKP = cd.MAKP
            {servicePayerTypeJoin}
            where cd.MABN = :HisPatientCode
              and cd.NGAYUD >= :Today
              and cd.NGAYUD < :Tomorrow
              and cd.NGAY_YL is not null
              and (vp.ID_LOAI is null or vp.ID_LOAI <> 1)
            order by cd.NGAY_YL desc, cd.ID desc
            """;

        try
        {
            var rows = await connection.QueryAsync(servicesSql, new { HisPatientCode = hisPatientCode, Today = today, Tomorrow = tomorrow });
            foreach (var row in rows)
            {
                services.Add(MapActiveService(row));
            }
        }
        catch (OracleException exception) when (IsMissingMonthlySchema(exception) || IsMissingColumnOrTable(exception))
        {
            services.Clear();
        }

        var hasActiveVisit =
            registration is not null && (registration.Status != "Đã khám" || services.Any(service => service.Status != "Đã có kết quả"))
            || registration is null && services.Count > 0;
        var currentStep = GetTodayVisitStep(registration, services);
        var queueStatus = registration is null
            ? null
            : await GetClinicQueueStatusAsync(connection, schema, registration, cancellationToken);

        return new TodayVisitStatusDto(
            HasActiveVisit: hasActiveVisit,
            CurrentStep: currentStep.Code,
            CurrentStepText: currentStep.Text,
            Registration: registration,
            Services: services,
            QueueStatus: queueStatus);
    }

    private async Task<ClinicQueueStatusDto?> GetClinicQueueStatusAsync(
        OracleConnection connection,
        string schema,
        RegistrationDto registration,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(registration.DepartmentCode) ||
            !int.TryParse(registration.TicketNumber, NumberStyles.Integer, CultureInfo.InvariantCulture, out var patientTicket))
        {
            return null;
        }

        var today = DateTime.Today;
        var tomorrow = today.AddDays(1);
        const int minutesPerTicket = 5;

        var sql = $"""
            select
              max(case when td.DONE is not null then td.STT_KHAM end) as CurrentTicketNumber,
              count(case when td.STT_KHAM < :PatientTicket and td.DONE is null then 1 end) as WaitingAhead,
              max(td.NGAYUD) as UpdatedAt
            from {schema}.TIEPDON td
            where td.NGAY >= :Today
              and td.NGAY < :Tomorrow
              and td.MAKP = :DepartmentCode
              and td.STT_KHAM is not null
            """;

        try
        {
            var row = await connection.QuerySingleOrDefaultAsync(
                new CommandDefinition(
                    sql,
                    new
                    {
                        Today = today,
                        Tomorrow = tomorrow,
                        DepartmentCode = registration.DepartmentCode,
                        PatientTicket = patientTicket
                    },
                    cancellationToken: cancellationToken,
                    commandTimeout: 30));

            if (row is null)
            {
                return null;
            }

            int? currentTicket = ToNullableInt(row.CURRENTTICKETNUMBER);
            var waitingAhead = Math.Max(0, ToNullableInt(row.WAITINGAHEAD) ?? 0);
            int? estimatedMinutes = null;
            string estimatedText;

            if (currentTicket.HasValue && currentTicket.Value >= patientTicket && registration.Status != "Đã khám")
            {
                estimatedText = "Có thể đã qua số, vui lòng liên hệ quầy hoặc phòng khám.";
            }
            else if (waitingAhead == 0)
            {
                estimatedMinutes = 0;
                estimatedText = "Sắp tới lượt, anh/chị vui lòng ở gần phòng khám.";
            }
            else
            {
                estimatedMinutes = waitingAhead * minutesPerTicket;
                estimatedText = $"Còn khoảng {waitingAhead} lượt, dự kiến {estimatedMinutes} phút.";
            }

            return new ClinicQueueStatusDto(
                DepartmentCode: registration.DepartmentCode,
                DepartmentName: registration.DepartmentName,
                PatientTicketNumber: registration.TicketNumber,
                CurrentTicketNumber: currentTicket?.ToString(CultureInfo.InvariantCulture) ?? string.Empty,
                WaitingAhead: waitingAhead,
                EstimatedMinutes: estimatedMinutes,
                EstimatedText: estimatedText,
                UpdatedAt: ToDateTimeOffsetOrDefault(row.UPDATEDAT, registration.Id).ToString("O", CultureInfo.InvariantCulture),
                Source: "HIS TIEPDON.DONE/STT_KHAM",
                BranchCode: _branchCode,
                BranchName: _branchName);
        }
        catch (OracleException exception) when (IsMissingMonthlySchema(exception) || IsMissingColumnOrTable(exception))
        {
            return null;
        }
    }

    private async Task<IReadOnlyList<ServiceDto>> GetVisitServicesAsync(OracleConnection connection, IReadOnlyList<string> schemas, string hisPatientCode, string visitId)
    {
        var services = new List<ServiceDto>();

        foreach (var schema in schemas)
        {
            var sql = $"""
                select
                  to_char(cd.ID) as Id,
                  coalesce(to_char(cd.MAVAOVIEN), to_char(cd.MAQL), to_char(cd.ID)) as VisitId,
                  vp.TEN as ServiceName,
                  coalesce(cd.NGAY_KQ, cd.NGAY_TH_YL, cd.NGAY_YL) as PerformedAt,
                  case
                    when cd.NGAY_KQ is not null then N'Có kết quả'
                    when cd.NGAY_TH_YL is not null then N'Đã thực hiện'
                    else N'Đã chỉ định'
                  end as Status
                from {schema}.V_CHIDINH cd
                left join {_oracleMasterSchema}.V_GIAVP vp on vp.ID = cd.MAVP
                where cd.MABN = :HisPatientCode
                  and to_char(cd.MAVAOVIEN) = :VisitId
                order by coalesce(cd.NGAY_KQ, cd.NGAY_TH_YL, cd.NGAY_YL) desc
                """;

            try
            {
                var rows = await connection.QueryAsync(sql, new { HisPatientCode = hisPatientCode, VisitId = visitId });
                services.AddRange(rows.Select(row => new ServiceDto(
                    Id: Convert.ToString(row.ID) ?? string.Empty,
                    VisitId: Convert.ToString(row.VISITID) ?? string.Empty,
                    ServiceName: Convert.ToString(row.SERVICENAME) ?? "Dịch vụ",
                    PerformedAt: ToDateTimeOffsetOrDefault(row.PERFORMEDAT, Convert.ToString(row.ID)),
                    Status: Convert.ToString(row.STATUS) ?? string.Empty)));
            }
            catch (OracleException exception) when (IsMissingMonthlySchema(exception))
            {
                continue;
            }
        }

        return services
            .GroupBy(service => service.Id)
            .Select(group => group.First())
            .OrderByDescending(service => service.PerformedAt)
            .ToList();
    }

    private async Task<PrescriptionDto?> GetVisitPrescriptionAsync(OracleConnection connection, IReadOnlyList<string> schemas, string hisPatientCode, string visitId, DateTimeOffset fallbackDate, string doctorName)
    {
        var items = new List<PrescriptionItemDto>();
        DateTimeOffset? prescribedAt = null;
        string prescribedDoctorName = string.Empty;

        foreach (var schema in schemas)
        {
            var sql = $"""
                select
                  to_char(ll.ID) as PrescriptionId,
                  ll.NGAY as PrescribedAt,
                  to_char(ct.ID) || '-' || to_char(ct.STT) || '-' || to_char(ct.MABD) as ItemId,
                  bs.HOTEN as DoctorName,
                  bd.TEN as MedicineName,
                  coalesce(bd.TENHC, bd.GENERIC) as ActiveIngredient,
                  bd.HAMLUONG as Strength,
                  bd.DUONGDUNG as Route,
                  to_char(coalesce(ct.SLTHUC, ct.SLYEUCAU)) as Quantity,
                  coalesce(ct.CACHDUNG, ct.CACHDUNG_0) as Dosage,
                  coalesce(dt.DOITUONG, case coalesce(ct.MADOITUONG, ll.MADOITUONG) when 1 then N'BHYT' when 2 then N'Dịch vụ' end) as PayerType
                from {schema}.D_THUOCBHYTLL ll
                inner join {schema}.D_THUOCBHYTCT ct on ct.ID = ll.ID
                left join {_oracleMasterSchema}.D_DMBD bd on bd.ID = ct.MABD
                left join {_oracleMasterSchema}.DMBS bs on bs.MA = ll.MABS
                left join {_oracleMasterSchema}.DOITUONG dt on dt.MADOITUONG = coalesce(ct.MADOITUONG, ll.MADOITUONG)
                where ll.MABN = :HisPatientCode
                  and to_char(ll.MAVAOVIEN) = :VisitId
                order by ll.NGAY desc, ct.STT
                """;

            try
            {
                var rows = await connection.QueryAsync(sql, new { HisPatientCode = hisPatientCode, VisitId = visitId });

                foreach (var row in rows)
                {
                    prescribedAt ??= ToDateTimeOffsetOrDefault(row.PRESCRIBEDAT);
                    prescribedDoctorName = FirstNonEmpty(prescribedDoctorName, row.DOCTORNAME);
                    var dosage = Convert.ToString(row.DOSAGE) ?? string.Empty;
                    items.Add(new PrescriptionItemDto(
                        Id: Convert.ToString(row.ITEMID) ?? $"{visitId}-{items.Count + 1}",
                        MedicineName: Convert.ToString(row.MEDICINENAME) ?? string.Empty,
                        ActiveIngredient: Convert.ToString(row.ACTIVEINGREDIENT) ?? string.Empty,
                        Strength: Convert.ToString(row.STRENGTH) ?? string.Empty,
                        Route: Convert.ToString(row.ROUTE) ?? string.Empty,
                        Quantity: Convert.ToString(row.QUANTITY) ?? string.Empty,
                        Dosage: dosage,
                        Instruction: dosage,
                        PayerType: Convert.ToString(row.PAYERTYPE) ?? string.Empty));
                }
            }
            catch (OracleException exception) when (IsMissingMonthlySchema(exception) || IsMissingColumnOrTable(exception))
            {
                continue;
            }
        }

        if (items.Count == 0)
        {
            return null;
        }

        return new PrescriptionDto(
            Id: $"rx-{visitId}",
            VisitId: visitId,
            PrescribedAt: prescribedAt ?? fallbackDate,
            DoctorName: FirstNonEmpty(prescribedDoctorName, doctorName),
            PayerType: string.Join(", ", items.Select(item => item.PayerType).Where(value => !string.IsNullOrWhiteSpace(value)).Distinct()),
            Items: items
                .GroupBy(item => item.Id)
                .Select(group => group.First())
                .ToList());
    }

    private OracleConnection CreateConnection() => new(_connectionString);

    private async Task<IReadOnlyDictionary<string, string>> GetVisitDispositionsAsync(OracleConnection connection, IReadOnlyList<string> schemas, string hisPatientCode, IReadOnlyList<string> visitIds)
    {
        var numericVisitIds = visitIds
            .Select(id => decimal.TryParse(id, NumberStyles.Integer, CultureInfo.InvariantCulture, out var value) ? value : (decimal?)null)
            .Where(value => value.HasValue)
            .Select(value => value!.Value)
            .Distinct()
            .ToList();

        if (numericVisitIds.Count == 0)
        {
            return new Dictionary<string, string>();
        }

        var dispositions = new Dictionary<string, string>();

        foreach (var schema in schemas)
        {
            var sql = $"""
                select VisitId, listagg(Ten, ', ') within group (order by Ma) as Status
                from (
                  select distinct
                    to_char(ba.MAVAOVIEN) as VisitId,
                    dm.MA as Ma,
                    dm.TEN as Ten
                  from {schema}.BENHANDT ba
                  join {schema}.XUTRIKBct ct on ct.MAQL = ba.MAQL
                  join {_oracleMasterSchema}.XUTRIKB dm
                    on regexp_like(
                      ',' || replace(replace(ct.XUTRI, ';', ','), ' ', '') || ',',
                      ',0*' || to_char(dm.MA) || ','
                    )
                  where ba.MABN = :HisPatientCode
                    and ba.MAVAOVIEN in :VisitIds
                    and ct.XUTRI is not null
                )
                group by VisitId
                """;

            try
            {
                var rows = await connection.QueryAsync(sql, new { HisPatientCode = hisPatientCode, VisitIds = numericVisitIds });

                foreach (var row in rows)
                {
                    string visitId = Convert.ToString(row.VISITID) ?? string.Empty;
                    string status = Convert.ToString(row.STATUS) ?? string.Empty;

                    if (!string.IsNullOrWhiteSpace(visitId) && !string.IsNullOrWhiteSpace(status))
                    {
                        dispositions[visitId] = status;
                    }
                }
            }
            catch (OracleException exception) when (IsMissingMonthlySchema(exception) || IsMissingColumnOrTable(exception))
            {
                continue;
            }
        }

        return dispositions;
    }

    private static string GetDispositionStatus(IReadOnlyDictionary<string, string> dispositions, string visitId) =>
        dispositions.TryGetValue(visitId, out var status) ? status : "Chưa có xử trí";

    private async Task<IReadOnlyDictionary<string, VisitClinicalInfo>> GetVisitClinicalInfoAsync(OracleConnection connection, IReadOnlyList<string> schemas, string hisPatientCode, IReadOnlyList<string> visitIds)
    {
        var numericVisitIds = visitIds
            .Select(id => decimal.TryParse(id, NumberStyles.Integer, CultureInfo.InvariantCulture, out var value) ? value : (decimal?)null)
            .Where(value => value.HasValue)
            .Select(value => value!.Value)
            .Distinct()
            .ToList();

        if (numericVisitIds.Count == 0)
        {
            return new Dictionary<string, VisitClinicalInfo>();
        }

        var infoByVisit = new Dictionary<string, VisitClinicalInfo>();

        foreach (var schema in schemas)
        {
            var sql = $"""
                select VisitId, DepartmentName, DoctorName
                from (
                  select
                    to_char(ba.MAVAOVIEN) as VisitId,
                    kp.TENKP as DepartmentName,
                    bs.HOTEN as DoctorName,
                    row_number() over (
                      partition by ba.MAVAOVIEN
                      order by ba.NGAY desc nulls last, ba.MAQL desc nulls last
                    ) as rn
                  from {schema}.BENHANDT ba
                  left join {_oracleMasterSchema}.BTDKP_BV kp on kp.MAKP = ba.MAKP
                  left join {_oracleMasterSchema}.DMBS bs on bs.MA = ba.MABS
                  where ba.MABN = :HisPatientCode
                    and ba.MAVAOVIEN in :VisitIds
                )
                where rn = 1
                """;

            try
            {
                var rows = await connection.QueryAsync(sql, new { HisPatientCode = hisPatientCode, VisitIds = numericVisitIds });

                foreach (var row in rows)
                {
                    string visitId = Convert.ToString(row.VISITID) ?? string.Empty;

                    if (string.IsNullOrWhiteSpace(visitId))
                    {
                        continue;
                    }

                    infoByVisit[visitId] = new VisitClinicalInfo(
                        Convert.ToString(row.DEPARTMENTNAME) ?? string.Empty,
                        Convert.ToString(row.DOCTORNAME) ?? string.Empty);
                }
            }
            catch (OracleException exception) when (IsMissingMonthlySchema(exception) || IsMissingColumnOrTable(exception))
            {
                continue;
            }
        }

        return infoByVisit;
    }

    private async Task<IReadOnlyDictionary<string, VisitClinicalInfo>> GetVisitClinicalInfoFromOrdersAsync(
        OracleConnection connection,
        IReadOnlyList<string> schemas,
        string hisPatientCode,
        IReadOnlyList<string> visitIds,
        CancellationToken cancellationToken)
    {
        var numericVisitIds = visitIds
            .Select(id => decimal.TryParse(id, NumberStyles.Integer, CultureInfo.InvariantCulture, out var value) ? value : (decimal?)null)
            .Where(value => value.HasValue)
            .Select(value => value!.Value)
            .Distinct()
            .ToList();

        if (numericVisitIds.Count == 0)
        {
            return new Dictionary<string, VisitClinicalInfo>();
        }

        var infoByVisit = new Dictionary<string, VisitClinicalInfo>();

        foreach (var schema in schemas)
        {
            var performedAtExpression = await BuildPerformedAtExpressionAsync(connection, schema, cancellationToken);
            if (performedAtExpression == "null")
            {
                continue;
            }

            var sql = $"""
                select VisitId, DepartmentName, DoctorName
                from (
                  select
                    to_char(coalesce(cd.MAVAOVIEN, cd.MAQL)) as VisitId,
                    kp.TENKP as DepartmentName,
                    bs.HOTEN as DoctorName,
                    row_number() over (
                      partition by coalesce(cd.MAVAOVIEN, cd.MAQL)
                      order by {performedAtExpression} asc nulls last, cd.ID asc nulls last
                    ) as rn
                  from {schema}.V_CHIDINH cd
                  left join {_oracleMasterSchema}.BTDKP_BV kp on kp.MAKP = cd.MAKP
                  left join {_oracleMasterSchema}.DMBS bs on bs.MA = cd.MABS
                  where cd.MABN = :HisPatientCode
                    and coalesce(cd.MAVAOVIEN, cd.MAQL) in :VisitIds
                )
                where rn = 1
                """;

            try
            {
                var rows = await connection.QueryAsync(
                    new CommandDefinition(
                        sql,
                        new { HisPatientCode = hisPatientCode, VisitIds = numericVisitIds },
                        cancellationToken: cancellationToken,
                        commandTimeout: 30));

                foreach (var row in rows)
                {
                    string visitId = Convert.ToString(row.VISITID) ?? string.Empty;

                    if (string.IsNullOrWhiteSpace(visitId) || infoByVisit.ContainsKey(visitId))
                    {
                        continue;
                    }

                    infoByVisit[visitId] = new VisitClinicalInfo(
                        Convert.ToString(row.DEPARTMENTNAME) ?? string.Empty,
                        Convert.ToString(row.DOCTORNAME) ?? string.Empty);
                }
            }
            catch (OracleException exception) when (IsMissingMonthlySchema(exception) || IsMissingColumnOrTable(exception))
            {
                continue;
            }
        }

        return infoByVisit;
    }

    private async Task<IReadOnlyList<string>> GetPatientMonthlySchemasAsync(OracleConnection connection, string tableName, string dateColumn, string hisPatientCode)
    {
        var sql = $"""
            select month_code
            from (
              select distinct
                to_char({dateColumn}, 'MMYY') as month_code,
                trunc({dateColumn}, 'MM') as month_start
              from {tableName}
              where MABN = :HisPatientCode
                and {dateColumn} is not null
            )
            order by month_start desc
            """;

        var rows = await connection.QueryAsync<string>(sql, new { HisPatientCode = hisPatientCode });
        return rows.Select(monthCode => $"{_oracleMonthlySchemaPrefix}{monthCode}").ToList();
    }

    private async Task<IReadOnlyList<string>> GetPatientClinicalMonthlySchemasAsync(OracleConnection connection, string hisPatientCode)
    {
        var labSchemas = await GetPatientMonthlySchemasAsync(connection, "XN_PHIEU", "NGAY", hisPatientCode);
        var imagingSchemas = await GetPatientMonthlySchemasAsync(connection, "SA_BNCDHA", "NGAYCDHA", hisPatientCode);
        return labSchemas.Concat(imagingSchemas).Distinct().ToList();
    }

    private static async Task<bool> SchemaHasColumnAsync(OracleConnection connection, string schema, string tableName, string columnName, CancellationToken cancellationToken)
    {
        const string sql = """
            select count(*)
            from all_tab_columns
            where owner = :Owner
              and table_name = :TableName
              and column_name = :ColumnName
            """;

        var count = await connection.ExecuteScalarAsync<int>(
            new CommandDefinition(
                sql,
                new
                {
                    Owner = schema.ToUpperInvariant(),
                    TableName = tableName.ToUpperInvariant(),
                    ColumnName = columnName.ToUpperInvariant()
                },
                cancellationToken: cancellationToken,
                commandTimeout: 10));
        return count > 0;
    }

    private static async Task<string> FindFirstExistingColumnAsync(
        OracleConnection connection,
        string schema,
        string tableName,
        CancellationToken cancellationToken,
        params string[] columnNames)
    {
        foreach (var columnName in columnNames)
        {
            if (await SchemaHasColumnAsync(connection, schema, tableName, columnName, cancellationToken))
            {
                return columnName;
            }
        }

        return string.Empty;
    }

    private static async Task<string> BuildPerformedAtExpressionAsync(OracleConnection connection, string schema, CancellationToken cancellationToken)
    {
        var hasResultDate = await SchemaHasColumnAsync(connection, schema, "V_CHIDINH", "NGAY_KQ", cancellationToken);
        var hasOrderDate = await SchemaHasColumnAsync(connection, schema, "V_CHIDINH", "NGAY_YL", cancellationToken);

        return (hasResultDate, hasOrderDate) switch
        {
            (true, true) => "coalesce(cd.NGAY_KQ, cd.NGAY_YL)",
            (true, false) => "cd.NGAY_KQ",
            (false, true) => "cd.NGAY_YL",
            _ => "null"
        };
    }

    private async Task<IReadOnlyList<string>> GetPatientVisitMonthlySchemasAsync(OracleConnection connection, string hisPatientCode)
    {
        var sql = $"""
            select month_code
            from (
              select distinct
                to_char(NGAY_TIEPDON, 'MMYY') as month_code,
                trunc(NGAY_TIEPDON, 'MM') as month_start
              from {_oracleMasterSchema}.THEODOI_KCB
              where MABN = :HisPatientCode
                and NGAY_TIEPDON is not null
            )
            order by month_start desc
            """;

        var rows = await connection.QueryAsync<string>(sql, new { HisPatientCode = hisPatientCode });
        return rows.Select(monthCode => $"{_oracleMonthlySchemaPrefix}{monthCode}").ToList();
    }

    private IReadOnlyList<string> GetMonthlySchemasForPeriod(DateTime startDate, DateTime endDate)
    {
        if (endDate < startDate)
        {
            endDate = startDate;
        }

        var schemas = new List<string>();
        var current = new DateTime(startDate.Year, startDate.Month, 1);
        var last = new DateTime(endDate.Year, endDate.Month, 1);

        while (current <= last)
        {
            schemas.Add($"{_oracleMonthlySchemaPrefix}{current:MMyy}");
            current = current.AddMonths(1);
        }

        schemas.Reverse();
        return schemas;
    }

    private static bool IsMissingMonthlySchema(OracleException exception) =>
        exception.Number is 942 or 4043;

    private static bool IsMissingColumnOrTable(OracleException exception) =>
        exception.Number is 904 or 942 or 4043;

    private static DateOnly ToDateOnlyOrDefault(object? value)
    {
        if (value is DateTime dateTime)
        {
            return DateOnly.FromDateTime(dateTime);
        }

        var text = Convert.ToString(value)?.Trim();

        if (string.IsNullOrWhiteSpace(text))
        {
            return DateOnly.MinValue;
        }

        string[] formats = ["yyyyMMdd", "yyyy-MM-dd", "dd/MM/yyyy", "d/M/yyyy"];

        return DateTime.TryParseExact(text, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedDate)
            ? DateOnly.FromDateTime(parsedDate)
            : DateOnly.MinValue;
    }

    private static DateTimeOffset ToDateTimeOffsetOrDefault(object? value)
    {
        return value is DateTime dateTime ? new DateTimeOffset(DateTime.SpecifyKind(dateTime, DateTimeKind.Local)) : DateTimeOffset.MinValue;
    }

    private static DateTimeOffset ToDateTimeOffsetOrDefault(object? value, string? fallbackId)
    {
        var dateTimeOffset = ToDateTimeOffsetOrDefault(value);

        if (dateTimeOffset != DateTimeOffset.MinValue)
        {
            return dateTimeOffset;
        }

        return TryParseDateFromHisId(fallbackId) ?? DateTimeOffset.MinValue;
    }

    private static DateTimeOffset? TryParseDateFromHisId(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length < 6)
        {
            return null;
        }

        var prefix = value[..6];

        if (!DateTime.TryParseExact(prefix, "yyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var dateTime))
        {
            return null;
        }

        return new DateTimeOffset(DateTime.SpecifyKind(dateTime, DateTimeKind.Local));
    }

    private static DateTime? ToNullableDateTime(object? value) =>
        value is DateTime dateTime ? dateTime : null;

    private static DateTimeOffset? ToNullableDateTimeOffset(object? value) =>
        value switch
        {
            DateTimeOffset dateTimeOffset => dateTimeOffset,
            DateTime dateTime => new DateTimeOffset(DateTime.SpecifyKind(dateTime, DateTimeKind.Local)),
            _ => null,
        };

    private static int? ToNullableInt(object? value)
    {
        if (value is null)
        {
            return null;
        }

        if (int.TryParse(Convert.ToString(value), NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed))
        {
            return parsed;
        }

        return null;
    }

    private static DateTimeOffset? ParseFollowUpDate(object? value)
    {
        var text = Convert.ToString(value);

        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        string[] formats = ["dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "d-M-yyyy", "yyyy-MM-dd"];

        if (DateTime.TryParseExact(text.Trim(), formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dateTime)
            || DateTime.TryParse(text, CultureInfo.GetCultureInfo("vi-VN"), DateTimeStyles.None, out dateTime))
        {
            return new DateTimeOffset(DateTime.SpecifyKind(dateTime, DateTimeKind.Local));
        }

        return null;
    }

    private static IReadOnlyList<DiagnosisDto> BuildDiagnoses(string visitId, dynamic row)
    {
        var diagnoses = new List<DiagnosisDto>();
        var primaryCode = Convert.ToString(row.PRIMARYICD) ?? string.Empty;
        var primaryName = FirstNonEmpty(row.DIAGNOSISOUT, row.DIAGNOSISIN, row.DIAGNOSISDETAIL, row.REASON);

        if (!string.IsNullOrWhiteSpace(primaryCode) || !string.IsNullOrWhiteSpace(primaryName))
        {
            diagnoses.Add(new DiagnosisDto($"{visitId}-primary", visitId, primaryCode, primaryName, "Chính"));
        }

        string? secondaryIcd = Convert.ToString(row.SECONDARYICD);
        diagnoses.AddRange(SplitCodes(secondaryIcd)
            .Select((code, index) => new DiagnosisDto($"{visitId}-secondary-{index + 1}", visitId, code, string.Empty, "Phụ")));

        return diagnoses;
    }

    private static string BuildVisitNotes(dynamic row)
    {
        return MergeText(
            PrefixText("Lý do vào viện", row.REASON),
            PrefixText("Chẩn đoán vào", row.DIAGNOSISIN),
            PrefixText("Chẩn đoán ra viện", row.DIAGNOSISOUT),
            PrefixText("Chẩn đoán chi tiết", row.DIAGNOSISDETAIL),
            PrefixText("Phương pháp điều trị", row.TREATMENTMETHOD),
            PrefixText("Ghi chú", row.NOTE));
    }

    private static string BuildAppointmentContent(dynamic row)
    {
        var dayCount = Convert.ToString(row.DAYCOUNT);

        return MergeText(
            PrefixText("Ghi chú", row.APPOINTMENTNOTE),
            string.IsNullOrWhiteSpace(dayCount) ? string.Empty : $"Hẹn sau: {dayCount.Trim()} ngày",
            PrefixText("Chẩn đoán", FirstNonEmpty(row.DIAGNOSIS, row.INITIALDIAGNOSIS, row.DIAGNOSISDETAIL)));
    }

    private RegistrationDto MapRegistration(dynamic row, string hisPatientCode)
    {
        var id = Convert.ToString(row.ID) ?? string.Empty;

        return new RegistrationDto(
            Id: id,
            PatientId: $"his-{hisPatientCode}",
            VisitId: Convert.ToString(row.VISITID) ?? string.Empty,
            RegisteredAt: ToDateTimeOffsetOrDefault(row.REGISTEREDAT, id),
            TicketNumber: Convert.ToString(row.TICKETNUMBER) ?? string.Empty,
            DepartmentCode: Convert.ToString(row.DEPARTMENTCODE) ?? string.Empty,
            DepartmentName: FirstNonEmpty(row.DEPARTMENTNAME, "Chưa ghi nhận phòng khám"),
            DoctorName: FirstNonEmpty(row.DOCTORNAME),
            Status: MapRegistrationStatus(row.DONESTATUS),
            Reason: FirstNonEmpty(row.REASON),
            Notes: FirstNonEmpty(row.NOTES),
            PayerTypeCode: FirstNonEmpty(row.PAYERTYPECODE),
            PayerTypeName: FirstNonEmpty(row.PAYERTYPENAME),
            BranchCode: _branchCode,
            BranchName: _branchName);
    }

    private static string PayerTypeNameSqlExpression(string tableAlias, string payerTypeColumn, string dictionaryAlias)
    {
        return $"""
            coalesce(
              to_char({dictionaryAlias}.DOITUONG),
              case to_char({tableAlias}.{payerTypeColumn})
                when '1' then 'BHYT'
                when '2' then 'Thu Phí'
                when '3' then 'Miễn'
                when '4' then 'Nước Ngoài'
                when '5' then 'Hao phí'
                when '6' then 'BẢO LÃNH VP'
                when '9' then 'Khám Sức Khỏe'
                when '10' then 'XN SÀNG LỌC'
              end
            )
            """;
    }

    private static bool IsGenericRegistrationDepartment(string value)
    {
        var normalized = NormalizeForComparison(value);
        return string.IsNullOrWhiteSpace(normalized)
            || normalized == "tiep don/kcb"
            || normalized == "tiep don"
            || normalized == "kcb"
            || normalized.Contains("chua ghi nhan");
    }

    private static ActiveServiceDto MapActiveService(dynamic row)
    {
        var id = Convert.ToString(row.ID) ?? string.Empty;
        DateTimeOffset? startedAt = ToNullableDateTimeOffset(row.STARTEDAT);
        DateTimeOffset? resultAt = ToNullableDateTimeOffset(row.RESULTAT);

        return new ActiveServiceDto(
            Id: id,
            VisitId: Convert.ToString(row.VISITID) ?? string.Empty,
            OrderedAt: ToDateTimeOffsetOrDefault(row.ORDEREDAT, id),
            StartedAt: startedAt,
            ResultAt: resultAt,
            DepartmentName: FirstNonEmpty(row.DEPARTMENTNAME),
            ServiceName: FirstNonEmpty(row.SERVICENAME, "Dịch vụ cận lâm sàng"),
            ServiceGroup: ClassifyServiceGroup(row.SERVICEGROUPID, row.SERVICEGROUP),
            Status: resultAt.HasValue ? "Đã có kết quả" : startedAt.HasValue ? "Đang thực hiện" : "Chờ thực hiện",
            PayerTypeCode: FirstNonEmpty(row.PAYERTYPECODE),
            PayerTypeName: FirstNonEmpty(row.PAYERTYPENAME));
    }

    private static string MapRegistrationStatus(object? value)
    {
        var status = Convert.ToString(value)?.Trim().ToLowerInvariant();

        return status switch
        {
            "d" => "Đang gọi/đang khám",
            "?" => "Đang khám",
            "x" => "Đã khám",
            _ => "Chờ khám",
        };
    }

    private static (string Code, string Text) GetTodayVisitStep(RegistrationDto? registration, IReadOnlyList<ActiveServiceDto> services)
    {
        if (registration is null)
        {
            if (services.Count > 0)
            {
                return services.Any(service => service.Status == "Đang thực hiện")
                    ? ("DOING_CLS", "Đang thực hiện cận lâm sàng")
                    : services.Any(service => service.Status == "Chờ thực hiện")
                        ? ("WAITING_CLS", "Chờ thực hiện cận lâm sàng")
                        : ("DOING_CLS", "Có chỉ định cận lâm sàng hôm nay");
            }

            return ("NONE", "Chưa có lượt đăng ký hôm nay");
        }

        if (services.Any(service => service.Status == "Đang thực hiện"))
        {
            return ("DOING_CLS", "Đang thực hiện cận lâm sàng");
        }

        if (registration.Status == "Đang khám" && services.Count > 0)
        {
            return ("DOING_CLS", "Đang thực hiện cận lâm sàng");
        }

        if (services.Any(service => service.Status == "Chờ thực hiện"))
        {
            return ("WAITING_CLS", "Chờ thực hiện cận lâm sàng");
        }

        if (registration.Status == "Đang gọi/đang khám" || registration.Status == "Đang khám")
        {
            return ("IN_EXAM", "Đang gọi hoặc đang khám");
        }

        if (registration.Status == "Đã khám")
        {
            return ("DONE", "Đã hoàn tất khám");
        }

        return ("WAITING_EXAM", "Đang chờ khám");
    }

    private static string ClassifyServiceGroup(object? groupIdValue, object? groupNameValue)
    {
        var groupName = FirstNonEmpty(groupNameValue);

        if (!int.TryParse(Convert.ToString(groupIdValue), out var groupId))
        {
            return groupName;
        }

        if (new[] { 6, 7, 8, 9, 10, 23, 33, 37, 43, 44, 45, 46 }.Contains(groupId))
        {
            return "Xét nghiệm";
        }

        if (new[] { 2, 3, 14, 15, 27, 35, 38, 48, 50, 52 }.Contains(groupId))
        {
            return "CĐHA & TDCN";
        }

        if (new[] { 4, 5, 11, 12, 13, 16, 17, 18, 19, 20, 34, 36, 47, 49, 53, 55, 57 }.Contains(groupId))
        {
            return "Phẫu thuật - Thủ thuật";
        }

        return string.IsNullOrWhiteSpace(groupName) ? "Khác" : groupName;
    }

    private static string PrefixText(string label, object? value)
    {
        var text = Convert.ToString(value);
        return string.IsNullOrWhiteSpace(text) ? string.Empty : $"{label}: {text.Trim()}";
    }

    private static string FirstNonEmpty(params object?[] values) =>
        values is null
            ? string.Empty
            : Convert.ToString(values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(Convert.ToString(value)))) ?? string.Empty;

    private static IReadOnlyList<string> SplitCodes(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? Array.Empty<string>()
            : value.Split([';', ',', '+', ' '], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Distinct().ToList();

    private static string BuildSecondaryDiagnosis(object? diagnosisOutValue, object? secondaryIcdValue)
    {
        var codes = SplitCodes(Convert.ToString(secondaryIcdValue)).ToList();
        var parts = SplitTextParts(Convert.ToString(diagnosisOutValue)).ToList();
        var secondaryNames = parts.Count > 1 ? parts.Skip(1).ToList() : new List<string>();

        if (secondaryNames.Count == 0)
        {
            return string.Join("; ", codes);
        }

        return string.Join("; ", secondaryNames.Select((name, index) =>
        {
            var code = index < codes.Count ? codes[index] : string.Empty;
            return string.IsNullOrWhiteSpace(code) ? name : $"{name} ({code})";
        }));
    }

    private static string BuildPrimaryDischargeDiagnosis(object? primaryIcdValue, object? diagnosisOutValue, object? diagnosisDetailValue, object? reasonValue)
    {
        var primaryCode = Convert.ToString(primaryIcdValue)?.Trim() ?? string.Empty;
        var primaryName = SplitTextParts(Convert.ToString(diagnosisOutValue)).FirstOrDefault()
            ?? FirstNonEmpty(diagnosisDetailValue, reasonValue);

        return string.Join(" - ", new[] { primaryCode, primaryName }.Where(value => !string.IsNullOrWhiteSpace(value)));
    }

    private static IReadOnlyList<string> SplitTextParts(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? Array.Empty<string>()
            : value.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

    private static decimal ParseDecimal(object? value)
    {
        var text = Convert.ToString(value);

        if (string.IsNullOrWhiteSpace(text))
        {
            return 0;
        }

        text = text.Trim().Replace(',', '.');
        return decimal.TryParse(text, NumberStyles.Number, CultureInfo.InvariantCulture, out var number) ? number : 0;
    }

    private static decimal CalculateBmi(decimal weight, decimal height)
    {
        if (weight <= 0 || height <= 0)
        {
            return 0;
        }

        var heightInMeters = height > 3 ? height / 100 : height;
        return heightInMeters <= 0 ? 0 : Math.Round(weight / (heightInMeters * heightInMeters), 1);
    }

    private static string MapGender(object? value) => Convert.ToString(value) switch
    {
        "0" => "Nam",
        "1" => "Nữ",
        _ => "Khác",
    };

    private static string MapLabFlag(object? abnormal, object? lowHigh)
    {
        var lowHighValue = Convert.ToString(lowHigh);

        return lowHighValue switch
        {
            "1" => "Thấp",
            "2" => "Cao",
            _ => Convert.ToString(abnormal) == "1" ? "Cao" : "Bình thường",
        };
    }

    private static string MergeText(params object?[] values) =>
        string.Join(Environment.NewLine, values.Select(Convert.ToString).Where(value => !string.IsNullOrWhiteSpace(value)));

    private static string NormalizeForComparison(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var normalized = value.Trim().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);

        foreach (var character in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark)
            {
                builder.Append(character);
            }
        }

        return builder.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant();
    }

    private static string NormalizeOracleIdentifier(string? value, string fallback)
    {
        var identifier = string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
        if (!Regex.IsMatch(identifier, "^[A-Za-z][A-Za-z0-9_$#]*$"))
        {
            throw new InvalidOperationException($"Invalid Oracle schema identifier: {identifier}");
        }

        return identifier.ToUpperInvariant();
    }

    private static string NormalizeDigits(string value) => Regex.Replace(value.Trim(), "[^0-9]", string.Empty);

    private static string CleanRtf(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var text = value;

        text = Regex.Replace(text, @"\\u(-?\d+)\??", match =>
        {
            var code = int.Parse(match.Groups[1].Value);
            return char.ConvertFromUtf32(code < 0 ? code + 65536 : code);
        });

        text = Regex.Replace(text, @"\\'([0-9a-fA-F]{2})", match =>
        {
            var bytes = new[] { Convert.ToByte(match.Groups[1].Value, 16) };
            return Encoding.GetEncoding(1258).GetString(bytes);
        });

        text = Regex.Replace(text, @"\{\\(fonttbl|colortbl|stylesheet|info|generator).*?\}\}", string.Empty, RegexOptions.Singleline);
        text = Regex.Replace(text, @"\\par[d]?", Environment.NewLine);
        text = Regex.Replace(text, @"\\tab", " ");
        text = Regex.Replace(text, @"\\[a-zA-Z]+\d* ?", string.Empty);
        text = text.Replace("{", string.Empty).Replace("}", string.Empty).Replace("\\", string.Empty);
        text = text.Replace("Ã°", "Ä‘").Replace("Ã", "Ä");
        text = Regex.Replace(text, @"(?m)^\s*\*?Riched[^\r\n]*(\r?\n)?", string.Empty);
        text = Regex.Replace(text, @"(?m)^\s*-?\d+(?:-?\d+)*", string.Empty);
        text = text.Replace(";;", string.Empty);
        text = Regex.Replace(text, @"[ \t]+", " ");
        text = Regex.Replace(text, @"\r?\n\s*", Environment.NewLine);

        text = text.Normalize(NormalizationForm.FormC);
        text = FixVietnameseRtfArtifacts(text);

        return text.Trim();
    }

    private static string FixVietnameseRtfArtifacts(string text)
    {
        return text
            .Replace("Đ̉N", "ĐÒN")
            .Replace("đ̉n", "đòn");
    }

    private static string DeriveBenefitCode(object? cardNumber)
    {
        var value = Convert.ToString(cardNumber);
        return string.IsNullOrWhiteSpace(value) || value.Length < 3 ? string.Empty : value[2].ToString();
    }
}

