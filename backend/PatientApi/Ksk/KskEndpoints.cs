using System.Security.Cryptography;
using System.Text;
using System.Globalization;

namespace PatientApi.Ksk;

public static class KskEndpoints
{
    public static void MapKskEndpoints(this WebApplication app)
    {
        // Independent staff credential: patient tokens cannot read cohort health data.
        app.MapGet("/api/internal/ksk", async (HttpContext context, IConfiguration config,
            OracleKskRepository repository, ILogger<OracleKskRepository> logger) =>
        {
            context.Response.Headers.CacheControl = "no-store, private";
            if (!config.GetValue("Ksk:Enabled", false)) return Results.NotFound();
            var secret = config["Ksk:ServerToken"] ?? "";
            var provided = context.Request.Headers["X-Ksk-Token"].ToString();
            if (secret.Length < 32 || !CryptographicOperations.FixedTimeEquals(
                    SHA256.HashData(Encoding.UTF8.GetBytes(secret)),
                    SHA256.HashData(Encoding.UTF8.GetBytes(provided))))
                return Results.StatusCode(403);
            var q = context.Request.Query;
            if (!DateOnly.TryParseExact(q["from"], "yyyy-MM-dd", CultureInfo.InvariantCulture,
                    DateTimeStyles.None, out var from)
                || !DateOnly.TryParseExact(q["to"], "yyyy-MM-dd", CultureInfo.InvariantCulture,
                    DateTimeStyles.None, out var to)
                || to < from || to.DayNumber - from.DayNumber > 92)
                return Results.BadRequest(new { error = "Chọn khoảng ngày hợp lệ, tối đa 93 ngày." });
            var cohort = q["cohort"].ToString();
            if (cohort.Length > 0 && (cohort.Length > 24 || cohort.Any(c => c < '0' || c > '9')))
                return Results.BadRequest(new { error = "Mã đợt không hợp lệ." });
            var collections = q["all"] == "1";
            DateOnly? collectedFrom = null, collectedTo = null;
            if (collections)
            {
                if (cohort.Length != 0 || !DateOnly.TryParseExact(q["collectedFrom"], "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var cf)
                    || !DateOnly.TryParseExact(q["collectedTo"], "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var cto)
                    || cto < cf || cto.DayNumber - cf.DayNumber > 92
                    || Math.Max(to.DayNumber, cto.DayNumber) - Math.Min(from.DayNumber, cf.DayNumber) > 185)
                    return Results.BadRequest(new { error = "Ngày thu/ngày đăng ký tối đa 93 ngày mỗi khoảng, tổng phạm vi không quá 186 ngày." });
                collectedFrom = cf; collectedTo = cto;
            }
            else if (!string.IsNullOrEmpty(q["all"])) return Results.BadRequest();
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(context.RequestAborted);
            timeout.CancelAfter(TimeSpan.FromSeconds(50));
            try
            {
                var data = await repository.ReadAsync(from, to, cohort, timeout.Token, collections, collectedFrom, collectedTo);
                // No patient names, results, credentials or SQL in access logs.
                logger.LogInformation("KSK read completed. CohortSelected={Selected}; From={From}; To={To}",
                    cohort.Length > 0, from, to);
                return Results.Ok(data);
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !context.RequestAborted.IsCancellationRequested)
            {
                logger.LogWarning("KSK read unavailable. ErrorType={ErrorType}; OracleCode={OracleCode}",
                    ex.GetType().Name, ex is Oracle.ManagedDataAccess.Client.OracleException oracle ? oracle.Number : (int?)null);
                return Results.Json(new { error = "Không đọc được HIS. Kiểm tra kết nối chỉ đọc và cấu trúc KSK trên agent." }, statusCode: 503);
            }
        });
    }
}
