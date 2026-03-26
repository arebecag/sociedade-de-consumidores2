namespace SociedadeConsumidores.Infrastructure;

public class JwtOptions
{
    public string Issuer { get; set; } = "SociedadeConsumidores";
    public string Audience { get; set; } = "SociedadeConsumidores.Frontend";
    public string SigningKey { get; set; } = "change-me-super-secret-key";
    public int AccessTokenMinutes { get; set; } = 60 * 24 * 30;
    public int RefreshTokenDays { get; set; } = 30;
}

public class EmailOptions
{
    public string FromName { get; set; } = "Sociedade de Consumidores";
    public string FromAddress { get; set; } = "no-reply@example.com";
    public string SmtpHost { get; set; } = string.Empty;
    public int SmtpPort { get; set; } = 587;
    public string SmtpUser { get; set; } = string.Empty;
    public string SmtpPassword { get; set; } = string.Empty;
    public bool UseSsl { get; set; } = true;
}

public class AsaasOptions
{
    public string BaseUrl { get; set; } = "https://api.asaas.com/v3";
    public string ApiKey { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;
}

public class BlingOptions
{
    public string BaseUrl { get; set; } = "https://api.bling.com.br/Api/v3";
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = string.Empty;
}
