using System.ComponentModel.DataAnnotations;
using System.Text.Json.Nodes;
using SociedadeConsumidores.Domain;

namespace SociedadeConsumidores.Application;

public record AuthRegisterRequest(
    [Required] string full_name,
    [Required, EmailAddress] string email,
    [Required] string password,
    Guid? referrer_id,
    string? referrer_name);

public record AuthLoginRequest([Required, EmailAddress] string email, [Required] string password);
public record RefreshTokenRequest([Required] string refresh_token);
public record VerifyEmailCodeRequest([Required, EmailAddress] string email, [Required] string code);
public record RequestPasswordResetRequest([Required, EmailAddress] string email);
public record ResetPasswordRequest([Required, EmailAddress] string email, [Required] string token, [Required] string newPassword);
public record RegisterPartnerRequest(JsonObject partnerData, Guid? referrerPartnerId, string? referrerName);
public record AsaasChargeRequest(Guid partnerId, string? cpf, decimal? valor, string? descricao, int diasVencimento = 3);
public record ProcessPurchasePaymentRequest(Guid financeiroId, Guid partnerId);
public record GenericCompatRequest(Dictionary<string, object?> filters, string? sort = null, int? limit = null);

public record AuthResponse(
    bool success,
    string token,
    string refresh_token,
    object user,
    Partner? partner);
