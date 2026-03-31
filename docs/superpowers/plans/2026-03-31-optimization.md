# GOON OS — Optimization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix bugs, improve database performance, and optimize frontend speed across the GOON OS platform.

**Architecture:** Backend-first approach — fix database indexes and N+1 queries for immediate speed gains, then stabilize NestJS with proper error handling and connection lifecycle, finally optimize Next.js frontend config and data fetching.

**Tech Stack:** Turborepo, NestJS 11, Next.js 16, Prisma 6.19, Neon PostgreSQL, React 19

---

## Task 1: Add Database Indexes to Prisma Schema

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

Every foreign key and frequently-filtered column is missing indexes. This is the single biggest performance win.

- [ ] **Step 1: Add indexes to Client model**

In `apps/api/prisma/schema.prisma`, add `@@index` to the `Client` model right before the closing `}`:

```prisma
model Client {
  // ... existing fields ...

  @@index([status])
  @@index([createdAt])
}
```

- [ ] **Step 2: Add indexes to ClientPlan model**

```prisma
model ClientPlan {
  // ... existing fields ...

  @@index([clientId])
  @@index([productId])
  @@index([status])
  @@index([endDate])
  @@index([clientId, status])
}
```

- [ ] **Step 3: Add indexes to Contract model**

```prisma
model Contract {
  // ... existing fields ...

  @@index([clientId])
  @@index([clientPlanId])
  @@index([status])
  @@index([isSigned])
}
```

- [ ] **Step 4: Add indexes to Payment model**

```prisma
model Payment {
  // ... existing fields ...

  @@index([clientId])
  @@index([clientPlanId])
  @@index([contractId])
  @@index([status])
  @@index([dueDate])
  @@index([status, dueDate])
}
```

- [ ] **Step 5: Add indexes to Pendency model**

```prisma
model Pendency {
  // ... existing fields ...

  @@index([clientId])
  @@index([status])
  @@index([type])
  @@index([type, clientId, status])
}
```

- [ ] **Step 6: Add indexes to ActivityLog model**

```prisma
model ActivityLog {
  // ... existing fields ...

  @@index([clientId])
  @@index([entityType, entityId])
  @@index([createdAt])
}
```

- [ ] **Step 7: Push schema to database**

