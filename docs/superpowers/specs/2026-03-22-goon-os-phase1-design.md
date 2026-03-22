# GOON OS — Phase 1 Design Spec

**Date:** 2026-03-22
**Authors:** João Vitor + Claude
**Status:** Approved

## Context

GOON is a business management consultancy specializing in fashion and design businesses. Currently, client management, contracts, and onboarding are handled manually (Word templates, spreadsheets, WhatsApp). GOON OS is a centralized system to control clients, contracts, financials, and operations in one place.

This spec covers **Phase 1**: CRM, Products & Plans, Contracts, Onboarding Kanban, and CEO Dashboard. Phase 2 (Asaas financial integration) and Phase 3 (Data intelligence & AI) follow later as separate specs.

## Users

- **João** (CEO/primary): Full access, manages everything
- **Future team members**: Simple auth for now (no role-based access yet)

## Goals

1. Centralize all client information in one place (CRM)
2. Track which product each client contracted and the terms (Products & Plans)
3. Auto-generate contracts from templates with dynamic fields (Contracts)
4. Visual pipeline for onboarding new clients (Kanban)
5. CEO-level overview of the business (Dashboard)
6. Mobile-friendly for quick consultation on the go

## Non-Goals (Phase 1)

- Asaas integration (Phase 2 — includes: payment status sync, invoice generation, delinquency tracking, Asaas webhooks)
- Automatic billing/invoicing (Phase 2)
- Delinquency alerts and automatic collections (Phase 2)
- AI-powered insights and diagnostics (Phase 3 — uses client strategic data + onboarding history as input)
- Role-based access control (future)
- D4Sign/Clicksign integration (future — contracts start as PDF download)

---

## Tech Stack

Same proven stack as VOA RH, separate repository:

- **Monorepo:** Turborepo
- **Backend:** NestJS + TypeScript (apps/api)
- **Frontend:** Next.js 16 + React 19 + TypeScript (apps/web)
- **Database:** PostgreSQL on Supabase (new project)
- **ORM:** Prisma
- **UI:** Tailwind CSS 4 + shadcn/ui + lucide-react icons
- **Toasts:** Sonner
- **PDF Generation:** @sparticuz/chromium + Puppeteer-core (Render-compatible, no full Chromium install needed)
- **Auth:** JWT (access + refresh tokens)
- **State:** React Query + React hooks
- **Deploy:** Vercel (frontend) + Render (backend)

---

## Data Model

### Client (core entity)

