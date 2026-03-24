using System.Security.Claims;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SociedadeConsumidores.Application;
using SociedadeConsumidores.Infrastructure;

namespace SociedadeConsumidores.WebApi.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthService authService) : ControllerBase
{
    [HttpPost("register")] public Task<object> Register([FromBody] AuthRegisterRequest request, CancellationToken cancellationToken) => authService.RegisterAsync(request, cancellationToken);
    [HttpPost("login")] public Task<AuthResponse> Login([FromBody] AuthLoginRequest request, CancellationToken cancellationToken) => authService.LoginAsync(request, cancellationToken);
    [HttpPost("refresh")] public Task<object> Refresh([FromBody] RefreshTokenRequest request, CancellationToken cancellationToken) => authService.RefreshAsync(request, cancellationToken);
    [HttpPost("logout")] public async Task<IActionResult> Logout([FromBody] RefreshTokenRequest request, CancellationToken cancellationToken) { await authService.LogoutAsync(request.refresh_token, cancellationToken); return Ok(new { success = true }); }
    [HttpPost("me")] public Task<object> Me([FromBody] JsonObject payload, CancellationToken cancellationToken) => authService.MeAsync(payload["token"]?.ToString() ?? string.Empty, cancellationToken);
    [HttpPost("send-verification-code")] public Task<object> SendVerificationCode([FromBody] RequestPasswordResetRequest request, CancellationToken cancellationToken) => authService.SendVerificationCodeAsync(request.email, cancellationToken);
    [HttpPost("verify-email-code")] public Task<object> VerifyEmailCode([FromBody] VerifyEmailCodeRequest request, CancellationToken cancellationToken) => authService.VerifyEmailCodeAsync(request, cancellationToken);
    [HttpPost("request-password-reset")] public Task<object> RequestPasswordReset([FromBody] RequestPasswordResetRequest request, CancellationToken cancellationToken) => authService.RequestPasswordResetAsync(request.email, cancellationToken);
    [HttpPost("reset-password")] public Task<object> ResetPassword([FromBody] ResetPasswordRequest request, CancellationToken cancellationToken) => authService.ResetPasswordAsync(request, cancellationToken);
}

[ApiController]
[Authorize]
[Route("api/partners")]
public class PartnersController(IPartnerService partnerService, ApplicationDbContext db) : ControllerBase
{
    [HttpPost("register")]
    public async Task<object> Register([FromBody] RegisterPartnerRequest request, CancellationToken cancellationToken)
        => new { partner = await partnerService.RegisterPartnerAsync(request, cancellationToken) };

    [HttpGet("me")]
    public async Task<object> Me(CancellationToken cancellationToken)
    {
        var userId = Guid.Parse(User.FindFirstValue("uid")!);
        var partner = await db.Partners.FirstOrDefaultAsync(x => x.user_id == userId, cancellationToken);
        return new { partner };
    }
}

[ApiController]
[Authorize]
[Route("api/financeiro")]
public class FinanceiroController(IAsaasService asaasService, IPurchaseProcessingService purchaseProcessingService, ICommissionService commissionService) : ControllerBase
{
    [HttpPost("asaas/cobrancas")]
    public Task<object> GerarCobranca([FromBody] AsaasChargeRequest request, CancellationToken cancellationToken)
        => asaasService.GerarCobrancaAsync(request, User.FindFirstValue(ClaimTypes.Email) ?? string.Empty, cancellationToken);

    [HttpPost("process-purchase-payment")]
    public async Task<object> ProcessPurchase([FromBody] ProcessPurchasePaymentRequest request, CancellationToken cancellationToken)
    {
        var result = await purchaseProcessingService.ProcessPurchasePaymentAsync(request, cancellationToken);
        return result;
    }

    [HttpPost("distribuir-comissoes")]
    public Task<IReadOnlyList<object>> Distribuir([FromBody] JsonObject payload, CancellationToken cancellationToken)
        => commissionService.DistribuirComissoesAsync(Guid.Parse(payload["purchaseId"]!.ToString()), Guid.Parse(payload["buyerPartnerId"]!.ToString()), payload["amount"]!.GetValue<decimal>(), cancellationToken);
}

