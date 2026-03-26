using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Mail;
using System.Reflection;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using SociedadeConsumidores.Application;
using SociedadeConsumidores.Domain;

namespace SociedadeConsumidores.Infrastructure;

public interface IJwtTokenService
{
    Task<AuthResponse> CreateTokensAsync(LoginUser user, Partner? partner, CancellationToken cancellationToken = default);
    ClaimsPrincipal? ValidateAccessToken(string token);
}

public interface IEmailSender
{
    Task SendAsync(string to, string subject, string html, CancellationToken cancellationToken = default);
}

public interface IAuthService
{
    Task<object> RegisterAsync(AuthRegisterRequest request, CancellationToken cancellationToken = default);
    Task<AuthResponse> LoginAsync(AuthLoginRequest request, CancellationToken cancellationToken = default);
    Task<object> MeAsync(string token, CancellationToken cancellationToken = default);
    Task<object> RefreshAsync(RefreshTokenRequest request, CancellationToken cancellationToken = default);
    Task LogoutAsync(string refreshToken, CancellationToken cancellationToken = default);
    Task<object> SendVerificationCodeAsync(string email, CancellationToken cancellationToken = default);
    Task<object> VerifyEmailCodeAsync(VerifyEmailCodeRequest request, CancellationToken cancellationToken = default);
    Task<object> RequestPasswordResetAsync(string email, CancellationToken cancellationToken = default);
    Task<object> ResetPasswordAsync(ResetPasswordRequest request, CancellationToken cancellationToken = default);
}

public interface IPartnerService
{
    Task<Partner> RegisterPartnerAsync(RegisterPartnerRequest request, CancellationToken cancellationToken = default);
}

public interface ICommissionService
{
    Task<IReadOnlyList<object>> DistribuirComissoesAsync(Guid purchaseId, Guid buyerPartnerId, decimal amount, CancellationToken cancellationToken = default);
}

public interface IPurchaseProcessingService
{
    Task<object> ProcessPurchasePaymentAsync(ProcessPurchasePaymentRequest request, CancellationToken cancellationToken = default);
}

public interface IAsaasService
{
    Task<object> GerarCobrancaAsync(AsaasChargeRequest request, string userEmail, CancellationToken cancellationToken = default);
    Task<object> ProcessWebhookAsync(JsonObject payload, CancellationToken cancellationToken = default);
}

public interface IBlingService
{
    Task<object> GerarAuthUrlAsync(CancellationToken cancellationToken = default);
    Task<object> CallbackAsync(string code, CancellationToken cancellationToken = default);
    Task<object> TestarConexaoAsync(CancellationToken cancellationToken = default);
    Task<object> RenovarTokenAsync(CancellationToken cancellationToken = default);
    Task<object> EmitirNotaAsync(Guid partnerId, Guid? purchaseId, string? productName, decimal amount, CancellationToken cancellationToken = default);
    Task<object> EmitirNotaAutomaticaAsync(string paymentId, CancellationToken cancellationToken = default);
    Task<object> ProcessWebhookAsync(JsonObject payload, CancellationToken cancellationToken = default);
}

public interface ICompatEntityService
{
    Task<object?> GetAsync(string entityName, Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<object>> ListAsync(string entityName, string? sort = null, int? limit = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<object>> FilterAsync(string entityName, Dictionary<string, object?> filters, string? sort = null, int? limit = null, CancellationToken cancellationToken = default);
    Task<object> CreateAsync(string entityName, JsonObject payload, CancellationToken cancellationToken = default);
    Task<object> UpdateAsync(string entityName, Guid id, JsonObject payload, CancellationToken cancellationToken = default);
    Task DeleteAsync(string entityName, Guid id, CancellationToken cancellationToken = default);
}

public class JwtTokenService(IOptions<JwtOptions> jwtOptions, ApplicationDbContext dbContext) : IJwtTokenService
{
    private readonly JwtOptions _options = jwtOptions.Value;

    public async Task<AuthResponse> CreateTokensAsync(LoginUser user, Partner? partner, CancellationToken cancellationToken = default)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.email),
            new(ClaimTypes.Role, user.role),
            new("uid", user.id.ToString())
        };

        var token = new JwtSecurityToken(
            _options.Issuer,
            _options.Audience,
            claims,
            expires: DateTime.UtcNow.AddMinutes(_options.AccessTokenMinutes),
            signingCredentials: creds);

        var accessToken = new JwtSecurityTokenHandler().WriteToken(token);
        var refreshTokenValue = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        dbContext.RefreshTokens.Add(new RefreshToken
        {
            user_id = user.id,
            token = refreshTokenValue,
            expires_at = DateTime.UtcNow.AddDays(_options.RefreshTokenDays)
        });
        await dbContext.SaveChangesAsync(cancellationToken);

        return new AuthResponse(true, accessToken, refreshTokenValue, new
        {
            user.id,
            user.email,
            user.full_name,
            user.is_email_verified,
            user.status,
            user.role,
            partner_id = user.partner_id ?? partner?.id
        }, partner);
    }

    public ClaimsPrincipal? ValidateAccessToken(string token)
    {
        var handler = new JwtSecurityTokenHandler();
        try
        {
            return handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = _options.Issuer,
                ValidateAudience = true,
                ValidAudience = _options.Audience,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey)),
                ClockSkew = TimeSpan.FromMinutes(1)
            }, out _);
        }
        catch
        {
            return null;
        }
    }
}

public class SmtpEmailSender(IOptions<EmailOptions> options) : IEmailSender
{
    private readonly EmailOptions _options = options.Value;

