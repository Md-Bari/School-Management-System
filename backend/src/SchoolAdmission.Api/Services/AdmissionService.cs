using System.Data;
using System.Security.Cryptography;
using Dapper;
using Npgsql;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Infrastructure;

namespace SchoolAdmission.Api.Services;

/// <summary>
/// All seat-changing operations live here.
///
/// Concurrency model (see ASSUMPTIONS.md):
///  * Every operation that can change held+confirmed for a class (create hold, confirm, cancel,
///    expire) first takes a row lock on that class with SELECT ... FOR UPDATE. That serialises
///    all seat changes for one class at the database, so it holds no matter how many backend
///    processes are running.
///  * Time is always read from PostgreSQL (clock_timestamp()) *after* the lock is taken, so
///    there is a single clock and expiry decisions cannot interleave incorrectly.
///  * Expiry is lazy: a HELD hold whose expires_at has passed is simply not counted anywhere.
///    No API call or background job is needed for the seat to come back.
/// </summary>
public sealed class AdmissionService(NpgsqlDataSource dataSource, AdmissionOptions options)
{
    // A HELD row past its expiry is reported (and counted) as EXPIRED.
    private const string EffectiveStatusSql =
        "CASE WHEN h.status = 'HELD' AND h.expires_at <= clock_timestamp() THEN 'EXPIRED' ELSE h.status END";

    private const string ClassSummarySql = """
        SELECT c.id, c.name, c.total_seats,
               COUNT(h.id) FILTER (WHERE h.status = 'HELD' AND h.expires_at > clock_timestamp()) AS held_seats,
               COUNT(h.id) FILTER (WHERE h.status = 'CONFIRMED')                                AS confirmed_seats
        FROM classes c
        LEFT JOIN holds h ON h.class_id = c.id
        """;

    public async Task<ClassRow> CreateClassAsync(string name, int totalSeats, CancellationToken ct)
    {
        var id = NewId("c_");
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await conn.ExecuteAsync(new CommandDefinition(
            "INSERT INTO classes (id, name, total_seats, created_at) VALUES (@id, @name, @totalSeats, clock_timestamp())",
            new { id, name, totalSeats }, cancellationToken: ct));
        return new ClassRow { Id = id, Name = name, TotalSeats = totalSeats };
    }

