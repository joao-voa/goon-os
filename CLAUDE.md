# GOON OS — Documentação do Projeto

Sistema de gestão empresarial da **GOON** (agência AURA 360). Cobre CRM/funil de
vendas, clientes e planos, financeiro (pagamentos, comissões, despesas, fluxo de
caixa), contratos, mentoria e agenda.

---

## 1. Stack & Estrutura

Monorepo **Turborepo** com dois apps:

| App | Stack | Papel |
|-----|-------|-------|
| `apps/api` | **NestJS 11** + **Prisma 6** (`@prisma/client`) | API REST |
| `apps/web` | **Next.js 16** (App Router) + **React 19** + TypeScript 5.7 | Front dashboard |

- **Banco:** PostgreSQL no **Neon** (serverless).
- **Prisma sem engine nativo:** usa `driverAdapters` + `queryCompiler` (WASM) via
  `@prisma/adapter-neon` (`PrismaNeon` + `neonConfig.webSocketConstructor = ws`),
  conexão por HTTP/WS na **porta 443**. Não voltar pro engine binário (quebrava no
  serverless do Vercel). Bônus: scripts locais conectam ao Neon de qualquer rede.
- **DnD do kanban:** `@dnd-kit/core` + `@dnd-kit/sortable`.

### Rodar scripts pontuais no banco
Rodar **de dentro de `apps/api`** com `npx tsx`, instanciando o Prisma via adapter Neon:
```ts
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neonConfig } from '@neondatabase/serverless'
import ws from 'ws'; import 'dotenv/config'
neonConfig.webSocketConstructor = ws
const p = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) })
```

---

## 2. Deploy (tudo no Vercel, team `joao-voas-projects`)

| Projeto Vercel | URL | Notas |
|---|---|---|
| **goon-os-web** | goon-os-web.vercel.app | Auto-deploy no push da `main` (root `apps/web`) |
| **goon-os-api** | goon-os-api.vercel.app | Serverless via `apps/api/api/index.ts` + `vercel.json` (rewrite `/(.*) → /api`), auto-deploy no push da `main` (root `apps/api`). Build usa `npx prisma generate`. |

- **Web → API:** env `NEXT_PUBLIC_API_URL` = `https://goon-os-api.vercel.app` (inlined no build → trocar exige redeploy do web).
- **Deploy manual por CLI de dentro de `apps/api` NÃO funciona** (root dir duplica o path). Usar `git push`.
- Alterações **só de dados** (scripts no Neon) valem na hora, sem deploy.
- **Render é do ImobiSaaS, NÃO do GOON.**

⚠️ **Nunca** usar `prisma db push --force-reset/--accept-data-loss` em banco com dados.
Mudanças de schema aditivas: `npx prisma db push --skip-generate` + `npx prisma generate`.

---

## 3. Modelo de Dados (Prisma — `apps/api/prisma/schema.prisma`)

Principais models:

- **User** — acesso. `role` (admin/gestao/comercial/analitico), `allowedModules`
  (JSON array de paths, ex: `["/crm"]`), `isActive`, `mustChangePassword`.
- **Client** — lead **e** cliente (mesma tabela). Campos de CRM (`leadStage`,
  `leadSource`, `salesRep`, `cardResponsible`, `saleValue`…), fiscais (`cnpj`,
  `responsible`, endereço), flags (`hasContract`, `isClientActive`,
  `mentorshipEnded`), `kanbanOrder` (ordem manual no kanban). CNPJ é `@unique`.
- **ClientDocument** — documentos anexados ao cliente (ex: contrato assinado).
  Arquivo em **base64** no campo `data @db.Text` (sem storage externo). `type`
  (SIGNED_CONTRACT/OTHER). Fonte de verdade do `hasContract`.
- **ClientPlan** — plano contratado. **É a fonte de verdade de VENDAS.** `value`,
  `paymentType`, `installments`, `cycleDuration`, `cycleNumber` (renovação ≥2),
  `startDate`/`endDate`, `paymentDay`, `status` (ACTIVE/CANCELLED/COMPLETED).
- **PlanMentor** — splits por plano (`mentorName`, `value` = **total** do split ao
  longo do contrato; realização é **mês a mês** conforme as parcelas caem).
- **Payment** — parcelas. `installment`/`totalInstallments`, `value`, `dueDate`,
  `status` (PENDING/PAID/OVERDUE/CANCELLED/SCHEDULED), `paidValue`, `inCarteira`
  (carteira de cobrança), `observation`.
- **Contract** — contrato gerado (`templateType`, `dynamicFields` JSON, PDF/DOCX,
  `isSigned`). Templates: GE/GI/GS.
- **Commission**, **Expense**, **Onboarding**, **Pendency**, **ActivityLog**,
  **AuditLog**, **Meeting**, **Task**, **LeadInteraction**.
- Mentoria: **MenteeProfile**, **SessionCaseStudy**, **MonthlyMetric**,
  **ActionItem**, **FlowTemplate**.
- **Person** / **PersonTransaction** — contas de pessoas (person-accounts).

### Produtos (Product.code)
`GE` GOON ELITE · `GI` GOON INFINITY · `TTS` TIK TOK SCALE · `TTSG` TIKTOK SCALE GRUPO · `GA` GOON ADVISOR · `GS` GOON SCALE · `AURA` Consultoria AURA 360.

---

## 4. Módulos

**API** (`apps/api/src/modules`): activity-log, admin, audit, cashflow, clients,
commissions, contracts, crm, dashboard, expenses, meetings, mentorship, onboarding,
payments, pendencies, person-accounts, plans, products, tasks.

