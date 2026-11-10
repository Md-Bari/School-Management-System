using System.Net;
using SchoolAdmission.Api.Tests.Infrastructure;

namespace SchoolAdmission.Api.Tests;

/// <summary>
/// Optional rule ONE_ADMISSION_PER_STUDENT=true: a student can be admitted to only one class.
/// Runs against its own database, because switching the rule on creates a unique index that
/// must not leak into the tests of the default (brief) behaviour.
/// </summary>
public sealed class OneAdmissionPerStudentTests : IAsyncLifetime
{
    private readonly TestDatabase _database = new();
    private ApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        await _database.InitializeAsync();
        _factory = new ApiFactory(_database.ConnectionString, oneAdmissionPerStudent: true);
    }

    public async Task DisposeAsync()
    {
        await _factory.DisposeAsync();
        await _database.DisposeAsync();
    }

    private static async Task<string> HoldIdAsync(HttpResponseMessage res)
    {
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        return (await res.JsonAsync()).GetProperty("holdId").GetString()!;
    }

    [Fact]
    public async Task Settings_ReportTheRuleAsOn()
    {
        var settings = await _factory.CreateClient().GetJsonAsync("/settings");
        Assert.True(settings.GetProperty("oneAdmissionPerStudent").GetBoolean());
    }

    [Fact]
    public async Task AdmittedStudent_CannotApplyToAnotherClass()
    {
        var client = _factory.CreateClient();
        var morning = await client.CreateClassAsync(5, "Class 6 - Morning Shift");
        var day = await client.CreateClassAsync(5, "Class 6 - Day Shift");
        var student = TestHelpers.NewStudentId();

        var holdId = await HoldIdAsync(await client.PostHoldAsync(morning, student));
        Assert.Equal(HttpStatusCode.OK, (await client.ConfirmAsync(holdId, student)).StatusCode);

        var other = await client.PostHoldAsync(day, student);
        Assert.Equal(HttpStatusCode.Conflict, other.StatusCode);
        Assert.Equal("ALREADY_ADMITTED", await other.ErrorCodeAsync());
    }

    [Fact]
    public async Task ConfirmingOneClass_CancelsTheStudentsOtherHolds_AndFreesThoseSeats()
    {
        var client = _factory.CreateClient();
        var classA = await client.CreateClassAsync(1);
        var classB = await client.CreateClassAsync(1);
        var student = TestHelpers.NewStudentId();

        var holdA = await HoldIdAsync(await client.PostHoldAsync(classA, student));
        var holdB = await HoldIdAsync(await client.PostHoldAsync(classB, student));

        Assert.Equal(HttpStatusCode.OK, (await client.ConfirmAsync(holdA, student)).StatusCode);

        Assert.Equal("CANCELLED", (await client.GetJsonAsync($"/holds/{holdB}")).GetProperty("status").GetString());
        Assert.Equal(1, (await client.GetJsonAsync($"/classes/{classB}")).GetProperty("availableSeats").GetInt32());
        Assert.Equal(HttpStatusCode.Conflict, (await client.ConfirmAsync(holdB, student)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await client.PostHoldAsync(classB, TestHelpers.NewStudentId())).StatusCode);
    }

    [Fact]
    public async Task ConfirmingHoldsInManyClassesAtOnce_AdmitsTheStudentExactlyOnce()
    {
        var client = _factory.CreateClient();
        var student = TestHelpers.NewStudentId();
        var holds = new List<string>();
        var classes = new List<string>();
        for (var i = 0; i < 5; i++)
        {
            var classId = await client.CreateClassAsync(3);
            classes.Add(classId);
            holds.Add(await HoldIdAsync(await client.PostHoldAsync(classId, student)));
        }

        using var gate = new SemaphoreSlim(0);
        var tasks = holds.Select(async h =>
        {
            await gate.WaitAsync();
            return await client.ConfirmAsync(h, student);
        }).ToList();
        gate.Release(holds.Count);
        var responses = await Task.WhenAll(tasks);

        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.OK));
        Assert.All(responses.Where(r => r.StatusCode != HttpStatusCode.OK),
            r => Assert.Equal(HttpStatusCode.Conflict, r.StatusCode));

        var confirmedTotal = 0;
        foreach (var classId in classes)
        {
            confirmedTotal += (await client.GetJsonAsync($"/classes/{classId}")).GetProperty("confirmedSeats").GetInt32();
        }
        Assert.Equal(1, confirmedTotal);
    }
}
