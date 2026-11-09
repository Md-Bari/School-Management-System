namespace SchoolAdmission.Api.Endpoints;

// Response shapes. Field names follow the assignment's API contract exactly; a few extra
// fields (allowed by the spec) are appended where they help the UI.

public sealed record ClassCreatedResponse(string Id, string Name, int TotalSeats);

public sealed record ClassSummaryResponse(
    string Id,
    string Name,
    int TotalSeats,
    int HeldSeats,
    int ConfirmedSeats,
    int AvailableSeats);

public sealed record HoldCreatedResponse(
    string HoldId,
    string ClassId,
    string StudentId,
    string Status,
    DateTime ExpiresAt,
    string ClassName);

public sealed record HoldStatusResponse(
    string HoldId,
    string ClassId,
    string Status,
    DateTime ExpiresAt,
    string ClassName,
    string StudentId,
    DateTime? ConfirmedAt);

public sealed record HoldConfirmedResponse(
    string HoldId,
    string Status,
    string ClassId,
    DateTime? ConfirmedAt);

public sealed record MyHoldResponse(
    string HoldId,
    string ClassId,
    string ClassName,
    string Status,
    DateTime ExpiresAt,
    DateTime CreatedAt,
    DateTime? ConfirmedAt);
