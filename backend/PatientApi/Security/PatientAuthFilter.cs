namespace PatientApi.Security;

public sealed class PatientAuthFilter(PatientTokenValidator tokenValidator) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var request = context.HttpContext.Request;
        var patientContext = tokenValidator.Validate(request);

        if (patientContext is null)
        {
            return Results.Json(new { error = "Authentication required." }, statusCode: StatusCodes.Status401Unauthorized);
        }

        context.HttpContext.Items[nameof(PatientContext)] = patientContext;
        return await next(context);
    }
}
