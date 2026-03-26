using Microsoft.EntityFrameworkCore;
using SociedadeConsumidores.Domain;

namespace SociedadeConsumidores.Infrastructure;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : DbContext(options)
{
    public DbSet<LoginUser> LoginUsers => Set<LoginUser>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<EmailVerificationCode> EmailVerificationCodes => Set<EmailVerificationCode>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<Partner> Partners => Set<Partner>();
    public DbSet<NetworkRelation> NetworkRelations => Set<NetworkRelation>();
    public DbSet<BonusTransaction> BonusTransactions => Set<BonusTransaction>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Purchase> Purchases => Set<Purchase>();
    public DbSet<Financeiro> Financeiros => Set<Financeiro>();
    public DbSet<Saques> Saques => Set<Saques>();
    public DbSet<LogsFinanceiro> LogsFinanceiros => Set<LogsFinanceiro>();
    public DbSet<IntegracaoBling> IntegracoesBling => Set<IntegracaoBling>();
    public DbSet<LogIntegracaoBling> LogsIntegracaoBling => Set<LogIntegracaoBling>();
    public DbSet<WebhookEvent> WebhookEvents => Set<WebhookEvent>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        foreach (var entity in modelBuilder.Model.GetEntityTypes())
        {
            entity.SetTableName(entity.ClrType.Name);
        }

        modelBuilder.Entity<LoginUser>().HasIndex(x => x.email).IsUnique();
        modelBuilder.Entity<Partner>().HasIndex(x => x.email).IsUnique();
        modelBuilder.Entity<Partner>().HasIndex(x => x.unique_code).IsUnique();
        modelBuilder.Entity<RefreshToken>().HasIndex(x => x.token).IsUnique();
        modelBuilder.Entity<EmailVerificationCode>().HasIndex(x => new { x.email, x.code, x.used });
        modelBuilder.Entity<PasswordResetToken>().HasIndex(x => new { x.email, x.token, x.used });
        modelBuilder.Entity<NetworkRelation>().HasIndex(x => new { x.referrer_id, x.referred_id, x.relation_type }).IsUnique();
        modelBuilder.Entity<BonusTransaction>().HasIndex(x => new { x.purchase_id, x.partner_id }).IsUnique();
        modelBuilder.Entity<Financeiro>().HasIndex(x => x.asaasPaymentId);
        modelBuilder.Entity<WebhookEvent>().HasIndex(x => new { x.provider, x.event_id }).IsUnique();
        modelBuilder.Entity<IntegracaoBling>().HasData(new IntegracaoBling
        {
            id = Guid.Parse("11111111-2222-3333-4444-555555555555"),
            status_integracao = "desconectado",
            created_date = DateTime.UtcNow,
            updated_date = DateTime.UtcNow
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var entries = ChangeTracker.Entries<EntityBase>();
        foreach (var entry in entries)
        {
            if (entry.State == EntityState.Modified)
            {
                entry.Entity.updated_date = DateTime.UtcNow;
            }
        }
        return base.SaveChangesAsync(cancellationToken);
    }
}