    public async Task SendAsync(string to, string subject, string html, CancellationToken cancellationToken = default)
    {
        using var client = new SmtpClient(_options.SmtpHost, _options.SmtpPort)
        {
            EnableSsl = _options.UseSsl,
            Credentials = new NetworkCredential(_options.SmtpUser, _options.SmtpPassword)
        };

        using var message = new MailMessage(_options.FromAddress, to, subject, html)
        {
            IsBodyHtml = true,
            BodyEncoding = Encoding.UTF8,
            SubjectEncoding = Encoding.UTF8
        };
        await client.SendMailAsync(message, cancellationToken);
    }
}

public class AuthService(ApplicationDbContext db, IJwtTokenService jwt, IEmailSender emailSender) : IAuthService
{
    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();
    private static string HashPassword(string password) => BCrypt.Net.BCrypt.HashPassword(password, workFactor: 11);

    public async Task<object> RegisterAsync(AuthRegisterRequest request, CancellationToken cancellationToken = default)
    {
        var email = NormalizeEmail(request.email);
        if (await db.LoginUsers.AnyAsync(x => x.email == email, cancellationToken))
            throw new InvalidOperationException("E-mail já cadastrado");

        var user = new LoginUser
        {
            email = email,
            full_name = request.full_name.Trim(),
            password_hash = HashPassword(request.password),
            status = "active",
            role = UserRoles.parceiro,
            is_email_verified = false
        };
        db.LoginUsers.Add(user);
        await db.SaveChangesAsync(cancellationToken);
        try
        {
            await SendVerificationCodeAsync(email, cancellationToken);
        }
        catch
        {
            db.LoginUsers.Remove(user);
            await db.SaveChangesAsync(cancellationToken);
            throw;
        }

        return new { success = true, user_id = user.id, email, message = "Cadastro realizado! Verifique seu e-mail." };
    }

    public async Task<AuthResponse> LoginAsync(AuthLoginRequest request, CancellationToken cancellationToken = default)
    {
        var email = NormalizeEmail(request.email);
        var user = await db.LoginUsers.FirstOrDefaultAsync(x => x.email == email, cancellationToken)
            ?? throw new UnauthorizedAccessException("E-mail ou senha incorretos");

        if (!BCrypt.Net.BCrypt.Verify(request.password, user.password_hash))
            throw new UnauthorizedAccessException("E-mail ou senha incorretos");
        if (user.status == "blocked")
            throw new InvalidOperationException("Conta bloqueada. Entre em contato com o suporte.");

        user.last_login_at = DateTime.UtcNow;
        var partner = await db.Partners.FirstOrDefaultAsync(x => x.id == user.partner_id || x.email == user.email, cancellationToken);
        if (partner is not null && user.partner_id != partner.id)
            user.partner_id = partner.id;
        await db.SaveChangesAsync(cancellationToken);

        if (!user.is_email_verified)
            await SendVerificationCodeAsync(email, cancellationToken);

        return await jwt.CreateTokensAsync(user, partner, cancellationToken);
    }

    public async Task<object> MeAsync(string token, CancellationToken cancellationToken = default)
    {
        var principal = jwt.ValidateAccessToken(token) ?? throw new UnauthorizedAccessException("Token inválido ou expirado");
        var uid = Guid.Parse(principal.FindFirstValue("uid") ?? principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? principal.FindFirstValue(JwtRegisteredClaimNames.Sub)!);
        var user = await db.LoginUsers.FirstOrDefaultAsync(x => x.id == uid, cancellationToken)
            ?? throw new UnauthorizedAccessException("Usuário não encontrado");
        var partner = await db.Partners.FirstOrDefaultAsync(x => x.id == user.partner_id || x.email == user.email, cancellationToken);
        return new
        {
            user = new { user.id, user.email, user.full_name, user.is_email_verified, user.status, user.role, partner_id = user.partner_id ?? partner?.id },
            partner
        };
    }

    public async Task<object> RefreshAsync(RefreshTokenRequest request, CancellationToken cancellationToken = default)
    {
        var refresh = await db.RefreshTokens.FirstOrDefaultAsync(x => x.token == request.refresh_token && x.revoked_at == null, cancellationToken)
            ?? throw new UnauthorizedAccessException("Refresh token inválido");
        if (refresh.expires_at <= DateTime.UtcNow)
            throw new UnauthorizedAccessException("Refresh token expirado");
        var user = await db.LoginUsers.FindAsync([refresh.user_id], cancellationToken) ?? throw new UnauthorizedAccessException("Usuário inválido");
        var partner = await db.Partners.FirstOrDefaultAsync(x => x.id == user.partner_id || x.email == user.email, cancellationToken);
        refresh.revoked_at = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return await jwt.CreateTokensAsync(user, partner, cancellationToken);
    }