[ApiController]
[Route("api/webhooks")]
public class WebhooksController(IAsaasService asaasService, IBlingService blingService) : ControllerBase
{
    [HttpPost("asaas")]
    public Task<object> Asaas([FromBody] JsonObject payload, CancellationToken cancellationToken) => asaasService.ProcessWebhookAsync(payload, cancellationToken);

    [HttpPost("bling")]
    public Task<object> Bling([FromBody] JsonObject payload, CancellationToken cancellationToken) => blingService.ProcessWebhookAsync(payload, cancellationToken);
}

[ApiController]
[Authorize]
[Route("api/bling")]
public class BlingController(IBlingService blingService) : ControllerBase
{
    [HttpPost("auth-url")] public Task<object> AuthUrl(CancellationToken cancellationToken) => blingService.GerarAuthUrlAsync(cancellationToken);
    [HttpGet("callback")] public Task<object> Callback([FromQuery] string code, CancellationToken cancellationToken) => blingService.CallbackAsync(code, cancellationToken);
    [HttpPost("testar")] public Task<object> Testar(CancellationToken cancellationToken) => blingService.TestarConexaoAsync(cancellationToken);
    [HttpPost("renovar")] public Task<object> Renovar(CancellationToken cancellationToken) => blingService.RenovarTokenAsync(cancellationToken);
    [HttpPost("emitir-nota")]
    public Task<object> EmitirNota([FromBody] JsonObject payload, CancellationToken cancellationToken)
        => blingService.EmitirNotaAsync(Guid.Parse(payload["partnerId"]!.ToString()), payload["purchaseId"] is null ? null : Guid.Parse(payload["purchaseId"]!.ToString()), payload["productName"]?.ToString(), payload["amount"]?.GetValue<decimal>() ?? 0, cancellationToken);
    [HttpPost("emitir-nota-automatica")]
    public Task<object> EmitirNotaAutomatica([FromBody] JsonObject payload, CancellationToken cancellationToken)
        => blingService.EmitirNotaAutomaticaAsync(payload["payment_id"]?.ToString() ?? string.Empty, cancellationToken);
}

[ApiController]
[Authorize(Policy = "AdminOnly")]
[Route("api/admin")]
public class AdminController(ApplicationDbContext db) : ControllerBase
{
    [HttpGet("dashboard")]
    public async Task<object> Dashboard(CancellationToken cancellationToken)
    {
        var totalPartners = await db.Partners.CountAsync(cancellationToken);
        var totalAtivos = await db.Partners.CountAsync(x => x.status == "ativo", cancellationToken);
        var totalFinanceiro = await db.Financeiros.SumAsync(x => (decimal?)x.valor, cancellationToken) ?? 0;
        var pendentes = await db.Financeiros.CountAsync(x => x.status == "PENDING", cancellationToken);
        return new { totalPartners, totalAtivos, totalFinanceiro, pendentes };
    }
}

