# GOON OS Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the GOON OS Phase 1 — a business management system with CRM, Products & Plans, Contracts (PDF generation), Onboarding Kanban, and CEO Dashboard.

**Architecture:** Turborepo monorepo with NestJS backend API and Next.js 16 frontend. PostgreSQL on Supabase via Prisma ORM. JWT auth. PDF generation via @sparticuz/chromium + puppeteer-core. Same proven patterns as VOA RH project but in a completely separate repository.

**Tech Stack:** Turborepo, NestJS 11, Next.js 16, React 19, Prisma 6, PostgreSQL (Supabase), Tailwind CSS 4, shadcn/ui, lucide-react, Sonner, @dnd-kit, @sparticuz/chromium + puppeteer-core

**Spec:** `docs/superpowers/specs/2026-03-22-goon-os-phase1-design.md`

**Base path:** `C:/Users/joao.vitor/Desktop/GOON-OS`

---

## File Structure

### Project Root
```
GOON-OS/
├── package.json              # Turborepo root
├── turbo.json
├── apps/
│   ├── api/                  # NestJS backend
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── app.controller.ts      # health check
│   │   │   ├── prisma/
│   │   │   │   ├── prisma.module.ts
│   │   │   │   └── prisma.service.ts
│   │   │   ├── auth/
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   └── jwt-auth.guard.ts
│   │   │   ├── modules/
│   │   │   │   ├── clients/
│   │   │   │   │   ├── clients.module.ts
│   │   │   │   │   ├── clients.controller.ts
│   │   │   │   │   ├── clients.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   ├── products/
│   │   │   │   │   ├── products.module.ts
│   │   │   │   │   ├── products.controller.ts
│   │   │   │   │   └── products.service.ts
│   │   │   │   ├── plans/
│   │   │   │   │   ├── plans.module.ts
│   │   │   │   │   ├── plans.controller.ts
│   │   │   │   │   └── plans.service.ts
│   │   │   │   ├── contracts/
│   │   │   │   │   ├── contracts.module.ts
│   │   │   │   │   ├── contracts.controller.ts
│   │   │   │   │   ├── contracts.service.ts
│   │   │   │   │   ├── pdf.service.ts          # PDF generation
│   │   │   │   │   └── templates/              # HTML contract templates
│   │   │   │   │       ├── ge.html
│   │   │   │   │       ├── gi.html
│   │   │   │   │       └── gs.html
│   │   │   │   ├── onboarding/
│   │   │   │   │   ├── onboarding.module.ts
│   │   │   │   │   ├── onboarding.controller.ts
│   │   │   │   │   └── onboarding.service.ts
│   │   │   │   ├── dashboard/
│   │   │   │   │   ├── dashboard.module.ts
│   │   │   │   │   ├── dashboard.controller.ts
│   │   │   │   │   └── dashboard.service.ts
│   │   │   │   └── activity-log/
│   │   │   │       ├── activity-log.module.ts
│   │   │   │       └── activity-log.service.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                  # Next.js frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx            # root layout
│       │   │   ├── globals.css
│       │   │   ├── page.tsx              # redirect to /login
│       │   │   ├── (auth)/login/page.tsx
│       │   │   └── (dashboard)/
│       │   │       ├── layout.tsx        # sidebar + header
│       │   │       ├── dashboard/page.tsx
│       │   │       ├── clients/
│       │   │       │   ├── page.tsx
│       │   │       │   └── [id]/page.tsx
│       │   │       ├── products/page.tsx
│       │   │       ├── contracts/page.tsx
│       │   │       └── onboarding/page.tsx
│       │   ├── hooks/
│       │   │   ├── useAuth.ts
│       │   │   ├── useMediaQuery.ts
│       │   │   └── useSidebar.ts
│       │   ├── contexts/
│       │   │   └── SidebarContext.tsx
│       │   ├── components/
│       │   │   ├── Sidebar.tsx
│       │   │   ├── MobileHeader.tsx
│       │   │   ├── KanbanBoard.tsx
│       │   │   └── KanbanListView.tsx
│       │   └── lib/
│       │       ├── api.ts
│       │       ├── constants.ts
│       │       ├── query-client.ts
│       │       └── utils.ts
│       ├── package.json
│       └── tsconfig.json
```

