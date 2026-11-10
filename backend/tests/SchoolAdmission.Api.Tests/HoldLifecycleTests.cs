using System.Net;
using SchoolAdmission.Api.Tests.Infrastructure;

namespace SchoolAdmission.Api.Tests;

[Collection("api")]
public sealed class HoldLifecycleTests(ApiFixture fixture)
{
    [Fact]
    public async Task HoldThenConfirm_FollowsContractAndUpdatesCounts()
    {
        var client = fixture.Factory.CreateClient();
        var classId = await client.CreateClassAsync(3);
        var studentId = TestHelpers.NewStudentId();

        var holdRes = await client.PostHoldAsync(classId, studentId);
        Assert.Equal(HttpStatusCode.Created, holdRes.StatusCode);
        var hold = await holdRes.JsonAsync();
        var holdId = hold.GetProperty("holdId").GetString()!;
        Assert.Equal(classId, hold.GetProperty("classId").GetString());
        Assert.Equal(studentId, hold.GetProperty("studentId").GetString());
        Assert.Equal("HELD", hold.GetProperty("status").GetString());
        var expiresAt = DateTime.Parse(hold.GetProperty("expiresAt").GetString()!).ToUniversalTime();
        Assert.InRange(expiresAt, DateTime.UtcNow.AddSeconds(590), DateTime.UtcNow.AddSeconds(605));

        var cls = await client.GetJsonAsync($"/classes/{classId}");
        Assert.Equal(1, cls.GetProperty("heldSeats").GetInt32());
        Assert.Equal(2, cls.GetProperty("availableSeats").GetInt32());

        var confirm = await client.ConfirmAsync(holdId, studentId);
        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);
        var confirmBody = await confirm.JsonAsync();
        Assert.Equal(holdId, confirmBody.GetProperty("holdId").GetString());
        Assert.Equal("CONFIRMED", confirmBody.GetProperty("status").GetString());

        // Second confirm is idempotent and does not double count.
        Assert.Equal(HttpStatusCode.OK, (await client.ConfirmAsync(holdId, studentId)).StatusCode);
        cls = await client.GetJsonAsync($"/classes/{classId}");
        Assert.Equal(0, cls.GetProperty("heldSeats").GetInt32());
        Assert.Equal(1, cls.GetProperty("confirmedSeats").GetInt32());
        Assert.Equal(2, cls.GetProperty("availableSeats").GetInt32());

