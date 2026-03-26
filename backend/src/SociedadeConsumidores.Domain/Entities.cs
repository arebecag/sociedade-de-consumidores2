using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace SociedadeConsumidores.Domain;

public abstract class EntityBase
{
    [Key]
    [JsonPropertyName("id")]
    public Guid id { get; set; } = Guid.NewGuid();

    [JsonPropertyName("created_date")]
    public DateTime created_date { get; set; } = DateTime.UtcNow;

    [JsonPropertyName("updated_date")]
    public DateTime updated_date { get; set; } = DateTime.UtcNow;
}

public class LoginUser : EntityBase
{
    [MaxLength(255)] public string email { get; set; } = string.Empty;
    [MaxLength(255)] public string full_name { get; set; } = string.Empty;
    [MaxLength(255)] public string password_hash { get; set; } = string.Empty;
    [MaxLength(50)] public string status { get; set; } = "active";
    [MaxLength(50)] public string role { get; set; } = UserRoles.parceiro;
    public bool is_email_verified { get; set; }
    public Guid? partner_id { get; set; }
    public DateTime? last_login_at { get; set; }
}

public class RefreshToken : EntityBase
{
    public Guid user_id { get; set; }
    [MaxLength(255)] public string token { get; set; } = string.Empty;
    public DateTime expires_at { get; set; }
    public DateTime? revoked_at { get; set; }
    [MaxLength(255)] public string? created_by_ip { get; set; }
}

public class EmailVerificationCode : EntityBase
{
    public Guid user_id { get; set; }
    [MaxLength(255)] public string email { get; set; } = string.Empty;
    [MaxLength(10)] public string code { get; set; } = string.Empty;
    public DateTime expires_at { get; set; }
    public bool used { get; set; }
}

public class PasswordResetToken : EntityBase
{
    public Guid user_id { get; set; }
    [MaxLength(255)] public string email { get; set; } = string.Empty;
    [MaxLength(255)] public string token { get; set; } = string.Empty;
    public DateTime expires_at { get; set; }
    public bool used { get; set; }
}

public class Partner : EntityBase
{
    public Guid? user_id { get; set; }
    [MaxLength(255)] public string email { get; set; } = string.Empty;
    [MaxLength(255)] public string? created_by { get; set; }
    [MaxLength(255)] public string full_name { get; set; } = string.Empty;
    [MaxLength(120)] public string? display_name { get; set; }
    [MaxLength(50)] public string? cpf { get; set; }
    [MaxLength(50)] public string? phone { get; set; }
    public DateOnly? birth_date { get; set; }
    [MaxLength(50)] public string? gender { get; set; }
    [MaxLength(50)] public string status { get; set; } = PartnerStatuses.pendente;
    [MaxLength(50)] public string graduation { get; set; } = "cliente_iniciante";
    public DateOnly? graduation_start_date { get; set; }
    public bool first_purchase_done { get; set; }
    public decimal total_bonus_generated { get; set; }
    public decimal bonus_for_withdrawal { get; set; }
    public decimal bonus_for_purchases { get; set; }
    public decimal total_withdrawn { get; set; }
    public decimal total_spent_purchases { get; set; }
    public int groups_formed { get; set; }
    [MaxLength(50)] public string? unique_code { get; set; }
    public bool accepted_terms { get; set; }
    public bool accepted_rules { get; set; }
    public bool email_verified { get; set; }
    public bool phone_verified { get; set; }
    public bool notification_email { get; set; } = true;
    public bool notification_sms { get; set; }
    public bool notification_whatsapp { get; set; }
    [MaxLength(50)] public string? notification_frequency { get; set; }
    public Guid? referrer_id { get; set; }
    [MaxLength(255)] public string? referrer_name { get; set; }
    [Column(TypeName = "jsonb")] public List<string> pending_reasons { get; set; } = [];
    [MaxLength(120)] public string? pix_key { get; set; }
    [MaxLength(255)] public string? address_street { get; set; }
    [MaxLength(50)] public string? address_number { get; set; }
    [MaxLength(255)] public string? address_complement { get; set; }
    [MaxLength(255)] public string? address_neighborhood { get; set; }
    [MaxLength(100)] public string? address_city { get; set; }
    [MaxLength(10)] public string? address_state { get; set; }
    [MaxLength(20)] public string? address_cep { get; set; }
    [MaxLength(50)] public string? email_change_code { get; set; }
    [MaxLength(255)] public string? email_change_new { get; set; }
    public DateTime? email_change_expiry { get; set; }
}

public class NetworkRelation : EntityBase
{
    public Guid referrer_id { get; set; }
    [MaxLength(255)] public string referrer_name { get; set; } = string.Empty;
    public Guid referred_id { get; set; }
    [MaxLength(255)] public string referred_name { get; set; } = string.Empty;
    [MaxLength(50)] public string relation_type { get; set; } = "direct";
    public bool is_spillover { get; set; }
    public int level { get; set; }
}

