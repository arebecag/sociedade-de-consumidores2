create table if not exists "Financeiro" (
  id uuid primary key,
  created_date timestamptz not null,
  updated_date timestamptz not null,
  "userId" uuid not null,
  "userEmail" varchar(255) null,
  "userName" varchar(255) null,
  "asaasCustomerId" varchar(255) null,
  "asaasPaymentId" varchar(255) null,
  status varchar(50) not null default 'PENDING',
  "billingType" varchar(100) null,
  valor numeric(18,2) not null default 0,
  "valorBonus" numeric(18,2) not null default 0,
  descricao varchar(500) null,
  "dueDate" date null,
  "invoiceUrl" varchar(500) null,
  "bankSlipUrl" varchar(500) null,
  "bonusLiberado" boolean not null default false,
  "notaFiscalEmitida" boolean not null default false,
  "notaFiscalNumero" varchar(100) null,
  "notaFiscalChave" varchar(255) null,
  "notaFiscalUrl" varchar(500) null
);

create index if not exists "IX_Financeiro_asaasPaymentId" on "Financeiro" ("asaasPaymentId");

create table if not exists "IntegracaoBling" (
  id uuid primary key,
  created_date timestamptz not null,
  updated_date timestamptz not null,
  status_integracao varchar(100) not null default 'desconectado',
  access_token varchar(2000) null,
  refresh_token varchar(2000) null,
  scope varchar(500) null,
  expires_in int null,
  expira_em timestamptz null,
  data_autenticacao timestamptz null,
  ultimo_erro varchar(1000) null
);

insert into "IntegracaoBling" (id, created_date, updated_date, status_integracao)
select '11111111-2222-3333-4444-555555555555'::uuid, now(), now(), 'desconectado'
where not exists (select 1 from "IntegracaoBling");