---

## Task 1: Project Scaffold + Prisma Schema

**Files to create:** Everything in the project root, `apps/api/` skeleton, `apps/web/` skeleton, Prisma schema with all models.

This is the biggest task — sets up the entire monorepo from scratch.

- [ ] **Step 1: Initialize Turborepo monorepo**

```bash
cd "/c/Users/joao.vitor/Desktop/GOON-OS"
git init
npm init -y
```

Set up `package.json` root:
```json
{
  "name": "goon-os",
  "version": "0.0.1",
  "private": true,
  "packageManager": "npm@11.9.0",
  "workspaces": ["apps/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build"
  },
  "devDependencies": {
    "turbo": "latest",
    "typescript": "^5.0.0"
  }
}
```

Create `turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

- [ ] **Step 2: Scaffold NestJS API app**

Create `apps/api/` with NestJS boilerplate:
- `package.json` with dependencies: @nestjs/common, @nestjs/core, @nestjs/platform-express, @nestjs/config, @nestjs/jwt, @nestjs/passport, @prisma/client, prisma, bcryptjs, class-validator, class-transformer, passport, passport-jwt, reflect-metadata, rxjs, @supabase/supabase-js
- `tsconfig.json` and `tsconfig.build.json`
- `nest-cli.json`
- `src/main.ts` — bootstrap with CORS (localhost:3000 + Vercel URL), ValidationPipe, port 3001
- `src/app.module.ts` — imports ConfigModule, PrismaModule
- `src/app.controller.ts` — `GET /` returns `{ status: 'ok', service: 'goon-os-api' }`, `GET /health` returns `{ status: 'ok', timestamp: ISO }`

- [ ] **Step 3: Create Prisma schema with ALL models**

`apps/api/prisma/schema.prisma` — complete schema with all 7 models from spec:
- User, Client, Product, ClientPlan, Contract, Onboarding, ActivityLog
- Use `Decimal @db.Decimal(10,2)` for financial fields
- Use `@default(cuid())` for all IDs
- Use `@default(now())` for createdAt, `@updatedAt` for updatedAt
- All relationships defined with proper foreign keys

- [ ] **Step 4: Create seed script**

`apps/api/prisma/seed.ts`:
- Create admin user: `admin@goon.com.br` / `goon2026` (bcrypt hashed)
- Create 3 products: GE (GOON ELITE), GI (GOON INFINITY), GS (GOON SCALE)

- [ ] **Step 5: Create PrismaModule and PrismaService**

`apps/api/src/prisma/prisma.module.ts` and `prisma.service.ts` — global module, singleton service extending PrismaClient.

- [ ] **Step 6: Scaffold Next.js web app**

Create `apps/web/` with Next.js 16 boilerplate:
- `package.json` with dependencies: next, react, react-dom, @tanstack/react-query, lucide-react, sonner, tailwind-merge, clsx, class-variance-authority, zod
- `next.config.ts`
- `tsconfig.json`
- `tailwind.config.ts` (or CSS-based Tailwind 4 config)
- `src/app/layout.tsx` — root layout with theme script (same pattern as VOA RH)
- `src/app/globals.css` — CSS variables for dark/light theme (same VOA RH pattern)
- `src/app/page.tsx` — redirect to `/login`
- `src/lib/api.ts` — apiFetch utility with Bearer token, 401 redirect
- `src/lib/query-client.ts` — React Query config
- `src/lib/utils.ts` — cn() Tailwind merge helper
- `src/lib/constants.ts` — onboarding stages, stage labels, stage colors
- `.env.local` — `NEXT_PUBLIC_API_URL=http://localhost:3001`

- [ ] **Step 7: Install dependencies and run Prisma migration**

```bash
cd "/c/Users/joao.vitor/Desktop/GOON-OS"
npm install
cd apps/api
npx prisma generate
npx prisma db push
npx ts-node prisma/seed.ts
```

