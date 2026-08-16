using System.Security.Claims;

namespace PatientApi.Security;

public sealed class PatientTokenValidator(IConfiguration configuration)
{
    private readonly string? _portalToken = configuration["PatientPortal:ServerToken"];
    private readonly string? _demoHisPatientCode = configuration["PatientPortal:DemoHisPatientCode"];

    public PatientContext? Validate(HttpRequest request)
    {
        var authorization = request.Headers.Authorization.ToString();
        var token = authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
            ? authorization["Bearer ".Length..].Trim()
            : null;

        if (!string.IsNullOrWhiteSpace(_portalToken) && token == _portalToken)
        {
            var headerPatientCode = request.Headers["X-His-Patient-Code"].ToString();
            var serverPatientCode = !string.IsNullOrWhiteSpace(headerPatientCode) ? headerPatientCode : _demoHisPatientCode;

            if (string.IsNullOrWhiteSpace(serverPatientCode))
            {
                return null;
            }

            return new PatientContext("portal-server", serverPatientCode.Trim());
        }

        var patientCode = request.HttpContext.User.FindFirstValue("his_patient_code");
        var userId = request.HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(patientCode) || string.IsNullOrWhiteSpace(userId))
        {
            return null;
        }

        return new PatientContext(userId, patientCode);
    }
}
