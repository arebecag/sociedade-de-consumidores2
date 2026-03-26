namespace SociedadeConsumidores.Domain;

public static class UserRoles
{
    public const string admin = "admin";
    public const string associado = "associado";
    public const string parceiro = "parceiro";
}

public static class PartnerStatuses
{
    public const string ativo = "ativo";
    public const string pendente = "pendente";
    public const string bloqueado = "bloqueado";
    public const string excluido = "excluido";
}

public static class ChargeStatuses
{
    public const string PENDING = "PENDING";
    public const string RECEIVED = "RECEIVED";
    public const string CONFIRMED = "CONFIRMED";
    public const string OVERDUE = "OVERDUE";
    public const string CANCELLED = "CANCELLED";
    public const string REFUNDED = "REFUNDED";
}