- [ ] **Step 8: Verify both apps start**

```bash
cd "/c/Users/joao.vitor/Desktop/GOON-OS"
npm run dev
```

Verify API on http://localhost:3001/health and Web on http://localhost:3000

- [ ] **Step 9: Create .gitignore BEFORE first commit**

```
node_modules/
dist/
.next/
.env
.env.local
*.log
.turbo/
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: project scaffold with Turborepo, NestJS API, Next.js web, Prisma schema"
```

---

## Task 2: Auth (JWT Login)

**Files to create:**
- `apps/api/src/auth/auth.module.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/jwt.strategy.ts`
- `apps/api/src/auth/jwt-auth.guard.ts`
- `apps/web/src/hooks/useAuth.ts`
- `apps/web/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Create Auth module (API)**

Auth service with:
- `login(email, password)` — validate credentials via bcrypt, return JWT access_token + refresh_token
- `getProfile(userId)` — return user info

Auth controller:
- `POST /api/auth/login` — body: `{ email, password }`, returns tokens + user
- `GET /api/auth/me` — requires JWT guard, returns user profile

JWT strategy + guard using @nestjs/passport, @nestjs/jwt.

Register AuthModule in AppModule. Apply JwtAuthGuard globally with `@UseGuards(JwtAuthGuard)` on protected routes (or use APP_GUARD).

- [ ] **Step 2: Create Login page (Web)**

`src/app/(auth)/login/page.tsx`:
- Email + password form
- "GOON OS" branding header
- Submit calls `/api/auth/login`
- On success: store tokens in localStorage, redirect to `/dashboard`
- Error handling with toast

- [ ] **Step 3: Create useAuth hook**

`src/hooks/useAuth.ts`:
- Same pattern as VOA RH: check localStorage token, fetch `/api/auth/me`, redirect to `/login` on failure
- Returns `{ user, loading, logout }`

- [ ] **Step 4: Verify login works**

Test login with `admin@goon.com.br` / `goon2026`

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: JWT auth with login page"
```

---

## Task 3: Dashboard Layout (Sidebar + Responsive)