        var status = await client.GetJsonAsync($"/holds/{holdId}");
        Assert.Equal("CONFIRMED", status.GetProperty("status").GetString());
    }

    [Fact]
    public async Task ExpiredHold_ReleasesSeatAutomatically_AndCannotBeConfirmed()
    {
        await using var shortHolds = new ApiFactory(fixture.Database.ConnectionString, holdDurationSeconds: 2);
        var client = shortHolds.CreateClient();
        var classId = await client.CreateClassAsync(1);
        var studentId = TestHelpers.NewStudentId();

        var holdId = (await (await client.PostHoldAsync(classId, studentId)).JsonAsync()).GetProperty("holdId").GetString()!;

        // Class is full while the hold is alive.
        var other = await client.PostHoldAsync(classId, TestHelpers.NewStudentId());
        Assert.Equal(HttpStatusCode.Conflict, other.StatusCode);
        Assert.Equal("NO_SEATS", await other.ErrorCodeAsync());

        await Task.Delay(TimeSpan.FromSeconds(3));

        // No API call was needed to release the seat.
        var cls = await client.GetJsonAsync($"/classes/{classId}");
        Assert.Equal(0, cls.GetProperty("heldSeats").GetInt32());
        Assert.Equal(1, cls.GetProperty("availableSeats").GetInt32());
        Assert.Equal("EXPIRED", (await client.GetJsonAsync($"/holds/{holdId}")).GetProperty("status").GetString());

        var confirm = await client.ConfirmAsync(holdId, studentId);
        Assert.Equal(HttpStatusCode.Conflict, confirm.StatusCode);
        Assert.Equal("HOLD_EXPIRED", await confirm.ErrorCodeAsync());

        // The same student may apply again once the old hold has expired.
        Assert.Equal(HttpStatusCode.Created, (await client.PostHoldAsync(classId, studentId)).StatusCode);
    }

    [Fact]
    public async Task OnlyTheOwningStudentCanConfirmOrCancel()
    {
        var client = fixture.Factory.CreateClient();
        var classId = await client.CreateClassAsync(2);
        var owner = TestHelpers.NewStudentId();
        var holdId = (await (await client.PostHoldAsync(classId, owner)).JsonAsync()).GetProperty("holdId").GetString()!;

        var stranger = TestHelpers.NewStudentId();
        var confirm = await client.ConfirmAsync(holdId, stranger);
        Assert.Equal(HttpStatusCode.Forbidden, confirm.StatusCode);
        Assert.Equal("NOT_YOUR_HOLD", await confirm.ErrorCodeAsync());
        Assert.Equal(HttpStatusCode.Forbidden, (await client.CancelAsync(holdId, stranger)).StatusCode);

        Assert.Equal("HELD", (await client.GetJsonAsync($"/holds/{holdId}")).GetProperty("status").GetString());
    }

    [Fact]
    public async Task Cancel_ReleasesSeat_AndStudentCanApplyAgain()
    {
        var client = fixture.Factory.CreateClient();
        var classId = await client.CreateClassAsync(1);
        var studentId = TestHelpers.NewStudentId();
        var holdId = (await (await client.PostHoldAsync(classId, studentId)).JsonAsync()).GetProperty("holdId").GetString()!;

        Assert.Equal(HttpStatusCode.Conflict, (await client.PostHoldAsync(classId, studentId)).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await client.CancelAsync(holdId, studentId)).StatusCode);
        Assert.Equal("CANCELLED", (await client.GetJsonAsync($"/holds/{holdId}")).GetProperty("status").GetString());
        Assert.Equal(1, (await client.GetJsonAsync($"/classes/{classId}")).GetProperty("availableSeats").GetInt32());

        var confirmCancelled = await client.ConfirmAsync(holdId, studentId);
        Assert.Equal(HttpStatusCode.Conflict, confirmCancelled.StatusCode);

        Assert.Equal(HttpStatusCode.Created, (await client.PostHoldAsync(classId, studentId)).StatusCode);
    }

    [Fact]
    public async Task ByDefault_StudentCanHoldAndConfirmInDifferentClasses_AsRule3IsPerClass()
    {
        var client = fixture.Factory.CreateClient();
        var morning = await client.CreateClassAsync(5, "Class 6 - Morning Shift");
        var day = await client.CreateClassAsync(5, "Class 6 - Day Shift");
        var student = "20152691234567890"; // the brief's own example ID, reused like an API test would

        foreach (var classId in new[] { morning, day })
        {
            var hold = await client.PostHoldAsync(classId, student);
            Assert.Equal(HttpStatusCode.Created, hold.StatusCode);
            var holdId = (await hold.JsonAsync()).GetProperty("holdId").GetString()!;
            Assert.Equal(HttpStatusCode.OK, (await client.ConfirmAsync(holdId, student)).StatusCode);
        }

        Assert.Equal(1, (await client.GetJsonAsync($"/classes/{morning}")).GetProperty("confirmedSeats").GetInt32());
        Assert.Equal(1, (await client.GetJsonAsync($"/classes/{day}")).GetProperty("confirmedSeats").GetInt32());

        var settings = await client.GetJsonAsync("/settings");
        Assert.False(settings.GetProperty("oneAdmissionPerStudent").GetBoolean());
        Assert.Equal(600, settings.GetProperty("holdDurationSeconds").GetInt32());
    }

    [Fact]
    public async Task FullClass_StudentWhoAlreadyHoldsItsSeat_IsToldAlreadyApplied_NotNoSeats()
    {
        var client = fixture.Factory.CreateClient();
        var classId = await client.CreateClassAsync(1);
        var student = TestHelpers.NewStudentId();
        Assert.Equal(HttpStatusCode.Created, (await client.PostHoldAsync(classId, student)).StatusCode);

        var again = await client.PostHoldAsync(classId, student);
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.Equal("ALREADY_APPLIED", await again.ErrorCodeAsync());

        var other = await client.PostHoldAsync(classId, TestHelpers.NewStudentId());
        Assert.Equal("NO_SEATS", await other.ErrorCodeAsync());
    }

    [Fact]
    public async Task CancellingTwice_IsIdempotent()
    {
        var client = fixture.Factory.CreateClient();
        var classId = await client.CreateClassAsync(2);
        var studentId = TestHelpers.NewStudentId();
        var holdId = (await (await client.PostHoldAsync(classId, studentId)).JsonAsync()).GetProperty("holdId").GetString()!;

        Assert.Equal(HttpStatusCode.NoContent, (await client.CancelAsync(holdId, studentId)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.CancelAsync(holdId, studentId)).StatusCode);
        Assert.Equal(2, (await client.GetJsonAsync($"/classes/{classId}")).GetProperty("availableSeats").GetInt32());
    }

    [Fact]
    public async Task ConfirmedSeats_CountTowardsCapacity()
    {
        var client = fixture.Factory.CreateClient();
        var classId = await client.CreateClassAsync(2);
        foreach (var _ in Enumerable.Range(0, 2))
        {
            var s = TestHelpers.NewStudentId();
            var holdId = (await (await client.PostHoldAsync(classId, s)).JsonAsync()).GetProperty("holdId").GetString()!;
            Assert.Equal(HttpStatusCode.OK, (await client.ConfirmAsync(holdId, s)).StatusCode);
        }

        var late = await client.PostHoldAsync(classId, TestHelpers.NewStudentId());
        Assert.Equal(HttpStatusCode.Conflict, late.StatusCode);
        Assert.Equal("NO_SEATS", await late.ErrorCodeAsync());

        var cls = await client.GetJsonAsync($"/classes/{classId}");
        Assert.Equal(2, cls.GetProperty("confirmedSeats").GetInt32());
        Assert.Equal(0, cls.GetProperty("availableSeats").GetInt32());
    }

    [Fact]
    public async Task ExpiresAt_UsesTheDocumentedUtcFormat()
    {
        var client = fixture.Factory.CreateClient();
        var classId = await client.CreateClassAsync(1);
        var hold = await (await client.PostHoldAsync(classId, TestHelpers.NewStudentId())).JsonAsync();

        // Same shape as the brief's example: "2026-11-01T04:10:00Z"
        Assert.Matches(@"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$", hold.GetProperty("expiresAt").GetString());
    }

    [Fact]
    public async Task ConfirmedStudent_CannotApplyAgainToSameClass()
    {
        var client = fixture.Factory.CreateClient();
        var classId = await client.CreateClassAsync(5);
        var studentId = TestHelpers.NewStudentId();
        var holdId = (await (await client.PostHoldAsync(classId, studentId)).JsonAsync()).GetProperty("holdId").GetString()!;
        await client.ConfirmAsync(holdId, studentId);

        var again = await client.PostHoldAsync(classId, studentId);
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.Equal("ALREADY_CONFIRMED", await again.ErrorCodeAsync());

        Assert.Equal(HttpStatusCode.Conflict, (await client.CancelAsync(holdId, studentId)).StatusCode);
    }

    [Fact]
    public async Task MyHolds_ListsOnlyThisStudentsApplicationsWithClassName()
    {
        var client = fixture.Factory.CreateClient();
        var classA = await client.CreateClassAsync(5, "Class 6 - Morning Shift");
        var classB = await client.CreateClassAsync(5, "Class 6 - Day Shift");
        var me = TestHelpers.NewStudentId();
        await client.PostHoldAsync(classA, me);
        await client.PostHoldAsync(classB, me);
        await client.PostHoldAsync(classA, TestHelpers.NewStudentId());

        var req = new HttpRequestMessage(HttpMethod.Get, "/me/holds");
        req.Headers.Add("X-Student-Id", me);
        var res = await client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var items = (await res.JsonAsync()).EnumerateArray().ToList();

        Assert.Equal(2, items.Count);
        Assert.All(items, i =>
        {
            Assert.Equal("HELD", i.GetProperty("status").GetString());
            Assert.False(string.IsNullOrEmpty(i.GetProperty("holdId").GetString()));
            Assert.False(string.IsNullOrEmpty(i.GetProperty("expiresAt").GetString()));
        });
        Assert.Contains(items, i => i.GetProperty("className").GetString() == "Class 6 - Day Shift");
    }
}
