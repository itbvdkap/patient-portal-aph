FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY backend/PatientApi/PatientApi.csproj backend/PatientApi/
RUN dotnet restore backend/PatientApi/PatientApi.csproj
COPY backend/PatientApi backend/PatientApi
RUN dotnet publish backend/PatientApi/PatientApi.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://0.0.0.0:5080 ASPNETCORE_ENVIRONMENT=Production
EXPOSE 5080
ENTRYPOINT ["dotnet", "PatientApi.dll"]
