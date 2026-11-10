using System.Text.Json;
using Npgsql;

namespace SchoolAdmission.Api.Infrastructure;

/// <summary>
/// Turns every failure into a JSON error body. Bad input is always 4xx; only truly unexpected
/// failures become 500, and a database outage becomes 503.
/// </summary>
public sealed class ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);

            // Framework-generated 404/405 (unknown route, wrong method) come back with an empty body.
            if (!context.Response.HasStarted && context.Response.ContentLength is null &&
                context.Response.StatusCode is 404 or 405 && context.Response.ContentType is null)
            {
                var code = context.Response.StatusCode == 404 ? ErrorCodes.NotFound : "METHOD_NOT_ALLOWED";
                await WriteError(context, context.Response.StatusCode, code, "The requested endpoint does not exist.");
            }
        }
        catch (ApiException ex)
        {
            await WriteError(context, ex.StatusCode, ex.Code, ex.Message, ex.Details);
        }
        catch (BadHttpRequestException ex)
        {
            // Kestrel's own status (e.g. 413 for a body over the size limit); always 4xx.
            var status = ex.StatusCode is >= 400 and < 500 ? ex.StatusCode : StatusCodes.Status400BadRequest;
            var code = status == StatusCodes.Status413PayloadTooLarge ? ErrorCodes.PayloadTooLarge : ErrorCodes.InvalidJson;
            await WriteError(context, status, code, ex.Message);
        }
        catch (JsonException ex)
        {
            await WriteError(context, StatusCodes.Status400BadRequest, ErrorCodes.InvalidJson,
                $"Request body is not valid JSON: {ex.Message}");
        }
        catch (PostgresException ex) when (ex.SqlState.StartsWith("22", StringComparison.Ordinal))
        {
            // SQLSTATE class 22 = "data exception" (bad characters, out-of-range values...):
            // always caused by the input, so it is a 400, never a 500.
            logger.LogWarning("Rejected input the database could not accept: {SqlState}", ex.SqlState);
            await WriteError(context, StatusCodes.Status400BadRequest, ErrorCodes.ValidationError,
                "The request contains a value that is not allowed.");
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // Client went away; nothing to write.
        }
        catch (Exception ex) when (IsDatabaseUnavailable(ex))
        {
            logger.LogError(ex, "Database unavailable");
            await WriteError(context, StatusCodes.Status503ServiceUnavailable, ErrorCodes.ServiceUnavailable,
                "The database is temporarily unavailable. Please try again shortly.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception");
            await WriteError(context, StatusCodes.Status500InternalServerError, ErrorCodes.InternalError,
                "An unexpected error occurred.");
        }
    }

    private static bool IsDatabaseUnavailable(Exception ex) =>
        ex is NpgsqlException { IsTransient: true } or TimeoutException ||
        (ex is NpgsqlException && ex is not PostgresException) ||
        ex.InnerException is System.Net.Sockets.SocketException;

    private static async Task WriteError(HttpContext context, int status, string code, string message, object? details = null)
    {
        if (context.Response.HasStarted)
        {
            return;
        }

        context.Response.Clear();
        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(new ErrorResponse(code, message, details));
    }
}

public sealed record ErrorResponse(string Error, string Message, object? Details);