**Files to create:**
- `apps/web/src/hooks/useMediaQuery.ts`
- `apps/web/src/hooks/useSidebar.ts`
- `apps/web/src/contexts/SidebarContext.tsx`
- `apps/web/src/components/Sidebar.tsx`
- `apps/web/src/components/MobileHeader.tsx`
- `apps/web/src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create hooks and context**

Copy proven patterns from VOA RH:
- `useMediaQuery.ts` — SSR-safe media query hook with `useIsMobile()`, `useIsTablet()`
- `useSidebar.ts` — expand/collapse/mobile state with localStorage persistence
- `SidebarContext.tsx` — React context provider

- [ ] **Step 2: Create Sidebar component**

`components/Sidebar.tsx` — 3 modes: expanded (240px), collapsed (56px icons), mobile overlay.

Navigation items:
```typescript
const NAV_ITEMS = [
  { href: '/dashboard',   label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/clients',     label: 'Clientes',   icon: Building2 },
  { href: '/products',    label: 'Produtos',   icon: Package },
  { href: '/contracts',   label: 'Contratos',  icon: FileText },
  { href: '/onboarding',  label: 'Onboarding', icon: GitBranch },
]
```

Same visual pattern as VOA RH: dark bg, active item with left accent, theme toggle, logout button at bottom.

- [ ] **Step 3: Create MobileHeader**

`components/MobileHeader.tsx` — hamburger ☰ + "GOON" logo + user name.

- [ ] **Step 4: Create dashboard layout**

`app/(dashboard)/layout.tsx`:
- SidebarProvider wrapping
- Sidebar + MobileHeader (conditional)
- Desktop header with dynamic left offset
- Main content area with responsive padding
- Toaster from sonner
- QueryClientProvider
- useAuth for protection
- useKeepAlive for Render ping (when deployed)

- [ ] **Step 5: Create placeholder dashboard page**

`app/(dashboard)/dashboard/page.tsx` — simple "Dashboard" heading for now.

- [ ] **Step 6: Verify layout renders correctly**

- [ ] **Step 7: Commit**

```bash
git commit -m "feat: dashboard layout with collapsible sidebar and mobile support"
```

---

## Task 4: CRM — Clients Module

**API files:**
- `apps/api/src/modules/clients/clients.module.ts`
- `apps/api/src/modules/clients/clients.controller.ts`
- `apps/api/src/modules/clients/clients.service.ts`
- `apps/api/src/modules/clients/dto/create-client.dto.ts`
- `apps/api/src/modules/clients/dto/update-client.dto.ts`

**Web files:**
- `apps/web/src/app/(dashboard)/clients/page.tsx`
- `apps/web/src/app/(dashboard)/clients/[id]/page.tsx`

- [ ] **Step 1: Create Clients API**

ClientsService with:
- `findAll(params)` — paginated list with search (companyName, responsible, CNPJ), filter (status, segment), sort (companyName default). Returns `{ data: Client[], total, page, limit }`
- `findOne(id)` — includes plans (with product), contracts, onboarding
- `create(dto)` — create client, log ActivityLog CREATED
- `update(id, dto)` — update client, log ActivityLog UPDATED
- `remove(id)` — soft delete: set INACTIVE, cancel active plans and draft contracts, log ActivityLog

ClientsController:
- `GET /api/clients` — query params: `search`, `status`, `segment`, `page`, `limit`, `sort`
- `POST /api/clients` — body: CreateClientDto (validated with class-validator)
- `GET /api/clients/:id`
- `PUT /api/clients/:id`
- `DELETE /api/clients/:id`

DTOs with validation: companyName required, email optional but valid format, cnpj optional but unique.

- [ ] **Step 2: Create ActivityLog module**

`activity-log.module.ts` and `activity-log.service.ts`:
- `log(params)` — create ActivityLog entry
- `findByClient(clientId, limit)` — recent activity for a client
- `findRecent(limit)` — recent activity across all entities
- Global module, injectable anywhere

- [ ] **Step 3: Create Clients List page**

`clients/page.tsx`:
- Search bar + status/segment filters
- Table: Company, Responsible, Segment, Product, Fit Score, Status
- Pagination controls
- Mobile: card view (useIsMobile)
- Click row → navigate to `/clients/[id]`
- "Novo Cliente" button → creation modal
- Creation modal with essential fields + "Mais campos" toggle (same pattern as VOA RH candidates)

- [ ] **Step 4: Create Client Detail page**

`clients/[id]/page.tsx`:
- Header: company name, status badge
- Sections (tab-style or accordion):
  - **Info**: company + contact + address fields, inline editable
  - **Estratégico**: pains, goals, maturity, fit score
  - **Planos**: list (populated in Task 5)
  - **Contratos**: list (populated in Task 6)
  - **Onboarding**: current stage (populated in Task 7)
- Action buttons: WhatsApp (if phone exists), Email, "Adicionar Plano", "Gerar Contrato"

- [ ] **Step 5: Verify CRUD works end-to-end**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: CRM clients module with list, detail, inline edit, and activity log"
```

---

## Task 5: Products & Plans Module

**API files:**
- `apps/api/src/modules/products/products.module.ts`
- `apps/api/src/modules/products/products.controller.ts`
- `apps/api/src/modules/products/products.service.ts`
- `apps/api/src/modules/plans/plans.module.ts`
- `apps/api/src/modules/plans/plans.controller.ts`
- `apps/api/src/modules/plans/plans.service.ts`

**Web files:**
- `apps/web/src/app/(dashboard)/products/page.tsx`

- [ ] **Step 1: Create Products API**

ProductsService: `findAll()`, `findOne(id)`, `update(id, dto)`, `create(dto)`
ProductsController: `GET /api/products`, `GET /api/products/:id`, `PUT /api/products/:id`, `POST /api/products`

- [ ] **Step 2: Create Plans API**

PlansService:
- `findByClient(clientId)` — list plans for a client
- `create(clientId, dto)` — create plan, auto-calculate endDate from startDate + cycleDuration, auto-create Onboarding if client doesn't have one, log ActivityLog
- `update(id, dto)` — update plan
- `cancel(id)` — set status CANCELLED, log ActivityLog

PlansController:
- `GET /api/clients/:clientId/plans`
- `POST /api/clients/:clientId/plans` — body: `{ productId, value, paymentType, installments, installmentValue, cycleDuration, startDate, notes }`
- `PUT /api/plans/:id`
- `DELETE /api/plans/:id` — cancels plan

- [ ] **Step 3: Create Products page**

`products/page.tsx`:
- Card view for each product (GE, GI, GS)
- Shows: name, code, description, active status, number of active clients
- Edit modal for name/description
- Simple and clean

- [ ] **Step 4: Integrate plan creation into Client Detail**

In the client detail page, the "Planos" section:
- List existing plans with: product name, value (BRL), status, dates
- "Adicionar Plano" button → modal with: product select (GE/GI/GS), value, payment type, installments, duration, start date
- End date auto-calculated
- On save: POST to API, refresh list

- [ ] **Step 5: Verify plan creation creates onboarding**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: products & plans module with auto-onboarding creation"
```

---

## Task 6: Contracts Module (with PDF Generation)

**API files:**
- `apps/api/src/modules/contracts/contracts.module.ts`
- `apps/api/src/modules/contracts/contracts.controller.ts`
- `apps/api/src/modules/contracts/contracts.service.ts`
- `apps/api/src/modules/contracts/pdf.service.ts`
- `apps/api/src/modules/contracts/templates/ge.html`
- `apps/api/src/modules/contracts/templates/gi.html`
- `apps/api/src/modules/contracts/templates/gs.html`

**Web files:**
- `apps/web/src/app/(dashboard)/contracts/page.tsx`

- [ ] **Step 1: Create contract HTML templates**

3 HTML templates (ge.html, gi.html, gs.html) with placeholder content and `{{field}}` markers. Professional contract layout with:
- Header with GOON branding
- Client info section (company, CNPJ, address, responsible)
- Service description section (product name, duration)
- Financial section (value, installments, payment terms)
- Dates section (start, end)
- Signature lines
- Footer

Templates use inline CSS for PDF rendering compatibility.

- [ ] **Step 2: Create PDF service**

`pdf.service.ts`:
- Install: `@sparticuz/chromium` and `puppeteer-core`
- `generatePdf(templateType, dynamicFields)`:
  1. Read template file (ge.html/gi.html/gs.html)
  2. Replace all `{{field}}` markers with values from dynamicFields
  3. Launch chromium, create page, set HTML content
  4. Generate PDF buffer
  5. Upload to Supabase Storage (bucket: `contracts`)
  6. Return public URL
- Validate required fields before generation: companyName, responsible, productName, value, startDate

- [ ] **Step 3: Create Contracts API**

ContractsService:
- `findAll(params)` — paginated, filterable by clientId, status
- `findOne(id)` — includes client and plan
- `create(dto)` — create contract record, pre-fill dynamicFields from client + plan data
- `update(id, dto)` — update dynamic fields
- `changeStatus(id, newStatus)` — validate transitions (DRAFT→SENT→SIGNED, any→CANCELLED), set sentAt/signedAt timestamps, log ActivityLog
- `generatePdf(id)` — call PdfService, save URL, increment version, log ActivityLog
- `getDownloadUrl(id)` — return PDF URL

ContractsController:
- `GET /api/contracts` — query: `clientId`, `status`, `page`, `limit`
- `POST /api/contracts`
- `GET /api/contracts/:id`
- `PUT /api/contracts/:id`
- `PATCH /api/contracts/:id/status` — body: `{ status: "SENT" }`
- `POST /api/contracts/:id/generate-pdf`
- `GET /api/contracts/:id/download`

- [ ] **Step 4: Create Contracts list page**

`contracts/page.tsx`:
- Table: Client, Product, Value, Status badge, Version, Date
- Filter by status (DRAFT, SENT, SIGNED)
- Pagination
- Mobile: card view
- Click → opens contract detail modal

- [ ] **Step 5: Integrate contract creation into Client Detail**

In client detail, "Contratos" section:
- List existing contracts
- "Gerar Contrato" button → modal with:
  1. Select plan (if multiple)
  2. Dynamic fields pre-filled (editable)
  3. "Gerar PDF" button → calls API, shows success toast
  4. "Baixar PDF" button after generation
- Status change buttons: "Marcar como Enviado", "Marcar como Assinado"

- [ ] **Step 6: Test full contract flow**

Create client → add plan → generate contract → generate PDF → download → change status

- [ ] **Step 7: Commit**

```bash
git commit -m "feat: contracts module with PDF generation and status flow"
```

---

## Task 7: Onboarding Kanban

**API files:**
- `apps/api/src/modules/onboarding/onboarding.module.ts`
- `apps/api/src/modules/onboarding/onboarding.controller.ts`
- `apps/api/src/modules/onboarding/onboarding.service.ts`

**Web files:**
- `apps/web/src/components/KanbanBoard.tsx`
- `apps/web/src/components/KanbanListView.tsx`
- `apps/web/src/app/(dashboard)/onboarding/page.tsx`

- [ ] **Step 1: Create Onboarding API**

OnboardingService:
- `findAll()` — all onboardings with client info (company name, responsible, product)
- `findOne(id)` — detail with client and recent activity
- `create(clientId)` — create at CLIENT_CLOSED stage
- `changeStage(id, toStage)` — update stage, log ActivityLog with fromValue/toValue

OnboardingController:
- `GET /api/onboarding`
- `POST /api/onboarding`
- `PATCH /api/onboarding/:id/stage` — body: `{ toStage: "STAGE_NAME" }`
- `GET /api/onboarding/:id`

- [ ] **Step 2: Install @dnd-kit**

```bash
cd apps/web && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 3: Create KanbanBoard component**

`components/KanbanBoard.tsx`:
- 10 columns for each stage
- Uses DndContext, SortableContext from @dnd-kit
- Drag & drop with PointerSensor (distance: 6)
- Drop zone indicator (useDroppable + isOver styling)
- DragOverlay for visual feedback
- On drop: call API `PATCH /api/onboarding/:id/stage` with `{ toStage }`, show toast
- Confirmation dialog for final stage (ONBOARDING_DONE)
- Cards show: company name, product badge (GE/GI/GS colored), responsible, days in stage
- Click card → opens modal with client info + stage dropdown

Stage colors:
```typescript
const STAGE_COLORS = {
  CLIENT_CLOSED: '#8b5cf6',
  SYSTEM_REGISTERED: '#4A78FF',
  INFO_COLLECTED: '#06b6d4',
  CONTRACT_DRAFTED: '#0891b2',
  CONTRACT_SENT: '#f59e0b',
  CONTRACT_SIGNED: '#f97316',
  INITIAL_PAYMENT: '#eab308',
  BILLING_CREATED: '#a855f7',
  KICKOFF_SCHEDULED: '#10b981',
  ONBOARDING_DONE: '#22c55e',
}
```

- [ ] **Step 4: Create KanbanListView component**

`components/KanbanListView.tsx` (mobile):
- Stage filter chips at top with counts
- Vertical card list sorted by updatedAt desc
- "Todas" chip with total count
- Tap card → modal with stage dropdown
- Same proven pattern as VOA RH

- [ ] **Step 5: Create Onboarding page**

`onboarding/page.tsx`:
- Uses useIsMobile to switch between KanbanBoard and KanbanListView
- Loads onboarding data from API
- Modal with client info and stage dropdown (same pattern as VOA RH)
- Toast on stage change (sonner)

- [ ] **Step 6: Integrate onboarding section in Client Detail**

In client detail page, "Onboarding" section:
- Shows current stage with colored badge
- Link "Ver no Kanban" → navigates to `/onboarding`

- [ ] **Step 7: Test full onboarding flow**

Create client → add plan (auto-creates onboarding) → see on Kanban → drag through stages

- [ ] **Step 8: Commit**

```bash
git commit -m "feat: onboarding kanban with drag & drop and mobile list view"
```

---

## Task 8: CEO Dashboard

**API files:**
- `apps/api/src/modules/dashboard/dashboard.module.ts`
- `apps/api/src/modules/dashboard/dashboard.controller.ts`
- `apps/api/src/modules/dashboard/dashboard.service.ts`

**Web files:**
- `apps/web/src/app/(dashboard)/dashboard/page.tsx` (replace placeholder)

- [ ] **Step 1: Create Dashboard API**

DashboardService:
- `getStats()` — aggregates:
  - `totalActiveClients`: count clients where status=ACTIVE
  - `newClientsThisMonth`: count clients created this month
  - `totalRevenue`: sum of value from active ClientPlans
  - `revenueByProduct`: sum grouped by product code (GE/GI/GS)
  - `pipelineSummary`: count onboardings grouped by currentStage
  - `contractsStatus`: count contracts grouped by status
  - `recentActivity`: last 10 ActivityLog entries with descriptions

DashboardController:
- `GET /api/dashboard` — returns full stats object

- [ ] **Step 2: Create Dashboard page**

Replace placeholder `dashboard/page.tsx`:

**KPI Cards (top row, responsive grid: 1col mobile / 4col desktop):**
- Clientes Ativos (number, blue)
- Novos este mês (number, green)
- Receita Total (BRL formatted, primary)
- Receita by product (3 small badges: GE/GI/GS with values)

**Pipeline Summary (middle):**
- Horizontal bar or card grid showing count per onboarding stage
- Each stage colored with STAGE_COLORS
- Click → navigate to `/onboarding` (filtered if possible)

**Contracts Status:**
- 3 badges/cards: Rascunho (DRAFT count), Enviado (SENT count), Assinado (SIGNED count)

**Recent Activity:**
- List of last 10 activity entries
- Each shows: icon, description, relative time ("há 2 horas")
- Scrollable

All responsive with useIsMobile.

- [ ] **Step 3: Verify dashboard loads with real data**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: CEO dashboard with KPIs, pipeline summary, and activity feed"
```

---

## Task 9: Deploy

**Files:**
- `.gitignore`
- `apps/api/.env` (production values)
- `apps/web/.env.local` (production API URL)

- [ ] **Step 1: Prepare .gitignore**

```
node_modules/
dist/
.next/
.env
.env.local
*.log
.turbo/
```

- [ ] **Step 2: Create GitHub repository**

```bash
cd "/c/Users/joao.vitor/Desktop/GOON-OS"
gh repo create joao-voa/goon-os --private --source=. --push
```

(If gh CLI not available, João creates manually on GitHub and runs `git remote add origin` + `git push`)

- [ ] **Step 3: Configure Render for API**

João creates a new Web Service on Render:
- Name: `goon-os-api`
- Repo: joao-voa/goon-os
- Root directory: `apps/api`
- Build command: `npm install && npx prisma generate && npm run build`
- Start command: `node dist/main`
- Environment variables: DATABASE_URL, DIRECT_URL, JWT_SECRET, JWT_REFRESH_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY, FRONTEND_URL

- [ ] **Step 4: Configure Vercel for Frontend**

João connects the repo to Vercel:
- Root directory: `apps/web`
- Framework: Next.js
- Environment variable: `NEXT_PUBLIC_API_URL=https://goon-os-api.onrender.com`

- [ ] **Step 5: Run seed on production database**

```bash
# From local, pointing to production DATABASE_URL
DATABASE_URL="production-url" npx prisma db push
DATABASE_URL="production-url" npx ts-node prisma/seed.ts
```

- [ ] **Step 6: Verify production deploy**

Test: login, create client, add plan, generate contract, kanban

- [ ] **Step 7: Final commit**

```bash
git commit -m "chore: deploy configuration"
git push origin main
```
