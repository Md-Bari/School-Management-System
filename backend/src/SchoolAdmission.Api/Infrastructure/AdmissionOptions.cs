namespace SchoolAdmission.Api.Infrastructure;

public sealed class AdmissionOptions
{
    public const int DefaultHoldDurationSeconds = 600;

    public required string ConnectionString { get; init; }
    public required int HoldDurationSeconds { get; init; }
    public TimeSpan SweepInterval { get; init; } = TimeSpan.FromSeconds(30);

    /// <summary>
    /// Optional stricter rule (ONE_ADMISSION_PER_STUDENT=true): a student can be admitted to only
    /// one class in total. Off by default so the API behaves exactly as the assignment's rule 3
    /// (one active/confirmed application per student per class).
    /// </summary>
    public bool OneAdmissionPerStudent { get; init; }

    public static AdmissionOptions FromConfiguration(IConfiguration config)
    {
        // Connection string: ConnectionStrings__Default (standard ASP.NET env var form)
        // or DATABASE_CONNECTION_STRING as a shorter alternative.
        var connectionString =
            config["DATABASE_CONNECTION_STRING"]
            ?? config.GetConnectionString("Default")
            ?? throw new InvalidOperationException(
                "No database connection string. Set ConnectionStrings__Default or DATABASE_CONNECTION_STRING.");

        var holdSeconds = DefaultHoldDurationSeconds;
        var raw = config["HOLD_DURATION_SECONDS"];
        if (!string.IsNullOrWhiteSpace(raw))
        {
            if (int.TryParse(raw.Trim(), out var parsed) && parsed > 0)
            {
                holdSeconds = parsed;
            }
            else
            {
                Console.Error.WriteLine(
                    $"warn: HOLD_DURATION_SECONDS='{raw}' is not a positive integer; using default {DefaultHoldDurationSeconds}.");
            }
        }

        var oneAdmission = config["ONE_ADMISSION_PER_STUDENT"]?.Trim().ToLowerInvariant() is "true" or "1" or "yes" or "on";

        return new AdmissionOptions
        {
            ConnectionString = connectionString,
            HoldDurationSeconds = holdSeconds,
            OneAdmissionPerStudent = oneAdmission,
        };
    }
}