```
Client {
  id              String    @id @default(cuid())
  companyName     String
  tradeName       String?
  cnpj            String?   @unique
  responsible     String
  phone           String?
  email           String?
  whatsapp        String?
  segment         String?

  // Address (needed for contracts)
  address         String?
  addressNumber   String?
  neighborhood    String?
  city            String?
  state           String?
  zipCode         String?

  // Business info
  employeeCount   String?   // enum: "1-5", "6-20", "21-50", "51-200", "200+"
  estimatedRevenue String?  // enum: "ATE_50K", "50K_200K", "200K_500K", "500K_1M", "ACIMA_1M"

  // Strategic intelligence
  mainPains       String?
  strategicGoals  String?
  maturity        String?   // enum: LOW, MEDIUM, HIGH
  goonFitScore    Int?      // 1-10

  status          String    @default("ACTIVE") // ACTIVE, PROSPECT, INACTIVE

  plans           ClientPlan[]
  contracts       Contract[]
  onboarding      Onboarding?
  activityLogs    ActivityLog[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

**Status definitions:**
- `PROSPECT` — lead/potential client, not yet contracted
- `ACTIVE` — has an active plan/contract
- `INACTIVE` — no longer active (cancelled, paused, or churned)

### Product

```
Product {
  id          String    @id @default(cuid())
  code        String    @unique  // "GE", "GI", "GS"
  name        String             // "GOON ELITE", "GOON INFINITY", "GOON SCALE"
  description String?
  isActive    Boolean   @default(true)

  plans       ClientPlan[]

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

### ClientPlan (junction: what each client contracted)

```
ClientPlan {
  id              String    @id @default(cuid())
  clientId        String
  productId       String
  value           Decimal   @db.Decimal(10, 2) // total contract value
  paymentType     String             // CASH, INSTALLMENT, RECURRING
  installments    Int?
  installmentValue Decimal? @db.Decimal(10, 2)
  cycleDuration   Int?               // months
  cycleNumber     Int     @default(1)
  startDate       DateTime
  endDate         DateTime?
  status          String  @default("ACTIVE") // ACTIVE, PAUSED, CANCELLED, COMPLETED
  notes           String?

  client          Client   @relation(fields: [clientId], references: [id])
  product         Product  @relation(fields: [productId], references: [id])
  contracts       Contract[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

### Contract

```
Contract {
  id              String    @id @default(cuid())
  clientId        String
  clientPlanId    String?
  templateType    String             // "GE", "GI", "GS", "CUSTOM"
  status          String  @default("DRAFT") // DRAFT, SENT, SIGNED, CANCELLED
  version         Int     @default(1) // incremented on each PDF regeneration

  // Dynamic fields (snapshot at generation time)
  dynamicFields   Json               // typed as ContractDynamicFields in code

  generatedPdfUrl String?
  sentAt          DateTime?
  signedAt        DateTime?

  client          Client       @relation(fields: [clientId], references: [id])
  clientPlan      ClientPlan?  @relation(fields: [clientPlanId], references: [id])

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

**ContractDynamicFields TypeScript interface (validated on write):**
```typescript
interface ContractDynamicFields {
  companyName: string
  cnpj?: string
  responsible: string
  address?: string
  city?: string
  state?: string
  productName: string
  value: string        // formatted BRL
  installments?: number
  installmentValue?: string  // formatted BRL
  startDate: string
  endDate?: string
  duration?: number
}
```

**Contract generation validation:** Before generating a PDF, the following fields are required: `companyName`, `responsible`, `productName`, `value`, `startDate`. If any are missing, return 400 with a list of missing fields.

**Versioning:** Each PDF regeneration increments `version` and overwrites `generatedPdfUrl`. Old PDFs are not preserved (simplicity for Phase 1).

### Onboarding

```
Onboarding {
  id          String    @id @default(cuid())
  clientId    String    @unique
  currentStage String   @default("CLIENT_CLOSED")
  notes       String?

  client      Client    @relation(fields: [clientId], references: [id])

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

**Onboarding creation:** Automatically created when a ClientPlan is created for a client that doesn't have an onboarding yet. Stage starts at `CLIENT_CLOSED`.

**Stage transitions:** Free movement allowed (forward and backward). The 10-stage pipeline is a guide, not a strict state machine. Users may need to move back if a step needs rework.

**Note:** Stages "Pagamento Inicial" and "Geração de Boletos" are manual-only in Phase 1. In Phase 2, these will be automated via Asaas integration.

### ActivityLog (audit trail)

```
ActivityLog {
  id          String    @id @default(cuid())
  clientId    String?
  entityType  String    // "CLIENT", "CONTRACT", "ONBOARDING", "PLAN"
  entityId    String
  action      String    // "CREATED", "UPDATED", "STAGE_CHANGED", "STATUS_CHANGED"
  fromValue   String?   // e.g. previous stage
  toValue     String?   // e.g. new stage
  description String?   // human-readable description
  userId      String?

  client      Client?   @relation(fields: [clientId], references: [id])

  createdAt   DateTime  @default(now())
}
```

This powers: "days in stage" on Kanban cards, "Recent Activity" on Dashboard, and future audit needs.

### User (simple auth)

```
User {
  id          String    @id @default(cuid())
  name        String
  email       String    @unique
  password    String    // bcrypt hash

  createdAt   DateTime  @default(now())
}
```

---

## Module 1: CRM & Clients

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/clients | List clients (search, filter, pagination: `?page=1&limit=20&search=X&status=X&segment=X`) |
| POST | /api/clients | Create client |
| GET | /api/clients/:id | Get client detail (includes plans, contracts, onboarding) |
| PUT | /api/clients/:id | Update client |
| DELETE | /api/clients/:id | Soft delete (set status INACTIVE) |

**Soft delete cascade:** When a client is set to INACTIVE, active plans are set to CANCELLED and pending contracts (DRAFT) are set to CANCELLED. SENT/SIGNED contracts are not affected.

### Frontend Pages

**Client List (`/clients`)**
- Table with columns: Company, Responsible, Segment, Product, Fit Score, Status
- Search bar (company name, responsible, CNPJ)
- Filter by: status, segment, product
- Pagination (20 per page)
- Sort by: company name (default), created date, fit score
- Mobile: card view
- Click row → detail page

**Client Detail (`/clients/[id]`)**
- Header: company name, status badge, edit button
- Tabs or sections:
  - **Info**: all company + contact + address fields, inline editable
  - **Strategic**: pains, goals, maturity, fit score — inline editable
  - **Plans**: list of contracted plans with status
  - **Contracts**: list with status badges, download PDF button
  - **Onboarding**: current stage indicator + link to Kanban
- Action buttons: WhatsApp, Email, Add Plan, Generate Contract

---

## Module 2: Products & Plans

### Products

Pre-seeded in database (via seed script):
- **GE** — GOON ELITE (basic tier)
- **GI** — GOON INFINITY (mid tier)
- **GS** — GOON SCALE (premium tier)

### Product API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/products | List all products |
| GET | /api/products/:id | Get product detail |
| PUT | /api/products/:id | Update product (name, description, active) |
| POST | /api/products | Create new product (for future use) |

Products page (`/products`) for managing name, description, active status.

### Client Plans

**API Endpoints**

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/clients/:id/plans | List plans for a client |
| POST | /api/clients/:id/plans | Create plan for client |
| PUT | /api/plans/:id | Update plan |
| DELETE | /api/plans/:id | Cancel plan (set status CANCELLED) |

**Plan creation flow** (modal from client detail):
1. Select product (GE/GI/GS)
2. Enter value, payment type, installments, duration
3. Set start date
4. End date auto-calculated from duration
5. Save → plan linked to client
6. If client has no onboarding yet → auto-create one

---

## Module 3: Contracts

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/contracts | List all contracts (`?clientId=X&status=X&page=1&limit=20`) |
| POST | /api/contracts | Create contract (from template + client data) |
| GET | /api/contracts/:id | Get contract detail |
| PUT | /api/contracts/:id | Update contract fields |
| PATCH | /api/contracts/:id/status | Change status (validates transitions: DRAFT→SENT→SIGNED, any→CANCELLED) |
| POST | /api/contracts/:id/generate-pdf | Generate/regenerate PDF (increments version) |
| GET | /api/contracts/:id/download | Download generated PDF |

### Contract Generation Flow

1. User clicks "Gerar Contrato" on client detail
2. System pre-fills dynamic fields from client + plan data
3. User reviews/edits fields in a form
4. Clicks "Gerar PDF"
5. Backend validates required fields (companyName, responsible, productName, value, startDate)
6. If validation fails → return 400 with list of missing fields
7. Backend renders HTML template with dynamic fields → Puppeteer-core + @sparticuz/chromium → PDF
8. PDF uploaded to Supabase Storage, version incremented
9. Contract status: DRAFT
10. User can "Enviar" (DRAFT→SENT) or "Marcar como Assinado" (SENT→SIGNED)

### Contract Templates

One HTML template per product (GE, GI, GS) stored in the backend. Dynamic fields replaced at generation time:

- `{{companyName}}` — client company name
- `{{cnpj}}` — client CNPJ
- `{{responsible}}` — contact person
- `{{address}}` — full address (address, number, neighborhood, city, state, zip)
- `{{productName}}` — product full name
- `{{value}}` — total value (formatted BRL)
- `{{installments}}` — number of installments
- `{{installmentValue}}` — value per installment (formatted BRL)
- `{{startDate}}` — contract start date
- `{{endDate}}` — contract end date
- `{{duration}}` — duration in months

Templates are placeholder initially — updated when João provides the Word documents.

### Frontend

**Contracts list (`/contracts`)**
- Table: Client, Product, Value, Status, Version, Created date
- Filter by status (DRAFT, SENT, SIGNED)
- Pagination (20 per page)
- Mobile: card view

**Contract detail** (modal or drawer from client page):
- Dynamic fields form (pre-filled, editable)
- Generate PDF button
- Download PDF button
- Status change buttons (Draft → Sent → Signed)

---

## Module 4: Onboarding (Kanban)

### Pipeline Stages (fixed, 10 stages)

```
CLIENT_CLOSED      → "Cliente Fechado"
SYSTEM_REGISTERED  → "Cadastro no Sistema"
INFO_COLLECTED     → "Coleta de Informações"
CONTRACT_DRAFTED   → "Elaboração do Contrato"
CONTRACT_SENT      → "Envio do Contrato"
CONTRACT_SIGNED    → "Assinatura"
INITIAL_PAYMENT    → "Pagamento Inicial"       ← manual in Phase 1
BILLING_CREATED    → "Geração de Boletos"      ← manual in Phase 1
KICKOFF_SCHEDULED  → "Kickoff Agendado"
ONBOARDING_DONE    → "Onboarding Finalizado"
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/onboarding | List all onboardings with client info |
| POST | /api/onboarding | Create onboarding for client |
| PATCH | /api/onboarding/:id/stage | Move to new stage (body: `{ toStage: "STAGE" }`) |
| GET | /api/onboarding/:id | Get onboarding detail |

**Stage change** logs an ActivityLog entry with `fromValue` (old stage) and `toValue` (new stage). This powers "days in stage" calculation.

### Frontend (`/onboarding`)

**Desktop: Kanban board**
- 10 columns (horizontal scroll)
- Cards show: client company name, product badge, responsible name, days in stage
- "Days in stage" calculated from last ActivityLog `STAGE_CHANGED` entry for this onboarding
- Drag & drop moves to new stage with toast feedback
- Click card → modal with client info + stage dropdown
- Confirmation for final stage ("Onboarding Finalizado")

**Mobile: filtered list view**
- Stage filter chips at top
- Cards in vertical list
- Tap card → modal with stage dropdown

Same proven UX pattern as VOA RH Kanban.

---

## Module 5: Dashboard

### API Endpoint

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/dashboard | Aggregated KPIs, pipeline summary, recent activity |

Returns:
```typescript
{
  kpis: {
    totalActiveClients: number
    newClientsThisMonth: number
    totalRevenue: number         // sum of active plans
    revenueByProduct: { GE: number, GI: number, GS: number }
  }
  pipelineSummary: { stage: string, count: number }[]
  contractsStatus: { status: string, count: number }[]
  recentActivity: ActivityLog[]  // last 10 entries
}
```

### Page (`/dashboard`)

**KPI Cards (top row):**
- Total clientes ativos
- Novos clientes (mês atual)
- Receita total (soma de todos os planos ativos)
- Receita por produto: GE | GI | GS

**Pipeline Summary:**
- Visual bar showing distribution across onboarding stages
- Click stage → navigate to onboarding page filtered

**Contracts Status:**
- Bar or badges: DRAFT / SENT / SIGNED counts

**Recent Activity:**
- Last 10 activity entries (client created, stage changed, contract generated, etc.)

**Responsive:**
- Mobile: cards stack 1 per row, pipeline as horizontal scroll

---

## Layout & Navigation

### Sidebar (same pattern as VOA RH)

```
Dashboard       (LayoutDashboard icon)
Clientes        (Building2 icon)
Produtos        (Package icon)
Contratos       (FileText icon)
Onboarding      (GitBranch icon)
```

Collapsible: expanded (240px) / icons (56px) / mobile hamburger.

### Theme

Dark theme by default. Light mode toggle. CSS variables for easy rebranding when GOON identity is provided.

### Auth

Simple login page → JWT → dashboard. Single admin user seeded. CORS configured for Vercel↔Render.

---

## Breakpoints

```
Mobile:  < 768px  — single column, hamburger, list views, card views
Tablet:  768-1023px — sidebar collapsed, 2-col where fits
Desktop: ≥ 1024px — sidebar expanded, full layouts
```

---

## Implementation Order

1. **Project scaffold** — Turborepo monorepo, NestJS API, Next.js web, Prisma schema (all models + ActivityLog), Supabase DB, seed (user + products)
2. **Auth** — JWT login, middleware, user seed
3. **CRM (Clients)** — CRUD + list + detail + inline edit + pagination
4. **Products & Plans** — Product CRUD, client plan CRUD, auto-create onboarding
5. **Contracts** — Template system, dynamic fields validation, PDF generation (@sparticuz/chromium), status flow
6. **Onboarding Kanban** — Pipeline, drag & drop, mobile list, ActivityLog on stage change
7. **Dashboard** — KPIs aggregation, pipeline summary, recent activity
8. **Deploy** — Vercel + Render + CORS

---

## Success Criteria

- [ ] Client CRUD with all fields (company + address + strategic)
- [ ] Products seeded (GE, GI, GS) with plan linking to clients
- [ ] Contract generation from template → PDF download with validation
- [ ] Contract status flow (Draft → Sent → Signed) with dedicated endpoint
- [ ] Contract versioning on regeneration
- [ ] Onboarding Kanban with 10 stages, drag & drop, stage dropdown
- [ ] ActivityLog recording stage changes, client creation, contract events
- [ ] Dashboard with KPIs, pipeline summary, and recent activity
- [ ] Mobile responsive on all screens
- [ ] Pagination on all list endpoints
- [ ] Deployed to Vercel + Render
