# Sociedade de Consumidores Backend (.NET 9 + PostgreSQL)

Migração do backend Base44 para stack própria com ASP.NET Core 9, EF Core e PostgreSQL.

## Estrutura

- `SociedadeConsumidores.sln`
- `src/SociedadeConsumidores.Domain`
- `src/SociedadeConsumidores.Application`
- `src/SociedadeConsumidores.Infrastructure`
- `src/SociedadeConsumidores.WebApi`
- `database/001_initial.sql`

## Funcionalidades implementadas nesta base

- autenticação própria com JWT + refresh token
- registro, login, logout, `me`, verificação de e-mail, reset de senha
- cadastro de parceiro preservando a lógica 3x3 e derramamento atual
- compras, cobranças, bônus/comissões e processamento pós-pagamento
- integração encapsulada com Asaas e Bling
- webhooks com persistência e idempotência
- endpoints administrativos iniciais
- camada de compatibilidade `/api/compat/*` para preservar o frontend React atual
- Swagger, CORS, BackgroundServices e logging estruturado em JSON

## Requisitos

- .NET SDK 9
- PostgreSQL 15+

## Configuração

Edite `src/SociedadeConsumidores.WebApi/appsettings.json` e/ou variáveis de ambiente.

Variáveis principais:

- `ConnectionStrings__DefaultConnection`
- `Jwt__Issuer`
- `Jwt__Audience`
- `Jwt__SigningKey`
- `Email__SmtpHost`
- `Email__SmtpPort`
- `Email__SmtpUser`
- `Email__SmtpPassword`
- `Asaas__BaseUrl`
- `Asaas__ApiKey`
- `Bling__BaseUrl`
- `Bling__ClientId`
- `Bling__ClientSecret`
- `Bling__RedirectUri`
- `Frontend__BaseUrl`

## Como rodar

```bash
cd backend
# restaurar pacotes
 dotnet restore SociedadeConsumidores.sln
# aplicar banco
 dotnet ef database update --project src/SociedadeConsumidores.Infrastructure --startup-project src/SociedadeConsumidores.WebApi
# subir API
 dotnet run --project src/SociedadeConsumidores.WebApi
```

## Swagger

- `https://localhost:5001/swagger`
- `http://localhost:5000/swagger`

## Frontend

O frontend React/Vite usa a camada de compatibilidade em `src/api/base44Client.js`, mas sem o SDK do Base44. Ajuste `VITE_API_BASE_URL` para apontar para a nova API.

## Deploy sugerido

- backend: VPS Linux/Windows com systemd ou IIS + reverse proxy
- banco: PostgreSQL gerenciado ou instalado na VPS
- frontend: build Vite servido por Nginx/Apache ou CDN
- HTTPS: Cloudflare ou Nginx + Let's Encrypt
