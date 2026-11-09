# ---- build ---------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first so the package layer is cached between code changes.
COPY SchoolAdmission.sln ./
COPY src/SchoolAdmission.Api/SchoolAdmission.Api.csproj src/SchoolAdmission.Api/
COPY tests/SchoolAdmission.Api.Tests/SchoolAdmission.Api.Tests.csproj tests/SchoolAdmission.Api.Tests/
RUN dotnet restore SchoolAdmission.sln

COPY . .
RUN dotnet build SchoolAdmission.sln -c Release --no-restore

# ---- test (used by: docker compose --profile test run --rm backend-tests) --
FROM build AS test
ENTRYPOINT ["dotnet", "test", "SchoolAdmission.sln", "-c", "Release", "--no-build", "--logger", "console;verbosity=normal"]

# ---- publish -------------------------------------------------------------
FROM build AS publish
RUN dotnet publish src/SchoolAdmission.Api/SchoolAdmission.Api.csproj -c Release --no-restore -o /app/publish

# ---- runtime (default target) -------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENV ASPNETCORE_HTTP_PORTS=8080 \
    ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "SchoolAdmission.Api.dll"]