    public async Task LogoutAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var token = await db.RefreshTokens.FirstOrDefaultAsync(x => x.token == refreshToken, cancellationToken);
        if (token is not null)
        {
            token.revoked_at = DateTime.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<object> SendVerificationCodeAsync(string email, CancellationToken cancellationToken = default)
    {
        var normalized = NormalizeEmail(email);
        var user = await db.LoginUsers.FirstOrDefaultAsync(x => x.email == normalized, cancellationToken)
            ?? throw new KeyNotFoundException("Usuário não encontrado");
        var activeCodes = await db.EmailVerificationCodes.Where(x => x.user_id == user.id && !x.used).ToListAsync(cancellationToken);
        foreach (var item in activeCodes) item.used = true;
        var code = RandomNumberGenerator.GetInt32(100000, 999999).ToString();
        db.EmailVerificationCodes.Add(new EmailVerificationCode
        {
            user_id = user.id,
            email = normalized,
            code = code,
            expires_at = DateTime.UtcNow.AddHours(24),
            used = false
        });
        await db.SaveChangesAsync(cancellationToken);
        await emailSender.SendAsync(normalized, "Código de Verificação - Sociedade de Consumidores", $"<h2>Código de Verificação</h2><p>Seu código é:</p><h1 style='color:#f97316'>{code}</h1><p>Expira em 24 horas.</p>", cancellationToken);
        return new { success = true, message = "Código enviado para o e-mail" };
    }

    public async Task<object> VerifyEmailCodeAsync(VerifyEmailCodeRequest request, CancellationToken cancellationToken = default)
    {
        var email = NormalizeEmail(request.email);
        var entity = await db.EmailVerificationCodes
            .OrderByDescending(x => x.created_date)
            .FirstOrDefaultAsync(x => x.email == email && x.code == request.code && !x.used, cancellationToken)
            ?? throw new InvalidOperationException("Código inválido ou já utilizado");
        if (entity.expires_at < DateTime.UtcNow)
            throw new InvalidOperationException("Código expirado");
        entity.used = true;
        var user = await db.LoginUsers.FindAsync([entity.user_id], cancellationToken) ?? throw new KeyNotFoundException();
        user.is_email_verified = true;
        user.status = "active";
        await db.SaveChangesAsync(cancellationToken);
        return new { success = true, message = "E-mail verificado com sucesso!" };
    }

    public async Task<object> RequestPasswordResetAsync(string email, CancellationToken cancellationToken = default)
    {
        var normalized = NormalizeEmail(email);
        var user = await db.LoginUsers.FirstOrDefaultAsync(x => x.email == normalized, cancellationToken);
        if (user is null)
            return new { success = true, message = "Se o e-mail estiver cadastrado, você receberá as instruções" };

        var token = Guid.NewGuid().ToString("N");
        db.PasswordResetTokens.Add(new PasswordResetToken
        {
            user_id = user.id,
            email = normalized,
            token = token,
            expires_at = DateTime.UtcNow.AddHours(2),
            used = false
        });
        await db.SaveChangesAsync(cancellationToken);
        var resetCode = token.Split('-').FirstOrDefault() ?? token[..8];
        await emailSender.SendAsync(normalized, "Redefinição de Senha - Sociedade de Consumidores", $"<h2>Redefinição de Senha</h2><p>Seu código é:</p><h1 style='color:#f97316'>{resetCode[..8]}</h1><p>Expira em 2 horas.</p>", cancellationToken);
        return new { success = true, message = "Código enviado para o e-mail" };
    }

    public async Task<object> ResetPasswordAsync(ResetPasswordRequest request, CancellationToken cancellationToken = default)
    {
        var email = NormalizeEmail(request.email);
        var tokenPrefix = request.token.Trim().ToLowerInvariant();
        var token = await db.PasswordResetTokens.FirstOrDefaultAsync(x => x.email == email && !x.used && x.token.StartsWith(tokenPrefix), cancellationToken)
            ?? throw new InvalidOperationException("Código inválido ou expirado");
        if (token.expires_at < DateTime.UtcNow)
            throw new InvalidOperationException("Código inválido ou expirado");
        token.used = true;
        var user = await db.LoginUsers.FindAsync([token.user_id], cancellationToken) ?? throw new KeyNotFoundException();
        user.password_hash = HashPassword(request.newPassword);
        await db.SaveChangesAsync(cancellationToken);
        return new { success = true, message = "Senha redefinida com sucesso!" };
    }
}

public class PartnerService(ApplicationDbContext db) : IPartnerService
{
    public async Task<Partner> RegisterPartnerAsync(RegisterPartnerRequest request, CancellationToken cancellationToken = default)
    {
        var payload = request.partnerData;
        var email = payload["email"]?.GetValue<string>()?.Trim().ToLowerInvariant() ?? throw new InvalidOperationException("Dados incompletos");
        var existing = await db.Partners.FirstOrDefaultAsync(x => x.email == email, cancellationToken);
        if (existing is not null)
            return existing;
        var userId = payload["user_id"]?.GetValue<string>();
        Guid loginUserId = Guid.Empty;
        if (!Guid.TryParse(userId, out loginUserId))
        {
            var user = await db.LoginUsers.FirstOrDefaultAsync(x => x.email == email, cancellationToken) ?? throw new KeyNotFoundException("LoginUser não encontrado. Registre-se primeiro.");
            loginUserId = user.id;
        }

        var partner = new Partner
        {
            user_id = loginUserId,
            email = email,
            created_by = email,
            full_name = payload["full_name"]?.GetValue<string>() ?? string.Empty,
            display_name = payload["display_name"]?.GetValue<string>(),
            phone = payload["phone"]?.GetValue<string>(),
            gender = payload["gender"]?.GetValue<string>(),
            status = payload["status"]?.GetValue<string>() ?? PartnerStatuses.pendente,
            graduation = payload["graduation"]?.GetValue<string>() ?? "cliente_iniciante",
            first_purchase_done = payload["first_purchase_done"]?.GetValue<bool>() ?? false,
            total_bonus_generated = payload["total_bonus_generated"]?.GetValue<decimal>() ?? 0,
            bonus_for_withdrawal = payload["bonus_for_withdrawal"]?.GetValue<decimal>() ?? 0,
            bonus_for_purchases = payload["bonus_for_purchases"]?.GetValue<decimal>() ?? 0,
            total_withdrawn = payload["total_withdrawn"]?.GetValue<decimal>() ?? 0,
            total_spent_purchases = payload["total_spent_purchases"]?.GetValue<decimal>() ?? 0,
            groups_formed = payload["groups_formed"]?.GetValue<int>() ?? 0,
            notification_email = payload["notification_email"]?.GetValue<bool>() ?? true,
            notification_sms = payload["notification_sms"]?.GetValue<bool>() ?? false,
            notification_whatsapp = payload["notification_whatsapp"]?.GetValue<bool>() ?? false,
            notification_frequency = payload["notification_frequency"]?.GetValue<string>() ?? "semanalmente",
            email_verified = payload["email_verified"]?.GetValue<bool>() ?? false,
            phone_verified = payload["phone_verified"]?.GetValue<bool>() ?? false,
            accepted_terms = payload["accepted_terms"]?.GetValue<bool>() ?? false,
            accepted_rules = payload["accepted_rules"]?.GetValue<bool>() ?? false,
            unique_code = payload["unique_code"]?.GetValue<string>(),
            referrer_id = request.referrerPartnerId,
            referrer_name = request.referrerName,
            pending_reasons = payload["pending_reasons"]?.Deserialize<List<string>>() ?? ["Falta da primeira compra", "Falta de informações no cadastro"]
        };
        if (DateOnly.TryParse(payload["birth_date"]?.GetValue<string>(), out var birthDate)) partner.birth_date = birthDate;
        if (DateOnly.TryParse(payload["graduation_start_date"]?.GetValue<string>(), out var grad)) partner.graduation_start_date = grad;
        db.Partners.Add(partner);
        var loginUser = await db.LoginUsers.FindAsync([loginUserId], cancellationToken);
        if (loginUser is not null) loginUser.partner_id = partner.id;
        await db.SaveChangesAsync(cancellationToken);

        if (request.referrerPartnerId.HasValue)
            await CreateNetworkRelationsAsync(request.referrerPartnerId.Value, request.referrerName ?? string.Empty, partner.id, partner.full_name, cancellationToken);

        return partner;
    }

