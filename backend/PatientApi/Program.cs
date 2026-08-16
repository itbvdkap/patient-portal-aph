using PatientApi.Repositories;
using PatientApi.Security;
using PatientApi.Sync;
using System.Text;

Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")))
{
    Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", Environments.Development);
}

var builder = WebApplication.CreateBuilder(args);

if (string.IsNullOrWhiteSpace(builder.Configuration["urls"]) &&
    string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("ASPNETCORE_URLS")))
{
    builder.WebHost.UseUrls("http://127.0.0.1:5080");
}

builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

builder.Services.AddSingleton<PatientTokenValidator>();
builder.Services.AddScoped<OracleHisPatientRepository>();

var dataMode = builder.Configuration["PatientPortal:DataMode"] ?? "OracleDirect";
if (dataMode.Equals("Reporting", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddSingleton<ReportingStore>();
    builder.Services.AddSingleton<PatientSyncCoordinator>();
    builder.Services.AddHostedService(serviceProvider => serviceProvider.GetRequiredService<PatientSyncCoordinator>());
    builder.Services.AddHostedService<SupabaseQueueSyncAgent>();
    builder.Services.AddScoped<IPatientRepository, ReportingPatientRepository>();
}
else
{
    builder.Services.AddScoped<IPatientRepository, OracleHisPatientRepository>();
}

var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new { status = "healthy", dataMode }));

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.MapPost("/api/auth/verify", async (
    LoginVerificationRequest request,
    HttpContext httpContext,
    IConfiguration configuration,
    IPatientRepository repository,
    CancellationToken cancellationToken) =>
{
    if (!PortalServerAuth.HasPortalServerToken(httpContext.Request, configuration))
    {
        return Results.Json(new { error = "Authentication required." }, statusCode: StatusCodes.Status401Unauthorized);
    }

    var verifiedPatient = await repository.VerifyLoginAsync(request.Phone, request.CitizenId, cancellationToken);

    return verifiedPatient is null
        ? Results.Json(new { error = "Không tìm thấy hồ sơ phù hợp với số điện thoại và CCCD/CMND." }, statusCode: StatusCodes.Status404NotFound)
        : Results.Ok(new { data = verifiedPatient });
});

RouteGroupBuilder me = app.MapGroup("/api/me");
me.AddEndpointFilter<PatientAuthFilter>();

me.MapGet("/", async (HttpContext httpContext, IPatientRepository repository, CancellationToken cancellationToken) =>
{
    var patientContext = httpContext.GetPatientContext();
    var patient = await repository.GetPatientAsync(patientContext.HisPatientCode, cancellationToken);
    return patient is null ? Results.NotFound(new { error = "Resource not found." }) : Results.Ok(new { data = patient });
});

me.MapGet("/visits", async (HttpContext httpContext, IPatientRepository repository, CancellationToken cancellationToken) =>
{
    var patientContext = httpContext.GetPatientContext();
    return Results.Ok(new { data = await repository.GetVisitsAsync(patientContext.HisPatientCode, cancellationToken) });
});

me.MapGet("/summary", async (HttpContext httpContext, IPatientRepository repository, CancellationToken cancellationToken) =>
{
    var patientContext = httpContext.GetPatientContext();
    return Results.Ok(new { data = await repository.GetSummaryAsync(patientContext.HisPatientCode, cancellationToken) });
});

me.MapGet("/visits/{id}", async (string id, HttpContext httpContext, IPatientRepository repository, CancellationToken cancellationToken) =>
{
    var patientContext = httpContext.GetPatientContext();
    var visit = await repository.GetVisitDetailAsync(patientContext.HisPatientCode, id, cancellationToken);
    return visit is null ? Results.NotFound(new { error = "Resource not found." }) : Results.Ok(new { data = visit });
});

me.MapGet("/lab-results", async (HttpContext httpContext, IPatientRepository repository, CancellationToken cancellationToken, string? visitId) =>
{
    var patientContext = httpContext.GetPatientContext();
    return Results.Ok(new { data = await repository.GetLabResultsAsync(patientContext.HisPatientCode, cancellationToken, visitId) });
});

me.MapGet("/imaging", async (HttpContext httpContext, IPatientRepository repository, CancellationToken cancellationToken) =>
{
    var patientContext = httpContext.GetPatientContext();
    return Results.Ok(new { data = await repository.GetImagingResultsAsync(patientContext.HisPatientCode, cancellationToken) });
});

me.MapGet("/prescriptions", async (HttpContext httpContext, IPatientRepository repository, CancellationToken cancellationToken) =>
{
    var patientContext = httpContext.GetPatientContext();
    return Results.Ok(new { data = await repository.GetPrescriptionsAsync(patientContext.HisPatientCode, cancellationToken) });
});

me.MapGet("/insurance", async (HttpContext httpContext, IPatientRepository repository, CancellationToken cancellationToken) =>
{
    var patientContext = httpContext.GetPatientContext();
    return Results.Ok(new { data = await repository.GetInsuranceAsync(patientContext.HisPatientCode, cancellationToken) });
});

me.MapGet("/appointments", async (HttpContext httpContext, IPatientRepository repository, CancellationToken cancellationToken) =>
{
    var patientContext = httpContext.GetPatientContext();
    return Results.Ok(new { data = await repository.GetAppointmentsAsync(patientContext.HisPatientCode, cancellationToken) });
});

me.MapGet("/today-visit", async (HttpContext httpContext, IPatientRepository repository, CancellationToken cancellationToken) =>
{
    var patientContext = httpContext.GetPatientContext();
    return Results.Ok(new { data = await repository.GetTodayVisitStatusAsync(patientContext.HisPatientCode, cancellationToken) });
});

me.MapGet("/registrations", async (HttpContext httpContext, IPatientRepository repository, CancellationToken cancellationToken) =>
{
    var patientContext = httpContext.GetPatientContext();
    return Results.Ok(new { data = await repository.GetRegistrationsAsync(patientContext.HisPatientCode, cancellationToken) });
});

if (dataMode.Equals("Reporting", StringComparison.OrdinalIgnoreCase))
{
    me.MapGet("/sync-status", async (HttpContext httpContext, ReportingStore store, CancellationToken cancellationToken) =>
    {
        var patientContext = httpContext.GetPatientContext();
        return Results.Ok(new { data = await store.GetStatusesAsync(patientContext.HisPatientCode, cancellationToken) });
    });

    me.MapPost("/sync", async (HttpContext httpContext, PatientSyncCoordinator sync, CancellationToken cancellationToken) =>
    {
        var patientContext = httpContext.GetPatientContext();
        await sync.QueueAsync(new SyncRequest(patientContext.HisPatientCode, "all", RequestedBy: "patient"), false, cancellationToken);
        return Results.Accepted(value: new { status = "queued" });
    });
}

app.Run();

internal static class PatientContextHttpExtensions
{
    public static PatientContext GetPatientContext(this HttpContext httpContext)
    {
        return httpContext.Items[nameof(PatientContext)] as PatientContext
            ?? throw new InvalidOperationException("Patient context is not available.");
    }
}

internal sealed record LoginVerificationRequest(string Phone, string CitizenId);

internal static class PortalServerAuth
{
    public static bool HasPortalServerToken(HttpRequest request, IConfiguration configuration)
    {
        var portalToken = configuration["PatientPortal:ServerToken"];
        var authorization = request.Headers.Authorization.ToString();
        var token = authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
            ? authorization["Bearer ".Length..].Trim()
            : null;

        return !string.IsNullOrWhiteSpace(portalToken) && token == portalToken;
    }
}
