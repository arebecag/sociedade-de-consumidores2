using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SociedadeConsumidores.Domain;

namespace SociedadeConsumidores.Infrastructure;

public class FinancialSyncWorker(IServiceScopeFactory scopeFactory, ILogger<FinancialSyncWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var overdue = await db.Financeiros.Where(x => x.status == ChargeStatuses.PENDING && x.dueDate < DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1))).ToListAsync(stoppingToken);
                foreach (var item in overdue) item.status = ChargeStatuses.OVERDUE;
                await db.SaveChangesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Erro no worker financeiro");
            }
            await Task.Delay(TimeSpan.FromMinutes(10), stoppingToken);
        }
    }
}

public class BlingRefreshWorker(IServiceScopeFactory scopeFactory, ILogger<BlingRefreshWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var bling = scope.ServiceProvider.GetRequiredService<IBlingService>();
                await bling.RenovarTokenAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Falha ao renovar token do Bling automaticamente");
            }
            await Task.Delay(TimeSpan.FromMinutes(30), stoppingToken);
        }
    }
}