    private async Task CreateNetworkRelationsAsync(Guid referrerId, string referrerName, Guid newPartnerId, string newPartnerName, CancellationToken cancellationToken)
    {
        var directRelations = await db.NetworkRelations.Where(x => x.referrer_id == referrerId && x.relation_type == "direct").OrderBy(x => x.created_date).ToListAsync(cancellationToken);
        var grandpa = await db.NetworkRelations.FirstOrDefaultAsync(x => x.referred_id == referrerId && x.relation_type == "direct", cancellationToken);
        if (directRelations.Count < 3)
        {
            db.NetworkRelations.Add(new NetworkRelation { referrer_id = referrerId, referrer_name = referrerName, referred_id = newPartnerId, referred_name = newPartnerName, relation_type = "direct", is_spillover = false, level = 1 });
            if (grandpa is not null)
                db.NetworkRelations.Add(new NetworkRelation { referrer_id = grandpa.referrer_id, referrer_name = grandpa.referrer_name, referred_id = newPartnerId, referred_name = newPartnerName, relation_type = "indirect", is_spillover = false, level = 2 });
            await db.SaveChangesAsync(cancellationToken);
            return;
        }

        var firstThree = directRelations.Take(3).ToList();
        var childCounts = new List<(NetworkRelation child, int count)>();
        foreach (var child in firstThree)
        {
            var count = await db.NetworkRelations.CountAsync(x => x.referrer_id == child.referred_id && x.relation_type == "direct", cancellationToken);
            childCounts.Add((child, count));
        }

        var grupoCompleto = childCounts.All(x => x.count >= 3);
        if (grupoCompleto)
        {
            db.NetworkRelations.Add(new NetworkRelation { referrer_id = referrerId, referrer_name = referrerName, referred_id = newPartnerId, referred_name = newPartnerName, relation_type = "direct", is_spillover = false, level = 1 });
            if (grandpa is not null)
                db.NetworkRelations.Add(new NetworkRelation { referrer_id = grandpa.referrer_id, referrer_name = grandpa.referrer_name, referred_id = newPartnerId, referred_name = newPartnerName, relation_type = "indirect", is_spillover = false, level = 2 });
            var referrer = await db.Partners.FindAsync([referrerId], cancellationToken);
            if (referrer is not null) referrer.groups_formed += 1;
            await db.SaveChangesAsync(cancellationToken);
            return;
        }

        var target = childCounts.Where(x => x.count < 3).OrderBy(x => x.count).First();
        db.NetworkRelations.Add(new NetworkRelation { referrer_id = target.child.referred_id, referrer_name = target.child.referred_name, referred_id = newPartnerId, referred_name = newPartnerName, relation_type = "direct", is_spillover = true, level = 1 });
        db.NetworkRelations.Add(new NetworkRelation { referrer_id = referrerId, referrer_name = referrerName, referred_id = newPartnerId, referred_name = newPartnerName, relation_type = "indirect", is_spillover = true, level = 2 });
        var newPartner = await db.Partners.FindAsync([newPartnerId], cancellationToken);
        if (newPartner is not null)
        {
            newPartner.referrer_id = target.child.referred_id;
            newPartner.referrer_name = target.child.referred_name;
        }
        if (childCounts.Sum(x => x.count) + 1 >= 9)
        {
            var referrer = await db.Partners.FindAsync([referrerId], cancellationToken);
            if (referrer is not null) referrer.groups_formed += 1;
        }
        await db.SaveChangesAsync(cancellationToken);
    }
}

public class CommissionService(ApplicationDbContext db) : ICommissionService
{
    public async Task<IReadOnlyList<object>> DistribuirComissoesAsync(Guid purchaseId, Guid buyerPartnerId, decimal amount, CancellationToken cancellationToken = default)
    {
        var results = new List<object>();
        async Task HandleAsync(string relationType, decimal percentage, string bonusType)
        {
            var rel = await db.NetworkRelations.FirstOrDefaultAsync(x => x.referred_id == buyerPartnerId && x.relation_type == relationType, cancellationToken);
            if (rel is null) return;
            var partner = await db.Partners.FindAsync([rel.referrer_id], cancellationToken);
            if (partner is null) return;
            var exists = await db.BonusTransactions.AnyAsync(x => x.purchase_id == purchaseId && x.partner_id == partner.id, cancellationToken);
            if (exists) return;
            var forWithdrawal = amount * percentage;
            var forPurchases = forWithdrawal * 0.5m;
            var status = partner.status == PartnerStatuses.ativo ? "credited" : "blocked";
            db.BonusTransactions.Add(new BonusTransaction
            {
                partner_id = partner.id,
                partner_name = partner.full_name,
                source_partner_id = buyerPartnerId,
                source_partner_name = rel.referred_name,
                purchase_id = purchaseId,
                type = bonusType,
                percentage = percentage * 100,
                total_amount = forWithdrawal,
                amount_for_withdrawal = forWithdrawal,
                amount_for_purchases = forPurchases,
                status = status
            });
            if (status == "credited")
            {
                partner.total_bonus_generated += forWithdrawal;
                partner.bonus_for_withdrawal += forWithdrawal;
                partner.bonus_for_purchases += forPurchases;
            }
            results.Add(new { type = bonusType, partner = partner.full_name, total = forWithdrawal, forWithdrawal, forPurchases, status });
        }

        await HandleAsync("direct", 0.15m, "direct");
        await HandleAsync("indirect", 0.30m, "indirect");
        await db.SaveChangesAsync(cancellationToken);
        return results;
    }
}

public class PurchaseProcessingService(ApplicationDbContext db, IEmailSender emailSender) : IPurchaseProcessingService
{
    public async Task<object> ProcessPurchasePaymentAsync(ProcessPurchasePaymentRequest request, CancellationToken cancellationToken = default)
    {
        var partner = await db.Partners.FindAsync([request.partnerId], cancellationToken) ?? throw new KeyNotFoundException("Parceiro não encontrado");
        var purchase = await db.Purchases.Where(x => x.partner_id == request.partnerId && x.status == "pending").OrderByDescending(x => x.created_date).FirstOrDefaultAsync(cancellationToken)
            ?? throw new KeyNotFoundException("Nenhuma compra pendente encontrada");
        purchase.status = "paid";
        purchase.download_available = true;
        var isFirstPurchase = !partner.first_purchase_done;
        partner.first_purchase_done = true;
        partner.pending_reasons = partner.pending_reasons.Where(x => x != "Falta da primeira compra").ToList();
        partner.total_spent_purchases += purchase.paid_with_boleto;
        if (partner.pending_reasons.Count == 0) partner.status = PartnerStatuses.ativo;
        await db.SaveChangesAsync(cancellationToken);

        var product = await db.Products.FindAsync([purchase.product_id], cancellationToken);
        await emailSender.SendAsync(partner.email, "🎉 Pagamento Confirmado!", $"<h2>Pagamento confirmado</h2><p>Olá, {partner.full_name}.</p><p>Seu pagamento de R$ {purchase.amount:F2} foi confirmado.</p><p><a href='{product?.download_url}'>Baixar produto</a></p>", cancellationToken);
        return new { success = true, purchase_id = purchase.id, partner_activated = partner.status == PartnerStatuses.ativo, download_link = product?.download_url };
    }
}

public class AsaasService(ApplicationDbContext db, IHttpClientFactory httpClientFactory, IOptions<AsaasOptions> options, IPurchaseProcessingService purchaseProcessing, ICommissionService commissionService, ILogger<AsaasService> logger) : IAsaasService
{
    private readonly AsaasOptions _options = options.Value;

