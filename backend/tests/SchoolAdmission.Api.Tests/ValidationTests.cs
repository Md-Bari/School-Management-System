using System.Net;
using System.Net.Http.Json;
using System.Text;
using SchoolAdmission.Api.Tests.Infrastructure;

namespace SchoolAdmission.Api.Tests;

/// <summary>Rule 7: bad input always gives 4xx, never 500.</summary>
[Collection("api")]
public sealed class ValidationTests(ApiFixture fixture)
{
    [Fact]
    public async Task CreateClass_ReturnsContractShape()
    {
        var client = fixture.Factory.CreateClient();
        var res = await client.PostAsJsonAsync("/classes", new { name = "Class 6 - Morning Shift", totalSeats = 120 });

        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        var body = await res.JsonAsync();
        Assert.False(string.IsNullOrEmpty(body.GetProperty("id").GetString()));
        Assert.Equal("Class 6 - Morning Shift", body.GetProperty("name").GetString());
        Assert.Equal(120, body.GetProperty("totalSeats").GetInt32());

        var listed = (await client.GetJsonAsync("/classes")).EnumerateArray()
            .Single(c => c.GetProperty("id").GetString() == body.GetProperty("id").GetString());
        Assert.Equal(120, listed.GetProperty("availableSeats").GetInt32());
        Assert.Equal(0, listed.GetProperty("heldSeats").GetInt32());
        Assert.Equal(0, listed.GetProperty("confirmedSeats").GetInt32());
    }

    [Theory]
    [InlineData("""{"name":"Class 6","totalSeats":0}""")]
    [InlineData("""{"name":"Class 6","totalSeats":-5}""")]
    [InlineData("""{"name":"Class 6","totalSeats":12.5}""")]
    [InlineData("""{"name":"Class 6","totalSeats":"120"}""")]
    [InlineData("""{"name":"Class 6","totalSeats":99999999999}""")]
    [InlineData("""{"name":"Class 6"}""")]
    [InlineData("""{"name":"","totalSeats":10}""")]
    [InlineData("""{"name":"   ","totalSeats":10}""")]
    [InlineData("""{"name":42,"totalSeats":10}""")]
    [InlineData("""{"totalSeats":10}""")]
    [InlineData("""[1,2,3]""")]
    [InlineData("""not json at all""")]
    [InlineData("""{"name":"Class 6","totalSeats":10""")]
    [InlineData("")]
    public async Task CreateClass_BadInput_Returns400(string body)
    {
        var client = fixture.Factory.CreateClient();
        var res = await client.PostAsync("/classes", new StringContent(body, Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.False(string.IsNullOrEmpty(await res.ErrorCodeAsync()));
    }

    [Theory]
    [InlineData(null, "MISSING_STUDENT_ID")]
    [InlineData("", "MISSING_STUDENT_ID")]
    [InlineData("12345", "INVALID_STUDENT_ID")]
    [InlineData("123456789012345678", "INVALID_STUDENT_ID")]
    [InlineData("2015269123456789A", "INVALID_STUDENT_ID")]
    [InlineData("২০১৫২৬৯১২৩৪৫৬৭৮৯০", "INVALID_STUDENT_ID")]
    public async Task Hold_WithMissingOrInvalidStudentId_Returns400(string? studentId, string expectedCode)
    {
        var client = fixture.Factory.CreateClient();
        var classId = await client.CreateClassAsync(5);
        var req = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        if (studentId is not null) req.Headers.TryAddWithoutValidation("X-Student-Id", studentId);
        var res = await client.SendAsync(req);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal(expectedCode, await res.ErrorCodeAsync());
    }

    [Fact]
    public async Task UnknownIds_Return404()
    {
        var client = fixture.Factory.CreateClient();
        var student = TestHelpers.NewStudentId();

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/classes/does-not-exist")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostHoldAsync("c_missing", student)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/holds/h_missing")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.ConfirmAsync("h_missing", student)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.CancelAsync("h_missing", student)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/no/such/route")).StatusCode);
    }

    [Fact]
    public async Task MyHolds_WithoutStudentId_Returns400()
    {
        var client = fixture.Factory.CreateClient();
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/me/holds")).StatusCode);
    }
}
