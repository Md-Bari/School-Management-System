namespace SchoolAdmission.Api.Infrastructure;

public static class StudentIdHeader
{
    public const string Name = "X-Student-Id";
    public const int Length = 17;

    /// <summary>Reads and validates the 17-digit birth registration number from X-Student-Id.</summary>
    public static string Require(HttpRequest request)
    {
        var raw = request.Headers[Name].ToString().Trim();
        if (raw.Length == 0)
        {
            throw ApiException.BadRequest(ErrorCodes.MissingStudentId,
                $"The {Name} header (17-digit birth registration number) is required.");
        }

        if (!IsValid(raw))
        {
            throw ApiException.BadRequest(ErrorCodes.InvalidStudentId,
                $"{Name} must be exactly {Length} digits (0-9).");
        }

        return raw;
    }

    public static bool IsValid(string value) =>
        value.Length == Length && value.All(c => c is >= '0' and <= '9');
}