    public async Task<object> GerarCobrancaAsync(AsaasChargeRequest request, string userEmail, CancellationToken cancellationToken = default)
    {
        var existing = await db.Financeiros.FirstOrDefaultAsync(x => x.userId == request.partnerId && x.status == ChargeStatuses.PENDING, cancellationToken);
        if (existing is not null) return new { success = true, reutilizado = true, cobranca = existing, message = "Cobrança pendente já existente reutilizada" };
        var partner = await db.Partners.FindAsync([request.partnerId], cancellationToken) ?? throw new KeyNotFoundException("Parceiro não encontrado");
        var cpf = (request.cpf ?? partner.cpf ?? string.Empty);
        var cpfLimpo = new string(cpf.Where(char.IsDigit).ToArray());
        if (cpfLimpo.Length != 11) throw new InvalidOperationException("CPF inválido ou não informado");
        var client = httpClientFactory.CreateClient("Asaas");
        string? customerId = null;
        var customerResponse = await client.PostAsJsonAsync("customers", new
        {
            name = partner.full_name,
            cpfCnpj = cpfLimpo,
            email = userEmail,
            mobilePhone = partner.phone,
            address = partner.address_street,
            addressNumber = partner.address_number,
            complement = partner.address_complement,
            province = partner.address_neighborhood,
            postalCode = partner.address_cep,
            city = partner.address_city,
            state = partner.address_state
        }, cancellationToken);
        if (customerResponse.IsSuccessStatusCode)
        {
            using var doc = JsonDocument.Parse(await customerResponse.Content.ReadAsStringAsync(cancellationToken));
            customerId = doc.RootElement.GetProperty("id").GetString();
        }
        var amount = request.valor ?? 97m;
        var due = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(request.diasVencimento));
        var chargeResponse = await client.PostAsJsonAsync("payments", new
        {
            customer = customerId,
            billingType = "BOLETO",
            value = amount,
            dueDate = due.ToString("yyyy-MM-dd"),
            description = request.descricao ?? "Ativação de Plano - Sociedade de Consumidores"
        }, cancellationToken);
        var chargePayload = await chargeResponse.Content.ReadAsStringAsync(cancellationToken);
        logger.LogInformation("Asaas charge response: {payload}", chargePayload);
        chargeResponse.EnsureSuccessStatusCode();
        using var chargeDoc = JsonDocument.Parse(chargePayload);
        var financeiro = new Financeiro
        {
            userId = request.partnerId,
            userEmail = partner.email,
            userName = partner.full_name,
            asaasCustomerId = customerId,
            asaasPaymentId = chargeDoc.RootElement.GetProperty("id").GetString(),
            status = chargeDoc.RootElement.GetProperty("status").GetString() ?? ChargeStatuses.PENDING,
            billingType = chargeDoc.RootElement.GetProperty("billingType").GetString(),
            valor = amount,
            descricao = request.descricao ?? "Ativação de Plano - Sociedade de Consumidores",
            dueDate = due,
            invoiceUrl = chargeDoc.RootElement.TryGetProperty("invoiceUrl", out var invoiceUrl) ? invoiceUrl.GetString() : null,
            bankSlipUrl = chargeDoc.RootElement.TryGetProperty("bankSlipUrl", out var bankSlip) ? bankSlip.GetString() : null,
            bonusLiberado = false
        };
        db.Financeiros.Add(financeiro);
        await db.SaveChangesAsync(cancellationToken);
        return new { success = true, boleto = financeiro };
    }

