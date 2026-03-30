using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using SociedadeConsumidores.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((ctx, services, configuration) => configuration
    .ReadFrom.Configuration(ctx.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console());

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection("Email"));
builder.Services.Configure<AsaasOptions>(builder.Configuration.GetSection("Asaas"));
builder.Services.Configure<BlingOptions>(builder.Configuration.GetSection("Bling"));

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

var jwt = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = key,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("admin"));
});

builder.Services.AddHttpClient("Asaas", (sp, client) =>
{
    var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<AsaasOptions>>().Value;
    client.BaseAddress = new Uri(options.BaseUrl.EndsWith('/') ? options.BaseUrl : options.BaseUrl + "/");
    client.DefaultRequestHeaders.Add("access_token", options.ApiKey);
    client.DefaultRequestHeaders.Add("User-Agent", "SociedadeConsumidores/1.0");
});

builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.PropertyNamingPolicy = null;
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IPartnerService, PartnerService>();
builder.Services.AddScoped<ICommissionService, CommissionService>();
builder.Services.AddScoped<IPurchaseProcessingService, PurchaseProcessingService>();
builder.Services.AddScoped<IAsaasService, AsaasService>();
builder.Services.AddScoped<IBlingService, BlingService>();
builder.Services.AddScoped<ICompatEntityService, CompatEntityService>();
builder.Services.AddHostedService<FinancialSyncWorker>();
builder.Services.AddHostedService<BlingRefreshWorker>();

var frontendUrl = builder.Configuration["Frontend:BaseUrl"] ?? "http://localhost:5173";
builder.Services.AddCors(options => options.AddPolicy("frontend", policy => policy
    .WithOrigins(frontendUrl)
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    db.Database.EnsureCreated();

    var databaseScriptsPath = Path.GetFullPath(Path.Combine(
        app.Environment.ContentRootPath,
        "..",
        "..",
        "database"));

    if (Directory.Exists(databaseScriptsPath))
    {
        var sqlScripts = Directory.GetFiles(databaseScriptsPath, "*.sql")
            .OrderBy(path => path, StringComparer.OrdinalIgnoreCase);

        foreach (var scriptPath in sqlScripts)
        {
            var scriptSql = File.ReadAllText(scriptPath);
            db.Database.ExecuteSqlRaw(scriptSql);
        }
    }
}

app.UseSerilogRequestLogging();
app.UseSwagger();
app.UseSwaggerUI();
app.UseCors("frontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/api/health", () => Results.Ok(new { ok = true, service = "SociedadeConsumidores.WebApi" }));
app.Run();
