using Npgsql;

namespace SchoolAdmission.Api.Data;

/// <summary>
/// Creates the schema on startup (idempotent). Waits for PostgreSQL to accept connections, and
/// uses an advisory lock so two backend processes starting together do not race on DDL.
/// </summary>
public sealed class DatabaseInitializer(NpgsqlDataSource dataSource, ILogger<DatabaseInitializer> logger)
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