    public async Task<object> ProcessWebhookAsync(JsonObject payload, CancellationToken cancellationToken = default)
    {
        var eventId = payload["id"]?.ToString() ?? payload["payment"]?["id"]?.ToString() ?? Guid.NewGuid().ToString("N");
        if (await db.WebhookEvents.AnyAsync(x => x.provider == "asaas" && x.event_id == eventId, cancellationToken))
            return new { success = true, duplicate = true };
        var webhookEvent = new WebhookEvent
        {
            provider = "asaas",
            event_id = eventId,
            event_type = payload["event"]?.ToString() ?? "unknown",
            payload_json = payload.ToJsonString()
        };
        db.WebhookEvents.Add(webhookEvent);
        await db.SaveChangesAsync(cancellationToken);

        var paymentId = payload["payment"]?["id"]?.ToString() ?? payload["payment"]?.ToString();
        if (paymentId is not null)
        {
            var financeiro = await db.Financeiros.FirstOrDefaultAsync(x => x.asaasPaymentId == paymentId, cancellationToken);
            if (financeiro is not null)
            {
                financeiro.status = payload["payment"]?["status"]?.ToString() ?? financeiro.status;
                if ((financeiro.status == ChargeStatuses.CONFIRMED || financeiro.status == ChargeStatuses.RECEIVED) && !financeiro.bonusLiberado)
                {
                    await purchaseProcessing.ProcessPurchasePaymentAsync(new ProcessPurchasePaymentRequest(financeiro.id, financeiro.userId), cancellationToken);
                    var purchase = await db.Purchases.Where(x => x.partner_id == financeiro.userId).OrderByDescending(x => x.created_date).FirstOrDefaultAsync(cancellationToken);
                    if (purchase is not null)
                    {
                        await commissionService.DistribuirComissoesAsync(purchase.id, financeiro.userId, financeiro.valor, cancellationToken);
                    }
                    financeiro.bonusLiberado = true;
                }
            }
        }

        webhookEvent.processed = true;
        webhookEvent.processed_at = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return new { success = true };
    }
}

public class BlingService(ApplicationDbContext db, IHttpClientFactory httpClientFactory, IOptions<BlingOptions> options) : IBlingService
{
    private readonly BlingOptions _options = options.Value;

    public Task<object> GerarAuthUrlAsync(CancellationToken cancellationToken = default)
    {
        var authUrl = $"{_options.BaseUrl}/oauth/authorize?response_type=code&client_id={Uri.EscapeDataString(_options.ClientId)}&redirect_uri={Uri.EscapeDataString(_options.RedirectUri)}&state=bling-auth";
        return Task.FromResult<object>(new { success = true, authUrl });
    }

