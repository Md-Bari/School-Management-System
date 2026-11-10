using Npgsql;
using SchoolAdmission.Api.Infrastructure;

namespace SchoolAdmission.Api.Data;

/// <summary>
/// Creates the schema on startup (idempotent). Waits for PostgreSQL to accept connections, and
/// uses an advisory lock so two backend processes starting together do not race on DDL.
/// </summary>
public sealed class DatabaseInitializer(
    NpgsqlDataSource dataSource,
    AdmissionOptions options,
    ILogger<DatabaseInitializer> logger)
{
    private const long SchemaLockKey = 727_001;

    public const string Schema = """
        CREATE TABLE IF NOT EXISTS classes (
            id           text        PRIMARY KEY,
            name         text        NOT NULL,
            total_seats  integer     NOT NULL CHECK (total_seats > 0),
            created_at   timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS holds (
            id            text        PRIMARY KEY,
            class_id      text        NOT NULL REFERENCES classes(id),
            student_id    text        NOT NULL CHECK (student_id ~ '^[0-9]{17}$'),
            status        text        NOT NULL CHECK (status IN ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED')),
            created_at    timestamptz NOT NULL,
            expires_at    timestamptz NOT NULL,
            confirmed_at  timestamptz NULL,
            cancelled_at  timestamptz NULL
        );

        CREATE INDEX IF NOT EXISTS ix_holds_class_status ON holds (class_id, status);
        CREATE INDEX IF NOT EXISTS ix_holds_student ON holds (student_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS ix_holds_held_expiry ON holds (expires_at) WHERE status = 'HELD';

        -- Defence in depth for rule 3: at most one HELD/CONFIRMED row per (class, student).
        -- (Expired HELD rows are flipped to EXPIRED before a new hold is inserted.)
        CREATE UNIQUE INDEX IF NOT EXISTS ux_holds_one_active_per_student
            ON holds (class_id, student_id) WHERE status IN ('HELD', 'CONFIRMED');
        """;

    /// <summary>
    /// Database-level safety net for "a student can be admitted to only one class": at most one
    /// CONFIRMED row per student. Created separately so that a database which already holds
    /// duplicate admissions (from before this rule) still starts; the service enforces the rule
    /// either way.
    /// </summary>
    private async Task CreateOneAdmissionPerStudentIndexAsync(NpgsqlConnection conn, CancellationToken ct)
    {
        if (!options.OneAdmissionPerStudent)
        {
            // Rule switched off: make sure an index from an earlier run with it on is gone,
            // otherwise it would still block admissions to a second class.
            await using var drop = new NpgsqlCommand("DROP INDEX IF EXISTS ux_holds_one_admission_per_student", conn);
            await drop.ExecuteNonQueryAsync(ct);
            return;
        }

        try
        {
            await using var cmd = new NpgsqlCommand(
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_holds_one_admission_per_student ON holds (student_id) WHERE status = 'CONFIRMED'",
                conn);
            await cmd.ExecuteNonQueryAsync(ct);
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            logger.LogWarning(
                "Existing data has a student confirmed in more than one class, so the one-admission index was not created. " +
                "The rule is still enforced by the application. Reset the data (docker compose down -v) to add the index.");
        }
    }

    public async Task InitializeAsync(CancellationToken cancellationToken)
    {
        var attempt = 0;
        while (true)
        {
            attempt++;
            try
            {
                await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);
                await using (var lockCmd = new NpgsqlCommand($"SELECT pg_advisory_lock({SchemaLockKey})", conn))
                {
                    await lockCmd.ExecuteNonQueryAsync(cancellationToken);
                }

                try
                {
                    await using var cmd = new NpgsqlCommand(Schema, conn);
                    await cmd.ExecuteNonQueryAsync(cancellationToken);
                    await CreateOneAdmissionPerStudentIndexAsync(conn, cancellationToken);
                }
                finally
                {
                    await using var unlockCmd = new NpgsqlCommand($"SELECT pg_advisory_unlock({SchemaLockKey})", conn);
                    await unlockCmd.ExecuteNonQueryAsync(CancellationToken.None);
                }

                logger.LogInformation("Database schema is ready");
                return;
            }
            catch (Exception ex) when (ex is NpgsqlException or System.Net.Sockets.SocketException && attempt < 30)
            {
                logger.LogWarning("Database not ready (attempt {Attempt}): {Message}. Retrying in 2s...", attempt, ex.Message);
                await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken);
            }
        }
    }
}
