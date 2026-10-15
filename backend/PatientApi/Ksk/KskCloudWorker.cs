using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace PatientApi.Ksk;

// Outbound-only bridge. Cloud never supplies an URL, SQL, credential, or write operation.
public sealed class KskCloudWorker(IConfiguration config, IHttpClientFactory clients, ILogger<KskCloudWorker> log) : BackgroundService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private sealed record Job(Guid Id, string Branch, string Operation, JsonElement Input, Guid Lease);
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!config.GetValue("KskCloud:Enabled", false)) return;
        var branch = config["PatientPortal:BranchCode"];
        var cloud = config["Supabase:Url"] ?? config["SUPABASE_URL"];
        var key = config["Supabase:ServiceRoleKey"] ?? config["SUPABASE_SERVICE_ROLE_KEY"]
            ?? config["Supabase:SecretKey"] ?? config["SUPABASE_SECRET_KEY"];
        var local = config["KskCloud:LocalApiBase"] ?? "http://127.0.0.1:5080";
        if (branch is not ("CN1" or "CN3") || !Uri.TryCreate(cloud, UriKind.Absolute, out var cloudUri) || cloudUri.Scheme != "https"
            || !string.IsNullOrEmpty(cloudUri.UserInfo) || !string.IsNullOrEmpty(cloudUri.Query) || !string.IsNullOrEmpty(cloudUri.Fragment)
            || string.IsNullOrWhiteSpace(key) || !Uri.TryCreate(local, UriKind.Absolute, out var localUri) || !localUri.IsLoopback || localUri.Scheme != "http")
        { log.LogError("KSK cloud configuration invalid; bridge remains stopped."); return; }
        var worker = Guid.NewGuid().ToString("N");
        using var client = clients.CreateClient(); client.Timeout = TimeSpan.FromSeconds(65);
        async Task<JsonElement> Rpc(string name, object body, CancellationToken ct) {
            using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(cloudUri, "/rest/v1/rpc/" + name));
            request.Headers.Add("apikey", key); request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
            request.Headers.Add("X-Client-Info", "anphu-patientapi/1.0");
            request.Content = new StringContent(JsonSerializer.Serialize(body, Json), Encoding.UTF8, "application/json");
            using var response = await client.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode) throw new InvalidOperationException("Cloud RPC unavailable.");
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct)); return document.RootElement.Clone();
        }
        while (!stoppingToken.IsCancellationRequested) {
            try {
                var claimed = await Rpc("portal_ksk_claim", new { p_branch = branch, p_worker = worker }, stoppingToken);
                var jobs = JsonSerializer.Deserialize<List<Job>>(claimed.GetRawText(), Json) ?? [];
                foreach (var job in jobs) {
                    object? result = null; var ok = false;
                    try {
                        if (job.Branch != branch) throw new InvalidOperationException("Branch mismatch.");
                        string endpoint; object? body = null; string? token;
                        if (job.Operation is "report" or "management") {
                            var fields = job.Input.EnumerateObject().ToDictionary(x => x.Name, x => x.Value.GetString() ?? "");
                            var allowed = job.Operation == "report" ? new[] { "from", "to", "cohort", "all", "collectedFrom", "collectedTo" } : new[] { "from", "to", "cohort" };
                            if (fields.Keys.Any(k => !allowed.Contains(k))) throw new InvalidOperationException("Invalid input.");
                            endpoint = (job.Operation == "report" ? "/api/internal/ksk" : "/api/internal/ksk-management") + "?" + string.Join("&", fields.Select(p => Uri.EscapeDataString(p.Key) + "=" + Uri.EscapeDataString(p.Value)));
                            token = config[job.Operation == "report" ? "Ksk:ServerToken" : "KskManagement:ServerToken"];
                        } else if (job.Operation is "patient" or "validate") {
                            endpoint = "/api/internal/ksk-management/" + job.Operation; body = job.Input; token = config["KskManagement:ServerToken"];
                        } else throw new InvalidOperationException("Unsupported operation. No HIS writes allowed.");
                        if (string.IsNullOrWhiteSpace(token) || token.Length < 32) throw new InvalidOperationException("Missing internal credential.");
                        using var request = new HttpRequestMessage(body is null ? HttpMethod.Get : HttpMethod.Post, new Uri(localUri, endpoint));
                        request.Headers.Add(job.Operation == "report" ? "X-Ksk-Token" : "X-Ksk-Management-Token", token);
                        if (body is not null) request.Content = new StringContent(JsonSerializer.Serialize(body, Json), Encoding.UTF8, "application/json");
                        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, stoppingToken);
                        if (!response.IsSuccessStatusCode) throw new InvalidOperationException("HIS read/validation rejected.");
                        using var stream = await response.Content.ReadAsStreamAsync(stoppingToken); using var buffer = new MemoryStream();
                        var chunk = new byte[32768]; int size;
                        while ((size = await stream.ReadAsync(chunk, stoppingToken)) != 0) { if (buffer.Length + size > 14000000) throw new InvalidOperationException("Payload bound exceeded."); buffer.Write(chunk, 0, size); }
                        using var doc = JsonDocument.Parse(buffer.ToArray()); result = doc.RootElement.Clone();
                        if (job.Operation == "management" && doc.RootElement.GetProperty("writeEnabled").GetBoolean()) throw new InvalidOperationException("Cloud requires HIS write disabled.");
                        ok = true;
                    } catch (Exception ex) when (!stoppingToken.IsCancellationRequested) {
                        // Do not log payload, source SQL, response body, token, or medical data.
                        log.LogWarning("KSK cloud read failed: {Type}", ex.GetType().Name);
                    }
                    await Rpc("portal_ksk_complete", new { p_id = job.Id, p_worker = worker, p_lease = job.Lease, p_ok = ok, p_result = ok ? result : null }, stoppingToken);
                }
                await Task.Delay(TimeSpan.FromSeconds(jobs.Count == 0 ? 3 : 1), stoppingToken);
            } catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { log.LogWarning("KSK cloud bridge unavailable: {Type}", ex.GetType().Name); await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken); }
        }
    }
}