public class BonusTransaction : EntityBase
{
    public Guid partner_id { get; set; }
    [MaxLength(255)] public string partner_name { get; set; } = string.Empty;
    public Guid source_partner_id { get; set; }
    [MaxLength(255)] public string source_partner_name { get; set; } = string.Empty;
    public Guid purchase_id { get; set; }
    [MaxLength(50)] public string type { get; set; } = string.Empty;
    public decimal percentage { get; set; }
    public decimal total_amount { get; set; }
    public decimal amount_for_withdrawal { get; set; }
    public decimal amount_for_purchases { get; set; }
    [MaxLength(50)] public string status { get; set; } = "credited";
}

public class Product : EntityBase
{
    [MaxLength(255)] public string name { get; set; } = string.Empty;
    [MaxLength(255)] public string? product_type { get; set; }
    [MaxLength(500)] public string? download_url { get; set; }
    public decimal price { get; set; }
    public bool active { get; set; } = true;
}

public class Purchase : EntityBase
{
    public Guid partner_id { get; set; }
    [MaxLength(255)] public string partner_name { get; set; } = string.Empty;
    public Guid product_id { get; set; }
    [MaxLength(255)] public string product_name { get; set; } = string.Empty;
    [MaxLength(50)] public string status { get; set; } = "pending";
    public decimal amount { get; set; }
    public decimal paid_with_boleto { get; set; }
    public decimal paid_with_bonus { get; set; }
    public bool download_available { get; set; }
    public Guid? financeiro_id { get; set; }
}

public class Financeiro : EntityBase
{
    public Guid userId { get; set; }
    [MaxLength(255)] public string? userEmail { get; set; }
    [MaxLength(255)] public string? userName { get; set; }
    [MaxLength(255)] public string? asaasCustomerId { get; set; }
    [MaxLength(255)] public string? asaasPaymentId { get; set; }
    [MaxLength(50)] public string status { get; set; } = ChargeStatuses.PENDING;
    [MaxLength(100)] public string? billingType { get; set; }
    public decimal valor { get; set; }
    public decimal valorBonus { get; set; }
    [MaxLength(500)] public string? descricao { get; set; }
    public DateOnly? dueDate { get; set; }
    [MaxLength(500)] public string? invoiceUrl { get; set; }
    [MaxLength(500)] public string? bankSlipUrl { get; set; }
    public bool bonusLiberado { get; set; }
    public bool notaFiscalEmitida { get; set; }
    [MaxLength(100)] public string? notaFiscalNumero { get; set; }
    [MaxLength(255)] public string? notaFiscalChave { get; set; }
    [MaxLength(500)] public string? notaFiscalUrl { get; set; }
}

public class Saques : EntityBase
{
    public Guid userId { get; set; }
    [MaxLength(255)] public string userEmail { get; set; } = string.Empty;
    [MaxLength(255)] public string userName { get; set; } = string.Empty;
    public decimal valor { get; set; }
    [MaxLength(50)] public string status { get; set; } = "PENDENTE";
    public DateTime dataSolicitacao { get; set; } = DateTime.UtcNow;
    [MaxLength(120)] public string? pixKey { get; set; }
}

public class LogsFinanceiro : EntityBase
{
    [MaxLength(100)] public string tipo { get; set; } = string.Empty;
    public Guid userId { get; set; }
    [MaxLength(255)] public string userEmail { get; set; } = string.Empty;
    [MaxLength(255)] public string userName { get; set; } = string.Empty;
    public decimal valor { get; set; }
    [MaxLength(1000)] public string descricao { get; set; } = string.Empty;
    public Guid? referenciaId { get; set; }
}

public class IntegracaoBling : EntityBase
{
    [MaxLength(100)] public string status_integracao { get; set; } = "desconectado";
    [MaxLength(2000)] public string? access_token { get; set; }
    [MaxLength(2000)] public string? refresh_token { get; set; }
    [MaxLength(500)] public string? scope { get; set; }
    public int? expires_in { get; set; }
    public DateTime? expira_em { get; set; }
    public DateTime? data_autenticacao { get; set; }
    [MaxLength(1000)] public string? ultimo_erro { get; set; }
}

public class LogIntegracaoBling : EntityBase
{
    [MaxLength(100)] public string tipo { get; set; } = string.Empty;
    [MaxLength(100)] public string status { get; set; } = string.Empty;
    [MaxLength(1000)] public string mensagem { get; set; } = string.Empty;
    [MaxLength(1000)] public string? erro { get; set; }
    public int? codigo_http { get; set; }
    [Column(TypeName = "jsonb")] public Dictionary<string, object?> detalhes { get; set; } = new();
}

public class WebhookEvent : EntityBase
{
    [MaxLength(100)] public string provider { get; set; } = string.Empty;
    [MaxLength(255)] public string event_id { get; set; } = string.Empty;
    [MaxLength(255)] public string event_type { get; set; } = string.Empty;
    [Column(TypeName = "jsonb")] public string payload_json { get; set; } = "{}";
    public bool processed { get; set; }
    public DateTime? processed_at { get; set; }
    [MaxLength(1000)] public string? processing_error { get; set; }
}

public class AuditLog : EntityBase
{
    [MaxLength(100)] public string actor_type { get; set; } = string.Empty;
    public Guid? actor_id { get; set; }
    [MaxLength(100)] public string action { get; set; } = string.Empty;
    [MaxLength(100)] public string entity_name { get; set; } = string.Empty;
    public Guid? entity_id { get; set; }
    [Column(TypeName = "jsonb")] public string data_json { get; set; } = "{}";
}
