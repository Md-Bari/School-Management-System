namespace SchoolAdmission.Api.Infrastructure;

/// <summary>
/// A business/validation error that maps to a 4xx response with a stable machine-readable code.
/// The frontend translates <see cref="Code"/> into a user-friendly (Bangla) message.
/// </summary>
public sealed class ApiException(int statusCode, string code, string message, object? details = null)
    : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public string Code { get; } = code;
    public object? Details { get; } = details;

    public static ApiException BadRequest(string code, string message, object? details = null) =>
        new(StatusCodes.Status400BadRequest, code, message, details);

    public static ApiException NotFound(string code, string message) =>
        new(StatusCodes.Status404NotFound, code, message);

    public static ApiException Forbidden(string code, string message) =>
        new(StatusCodes.Status403Forbidden, code, message);

    public static ApiException Conflict(string code, string message) =>
        new(StatusCodes.Status409Conflict, code, message);
}

public static class ErrorCodes
{
    public const string ValidationError = "VALIDATION_ERROR";
    public const string InvalidJson = "INVALID_JSON";
    public const string MissingStudentId = "MISSING_STUDENT_ID";
    public const string InvalidStudentId = "INVALID_STUDENT_ID";
    public const string ClassNotFound = "CLASS_NOT_FOUND";
    public const string HoldNotFound = "HOLD_NOT_FOUND";
    public const string NoSeats = "NO_SEATS";
    public const string AlreadyApplied = "ALREADY_APPLIED";
    public const string AlreadyConfirmed = "ALREADY_CONFIRMED";
    public const string AlreadyAdmitted = "ALREADY_ADMITTED";
    public const string HoldExpired = "HOLD_EXPIRED";
    public const string HoldCancelled = "HOLD_CANCELLED";
    public const string CannotCancelConfirmed = "CANNOT_CANCEL_CONFIRMED";
    public const string NotYourHold = "NOT_YOUR_HOLD";
    public const string NotFound = "NOT_FOUND";
    public const string ServiceUnavailable = "SERVICE_UNAVAILABLE";
    public const string InternalError = "INTERNAL_ERROR";
}