    public async Task<IReadOnlyList<ClassRow>> ListClassesAsync(CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        var rows = await conn.QueryAsync<ClassRow>(new CommandDefinition(
            ClassSummarySql + " GROUP BY c.id ORDER BY c.created_at, c.id", cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<ClassRow> GetClassAsync(string classId, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        var row = await conn.QuerySingleOrDefaultAsync<ClassRow>(new CommandDefinition(
            ClassSummarySql + " WHERE c.id = @classId GROUP BY c.id", new { classId }, cancellationToken: ct));
        return row ?? throw ClassNotFound();
    }

    public async Task<HoldRow> CreateHoldAsync(string classId, string studentId, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        // 1. Lock the class row: from here on, nobody else can change seats for this class.
        var cls = await conn.QuerySingleOrDefaultAsync<ClassRow>(new CommandDefinition(
            "SELECT id, name, total_seats FROM classes WHERE id = @classId FOR UPDATE",
            new { classId }, tx, cancellationToken: ct)) ?? throw ClassNotFound();

        var now = await DbNowAsync(conn, tx, ct);

        // 2. Housekeeping: mark this class's expired holds. Also frees the student's slot in the
        //    partial unique index if their previous hold expired.
        await ExpireHeldForClassAsync(conn, tx, classId, now, ct);

        // 3. Rule 3: one active (HELD) or CONFIRMED application per student per class.
        var existing = await conn.QueryFirstOrDefaultAsync<string>(new CommandDefinition(
            "SELECT status FROM holds WHERE class_id = @classId AND student_id = @studentId AND status IN ('HELD', 'CONFIRMED') LIMIT 1",
            new { classId, studentId }, tx, cancellationToken: ct));
        if (existing == HoldStatus.Confirmed)
        {
            throw ApiException.Conflict(ErrorCodes.AlreadyConfirmed,
                "This student's admission to this class is already confirmed.");
        }
        if (existing == HoldStatus.Held)
        {
            throw ApiException.Conflict(ErrorCodes.AlreadyApplied,
                "This student already has an active application for this class.");
        }

        // 4. Rule 1: held + confirmed must never exceed totalSeats.
        var used = await conn.ExecuteScalarAsync<long>(new CommandDefinition(
            "SELECT COUNT(*) FROM holds WHERE class_id = @classId AND status IN ('HELD', 'CONFIRMED')",
            new { classId }, tx, cancellationToken: ct));
        if (used >= cls.TotalSeats)
        {
            throw ApiException.Conflict(ErrorCodes.NoSeats, "No seats are available in this class.");
        }

        // Timestamps are truncated to whole seconds so expiresAt matches the documented format.
        var id = NewId("h_");
        HoldRow hold;
        try
        {
            hold = await conn.QuerySingleAsync<HoldRow>(new CommandDefinition("""
                INSERT INTO holds (id, class_id, student_id, status, created_at, expires_at)
                VALUES (@id, @classId, @studentId, 'HELD', @now,
                        date_trunc('second', @now) + make_interval(secs => @seconds))
                RETURNING id, class_id, student_id, status, created_at, expires_at
                """,
                new { id, classId, studentId, now, seconds = (double)options.HoldDurationSeconds }, tx, cancellationToken: ct));
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            // Unreachable while the class lock is held; kept as a database-level safety net.
            throw ApiException.Conflict(ErrorCodes.AlreadyApplied,
                "This student already has an active application for this class.");
        }

        await tx.CommitAsync(ct);

        return new HoldRow
        {
            Id = hold.Id, ClassId = hold.ClassId, ClassName = cls.Name, StudentId = hold.StudentId,
            Status = hold.Status, CreatedAt = hold.CreatedAt, ExpiresAt = hold.ExpiresAt,
        };
    }

    public async Task<HoldRow> GetHoldAsync(string holdId, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        var row = await conn.QuerySingleOrDefaultAsync<HoldRow>(new CommandDefinition($"""
            SELECT h.id, h.class_id, c.name AS class_name, h.student_id, {EffectiveStatusSql} AS status,
                   h.created_at, h.expires_at, h.confirmed_at, h.cancelled_at
            FROM holds h JOIN classes c ON c.id = h.class_id
            WHERE h.id = @holdId
            """, new { holdId }, cancellationToken: ct));
        return row ?? throw HoldNotFound();
    }

    public async Task<IReadOnlyList<HoldRow>> ListHoldsForStudentAsync(string studentId, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        var rows = await conn.QueryAsync<HoldRow>(new CommandDefinition($"""
            SELECT h.id, h.class_id, c.name AS class_name, h.student_id, {EffectiveStatusSql} AS status,
                   h.created_at, h.expires_at, h.confirmed_at, h.cancelled_at
            FROM holds h JOIN classes c ON c.id = h.class_id
            WHERE h.student_id = @studentId
            ORDER BY h.created_at DESC, h.id
            """, new { studentId }, cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<HoldRow> ConfirmHoldAsync(string holdId, string studentId, CancellationToken ct)
    {
        var (conn, tx, hold, now) = await LockHoldAsync(holdId, studentId, ct);
        await using (conn)
        await using (tx)
        {
            switch (hold.Status)
            {
                case HoldStatus.Confirmed:
                    // Idempotent: a repeated confirm succeeds but never counts the seat twice.
                    await tx.CommitAsync(ct);
                    return hold;
                case HoldStatus.Cancelled:
                    throw ApiException.Conflict(ErrorCodes.HoldCancelled, "This application was cancelled and cannot be confirmed.");
                case HoldStatus.Expired:
                    throw HoldExpired();
            }

            if (hold.ExpiresAt <= now)
            {
                await MarkExpiredAsync(conn, tx, holdId, ct);
                await tx.CommitAsync(ct);
                throw HoldExpired();
            }

            var confirmed = await conn.QuerySingleAsync<HoldRow>(new CommandDefinition("""
                UPDATE holds SET status = 'CONFIRMED', confirmed_at = @now
                WHERE id = @holdId
                RETURNING id, class_id, student_id, status, created_at, expires_at, confirmed_at
                """, new { holdId, now }, tx, cancellationToken: ct));
            await tx.CommitAsync(ct);
            return confirmed;
        }
    }

    public async Task CancelHoldAsync(string holdId, string studentId, CancellationToken ct)
    {
        var (conn, tx, hold, now) = await LockHoldAsync(holdId, studentId, ct);
        await using (conn)
        await using (tx)
        {
            switch (hold.Status)
            {
                case HoldStatus.Cancelled:
                    await tx.CommitAsync(ct); // idempotent
                    return;
                case HoldStatus.Confirmed:
                    throw ApiException.Conflict(ErrorCodes.CannotCancelConfirmed,
                        "A confirmed admission cannot be cancelled here.");
                case HoldStatus.Expired:
                    throw HoldExpired();
            }

            if (hold.ExpiresAt <= now)
            {
                await MarkExpiredAsync(conn, tx, holdId, ct);
                await tx.CommitAsync(ct);
                throw HoldExpired();
            }

            await conn.ExecuteAsync(new CommandDefinition(
                "UPDATE holds SET status = 'CANCELLED', cancelled_at = @now WHERE id = @holdId",
                new { holdId, now }, tx, cancellationToken: ct));
            await tx.CommitAsync(ct);
        }
    }

    /// <summary>
    /// Flips stale HELD rows to EXPIRED, one class at a time under the class lock (same lock
    /// order as every other operation, so it cannot deadlock with them). Purely cosmetic for the
    /// stored status column: counts already ignore expired holds.
    /// </summary>
    public async Task<int> SweepExpiredAsync(CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        var classIds = (await conn.QueryAsync<string>(new CommandDefinition(
            "SELECT DISTINCT class_id FROM holds WHERE status = 'HELD' AND expires_at <= clock_timestamp()",
            cancellationToken: ct))).AsList();

        var total = 0;
        foreach (var classId in classIds)
        {
            await using var tx = await conn.BeginTransactionAsync(ct);
            await conn.ExecuteAsync(new CommandDefinition(
                "SELECT 1 FROM classes WHERE id = @classId FOR UPDATE", new { classId }, tx, cancellationToken: ct));
            var now = await DbNowAsync(conn, tx, ct);
            total += await ExpireHeldForClassAsync(conn, tx, classId, now, ct);
            await tx.CommitAsync(ct);
        }
        return total;
    }

    // ---------------------------------------------------------------- helpers

    /// <summary>
    /// Opens a transaction holding the class lock and then the hold's row lock, and checks the
    /// hold belongs to <paramref name="studentId"/>. Caller owns the connection/transaction.
    /// </summary>
    private async Task<(NpgsqlConnection, NpgsqlTransaction, HoldRow, DateTime)> LockHoldAsync(
        string holdId, string studentId, CancellationToken ct)
    {
        var conn = await dataSource.OpenConnectionAsync(ct);
        NpgsqlTransaction? tx = null;
        try
        {
            var classId = await conn.QuerySingleOrDefaultAsync<string>(new CommandDefinition(
                "SELECT class_id FROM holds WHERE id = @holdId", new { holdId }, cancellationToken: ct))
                ?? throw HoldNotFound();

            tx = await conn.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

            // Same lock order as CreateHoldAsync: class first, then hold.
            await conn.ExecuteAsync(new CommandDefinition(
                "SELECT 1 FROM classes WHERE id = @classId FOR UPDATE", new { classId }, tx, cancellationToken: ct));

            var hold = await conn.QuerySingleAsync<HoldRow>(new CommandDefinition(
                "SELECT id, class_id, student_id, status, created_at, expires_at, confirmed_at, cancelled_at FROM holds WHERE id = @holdId FOR UPDATE",
                new { holdId }, tx, cancellationToken: ct));

            if (hold.StudentId != studentId)
            {
                throw ApiException.Forbidden(ErrorCodes.NotYourHold, "This application belongs to a different student.");
            }

            var now = await DbNowAsync(conn, tx, ct);
            return (conn, tx, hold, now);
        }
        catch
        {
            if (tx is not null) await tx.DisposeAsync();
            await conn.DisposeAsync();
            throw;
        }
    }

    private static Task<DateTime> DbNowAsync(NpgsqlConnection conn, NpgsqlTransaction tx, CancellationToken ct) =>
        // clock_timestamp() (not now()) because now() is frozen at transaction start, which may be
        // before we waited for the lock.
        conn.ExecuteScalarAsync<DateTime>(new CommandDefinition("SELECT clock_timestamp()", transaction: tx, cancellationToken: ct));

    private static Task<int> ExpireHeldForClassAsync(NpgsqlConnection conn, NpgsqlTransaction tx, string classId, DateTime now, CancellationToken ct) =>
        conn.ExecuteAsync(new CommandDefinition(
            "UPDATE holds SET status = 'EXPIRED' WHERE class_id = @classId AND status = 'HELD' AND expires_at <= @now",
            new { classId, now }, tx, cancellationToken: ct));

    private static Task MarkExpiredAsync(NpgsqlConnection conn, NpgsqlTransaction tx, string holdId, CancellationToken ct) =>
        conn.ExecuteAsync(new CommandDefinition(
            "UPDATE holds SET status = 'EXPIRED' WHERE id = @holdId AND status = 'HELD'",
            new { holdId }, tx, cancellationToken: ct));

    private static string NewId(string prefix) =>
        prefix + Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(8));

    private static ApiException ClassNotFound() =>
        ApiException.NotFound(ErrorCodes.ClassNotFound, "Class not found.");

    private static ApiException HoldNotFound() =>
        ApiException.NotFound(ErrorCodes.HoldNotFound, "Application (hold) not found.");

    private static ApiException HoldExpired() =>
        ApiException.Conflict(ErrorCodes.HoldExpired, "This application's hold has expired.");
}
