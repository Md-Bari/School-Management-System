namespace SchoolAdmission.Api.Data;

public static class HoldStatus
{
    public const string Held = "HELD";
    public const string Confirmed = "CONFIRMED";
    public const string Expired = "EXPIRED";
    public const string Cancelled = "CANCELLED";
}

// Rows as read from PostgreSQL (Dapper maps snake_case columns onto these).

public sealed class ClassRow
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
    public int TotalSeats { get; init; }
    public long HeldSeats { get; init; }
    public long ConfirmedSeats { get; init; }
}

public sealed class QuickSeatCheck
{
    public int TotalSeats { get; init; }
    public long Used { get; init; }
    public bool HasOwn { get; init; }
}

public sealed class HoldRow
{
    public string Id { get; init; } = "";
    public string ClassId { get; init; } = "";
    public string ClassName { get; init; } = "";
    public string StudentId { get; init; } = "";
    public string Status { get; init; } = "";
    public DateTime CreatedAt { get; init; }
    public DateTime ExpiresAt { get; init; }
    public DateTime? ConfirmedAt { get; init; }
    public DateTime? CancelledAt { get; init; }
}
