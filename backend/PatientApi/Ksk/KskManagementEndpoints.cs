using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Globalization;

namespace PatientApi.Ksk;
public static class KskManagementEndpoints
{
    private static bool Allowed(HttpContext context, IConfiguration config)
    {
        context.Response.Headers.CacheControl = "no-store, private";
        if (!config.GetValue("KskManagement:Enabled", false)) { context.Response.StatusCode = 404; return false; }
        var token = config["KskManagement:ServerToken"] ?? "";
        var given = context.Request.Headers["X-Ksk-Management-Token"].ToString();
        if (token.Length < 32 || !CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(token)), SHA256.HashData(Encoding.UTF8.GetBytes(given)))) { context.Response.StatusCode = 403; return false; }
        return true;
    }
    private static IResult Error(Exception error, ILogger logger)
    {
        if (error is ManagementError expected) return Results.Json(new { error = expected.Message }, statusCode: expected.Status);
        var number = error is Oracle.ManagedDataAccess.Client.OracleException oracle ? oracle.Number : 0;
        logger.LogWarning("KSK management unavailable: {Type}, Oracle={Number}. No request records logged.", error.GetType().Name, number);
        return Results.Json(new { error = number is 54 or 8177 ? "HIS đang có thay đổi đồng thời; đã hủy transaction, làm mới và thử lại." : "Nguồn quản lý/ledger hoặc kết nối chưa sẵn sàng. Không tự thử ghi lại khi chưa kiểm tra trạng thái lệnh." }, statusCode: number is 54 or 8177 ? 409 : 503);
    }
    public static void MapKskManagement(this WebApplication app)
    {
        app.MapGet("/api/internal/ksk-management", async (HttpContext context, IConfiguration config, OracleKskManagementRepository repository, ILogger<OracleKskManagementRepository> logger) => {
            if (!Allowed(context, config)) return Results.Empty;
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(context.RequestAborted); timeout.CancelAfter(TimeSpan.FromSeconds(45));
            try {
                var cohort = context.Request.Query["cohort"].ToString();
                if (cohort.Length > 0 && !KskManagementModel.Id(cohort)) return Results.BadRequest(new { error = "Mã đợt không hợp lệ." });
                if (!DateOnly.TryParseExact(context.Request.Query["from"], "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var from)
                    || !DateOnly.TryParseExact(context.Request.Query["to"], "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var to) || to < from || to.DayNumber - from.DayNumber > 92) return Results.BadRequest(new { error = "Ngày không hợp lệ; tối đa 93 ngày." });
                return Results.Ok(await repository.ReadAsync(cohort, from, to, timeout.Token));
            } catch (Exception error) { return Error(error, logger); }
        });
        app.MapPost("/api/internal/ksk-management/patient", async (HttpContext context, IConfiguration config, OracleKskManagementRepository repository, ILogger<OracleKskManagementRepository> logger) => {
            if (!Allowed(context, config)) return Results.Empty;
            if (context.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>() is { IsReadOnly: false } feature) feature.MaxRequestBodySize = 1024;
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(context.RequestAborted); timeout.CancelAfter(TimeSpan.FromSeconds(10));
            try {
                var body = await context.Request.ReadFromJsonAsync<Dictionary<string, string>>(timeout.Token);
                if (body is null || body.Count != 1 || !body.TryGetValue("mabn", out var mabn)) return Results.BadRequest();
                return Results.Ok(await repository.PatientAsync(mabn, timeout.Token));
            } catch (JsonException) { return Results.BadRequest(); }
            catch (Exception error) { return Error(error, logger); }
        });
        foreach (var action in new[] { "validate", "apply" }) {
            var operation = action;
            app.MapPost("/api/internal/ksk-management/" + action, async (HttpContext context, IConfiguration config, OracleKskManagementRepository repository, ILogger<OracleKskManagementRepository> logger) => {
                if (!Allowed(context, config)) return Results.Empty;
                if (context.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>() is { IsReadOnly: false } feature) feature.MaxRequestBodySize = 128000;
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(context.RequestAborted); timeout.CancelAfter(TimeSpan.FromSeconds(45));
                try {
                    var input = await context.Request.ReadFromJsonAsync<ManagementCommand>(new JsonSerializerOptions(JsonSerializerDefaults.Web) { UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow }, timeout.Token);
                    if (input is null) return Results.BadRequest();
                    if (operation == "validate") { await repository.ValidateAsync(input, timeout.Token); return Results.Ok(new { valid = true, applied = false }); }
                    return Results.Ok(await repository.ApplyAsync(input, timeout.Token));
                } catch (JsonException) { return Results.BadRequest(new { error = "Nội dung lệnh không hợp lệ." }); }
                catch (BadHttpRequestException) { return Results.BadRequest(new { error = "Dung lượng lệnh không hợp lệ." }); }
                catch (Exception error) { return Error(error, logger); }
            });
        }
    }
}
