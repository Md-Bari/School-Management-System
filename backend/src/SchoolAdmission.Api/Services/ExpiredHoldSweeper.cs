using SchoolAdmission.Api.Infrastructure;

namespace SchoolAdmission.Api.Services;

/// <summary>
/// Periodically rewrites stale HELD rows as EXPIRED so the stored status is tidy.
/// Correctness never depends on this job: every count already ignores expired holds.
/// </summary>
public sealed class ExpiredHoldSweeper(
    AdmissionService service,
    AdmissionOptions options,
    ILogger<ExpiredHoldSweeper> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(options.SweepInterval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                var count = await service.SweepExpiredAsync(stoppingToken);
                if (count > 0)
                {
                    logger.LogInformation("Marked {Count} hold(s) as EXPIRED", count);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Expired-hold sweep failed; will retry");
            }
        }
    }
}
