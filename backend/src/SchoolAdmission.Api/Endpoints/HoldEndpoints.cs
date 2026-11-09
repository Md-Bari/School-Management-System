using SchoolAdmission.Api.Infrastructure;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Endpoints;

public static class HoldEndpoints
{
    public static void MapHoldEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/classes/{classId}/holds", async (string classId, HttpRequest request, AdmissionService service, CancellationToken ct) =>
        {
            var studentId = StudentIdHeader.Require(request);
            var hold = await service.CreateHoldAsync(classId, studentId, ct);
            return Results.Created($"/holds/{hold.Id}",
                new HoldCreatedResponse(hold.Id, hold.ClassId, hold.StudentId, hold.Status, hold.ExpiresAt, hold.ClassName, hold.CreatedAt));
        });

        app.MapGet("/holds/{holdId}", async (string holdId, AdmissionService service, CancellationToken ct) =>
        {
            var h = await service.GetHoldAsync(holdId, ct);
            return Results.Ok(new HoldStatusResponse(h.Id, h.ClassId, h.Status, h.ExpiresAt, h.ClassName, h.StudentId, h.ConfirmedAt, h.CreatedAt));
        });

        app.MapPost("/holds/{holdId}/confirm", async (string holdId, HttpRequest request, AdmissionService service, CancellationToken ct) =>
        {
            var studentId = StudentIdHeader.Require(request);
            var h = await service.ConfirmHoldAsync(holdId, studentId, ct);
            return Results.Ok(new HoldConfirmedResponse(h.Id, h.Status, h.ClassId, h.ConfirmedAt));
        });

        app.MapDelete("/holds/{holdId}", async (string holdId, HttpRequest request, AdmissionService service, CancellationToken ct) =>
        {
            var studentId = StudentIdHeader.Require(request);
            await service.CancelHoldAsync(holdId, studentId, ct);
            return Results.NoContent();
        });

        app.MapGet("/me/holds", async (HttpRequest request, AdmissionService service, CancellationToken ct) =>
        {
            var studentId = StudentIdHeader.Require(request);
            var holds = await service.ListHoldsForStudentAsync(studentId, ct);
            return Results.Ok(holds.Select(h =>
                new MyHoldResponse(h.Id, h.ClassId, h.ClassName, h.Status, h.ExpiresAt, h.CreatedAt, h.ConfirmedAt)));
        });
    }
}
