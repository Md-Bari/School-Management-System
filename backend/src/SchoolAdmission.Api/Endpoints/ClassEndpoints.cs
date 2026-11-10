using System.Text.Json;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Infrastructure;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Endpoints;

public static class ClassEndpoints
{
    public const int MaxNameLength = 100;
    public const int MaxSeats = 10_000;

    public static void MapClassEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/classes", async (HttpRequest request, AdmissionService service, CancellationToken ct) =>
        {
            var (name, totalSeats) = await ReadCreateClassRequest(request, ct);
            var created = await service.CreateClassAsync(name, totalSeats, ct);
            return Results.Created($"/classes/{created.Id}",
                new ClassCreatedResponse(created.Id, created.Name, created.TotalSeats));
        });

        app.MapGet("/classes", async (AdmissionService service, CancellationToken ct) =>
            Results.Ok((await service.ListClassesAsync(ct)).Select(ToSummary)));

        app.MapGet("/classes/{classId}", async (string classId, AdmissionService service, CancellationToken ct) =>
            Results.Ok(ToSummary(await service.GetClassAsync(classId, ct))));
    }

    private static ClassSummaryResponse ToSummary(ClassRow c)
    {
        var held = (int)c.HeldSeats;
        var confirmed = (int)c.ConfirmedSeats;
        return new ClassSummaryResponse(c.Id, c.Name, c.TotalSeats, held, confirmed,
            Math.Max(0, c.TotalSeats - held - confirmed));
    }

    /// <summary>
    /// Control characters (including NUL, which PostgreSQL cannot store) and unpaired UTF-16
    /// surrogates are rejected so they produce a 400 instead of a database error.
    /// </summary>
    internal static bool HasInvalidCharacters(string value)
    {
        for (var i = 0; i < value.Length; i++)
        {
            var c = value[i];
            if (char.IsControl(c)) return true;
            if (char.IsHighSurrogate(c))
            {
                if (i + 1 < value.Length && char.IsLowSurrogate(value[i + 1]))
                {
                    i++;
                    continue;
                }
                return true;
            }
            if (char.IsLowSurrogate(c)) return true;
        }
        return false;
    }

    /// <summary>
    /// Parses the body by hand so every kind of bad input gets a precise 400 instead of a
    /// generic binder failure: wrong types, fractions, strings for numbers, missing fields, etc.
    /// </summary>
    private static async Task<(string Name, int TotalSeats)> ReadCreateClassRequest(HttpRequest request, CancellationToken ct)
    {
        JsonDocument doc;
        try
        {
            doc = await JsonDocument.ParseAsync(request.Body, cancellationToken: ct);
        }
        catch (JsonException)
        {
            throw ApiException.BadRequest(ErrorCodes.InvalidJson,
                "Request body must be a JSON object like {\"name\": \"Class 6 - Morning Shift\", \"totalSeats\": 120}.");
        }

        using (doc)
        {
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                throw ApiException.BadRequest(ErrorCodes.InvalidJson, "Request body must be a JSON object.");
            }

            var errors = new Dictionary<string, string>();

            string name = "";
            if (!root.TryGetProperty("name", out var nameEl) || nameEl.ValueKind != JsonValueKind.String)
            {
                errors["name"] = "name is required and must be a string.";
            }
            else
            {
                string? raw;
                try
                {
                    raw = nameEl.GetString();
                }
                catch (InvalidOperationException)
                {
                    raw = null; // invalid UTF-8 / UTF-16 inside the JSON string
                }

                if (raw is null || HasInvalidCharacters(raw))
                {
                    errors["name"] = "name contains invalid characters.";
                }
                else
                {
                    name = raw.Trim();
                    if (name.Length == 0) errors["name"] = "name must not be empty.";
                    else if (name.Length > MaxNameLength) errors["name"] = $"name must be at most {MaxNameLength} characters.";
                }
            }

            int totalSeats = 0;
            if (!root.TryGetProperty("totalSeats", out var seatsEl) || seatsEl.ValueKind != JsonValueKind.Number)
            {
                errors["totalSeats"] = "totalSeats is required and must be a number.";
            }
            else if (!seatsEl.TryGetInt32(out totalSeats))
            {
                errors["totalSeats"] = "totalSeats must be a whole number.";
            }
            else if (totalSeats < 1 || totalSeats > MaxSeats)
            {
                errors["totalSeats"] = $"totalSeats must be between 1 and {MaxSeats}.";
            }

            if (errors.Count > 0)
            {
                throw ApiException.BadRequest(ErrorCodes.ValidationError,
                    string.Join(" ", errors.Values), errors);
            }

            return (name, totalSeats);
        }
    }
}
