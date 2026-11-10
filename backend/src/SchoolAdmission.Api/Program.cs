using Dapper;
using Npgsql;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Endpoints;
using SchoolAdmission.Api.Infrastructure;
using SchoolAdmission.Api.Services;

DefaultTypeMap.MatchNamesWithUnderscores = true;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(k =>
{
    k.AddServerHeader = false;                       // don't advertise the server software
    k.Limits.MaxRequestBodySize = 64 * 1024;         // the largest valid body is a few hundred bytes
});

// All settings are resolved lazily from IConfiguration so that environment variables
// (and test overrides) are always honoured.
builder.Services.AddSingleton(sp => AdmissionOptions.FromConfiguration(sp.GetRequiredService<IConfiguration>()));
builder.Services.AddSingleton(sp =>
{
    var options = sp.GetRequiredService<AdmissionOptions>();
    return new NpgsqlDataSourceBuilder(options.ConnectionString).Build();
});
builder.Services.AddSingleton<DatabaseInitializer>();
builder.Services.AddSingleton<AdmissionService>();
builder.Services.AddHostedService<ExpiredHoldSweeper>();

builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.Converters.Add(new UtcDateTimeJsonConverter());
});

// Any origin is allowed because the frontend's URL is configurable and the API uses no cookies
// or credentials (identity is the X-Student-Id header), so there is nothing a foreign site could
// ride on.
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .AllowAnyOrigin()
    .AllowAnyMethod()
    .AllowAnyHeader()
    .WithExposedHeaders(ServerTimeHeaderMiddleware.HeaderName)));

var app = builder.Build();

// CORS and the server-time header add their headers via OnStarting, so they survive the
// error middleware clearing the response.
app.UseCors();
app.UseMiddleware<ServerTimeHeaderMiddleware>();
app.UseMiddleware<ErrorHandlingMiddleware>();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
// Read-only settings the UI adapts to (extra endpoint; the assignment's contract is unchanged).
app.MapGet("/settings", (AdmissionOptions o) => Results.Ok(new
{
    holdDurationSeconds = o.HoldDurationSeconds,
    oneAdmissionPerStudent = o.OneAdmissionPerStudent,
}));
app.MapClassEndpoints();
app.MapHoldEndpoints();

await app.Services.GetRequiredService<DatabaseInitializer>().InitializeAsync(app.Lifetime.ApplicationStopping);

app.Run();

// Exposed for WebApplicationFactory in the integration tests.
public partial class Program;
