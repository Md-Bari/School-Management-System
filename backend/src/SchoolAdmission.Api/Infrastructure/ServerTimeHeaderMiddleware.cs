namespace SchoolAdmission.Api.Infrastructure;

/// <summary>
/// Adds the server's current UTC time to every response so the UI can correct for a wrong
/// clock on the user's device when showing the hold countdown.
/// </summary>
public sealed class ServerTimeHeaderMiddleware(RequestDelegate next)
{
    public const string HeaderName = "X-Server-Time";

    public Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            context.Response.Headers[HeaderName] = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
            return Task.CompletedTask;
        });
        return next(context);
    }
}
