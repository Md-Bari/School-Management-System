using System.Net;
using SchoolAdmission.Api.Tests.Infrastructure;

namespace SchoolAdmission.Api.Tests;

/// <summary>
/// Rule 1: held + confirmed never exceeds totalSeats, however many requests arrive at once.
/// </summary>
[Collection("api")]
public sealed class ConcurrencyTests(ApiFixture fixture)
{
    [Fact]
    public async Task ManyStudentsAtOnce_NeverHoldMoreThanTotalSeats()
    {
        const int seats = 20;
        const int requests = 150;
        var client = fixture.Factory.CreateClient();
        var classId = await client.CreateClassAsync(seats);

        // Release every request at the same moment.
        using var gate = new SemaphoreSlim(0);
        var tasks = Enumerable.Range(0, requests).Select(async _ =>
        {
            var studentId = TestHelpers.NewStudentId();
            await gate.WaitAsync();
            return await client.PostHoldAsync(classId, studentId);
        }).ToList();
        gate.Release(requests);
        var responses = await Task.WhenAll(tasks);

        Assert.Equal(seats, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(requests - seats, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));

        var cls = await client.GetJsonAsync($"/classes/{classId}");
        Assert.Equal(seats, cls.GetProperty("heldSeats").GetInt32());
        Assert.Equal(0, cls.GetProperty("availableSeats").GetInt32());
    }

    [Fact]
    public async Task TwoBackendProcessesSharingTheDatabase_NeverOversell()
    {
        // Bonus requirement: two independent API instances (separate hosts, separate connection
        // pools — exactly like two processes on different ports) hammer the same class.
        await using var second = new ApiFactory(fixture.Database.ConnectionString);
        var clientA = fixture.Factory.CreateClient();
        var clientB = second.CreateClient();

        const int seats = 15;
        var classId = await clientA.CreateClassAsync(seats);

        using var gate = new SemaphoreSlim(0);
        var tasks = Enumerable.Range(0, 120).Select(async i =>
        {
            var studentId = TestHelpers.NewStudentId();
            await gate.WaitAsync();
            var hold = await (i % 2 == 0 ? clientA : clientB).PostHoldAsync(classId, studentId);
            if (hold.StatusCode == HttpStatusCode.Created && i % 3 == 0)
            {
                // Mix in confirms on the other instance to make sure confirm + hold interleave safely.
                var holdId = (await hold.JsonAsync()).GetProperty("holdId").GetString()!;
                await (i % 2 == 0 ? clientB : clientA).ConfirmAsync(holdId, studentId);
            }
            return hold.StatusCode;
        }).ToList();
        gate.Release(120);
        var statuses = await Task.WhenAll(tasks);

        Assert.Equal(seats, statuses.Count(s => s == HttpStatusCode.Created));

        var cls = await clientB.GetJsonAsync($"/classes/{classId}");
        var used = cls.GetProperty("heldSeats").GetInt32() + cls.GetProperty("confirmedSeats").GetInt32();
        Assert.Equal(seats, used);
    }

    [Fact]
    public async Task SameStudentApplyingManyTimesAtOnce_GetsExactlyOneHold()
    {
        var client = fixture.Factory.CreateClient();
        var classId = await client.CreateClassAsync(50);
        var studentId = TestHelpers.NewStudentId();

        using var gate = new SemaphoreSlim(0);
        var tasks = Enumerable.Range(0, 30).Select(async _ =>
        {
            await gate.WaitAsync();
            return await client.PostHoldAsync(classId, studentId);
        }).ToList();
        gate.Release(30);
        var responses = await Task.WhenAll(tasks);

        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(29, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        Assert.Equal(1, (await client.GetJsonAsync($"/classes/{classId}")).GetProperty("heldSeats").GetInt32());
    }

    [Fact]
    public async Task ConfirmingTheSameHoldConcurrently_CountsTheSeatOnce()
    {
        var client = fixture.Factory.CreateClient();
        var classId = await client.CreateClassAsync(5);
        var studentId = TestHelpers.NewStudentId();
        var holdId = (await (await client.PostHoldAsync(classId, studentId)).JsonAsync()).GetProperty("holdId").GetString()!;

        var responses = await Task.WhenAll(Enumerable.Range(0, 20).Select(_ => client.ConfirmAsync(holdId, studentId)));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        var cls = await client.GetJsonAsync($"/classes/{classId}");
        Assert.Equal(1, cls.GetProperty("confirmedSeats").GetInt32());
        Assert.Equal(0, cls.GetProperty("heldSeats").GetInt32());
        Assert.Equal(4, cls.GetProperty("availableSeats").GetInt32());
    }
}
