using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace PatientApi.Sync;

public sealed class ZaloZnsClient(HttpClient httpClient, IConfiguration configuration, ILogger<ZaloZnsClient> logger)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private string? _accessToken;
    private string? _refreshToken;

    public async Task<ZaloSendResult> SendTemplateAsync(string phone, string templateKey, JsonElement payload, string? templateId, CancellationToken cancellationToken)
    {
        var config = await ReadConfigAsync(templateKey, cancellationToken);
        if (string.IsNullOrWhiteSpace(config.Endpoint) || string.IsNullOrWhiteSpace(config.TemplateId))
        {
            return ZaloSendResult.Failed("Zalo ZNS is not configured. Missing endpoint/template id.");
        }

        if (string.IsNullOrWhiteSpace(config.AccessToken) && !string.IsNullOrWhiteSpace(config.RefreshToken))
        {
            var refreshed = await RefreshTokenAsync(config, cancellationToken);
            if (!refreshed.Success) return refreshed;
            config = config with { AccessToken = _accessToken, RefreshToken = _refreshToken };
        }

        if (string.IsNullOrWhiteSpace(config.AccessToken))
        {
            return ZaloSendResult.Failed("Zalo ZNS is not configured. Missing access token or refresh token.");
        }

        var result = await PostTemplateAsync(config, phone, templateId ?? config.TemplateId, payload, cancellationToken);
        if (!result.Success && result.IsAccessTokenInvalid && !string.IsNullOrWhiteSpace(config.RefreshToken))
        {
            var refreshed = await RefreshTokenAsync(config, cancellationToken);
            if (!refreshed.Success) return refreshed;
            config = config with { AccessToken = _accessToken, RefreshToken = _refreshToken };
            result = await PostTemplateAsync(config, phone, templateId ?? config.TemplateId, payload, cancellationToken);
        }

        return result;
    }

    private async Task<ZaloConfig> ReadConfigAsync(string templateKey, CancellationToken cancellationToken)
    {
        var settings = await ReadPortalSettingsAsync(cancellationToken);
        var endpoint = FirstSetting(settings, "zalo.zns_endpoint", configuration["ZALO_ZNS_ENDPOINT"])
            ?? "https://business.openapi.zalo.me/message/template";

        var accessToken = _accessToken
            ?? FirstSetting(settings, "zalo.access_token", configuration["ZALO_ACCESS_TOKEN"]);
        var refreshToken = _refreshToken
            ?? FirstSetting(settings, "zalo.refresh_token", configuration["ZALO_REFRESH_TOKEN"]);
        var templateId = FirstSetting(
            settings,
            $"zalo.template.{templateKey}",
            configuration[$"ZALO_TEMPLATE_{templateKey.ToUpperInvariant()}"],
            configuration["ZALO_BOOKING_CONFIRMED_TEMPLATE_ID"],
            configuration["ZALO_TEMPLATE_ID"]);

        return new ZaloConfig(
            Endpoint: endpoint,
            TokenEndpoint: FirstSetting(settings, "zalo.token_endpoint", configuration["ZALO_TOKEN_ENDPOINT"]) ?? "https://oauth.zaloapp.com/v4/oa/access_token",
            AppId: FirstSetting(settings, "zalo.app_id", configuration["ZALO_APP_ID"]),
            SecretKey: FirstSetting(settings, "zalo.secret_key", configuration["ZALO_SECRET_KEY"]),
            AccessToken: accessToken,
            RefreshToken: refreshToken,
            TemplateId: templateId);
    }

    private async Task<Dictionary<string, string>> ReadPortalSettingsAsync(CancellationToken cancellationToken)
    {
        var supabaseUrl = configuration["SUPABASE_URL"]?.TrimEnd('/');
        var supabaseKey = configuration["SUPABASE_SECRET_KEY"] ?? configuration["SUPABASE_SERVICE_ROLE_KEY"];
        if (string.IsNullOrWhiteSpace(supabaseUrl) || string.IsNullOrWhiteSpace(supabaseKey))
        {
            return [];
        }

        var request = new HttpRequestMessage(HttpMethod.Get, $"{supabaseUrl}/rest/v1/portal_app_settings?select=setting_key,setting_value&setting_group=eq.zalo");
        request.Headers.TryAddWithoutValidation("apikey", supabaseKey);
        request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {supabaseKey}");

        try
        {
            using var response = await httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Could not read Zalo settings from portal_app_settings. Status {StatusCode}.", (int)response.StatusCode);
                return [];
            }

            var rows = await response.Content.ReadFromJsonAsync<List<PortalSettingRow>>(JsonOptions, cancellationToken) ?? [];
            return rows
                .Where(row => !string.IsNullOrWhiteSpace(row.SettingKey))
                .ToDictionary(row => row.SettingKey!, row => row.SettingValue ?? "", StringComparer.OrdinalIgnoreCase);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not read Zalo settings from portal_app_settings.");
            return [];
        }
    }

    private async Task<ZaloSendResult> PostTemplateAsync(ZaloConfig config, string phone, string templateId, JsonElement payload, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, config.Endpoint);
        request.Headers.TryAddWithoutValidation("access_token", config.AccessToken);
        request.Content = JsonContent.Create(new
        {
            phone,
            template_id = templateId,
            template_data = BuildTemplateData(payload),
        }, options: JsonOptions);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var rawText = await response.Content.ReadAsStringAsync(cancellationToken);
        var zaloResponse = ParseZaloResponse(rawText);
        if (!response.IsSuccessStatusCode)
        {
            return ZaloSendResult.Failed(zaloResponse.Message ?? $"Zalo ZNS failed with HTTP {(int)response.StatusCode}.", rawText, IsAccessTokenInvalid(zaloResponse));
        }

        if (zaloResponse.Error is not null && zaloResponse.Error != 0)
        {
            return ZaloSendResult.Failed(zaloResponse.Message ?? $"Zalo ZNS error {zaloResponse.Error}.", rawText, IsAccessTokenInvalid(zaloResponse));
        }

        return ZaloSendResult.Sent(rawText);
    }

    private async Task<ZaloSendResult> RefreshTokenAsync(ZaloConfig config, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(config.TokenEndpoint) ||
            string.IsNullOrWhiteSpace(config.AppId) ||
            string.IsNullOrWhiteSpace(config.SecretKey) ||
            string.IsNullOrWhiteSpace(config.RefreshToken))
        {
            return ZaloSendResult.Failed("Zalo token refresh is not configured. Missing token endpoint/app id/secret key/refresh token.");
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, config.TokenEndpoint);
        request.Headers.TryAddWithoutValidation("secret_key", config.SecretKey);
        request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["app_id"] = config.AppId,
            ["grant_type"] = "refresh_token",
            ["refresh_token"] = config.RefreshToken,
        });

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var rawText = await response.Content.ReadAsStringAsync(cancellationToken);
        var token = JsonSerializer.Deserialize<ZaloTokenResponse>(rawText, JsonOptions);

        if (!response.IsSuccessStatusCode || string.IsNullOrWhiteSpace(token?.AccessToken))
        {
            return ZaloSendResult.Failed(token?.Message ?? $"Zalo token refresh failed with HTTP {(int)response.StatusCode}.", rawText);
        }

        _accessToken = token.AccessToken;
        _refreshToken = string.IsNullOrWhiteSpace(token.RefreshToken) ? config.RefreshToken : token.RefreshToken;
        await PersistTokensAsync(_accessToken, _refreshToken, token.ExpiresIn, token.RefreshExpiresIn, cancellationToken);
        return ZaloSendResult.Sent(rawText);
    }

    private async Task PersistTokensAsync(string accessToken, string refreshToken, JsonElement? expiresIn, JsonElement? refreshExpiresIn, CancellationToken cancellationToken)
    {
        var supabaseUrl = configuration["SUPABASE_URL"]?.TrimEnd('/');
        var supabaseKey = configuration["SUPABASE_SECRET_KEY"] ?? configuration["SUPABASE_SERVICE_ROLE_KEY"];
        if (string.IsNullOrWhiteSpace(supabaseUrl) || string.IsNullOrWhiteSpace(supabaseKey))
        {
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var rows = new List<object>
        {
            SettingRow("zalo.access_token", accessToken, true, "Zalo access token"),
            SettingRow("zalo.refresh_token", refreshToken, true, "Zalo refresh token"),
        };

        var accessExpiresAt = ExpiryIso(now, expiresIn);
        if (accessExpiresAt is not null) rows.Add(SettingRow("zalo.access_token_expires_at", accessExpiresAt, false, "Zalo access token hết hạn"));
        var refreshExpiresAt = ExpiryIso(now, refreshExpiresIn);
        if (refreshExpiresAt is not null) rows.Add(SettingRow("zalo.refresh_token_expires_at", refreshExpiresAt, false, "Zalo refresh token hết hạn"));

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{supabaseUrl}/rest/v1/portal_app_settings?on_conflict=setting_key");
        request.Headers.TryAddWithoutValidation("apikey", supabaseKey);
        request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {supabaseKey}");
        request.Headers.TryAddWithoutValidation("Prefer", "resolution=merge-duplicates");
        request.Content = JsonContent.Create(rows, options: JsonOptions);

        try
        {
            using var response = await httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Could not persist refreshed Zalo token. Status {StatusCode}.", (int)response.StatusCode);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not persist refreshed Zalo token.");
        }
    }

    private static Dictionary<string, object?> BuildTemplateData(JsonElement payload)
    {
        var data = JsonSerializer.Deserialize<Dictionary<string, object?>>(payload.GetRawText(), JsonOptions) ?? [];
        if (data.TryGetValue("ticket_number", out var ticketNumber)) data.TryAdd("stt_kham", ticketNumber);
        if (data.TryGetValue("department_name", out var departmentName)) data.TryAdd("phong_kham", departmentName);
        if (data.TryGetValue("appointment_date", out var appointmentDate))
        {
            data.TryAdd("ngay_kham", appointmentDate);
            data.TryAdd("date_code", appointmentDate);
        }
        if (data.TryGetValue("appointment_time", out var appointmentTime))
        {
            data.TryAdd("gio_kham", appointmentTime);
            data.TryAdd("schedule_time", appointmentTime);
        }
        if (data.TryGetValue("booking_code", out var bookingCode))
        {
            data.TryAdd("ma_lich_hen", bookingCode);
            data.TryAdd("id_booking", bookingCode);
        }
        if (data.TryGetValue("full_name", out var fullName))
        {
            data.TryAdd("ho_ten", fullName);
            data.TryAdd("customer_name", fullName);
        }
        if (data.TryGetValue("mabn", out var mabn)) data.TryAdd("patient_code", mabn);
        data.TryAdd("address", "Số 05, Đường 22 Tháng 12, P. An Phú, TP. Hồ Chí Minh");
        return data;
    }

    private static ZaloTemplateResponse ParseZaloResponse(string rawText)
    {
        try
        {
            return JsonSerializer.Deserialize<ZaloTemplateResponse>(rawText, JsonOptions) ?? new ZaloTemplateResponse();
        }
        catch
        {
            return new ZaloTemplateResponse { Message = rawText };
        }
    }

    private static bool IsAccessTokenInvalid(ZaloTemplateResponse response)
    {
        return response.Error == -124 ||
            (response.Message?.Contains("access token invalid", StringComparison.OrdinalIgnoreCase) ?? false);
    }

    private static string? FirstSetting(Dictionary<string, string> settings, string key, params string?[] fallbacks)
    {
        if (settings.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value)) return value.Trim();
        return fallbacks.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value))?.Trim();
    }

    private static object SettingRow(string settingKey, string settingValue, bool isSecret, string label)
    {
        return new
        {
            setting_key = settingKey,
            setting_value = settingValue,
            setting_group = "zalo",
            label,
            is_secret = isSecret,
            updated_by = "system:patientapi-zalo-refresh",
            updated_at = DateTimeOffset.UtcNow,
        };
    }

    private static string? ExpiryIso(DateTimeOffset now, JsonElement? value)
    {
        if (value is null) return null;

        double seconds = value.Value.ValueKind switch
        {
            JsonValueKind.Number when value.Value.TryGetDouble(out var number) => number,
            JsonValueKind.String when double.TryParse(value.Value.GetString(), out var number) => number,
            _ => 0
        };

        if (seconds <= 0) return null;
        var millis = seconds > 10_000 ? seconds : seconds * 1000;
        return now.AddMilliseconds(millis).ToString("O");
    }

    private sealed record ZaloConfig(
        string? Endpoint,
        string? TokenEndpoint,
        string? AppId,
        string? SecretKey,
        string? AccessToken,
        string? RefreshToken,
        string? TemplateId);

    private sealed record PortalSettingRow(
        [property: JsonPropertyName("setting_key")] string? SettingKey,
        [property: JsonPropertyName("setting_value")] string? SettingValue);

    private sealed record ZaloTemplateResponse
    {
        [JsonPropertyName("error")]
        public int? Error { get; init; }

        [JsonPropertyName("message")]
        public string? Message { get; init; }
    }

    private sealed record ZaloTokenResponse
    {
        [JsonPropertyName("access_token")]
        public string? AccessToken { get; init; }

        [JsonPropertyName("refresh_token")]
        public string? RefreshToken { get; init; }

        [JsonPropertyName("expires_in")]
        public JsonElement? ExpiresIn { get; init; }

        [JsonPropertyName("refresh_expires_in")]
        public JsonElement? RefreshExpiresIn { get; init; }

        [JsonPropertyName("message")]
        public string? Message { get; init; }
    }
}

public sealed record ZaloSendResult(bool Success, string? ErrorMessage, string? RawResponse, bool IsAccessTokenInvalid)
{
    public static ZaloSendResult Sent(string? rawResponse) => new(true, null, rawResponse, false);

    public static ZaloSendResult Failed(string message, string? rawResponse = null, bool isAccessTokenInvalid = false) =>
        new(false, message, rawResponse, isAccessTokenInvalid);
}