```bash
cd apps/api && npx prisma db push
```

Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 8: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "perf: add database indexes to all models"
```

---

## Task 2: Fix N+1 Query in OnboardingService.findAll()

**Files:**
- Modify: `apps/api/src/modules/onboarding/onboarding.service.ts`

Currently fetches ActivityLog per-onboarding in a loop (N+1). Fix: batch-fetch all stage logs in one query.

- [ ] **Step 1: Replace the N+1 loop with a batch query**

Replace the entire `findAll()` method in `apps/api/src/modules/onboarding/onboarding.service.ts` (lines 43-101):

```typescript
async findAll() {
  const onboardings = await this.prisma.onboarding.findMany({
    include: {
      client: {
        select: {
          id: true,
          companyName: true,
          responsible: true,
          phone: true,
          plans: {
            where: { status: 'ACTIVE' },
            take: 1,
            include: {
              product: { select: { code: true } },
            },
          },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // Batch-fetch the latest STAGE_CHANGED log for all onboardings in ONE query
  const onboardingIds = onboardings.map(ob => ob.id)

  const latestStageLogs = onboardingIds.length > 0
    ? await this.prisma.$queryRaw<Array<{ entityId: string; createdAt: Date }>>`
        SELECT DISTINCT ON ("entityId") "entityId", "createdAt"
        FROM "ActivityLog"
        WHERE "entityType" = 'ONBOARDING'
          AND "action" = 'STAGE_CHANGED'
          AND "entityId" = ANY(${onboardingIds})
        ORDER BY "entityId", "createdAt" DESC
      `
    : []

  const stageLogMap = new Map(
    latestStageLogs.map(log => [log.entityId, log.createdAt]),
  )

  return onboardings.map(ob => {
    const stageChangedAt = stageLogMap.get(ob.id) ?? ob.updatedAt
    const daysInStage = daysAgo(stageChangedAt)
    const firstActivePlan = ob.client.plans[0] ?? null

    return {
      id: ob.id,
      clientId: ob.clientId,
      currentStage: ob.currentStage,
      notes: ob.notes,
      createdAt: ob.createdAt,
      updatedAt: ob.updatedAt,
      daysInStage,
      productCode: firstActivePlan?.product?.code ?? null,
      client: {
        companyName: ob.client.companyName,
        responsible: ob.client.responsible,
        phone: ob.client.phone,
      },
    }
  })
}
```

- [ ] **Step 2: Verify the API starts and onboarding endpoint responds**

```bash
cd apps/api && npm run dev
# In another terminal:
curl http://localhost:3001/api/onboarding -H "Authorization: Bearer <token>"
```

Expected: Array of onboarding objects with `daysInStage` populated.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/onboarding/onboarding.service.ts
git commit -m "perf: fix N+1 query in OnboardingService.findAll"
```

---

## Task 3: Fix N+1 Query in PlansService.findByClient()

**Files:**
- Modify: `apps/api/src/modules/plans/plans.service.ts`

Currently fetches payments per-plan in a loop. Fix: use Prisma `include` with `groupBy` or include payments in the initial query.

- [ ] **Step 1: Replace N+1 with single query using include**

Replace the `findByClient()` method in `apps/api/src/modules/plans/plans.service.ts` (lines 13-43):

```typescript
async findByClient(clientId: string) {
  const plans = await this.prisma.clientPlan.findMany({
    where: { clientId },
    include: {
      product: { select: { id: true, code: true, name: true, description: true } },
      payments: { select: { status: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return plans.map(plan => {
    const payments = plan.payments
    const paid = payments.filter(p => p.status === 'PAID').length
    const overdue = payments.filter(p => p.status === 'OVERDUE').length
    const pending = payments.filter(p => p.status === 'PENDING' || p.status === 'SCHEDULED').length

    const { payments: _payments, ...planData } = plan

    return {
      ...planData,
      value: plan.value.toNumber(),
      installmentValue: plan.installmentValue ? plan.installmentValue.toNumber() : null,
      _count: { payments: payments.length },
      paymentStats: payments.length > 0 ? { total: payments.length, paid, overdue, pending } : null,
    }
  })
}
```

- [ ] **Step 2: Verify the plans endpoint responds correctly**

```bash
curl http://localhost:3001/api/plans/<clientId> -H "Authorization: Bearer <token>"
```

Expected: Plans with `paymentStats` populated, same shape as before.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/plans/plans.service.ts
git commit -m "perf: fix N+1 query in PlansService.findByClient"
```

---

## Task 4: Optimize Dashboard Aggregations

**Files:**
- Modify: `apps/api/src/modules/dashboard/dashboard.service.ts`

Currently loads all active plans and all payments into memory and sums in JS. Fix: use Prisma `aggregate` and `groupBy`.

- [ ] **Step 1: Replace revenue calculation with database aggregation**

In `apps/api/src/modules/dashboard/dashboard.service.ts`, replace lines 22-34 (the `activePlans` fetch and manual sum) with:

```typescript
// 3. Total revenue (aggregate in DB)
const revenueAgg = await this.prisma.clientPlan.aggregate({
  where: { status: 'ACTIVE' },
  _sum: { value: true },
})
const totalRevenue = Number(revenueAgg._sum.value ?? 0)

// 4. Revenue by product (groupBy in DB)
const revenueByProductRaw = await this.prisma.clientPlan.groupBy({
  by: ['productId'],
  where: { status: 'ACTIVE' },
  _sum: { value: true },
})

const products = await this.prisma.product.findMany({
  where: { id: { in: revenueByProductRaw.map(r => r.productId) } },
  select: { id: true, code: true },
})
const productCodeMap = new Map(products.map(p => [p.id, p.code]))

const revenueByProduct: Record<string, number> = { GE: 0, GI: 0, GS: 0 }
for (const row of revenueByProductRaw) {
  const code = productCodeMap.get(row.productId) ?? 'UNKNOWN'
  revenueByProduct[code] = Number(row._sum.value ?? 0)
}
```

- [ ] **Step 2: Replace payment sums with database aggregation**

Replace lines 77-95 (the `paidPayments`, `pendingPayments`, `overduePayments` fetches and manual sums) with:

```typescript
// 9. Financial KPIs (aggregate in DB)
const [paidAgg, pendingAgg, overdueAgg] = await this.prisma.$transaction([
  this.prisma.payment.aggregate({
    where: { status: 'PAID', paidAt: { gte: startOfMonth, lt: endOfMonth } },
    _sum: { value: true },
  }),
  this.prisma.payment.aggregate({
    where: { status: 'PENDING' },
    _sum: { value: true },
    _count: true,
  }),
  this.prisma.payment.aggregate({
    where: { status: 'OVERDUE' },
    _sum: { value: true },
    _count: true,
  }),
])

const totalReceived = Number(paidAgg._sum.value ?? 0)
const totalPending = Number(pendingAgg._sum.value ?? 0)
const totalOverdue = Number(overdueAgg._sum.value ?? 0)
const overdueCount = overdueAgg._count ?? 0
```

- [ ] **Step 3: Update MRR and averageTicket references**

The `mrr` and `averageTicket` lines stay the same since `totalRevenue` is still defined:

```typescript
const mrr = totalRevenue
const averageTicket = totalActiveClients > 0 ? totalRevenue / totalActiveClients : 0
```

- [ ] **Step 4: Verify dashboard endpoint returns correct data**

```bash
curl http://localhost:3001/api/dashboard -H "Authorization: Bearer <token>"
```

Expected: Same JSON shape with `kpis`, `financialKpis`, etc. Values should match.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/dashboard/dashboard.service.ts
git commit -m "perf: use DB aggregation in dashboard instead of JS reduce"
```

---

## Task 5: Optimize PendenciesService.generateAutomatic()

**Files:**
- Modify: `apps/api/src/modules/pendencies/pendencies.service.ts`

Currently runs N individual `findFirst` checks. Fix: batch-fetch all existing pendencies upfront, then check in-memory.

- [ ] **Step 1: Replace the loop-based exists() pattern with batch approach**

Replace the entire `generateAutomatic()` method in `apps/api/src/modules/pendencies/pendencies.service.ts` (lines 90-205):

```typescript
async generateAutomatic(): Promise<number> {
  let newCount = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dueSoonThreshold = new Date(today)
  dueSoonThreshold.setDate(dueSoonThreshold.getDate() + 5)

  const renewalThreshold = new Date(today)
  renewalThreshold.setDate(renewalThreshold.getDate() + 90)

  // Fetch ALL open/in-progress pendencies upfront (single query)
  const existingPendencies = await this.prisma.pendency.findMany({
    where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
    select: { type: true, clientId: true, relatedId: true },
  })

  // Build a Set for O(1) lookups
  const existsSet = new Set(
    existingPendencies.map(p => `${p.type}|${p.clientId}|${p.relatedId ?? ''}`),
  )

  const exists = (type: string, clientId: string, relatedId?: string) =>
    existsSet.has(`${type}|${clientId}|${relatedId ?? ''}`)

  // 1. CONTRACT_UNSIGNED
  const unsignedContracts = await this.prisma.contract.findMany({
    where: { isSigned: false, status: { not: 'CANCELLED' } },
    select: { id: true, clientId: true },
  })

  // 2. PAYMENT_OVERDUE
  const overduePayments = await this.prisma.payment.findMany({
    where: { status: 'OVERDUE' },
    select: { id: true, clientId: true },
  })

  // 3. PAYMENT_DUE_SOON
  const dueSoonPayments = await this.prisma.payment.findMany({
    where: {
      status: 'PENDING',
      dueDate: { gte: today, lte: dueSoonThreshold },
    },
    select: { id: true, clientId: true },
  })

  // 4. RENEWAL_PENDING
  const renewalPlans = await this.prisma.clientPlan.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { gte: today, lte: renewalThreshold },
    },
    select: { id: true, clientId: true },
  })

  // Collect all new pendencies to create in a single transaction
  const toCreate: Array<{
    clientId: string
    type: string
    status: string
    description: string
    relatedId: string | null
  }> = []

  for (const contract of unsignedContracts) {
    if (!exists('CONTRACT_UNSIGNED', contract.clientId, contract.id)) {
      toCreate.push({
        clientId: contract.clientId,
        type: 'CONTRACT_UNSIGNED',
        status: 'OPEN',
        description: 'Contrato não assinado',
        relatedId: contract.id,
      })
    }
  }

  for (const payment of overduePayments) {
    if (!exists('PAYMENT_OVERDUE', payment.clientId, payment.id)) {
      toCreate.push({
        clientId: payment.clientId,
        type: 'PAYMENT_OVERDUE',
        status: 'OPEN',
        description: 'Boleto vencido sem pagamento',
        relatedId: payment.id,
      })
    }
  }

  for (const payment of dueSoonPayments) {
    if (!exists('PAYMENT_DUE_SOON', payment.clientId, payment.id)) {
      toCreate.push({
        clientId: payment.clientId,
        type: 'PAYMENT_DUE_SOON',
        status: 'OPEN',
        description: 'Boleto vence em breve',
        relatedId: payment.id,
      })
    }
  }

  for (const plan of renewalPlans) {
    if (!exists('RENEWAL_PENDING', plan.clientId, plan.id)) {
      toCreate.push({
        clientId: plan.clientId,
        type: 'RENEWAL_PENDING',
        status: 'OPEN',
        description: 'Contrato próximo do vencimento — renovação necessária',
        relatedId: plan.id,
      })
    }
  }

  // Batch create all pendencies in a single transaction
  if (toCreate.length > 0) {
    await this.prisma.$transaction(
      toCreate.map(data => this.prisma.pendency.create({ data })),
    )
    newCount = toCreate.length
  }

  return newCount
}
```

- [ ] **Step 2: Verify pendency generation works**

```bash
curl -X POST http://localhost:3001/api/pendencies/generate -H "Authorization: Bearer <token>"
```

Expected: `{ "newCount": <number> }` — same behavior, much fewer DB queries.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/pendencies/pendencies.service.ts
git commit -m "perf: batch pendency generation — single query for existence check"
```

---

## Task 6: Add PrismaService Lifecycle + Global Error Filter

**Files:**
- Modify: `apps/api/src/prisma/prisma.service.ts`
- Create: `apps/api/src/filters/http-exception.filter.ts`
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: Add onModuleDestroy to PrismaService**

Replace the full content of `apps/api/src/prisma/prisma.service.ts`:

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
```

- [ ] **Step 2: Create global HTTP exception filter**

Create `apps/api/src/filters/http-exception.filter.ts`:

```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { Request, Response } from 'express'

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error'

    const body = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(typeof message === 'string' ? { message } : (message as object)),
    }

    if (status >= 500) {
      console.error(`[ERROR] ${request.method} ${request.url}`, exception)
    }

    response.status(status).json(body)
  }
}
```

- [ ] **Step 3: Register the filter and enable graceful shutdown in main.ts**

Replace `apps/api/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'
import { GlobalExceptionFilter } from './filters/http-exception.filter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableShutdownHooks()

  app.enableCors({
    origin: [
      process.env.FRONTEND_URL ?? 'http://localhost:3000',
      'http://localhost:3000',
      'https://goon-os-web.vercel.app',
    ].filter(Boolean),
    credentials: true,
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.useGlobalFilters(new GlobalExceptionFilter())

  await app.listen(process.env.PORT ?? 3001)
  console.log(`API running on http://localhost:${process.env.PORT ?? 3001}`)
}
bootstrap()
```

- [ ] **Step 4: Verify API starts correctly**

```bash
cd apps/api && npm run dev
```

Expected: "API running on http://localhost:3001" — no errors.

- [ ] **Step 5: Test error filter catches unhandled errors**

```bash
curl http://localhost:3001/api/nonexistent-route
```

Expected: JSON response with `{ "statusCode": 404, "timestamp": "...", "path": "..." }` instead of raw NestJS error.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/prisma/prisma.service.ts apps/api/src/filters/http-exception.filter.ts apps/api/src/main.ts
git commit -m "fix: add PrismaService lifecycle + global error filter"
```

---

## Task 7: Optimize Next.js Config

**Files:**
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: Add performance optimizations to next.config.ts**

Replace `apps/web/next.config.ts`:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@dnd-kit/core', '@dnd-kit/sortable'],
  },
}

export default nextConfig
```

- [ ] **Step 2: Verify frontend builds correctly**

```bash
cd apps/web && npm run build
```

Expected: Build completes without errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/next.config.ts
git commit -m "perf: optimize Next.js config — image formats, package imports"
```

---

## Task 8: Add Pagination to Unpaginated Endpoints

**Files:**
- Modify: `apps/api/src/modules/pendencies/pendencies.service.ts`

The `findAll()` returns ALL pendencies with no limit. Add pagination.

- [ ] **Step 1: Add pagination to PendenciesService.findAll()**

Replace the `findAll()` method in `apps/api/src/modules/pendencies/pendencies.service.ts` (lines 12-29):

```typescript
async findAll(params: {
  status?: string
  type?: string
  clientId?: string
  page?: number
  limit?: number
}) {
  const { status, type, clientId, page = 1, limit = 50 } = params

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (type) where.type = type
  if (clientId) where.clientId = clientId

  const skip = (page - 1) * limit

  const [data, total] = await this.prisma.$transaction([
    this.prisma.pendency.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        client: { select: { id: true, companyName: true } },
      },
    }),
    this.prisma.pendency.count({ where }),
  ])

  return { data, total, page, limit }
}
```

- [ ] **Step 2: Update the pendencies controller to pass pagination params**

Check the pendencies controller and ensure it passes `page` and `limit` from query params. In the controller's `findAll` handler, update to:

```typescript
@Get()
findAll(
  @Query('status') status?: string,
  @Query('type') type?: string,
  @Query('clientId') clientId?: string,
  @Query('page') page?: string,
  @Query('limit') limit?: string,
) {
  return this.pendenciesService.findAll({
    status,
    type,
    clientId,
    page: page ? parseInt(page) : undefined,
    limit: limit ? parseInt(limit) : undefined,
  })
}
```

- [ ] **Step 3: Verify pagination works**

```bash
curl "http://localhost:3001/api/pendencies?page=1&limit=10" -H "Authorization: Bearer <token>"
```

Expected: `{ "data": [...], "total": N, "page": 1, "limit": 10 }`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/pendencies/
git commit -m "perf: add pagination to pendencies endpoint"
```

---

## Summary

| Task | Type | Impact |
|------|------|--------|
| 1. Database indexes | Performance | All queries faster |
| 2. Onboarding N+1 fix | Bug/Perf | N+1 → 2 queries |
| 3. Plans N+1 fix | Bug/Perf | N+1 → 1 query |
| 4. Dashboard aggregation | Performance | Memory + speed |
| 5. Pendencies batch | Performance | 300+ → ~5 queries |
| 6. Prisma lifecycle + error filter | Stability | Connection leaks + unhandled errors |
| 7. Next.js config | Performance | Smaller bundles, better images |
| 8. Pendencies pagination | Bug | Prevents unbounded data fetch |
