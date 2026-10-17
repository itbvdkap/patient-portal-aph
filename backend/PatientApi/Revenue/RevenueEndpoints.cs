using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace PatientApi.Revenue;

public static class RevenueEndpoints
{
    public static void MapRevenueEndpoints(this WebApplication app)
    {
        app.MapGet("/api/internal/vienphi-revenue", async (HttpContext context, IConfiguration config, OracleRevenueRepository repository, ILogger<OracleRevenueRepository> log) =>
        {
            context.Response.Headers.CacheControl = "no-store, private";
            if (!config.GetValue("Ksk:Enabled", false)) return Results.NotFound();
            var secret = config["Ksk:ServerToken"] ?? "";
            var provided = context.Request.Headers["X-Ksk-Token"].ToString();
            if (secret.Length < 32 || !CryptographicOperations.FixedTimeEquals(
                SHA256.HashData(Encoding.UTF8.GetBytes(secret)), SHA256.HashData(Encoding.UTF8.GetBytes(provided)))) return Results.StatusCode(403);
            var q = context.Request.Query;
            if (q.Keys.Any(k => k is not ("from" or "to"))
                || !DateTime.TryParseExact(q["from"], "yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture, DateTimeStyles.None, out var from)
                || !DateTime.TryParseExact(q["to"], "yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture, DateTimeStyles.None, out var to)
                || to < from || (to - from).TotalDays >= 31 || from.Year < 2000 || to.Year > 9998) return Results.BadRequest(new { error = "Khoảng ngày giờ tối đa 31 ngày." });
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(context.RequestAborted); timeout.CancelAfter(TimeSpan.FromSeconds(50));
            try { return Results.Ok(await repository.ReadAsync(from, to, timeout.Token)); }
            catch (Exception ex) when (!context.RequestAborted.IsCancellationRequested)
            { log.LogWarning("Revenue read failed: {ErrorType}", ex.GetType().Name); return Results.Json(new { error = "Không đọc được báo cáo viện phí." }, statusCode: 503); }
        });
    }
}
