using Dapper;
using Npgsql;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Endpoints;
using SchoolAdmission.Api.Infrastructure;
using SchoolAdmission.Api.Services;

DefaultTypeMap.MatchNamesWithUnderscores = true;

var builder = WebApplication.CreateBuilder(args);

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
app.MapClassEndpoints();
app.MapHoldEndpoints();

await app.Services.GetRequiredService<DatabaseInitializer>().InitializeAsync(app.Lifetime.ApplicationStopping);

app.Run();

// Exposed for WebApplicationFactory in the integration tests.
public partial class Program;