    public async Task<object> CallbackAsync(string code, CancellationToken cancellationToken = default)
    {
        var client = httpClientFactory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Post, $"{_options.BaseUrl}/oauth/token");
        var basic = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{_options.ClientId}:{_options.ClientSecret}"));
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", basic);
        request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "authorization_code",
            ["code"] = code,
            ["redirect_uri"] = _options.RedirectUri
        });
        var response = await client.SendAsync(request, cancellationToken);
        var payload = await response.Content.ReadAsStringAsync(cancellationToken);
        response.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(payload);
        var integration = await db.IntegracoesBling.FirstAsync(cancellationToken);
        integration.access_token = doc.RootElement.GetProperty("access_token").GetString();
        integration.refresh_token = doc.RootElement.GetProperty("refresh_token").GetString();
        integration.expires_in = doc.RootElement.GetProperty("expires_in").GetInt32();
        integration.expira_em = DateTime.UtcNow.AddSeconds(integration.expires_in.Value);
        integration.data_autenticacao = DateTime.UtcNow;
        integration.status_integracao = "conectado";
        integration.ultimo_erro = null;
        await db.SaveChangesAsync(cancellationToken);
        return new { success = true };
    }

    public async Task<object> TestarConexaoAsync(CancellationToken cancellationToken = default)
    {
        var accessToken = await GetValidAccessTokenAsync(cancellationToken);
        var client = httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
        var response = await client.GetAsync($"{_options.BaseUrl}/contatos/limite", cancellationToken);
        var ok = response.IsSuccessStatusCode;
        db.LogsIntegracaoBling.Add(new LogIntegracaoBling { tipo = "api_call", status = ok ? "sucesso" : "erro", mensagem = ok ? "Conexão OK" : "Falha ao testar conexão", codigo_http = (int)response.StatusCode });
        await db.SaveChangesAsync(cancellationToken);
        return new { success = ok, mensagem = ok ? "Conexão OK" : await response.Content.ReadAsStringAsync(cancellationToken) };
    }

    public async Task<object> RenovarTokenAsync(CancellationToken cancellationToken = default)
    {
        var token = await RefreshAsync(cancellationToken);
        return new { success = true, access_token = token };
    }

    public async Task<object> EmitirNotaAsync(Guid partnerId, Guid? purchaseId, string? productName, decimal amount, CancellationToken cancellationToken = default)
    {
        var partner = await db.Partners.FindAsync([partnerId], cancellationToken) ?? throw new KeyNotFoundException("Parceiro não encontrado");
        var token = await GetValidAccessTokenAsync(cancellationToken);
        var client = httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        var notaData = new
        {
            numero = (string?)null,
            serie = "1",
            natureza_operacao = "Venda de mercadoria",
            data_emissao = DateTime.UtcNow.ToString("yyyy-MM-dd"),
            tipo_documento = 1,
            cliente = new
            {
                nome = partner.full_name,
                cpf_cnpj = partner.cpf,
                email = partner.email,
                endereco = new { logradouro = partner.address_street ?? "", numero = partner.address_number ?? "S/N", complemento = partner.address_complement ?? "", bairro = partner.address_neighborhood ?? "", cidade = partner.address_city ?? "", uf = partner.address_state ?? "", cep = partner.address_cep ?? "" }
            },
            itens = new[] { new { descricao = productName ?? "Produto Digital", quantidade = 1, valor_unitario = amount, codigo = purchaseId?.ToString() ?? "PROD001", tipo = "S", origem = 0, ncm = "00", cfop = "5933" } },
            informacoes_adicionais_contribuinte = "Venda realizada através da plataforma Sociedade de Consumidores"
        };
        var response = await client.PostAsJsonAsync($"{_options.BaseUrl}/nfe", notaData, cancellationToken);
        var payload = await response.Content.ReadAsStringAsync(cancellationToken);
        db.LogsIntegracaoBling.Add(new LogIntegracaoBling { tipo = "api_call", status = response.IsSuccessStatusCode ? "sucesso" : "erro", mensagem = response.IsSuccessStatusCode ? "Nota fiscal emitida" : "Erro ao emitir nota", codigo_http = (int)response.StatusCode, detalhes = new Dictionary<string, object?> { ["partnerId"] = partnerId, ["purchaseId"] = purchaseId, ["payload"] = payload } });
        await db.SaveChangesAsync(cancellationToken);
        response.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(payload);
        return new { success = true, nota = doc.RootElement };
    }

    public async Task<object> EmitirNotaAutomaticaAsync(string paymentId, CancellationToken cancellationToken = default)
    {
        var pagamento = await db.Financeiros.FirstOrDefaultAsync(x => x.asaasPaymentId == paymentId, cancellationToken) ?? throw new KeyNotFoundException("Pagamento não encontrado");
        var result = await EmitirNotaAsync(pagamento.userId, null, pagamento.descricao, pagamento.valor, cancellationToken);
        pagamento.notaFiscalEmitida = true;
        await db.SaveChangesAsync(cancellationToken);
        return result;
    }

    public async Task<object> ProcessWebhookAsync(JsonObject payload, CancellationToken cancellationToken = default)
    {
        var eventId = payload["id"]?.ToString() ?? Guid.NewGuid().ToString("N");
        if (await db.WebhookEvents.AnyAsync(x => x.provider == "bling" && x.event_id == eventId, cancellationToken))
            return new { success = true, duplicate = true };
        db.WebhookEvents.Add(new WebhookEvent { provider = "bling", event_id = eventId, event_type = payload["event"]?.ToString() ?? "unknown", payload_json = payload.ToJsonString(), processed = true, processed_at = DateTime.UtcNow });
        await db.SaveChangesAsync(cancellationToken);
        return new { success = true };
    }

    private async Task<string> GetValidAccessTokenAsync(CancellationToken cancellationToken)
    {
        var integration = await db.IntegracoesBling.FirstAsync(cancellationToken);
        if (integration.status_integracao != "conectado" || string.IsNullOrWhiteSpace(integration.access_token))
            throw new InvalidOperationException("Integração Bling não está conectada");
        if (integration.expira_em is null || integration.expira_em.Value <= DateTime.UtcNow.AddMinutes(5))
            return await RefreshAsync(cancellationToken);
        return integration.access_token;
    }

    private async Task<string> RefreshAsync(CancellationToken cancellationToken)
    {
        var integration = await db.IntegracoesBling.FirstAsync(cancellationToken);
        var client = httpClientFactory.CreateClient();
        var basic = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{_options.ClientId}:{_options.ClientSecret}"));
        var request = new HttpRequestMessage(HttpMethod.Post, $"{_options.BaseUrl}/oauth/token");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", basic);
        request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "refresh_token",
            ["refresh_token"] = integration.refresh_token ?? string.Empty
        });
        var response = await client.SendAsync(request, cancellationToken);
        var payload = await response.Content.ReadAsStringAsync(cancellationToken);
        response.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(payload);
        integration.access_token = doc.RootElement.GetProperty("access_token").GetString();
        integration.refresh_token = doc.RootElement.GetProperty("refresh_token").GetString();
        integration.expires_in = doc.RootElement.GetProperty("expires_in").GetInt32();
        integration.expira_em = DateTime.UtcNow.AddSeconds(integration.expires_in.Value);
        integration.status_integracao = "conectado";
        integration.ultimo_erro = null;
        await db.SaveChangesAsync(cancellationToken);
        return integration.access_token!;
    }
}

public class CompatEntityService(ApplicationDbContext db) : ICompatEntityService
{
    public async Task<object?> GetAsync(string entityName, Guid id, CancellationToken cancellationToken = default)
        => await GetQueryable(entityName).FirstOrDefaultAsync(e => EF.Property<Guid>(e, "id") == id, cancellationToken);