[ApiController]
[Route("api/compat")]
public class CompatController(IAuthService authService, IPartnerService partnerService, IAsaasService asaasService, IBlingService blingService, ICommissionService commissionService, IPurchaseProcessingService purchaseProcessingService, ICompatEntityService entities) : ControllerBase
{
    [HttpPost("functions/{name}")]
    public async Task<object> InvokeFunction(string name, [FromBody] JsonObject payload, CancellationToken cancellationToken)
    {
        return name switch
        {
            "authRegister" => await authService.RegisterAsync(new AuthRegisterRequest(payload["full_name"]!.ToString(), payload["email"]!.ToString(), payload["password"]!.ToString(), payload["referrer_id"] is null ? null : Guid.Parse(payload["referrer_id"]!.ToString()), payload["referrer_name"]?.ToString()), cancellationToken),
            "authLogin" => await authService.LoginAsync(new AuthLoginRequest(payload["email"]!.ToString(), payload["password"]!.ToString()), cancellationToken),
            "authMe" => await authService.MeAsync(payload["token"]!.ToString(), cancellationToken),
            "authLogout" => new { success = true },
            "registerPartner" => new { partner = await partnerService.RegisterPartnerAsync(new RegisterPartnerRequest(payload["partnerData"]!.AsObject(), payload["referrerPartnerId"] is null ? null : Guid.Parse(payload["referrerPartnerId"]!.ToString()), payload["referrerName"]?.ToString()), cancellationToken) },
            "requestPasswordReset" => await authService.RequestPasswordResetAsync(payload["email"]!.ToString(), cancellationToken),
            "resetPassword" => await authService.ResetPasswordAsync(new ResetPasswordRequest(payload["email"]!.ToString(), payload["token"]!.ToString(), payload["newPassword"]!.ToString()), cancellationToken),
            "sendEmailVerificationCode" => await authService.SendVerificationCodeAsync(payload["email"]!.ToString(), cancellationToken),
            "verifyEmailCode" => await authService.VerifyEmailCodeAsync(new VerifyEmailCodeRequest(payload["email"]!.ToString(), payload["code"]!.ToString()), cancellationToken),
            "asaasGerarCobranca" => await asaasService.GerarCobrancaAsync(new AsaasChargeRequest(Guid.Parse(payload["partnerId"]!.ToString()), payload["cpf"]?.ToString(), payload["valor"]?.GetValue<decimal>(), payload["descricao"]?.ToString(), payload["diasVencimento"]?.GetValue<int>() ?? 3), payload["email"]?.ToString() ?? string.Empty, cancellationToken),
            "blingGerarAuthUrl" => await blingService.GerarAuthUrlAsync(cancellationToken),
            "blingRenovarToken" => await blingService.RenovarTokenAsync(cancellationToken),
            "blingTestarConexao" => await blingService.TestarConexaoAsync(cancellationToken),
            "blingEmitirNota" => await blingService.EmitirNotaAsync(Guid.Parse(payload["partnerId"]!.ToString()), payload["purchaseId"] is null ? null : Guid.Parse(payload["purchaseId"]!.ToString()), payload["productName"]?.ToString(), payload["amount"]?.GetValue<decimal>() ?? 0, cancellationToken),
            "blingEmitirNotaAutomatica" => await blingService.EmitirNotaAutomaticaAsync(payload["payment_id"]!.ToString(), cancellationToken),
            "distribuirComissoes" => await commissionService.DistribuirComissoesAsync(Guid.Parse(payload["purchaseId"]!.ToString()), Guid.Parse(payload["buyerPartnerId"]!.ToString()), payload["amount"]!.GetValue<decimal>(), cancellationToken),
            "processPurchasePayment" => await purchaseProcessingService.ProcessPurchasePaymentAsync(new ProcessPurchasePaymentRequest(Guid.Parse(payload["financeiroId"]!.ToString()), Guid.Parse(payload["partnerId"]!.ToString())), cancellationToken),
            _ => throw new KeyNotFoundException($"Função não suportada: {name}")
        };
    }

    [HttpGet("entities/{entityName}/{id:guid}")]
    public Task<object?> GetEntity(string entityName, Guid id, CancellationToken cancellationToken) => entities.GetAsync(entityName, id, cancellationToken);

    [HttpGet("entities/{entityName}")]
    public Task<IReadOnlyList<object>> ListEntities(string entityName, [FromQuery] string? sort, [FromQuery] int? limit, CancellationToken cancellationToken) => entities.ListAsync(entityName, sort, limit, cancellationToken);

    [HttpPost("entities/{entityName}/filter")]
    public Task<IReadOnlyList<object>> FilterEntities(string entityName, [FromBody] GenericCompatRequest request, CancellationToken cancellationToken) => entities.FilterAsync(entityName, request.filters, request.sort, request.limit, cancellationToken);

    [HttpPost("entities/{entityName}")]
    public Task<object> CreateEntity(string entityName, [FromBody] JsonObject payload, CancellationToken cancellationToken) => entities.CreateAsync(entityName, payload, cancellationToken);

    [HttpPut("entities/{entityName}/{id:guid}")]
    public Task<object> UpdateEntity(string entityName, Guid id, [FromBody] JsonObject payload, CancellationToken cancellationToken) => entities.UpdateAsync(entityName, id, payload, cancellationToken);

    [HttpDelete("entities/{entityName}/{id:guid}")]
    public async Task<IActionResult> DeleteEntity(string entityName, Guid id, CancellationToken cancellationToken) { await entities.DeleteAsync(entityName, id, cancellationToken); return Ok(new { success = true }); }
}
