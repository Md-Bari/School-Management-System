using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace SchoolAdmission.Api.Tests.Infrastructure;

/// <summary>
/// Creates a throw-away PostgreSQL database for the test run and drops it afterwards.
/// Server comes from TEST_DB_CONNECTION_STRING (defaults to the docker-compose db on localhost:5433).
/// </summary>
public sealed class TestDatabase : IAsyncLifetime
{
    private const string DefaultAdmin = "Host=localhost;Port=5433;Username=postgres;Password=postgres;Database=postgres";

    private readonly string _adminConnectionString =
        Environment.GetEnvironmentVariable("TEST_DB_CONNECTION_STRING") is { Length: > 0 } cs ? cs : DefaultAdmin;

    private readonly string _databaseName = "admission_test_" + Guid.NewGuid().ToString("N")[..12];

    public string ConnectionString { get; private set; } = "";

    public async Task InitializeAsync()
    {
        await using var conn = new NpgsqlConnection(_adminConnectionString);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand($"CREATE DATABASE \"{_databaseName}\"", conn);
        await cmd.ExecuteNonQueryAsync();

        ConnectionString = new NpgsqlConnectionStringBuilder(_adminConnectionString)
        {
            Database = _databaseName,
        }.ConnectionString;
    }

    public async Task DisposeAsync()
    {
        NpgsqlConnection.ClearAllPools();
        await using var conn = new NpgsqlConnection(_adminConnectionString);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{_databaseName}\" WITH (FORCE)", conn);
        await cmd.ExecuteNonQueryAsync();
    }
}

/// <summary>An in-process instance of the API pointed at the test database.</summary>
public sealed class ApiFactory(string connectionString, int holdDurationSeconds = 600) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["DATABASE_CONNECTION_STRING"] = connectionString,
            ["ConnectionStrings:Default"] = connectionString,
            ["HOLD_DURATION_SECONDS"] = holdDurationSeconds.ToString(),
        }));
    }
}

/// <summary>Shared database + default API instance for all tests in the "api" collection.</summary>
public sealed class ApiFixture : IAsyncLifetime
{
    public TestDatabase Database { get; } = new();
    public ApiFactory Factory { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        await Database.InitializeAsync();
        Factory = new ApiFactory(Database.ConnectionString);
        _ = Factory.Server; // start the host (runs schema creation)
    }

    public async Task DisposeAsync()
    {
        await Factory.DisposeAsync();
        await Database.DisposeAsync();
    }
}

[CollectionDefinition("api")]
public sealed class ApiCollection : ICollectionFixture<ApiFixture>;

public static class TestHelpers
{
    public static string NewStudentId() =>
        string.Concat(Enumerable.Range(0, 17).Select(i => i == 0 ? (char)('1' + Random.Shared.Next(9)) : (char)('0' + Random.Shared.Next(10))));

    public static async Task<string> CreateClassAsync(this HttpClient client, int seats, string? name = null)
    {
        var res = await client.PostAsJsonAsync("/classes", new { name = name ?? $"Class {Guid.NewGuid():N}", totalSeats = seats });
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("id").GetString()!;
    }

    public static Task<HttpResponseMessage> PostHoldAsync(this HttpClient client, string classId, string? studentId)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        if (studentId is not null) req.Headers.Add("X-Student-Id", studentId);
        return client.SendAsync(req);
    }

    public static Task<HttpResponseMessage> ConfirmAsync(this HttpClient client, string holdId, string studentId)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, $"/holds/{holdId}/confirm");
        req.Headers.Add("X-Student-Id", studentId);
        return client.SendAsync(req);
    }

    public static Task<HttpResponseMessage> CancelAsync(this HttpClient client, string holdId, string studentId)
    {
        var req = new HttpRequestMessage(HttpMethod.Delete, $"/holds/{holdId}");
        req.Headers.Add("X-Student-Id", studentId);
        return client.SendAsync(req);
    }

    public static async Task<JsonElement> GetJsonAsync(this HttpClient client, string url)
    {
        var res = await client.GetAsync(url);
        res.EnsureSuccessStatusCode();
        return await res.Content.ReadFromJsonAsync<JsonElement>();
    }

    public static async Task<JsonElement> JsonAsync(this HttpResponseMessage res) =>
        await res.Content.ReadFromJsonAsync<JsonElement>();

    public static async Task<string> ErrorCodeAsync(this HttpResponseMessage res) =>
        (await res.JsonAsync()).GetProperty("error").GetString()!;
}