    public async Task<IReadOnlyList<object>> ListAsync(string entityName, string? sort = null, int? limit = null, CancellationToken cancellationToken = default)
    {
        var list = await ApplySort(GetQueryable(entityName), sort).ToListAsync(cancellationToken);
        return (limit.HasValue ? list.Take(limit.Value) : list).Cast<object>().ToList();
    }

    public async Task<IReadOnlyList<object>> FilterAsync(string entityName, Dictionary<string, object?> filters, string? sort = null, int? limit = null, CancellationToken cancellationToken = default)
    {
        var items = await ApplySort(GetQueryable(entityName), sort).ToListAsync(cancellationToken);
        IEnumerable<object> result = items;
        foreach (var (key, value) in filters)
        {
            result = result.Where(item => Equals(GetPropertyValue(item, key), Convert.ChangeType(value, Nullable.GetUnderlyingType(GetProperty(item, key)?.PropertyType ?? typeof(string)) ?? GetProperty(item, key)?.PropertyType ?? typeof(string))));
        }
        if (limit.HasValue) result = result.Take(limit.Value);
        return result.ToList();
    }

    public async Task<object> CreateAsync(string entityName, JsonObject payload, CancellationToken cancellationToken = default)
    {
        var type = GetEntityType(entityName);
        var entity = (EntityBase?)payload.Deserialize(type, new JsonSerializerOptions(JsonSerializerDefaults.Web)) ?? throw new InvalidOperationException("Payload inválido");
        db.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        return entity;
    }

    public async Task<object> UpdateAsync(string entityName, Guid id, JsonObject payload, CancellationToken cancellationToken = default)
    {
        var entity = await GetQueryable(entityName).FirstOrDefaultAsync(e => EF.Property<Guid>(e, "id") == id, cancellationToken) ?? throw new KeyNotFoundException("Registro não encontrado");
        ApplyPatch(entity, payload);
        await db.SaveChangesAsync(cancellationToken);
        return entity;
    }

    public async Task DeleteAsync(string entityName, Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await GetQueryable(entityName).FirstOrDefaultAsync(e => EF.Property<Guid>(e, "id") == id, cancellationToken) ?? throw new KeyNotFoundException("Registro não encontrado");
        db.Remove(entity);
        await db.SaveChangesAsync(cancellationToken);
    }

    private IQueryable<EntityBase> GetQueryable(string entityName) => entityName switch
    {
        "Partner" => db.Partners.Cast<EntityBase>(),
        "NetworkRelation" => db.NetworkRelations.Cast<EntityBase>(),
        "BonusTransaction" => db.BonusTransactions.Cast<EntityBase>(),
        "Purchase" => db.Purchases.Cast<EntityBase>(),
        "Financeiro" => db.Financeiros.Cast<EntityBase>(),
        "Saques" => db.Saques.Cast<EntityBase>(),
        "LogsFinanceiro" => db.LogsFinanceiros.Cast<EntityBase>(),
        "IntegracaoBling" => db.IntegracoesBling.Cast<EntityBase>(),
        "LogIntegracaoBling" => db.LogsIntegracaoBling.Cast<EntityBase>(),
        "Product" => db.Products.Cast<EntityBase>(),
        "LoginUser" => db.LoginUsers.Cast<EntityBase>(),
        "EmailVerificationCode" => db.EmailVerificationCodes.Cast<EntityBase>(),
        "PasswordResetToken" => db.PasswordResetTokens.Cast<EntityBase>(),
        _ => throw new KeyNotFoundException($"Entidade não suportada: {entityName}")
    };

    private static IQueryable<EntityBase> ApplySort(IQueryable<EntityBase> query, string? sort)
    {
        if (string.IsNullOrWhiteSpace(sort)) return query.OrderByDescending(x => x.created_date);
        var descending = sort.StartsWith('-');
        var property = descending ? sort[1..] : sort;
        return descending ? query.OrderByDescending(e => EF.Property<object>(e, property)) : query.OrderBy(e => EF.Property<object>(e, property));
    }

    private static Type GetEntityType(string entityName) => entityName switch
    {
        "Partner" => typeof(Partner),
        "NetworkRelation" => typeof(NetworkRelation),
        "BonusTransaction" => typeof(BonusTransaction),
        "Purchase" => typeof(Purchase),
        "Financeiro" => typeof(Financeiro),
        "Saques" => typeof(Saques),
        "LogsFinanceiro" => typeof(LogsFinanceiro),
        "IntegracaoBling" => typeof(IntegracaoBling),
        "LogIntegracaoBling" => typeof(LogIntegracaoBling),
        "Product" => typeof(Product),
        "LoginUser" => typeof(LoginUser),
        "EmailVerificationCode" => typeof(EmailVerificationCode),
        "PasswordResetToken" => typeof(PasswordResetToken),
        _ => throw new KeyNotFoundException($"Entidade não suportada: {entityName}")
    };

    private static void ApplyPatch(object entity, JsonObject payload)
    {
        foreach (var kvp in payload)
        {
            var prop = GetProperty(entity, kvp.Key);
            if (prop is null || !prop.CanWrite) continue;
            if (kvp.Value is null)
            {
                prop.SetValue(entity, null);
                continue;
            }
            var value = kvp.Value.Deserialize(prop.PropertyType, new JsonSerializerOptions(JsonSerializerDefaults.Web));
            prop.SetValue(entity, value);
        }
        if (entity is EntityBase baseEntity)
            baseEntity.updated_date = DateTime.UtcNow;
    }

    private static object? GetPropertyValue(object entity, string key) => GetProperty(entity, key)?.GetValue(entity);

    private static PropertyInfo? GetProperty(object entity, string key)
        => entity.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance).FirstOrDefault(p => string.Equals(p.Name, key, StringComparison.OrdinalIgnoreCase));
}