**Web** (`apps/web/src/app/(dashboard)`): home, crm, clients, sales, contracts,
payments, commissions, expenses, cashflow, products, onboarding, tasks, agenda,
pendencies, mentorship, person-accounts, admin, audit.

---

## 5. Regras de Negócio & Convenções

### Vendas
- **Fonte de verdade = `ClientPlan`**: cada ciclo não-cancelado é uma venda, datada
  pelo `startDate`; valor = `plan.value`. Renovações (`cycleNumber ≥ 2`) contam como
  venda nova. Clientes em **RECUPERAR/PERDIDO** e planos CANCELLED ficam de fora.
- Endpoint `GET /api/crm/sales-by-month?year=&product=` retorna meses + `byProgram`
  (totalizador por programa: valor e quantidade). Tela `/sales` tem filtro por
  programa (acesso só do dono — `canSeeSales`).

### Pipeline do CRM (kanban)
Ordem: **Novo (NOVO) → Em Contato (FUP) → Agendado (REUNIAO_AGENDADA) →
Em Negociação (EM_NEGOCIACAO) → Repescagem (REPESCAGEM) → Perdido (PERDIDO) →
Ganho (FECHADO)**. Códigos internos preservados (FECHADO = venda ganha) pra não
quebrar closeDeal/vendas/comissões. Arrastar pra "Ganho" abre o fluxo de fechamento.
Kanban tem ordenação manual (`kanbanOrder`) via `PATCH /api/crm/reorder`.

### TikTok Scale (produto novo)
Padrão: **venda = 2 meses garantidos = 2× R$2.500 = R$5.000**. Estrutura:
**adesão** (paga na entrada) + **1ª mensalidade** (~1 mês depois, no dia de
vencimento) + vigência de **2 meses** (cancelamento com **30 dias** de antecedência).
Sem renovação automática (confirmar a cada ciclo).

### Splits de mentores (GI/TTS a partir de 08/08/2026)
Sobre o valor do plano: **imposto 6%** → líquido = `valor × 0,94`; **João 10% do
líquido** (`valor × 0,094`); resto **50% Carol / 50% Giulliano** (`valor × 0,423`
cada). Guardado como total no `PlanMentor`, realizado **mês a mês**.
Fernando Vaz foi **removido** dos splits e das despesas de mentoria a partir de 08/08.

### Carteira de cobrança (churn) — códigos de parcela
- **98/98** = parcela **futura** de cliente em churn.
- **99/99** = parcela **antiga não paga**.
- Todas com `inCarteira = true` → saem do fluxo futuro e dos recebíveis.
- Filtro `NOT_CARTEIRA_CLIENT_FILTER` (`apps/api/src/shared/constants.ts`) exclui
  `leadStage RECUPERAR/PERDIDO` **ou** cliente com qualquer parcela `inCarteira`.

### Datas (bug D-1 resolvido)
Datas de dia-cheio (vencimento/vigência) são salvas em **UTC meia-noite**. Exibição
**sempre com `timeZone: 'UTC'`** (helper `fmtDate` em `apps/web/src/lib/format.ts` e
demais telas) pra não aparecer 1 dia antes no fuso do Brasil. Timestamps reais de
reunião ficam em horário **local**.

### Dedup de leads (sync de planilhas)
`syncFromSheets` normaliza **telefone (dígitos), nome (sem acento/espaço/caixa) e
email (minúsculo)** e compara contra **todos os stages** (inclusive PERDIDO) → evita
duplicata e re-entrada de perdido como novo. Criação manual de lead **não** dedupa.

### Documentos / contratos
Contrato assinado é anexado na ficha do cliente (aba Contrato → Documentos), guardado
em base64 no banco. Limite **~3MB** por arquivo pela tela (teto de body do serverless
Vercel = 4,5MB; body limit subido pra 5MB). Aba **Contratos** tem visão "Por Cliente"
(lista + download) e "Contratos Gerados" (geração por template GE/GI/GS).

### Comissões / Mentoria (regras GOON)
- Comissão: **10%** pro "Time de Vendas" (Serginho divide internamente); desconta dos
  mentores (Giulliano absorve).
- **João Afonso** entra como mentor em cliente novo (10% do líquido). Splits por
  cliente variam (Kan House 66/33 Carol/Giu sem João; Ary Narah/Star Shop com João).
- Mentoria: GE individual+grupo, GI só grupo, TTS/AURA individual.

### Acesso
- Rota bloqueada por `allowedModules` (JSON no User). Ex: usuário só-CRM =
  `allowedModules: ["/crm"]`, role `comercial`. Senha padrão nova conta: `aura360`
  (troca no 1º login) salvo se definida explícita.
- Tela de **Vendas** é exclusiva do dono (`canSeeSales`).

---

## 6. Endpoints úteis

- `GET /api/crm/pipeline` — leads do kanban (ordenados por `kanbanOrder`).
- `PATCH /api/crm/:id/stage` · `POST /api/crm/:id/close` · `PATCH /api/crm/reorder`.
- `GET /api/crm/sales-by-month?year=&product=`.
- `GET/POST /api/clients/:id/documents` (+ `/download`) · `GET /api/clients/contracts/overview`.
- `POST /api/crm/sync-sheets` — importa leads das planilhas (Meta Ads, Respondi).

---

## 7. Convenções de trabalho

- Alterações de **dados** (correções, cadastros, churn) → script `tsx` direto no Neon.
- Alterações de **código** → editar, `tsc --noEmit` (api + web) e/ou `next build`,
  commit + push (auto-deploy). Confirmar deploy da API pelo `/health` (200).
- Ao mexer em stage/venda/split, preservar os **códigos internos** e as convenções
  acima (98/98, 99/99, split 6%/10%/50-50, TTS 2 meses).
