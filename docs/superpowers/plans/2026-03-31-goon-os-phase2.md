# GOON OS Phase 2 — Gatilho, Comissões, Despesas, Dashboard Financeiro, Perfis

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the GOON OS spec by adding: (1) auto-generation of payments + commissions on deal close, (2) commission module, (3) expenses module, (4) consolidated financial dashboard, (5) user roles/profiles with route protection, (6) cancellation cascade logic.

**Architecture:** Extend Prisma schema with Commission and Expense models. Enhance the existing closeDeal flow to auto-create payments and commissions. Build new NestJS modules for commissions and expenses. Add role field to User and protect routes/menu by profile. Enhance dashboard with financial consolidation.

**Tech Stack:** NestJS 11, Prisma 6.19, Next.js 16, React 19, Neon PostgreSQL

---

## File Structure

### Backend — New Files
| File | Responsibility |
|------|---------------|
| `modules/commissions/commissions.module.ts` | Commission module declaration |
| `modules/commissions/commissions.controller.ts` | Commission CRUD + close endpoints |
| `modules/commissions/commissions.service.ts` | Commission business logic |
| `modules/expenses/expenses.module.ts` | Expense module declaration |
| `modules/expenses/expenses.controller.ts` | Expense CRUD endpoints |
| `modules/expenses/expenses.service.ts` | Expense business logic |
| `auth/roles.guard.ts` | Role-based access guard |
| `auth/roles.decorator.ts` | @Roles() decorator |

### Backend — Modified Files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add Commission, Expense models + User.role field |
| `modules/crm/crm.service.ts` | closeDeal creates payments + commissions |
| `modules/dashboard/dashboard.service.ts` | Add expenses, commissions, net balance KPIs |
| `auth/auth.service.ts` | Return role in login/profile |
| `auth/jwt.strategy.ts` | Include role in JWT payload |
| `app.module.ts` | Import CommissionsModule, ExpensesModule |

### Frontend — New Files
| File | Responsibility |
|------|---------------|
| `app/(dashboard)/commissions/page.tsx` | Commissions listing by vendor |
| `app/(dashboard)/expenses/page.tsx` | Expenses CRUD page |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `components/Sidebar.tsx` | Add Comissões, Despesas nav items + role-based visibility |
| `app/(dashboard)/dashboard/page.tsx` | Add financial consolidation section |
| `app/(dashboard)/payments/page.tsx` | Minor: link to commissions |
| `hooks/useAuth.ts` | Expose user.role |
| `lib/constants.ts` | Add commission/expense constants |

---

## Task 1: Add Commission and Expense Models to Prisma Schema

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add role field to User model**

In `apps/api/prisma/schema.prisma`, add `role` field to User model after `password`:

```prisma
model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  password  String
  role      String   @default("gestao") // comercial, analitico, gestao
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Add Commission model**

Add after the Payment model:

```prisma
model Commission {
  id            String    @id @default(cuid())
  clientId      String
  paymentId     String
  salesRep      String    // vendedor name
  percentage    Decimal   @db.Decimal(5, 2) // ex: 10.00 = 10%
  baseValue     Decimal   @db.Decimal(10, 2) // valor da parcela
  value         Decimal   @db.Decimal(10, 2) // valor da comissão calculado
  installment   Int       // parcela number
  totalInstallments Int   // total parcelas
  status        String    @default("PENDING") // PENDING, PAID, CANCELLED
  paidAt        DateTime?
  cancelledAt   DateTime?

  client        Client    @relation(fields: [clientId], references: [id])
  payment       Payment   @relation(fields: [paymentId], references: [id])

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([clientId])
  @@index([paymentId])
  @@index([salesRep])
  @@index([status])
  @@index([salesRep, status])
}
```

- [ ] **Step 3: Add Expense model**

Add after the Commission model:

```prisma
model Expense {
  id          String    @id @default(cuid())
  description String
  category    String    // SISTEMAS, MARKETING, PESSOAS, ESTRUTURA, OUTRO
  value       Decimal   @db.Decimal(10, 2)
  recurrence  String    @default("UNICA") // UNICA, MENSAL, TRIMESTRAL, ANUAL
  dueDate     DateTime
  status      String    @default("PREVISTO") // PREVISTO, PAGO
  paidAt      DateTime?
  notes       String?

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([category])
  @@index([status])
  @@index([dueDate])
  @@index([recurrence])
}
```

- [ ] **Step 4: Add relations to Client and Payment**

Add `commissions Commission[]` relation to the Client model (after `pendencies`):

```prisma
  commissions  Commission[]
```

Add `commissions Commission[]` relation to the Payment model (after `contract`):

```prisma
  commissions  Commission[]
```

- [ ] **Step 5: Push schema to database**

```bash
cd C:/Users/joao.vitor/Desktop/GOON-OS/apps/api && npx prisma db push
```

Expected: Schema synced, no errors.

- [ ] **Step 6: Generate Prisma client**

```bash
cd C:/Users/joao.vitor/Desktop/GOON-OS/apps/api && npx prisma generate
```

- [ ] **Step 7: Commit**

```bash
cd C:/Users/joao.vitor/Desktop/GOON-OS && git add apps/api/prisma/schema.prisma && git commit -m "feat(schema): add Commission, Expense models and User.role field"
```

---

## Task 2: Commissions Module — Backend

**Files:**
- Create: `apps/api/src/modules/commissions/commissions.module.ts`
- Create: `apps/api/src/modules/commissions/commissions.controller.ts`
- Create: `apps/api/src/modules/commissions/commissions.service.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create commissions.service.ts**

```typescript
// apps/api/src/modules/commissions/commissions.service.ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ActivityLogService } from '../activity-log/activity-log.service'

@Injectable()
export class CommissionsService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
  ) {}

  async findAll(params: {
    salesRep?: string
    status?: string
    month?: number // 1-12
    year?: number
    page?: number
    limit?: number
  }) {
    const { salesRep, status, month, year, page = 1, limit = 20 } = params
    const where: Record<string, unknown> = {}

    if (salesRep) where.salesRep = salesRep
    if (status) where.status = status

    if (month && year) {
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 1)
      where.createdAt = { gte: start, lt: end }
    } else if (year) {
      const start = new Date(year, 0, 1)
      const end = new Date(year + 1, 0, 1)
      where.createdAt = { gte: start, lt: end }
    }

    const skip = (page - 1) * limit

    const [data, total] = await this.prisma.$transaction([
      this.prisma.commission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          client: { select: { id: true, companyName: true } },
          payment: { select: { id: true, dueDate: true, status: true } },
        },
      }),
      this.prisma.commission.count({ where }),
    ])

    return {
      data: data.map(c => ({
        ...c,
        percentage: Number(c.percentage),
        baseValue: Number(c.baseValue),
        value: Number(c.value),
      })),
      total,
      page,
      limit,
    }
  }

  async getSummary(params: { month?: number; year?: number }) {
    const { month, year } = params
    const where: Record<string, unknown> = {}

    if (month && year) {
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 1)
      where.createdAt = { gte: start, lt: end }
    }

    const [totalToPay, totalPaid] = await this.prisma.$transaction([
      this.prisma.commission.aggregate({
        where: { ...where, status: 'PENDING' },
        _sum: { value: true },
        _count: true,
      }),
      this.prisma.commission.aggregate({
        where: { ...where, status: 'PAID' },
        _sum: { value: true },
        _count: true,
      }),
    ])

    // Breakdown by salesRep
    const bySalesRep = await this.prisma.commission.groupBy({
      by: ['salesRep', 'status'],
      where,
      _sum: { value: true },
      _count: true,
    })

    const reps: Record<string, { pending: number; paid: number; cancelled: number }> = {}
    for (const row of bySalesRep) {
      if (!reps[row.salesRep]) reps[row.salesRep] = { pending: 0, paid: 0, cancelled: 0 }
      const key = row.status.toLowerCase() as 'pending' | 'paid' | 'cancelled'
      reps[row.salesRep][key] = Number(row._sum.value ?? 0)
    }

    return {
      totalToPay: Number(totalToPay._sum.value ?? 0),
      totalToPayCount: totalToPay._count,
      totalPaid: Number(totalPaid._sum.value ?? 0),
      totalPaidCount: totalPaid._count,
      bySalesRep: reps,
    }
  }

  async markAsPaid(id: string) {
    const existing = await this.prisma.commission.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Commission ${id} not found`)

    const commission = await this.prisma.commission.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
    })

    await this.activityLog.log({
      clientId: commission.clientId,
      entityType: 'COMMISSION',
      entityId: commission.id,
      action: 'PAID',
      fromValue: 'PENDING',
      toValue: 'PAID',
      description: `Comissão parcela ${commission.installment}/${commission.totalInstallments} paga para ${commission.salesRep}`,
    })

    return { ...commission, percentage: Number(commission.percentage), baseValue: Number(commission.baseValue), value: Number(commission.value) }
  }

  async cancelByClient(clientId: string) {
    const result = await this.prisma.commission.updateMany({
      where: { clientId, status: 'PENDING' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    })

    if (result.count > 0) {
      await this.activityLog.log({
        clientId,
        entityType: 'COMMISSION',
        entityId: clientId,
        action: 'BULK_CANCELLED',
        description: `${result.count} comissões pendentes canceladas por cancelamento do cliente`,
      })
    }

    return { cancelled: result.count }
  }

  async createForPayments(
    clientId: string,
    salesRep: string,
    percentage: number,
    payments: Array<{ id: string; installment: number; totalInstallments: number; value: number }>,
  ) {
    const commissions = payments.map(p => ({
      clientId,
      paymentId: p.id,
      salesRep,
      percentage,
      baseValue: p.value,
      value: Math.round(p.value * percentage) / 100, // percentage / 100 * value
      installment: p.installment,
      totalInstallments: p.totalInstallments,
      status: 'PENDING',
    }))

    const created = await this.prisma.$transaction(
      commissions.map(c => this.prisma.commission.create({ data: c })),
    )

    await this.activityLog.log({
      clientId,
      entityType: 'COMMISSION',
      entityId: clientId,
      action: 'BULK_CREATED',
      description: `${created.length} comissões criadas para ${salesRep} (${percentage}%)`,
    })

    return created.map(c => ({
      ...c,
      percentage: Number(c.percentage),
      baseValue: Number(c.baseValue),
      value: Number(c.value),
    }))
  }
}
```

- [ ] **Step 2: Create commissions.controller.ts**

```typescript
// apps/api/src/modules/commissions/commissions.controller.ts
import { Controller, Get, Patch, Param, Query } from '@nestjs/common'
import { CommissionsService } from './commissions.service'

@Controller('api/commissions')
export class CommissionsController {
  constructor(private service: CommissionsService) {}

  @Get()
  findAll(
    @Query('salesRep') salesRep?: string,
    @Query('status') status?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      salesRep,
      status,
      month: month ? parseInt(month) : undefined,
      year: year ? parseInt(year) : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    })
  }

  @Get('summary')
  getSummary(
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.service.getSummary({
      month: month ? parseInt(month) : undefined,
      year: year ? parseInt(year) : undefined,
    })
  }

  @Patch(':id/pay')
  markAsPaid(@Param('id') id: string) {
    return this.service.markAsPaid(id)
  }
}
```

- [ ] **Step 3: Create commissions.module.ts**

```typescript
// apps/api/src/modules/commissions/commissions.module.ts
import { Module } from '@nestjs/common'
import { CommissionsController } from './commissions.controller'
import { CommissionsService } from './commissions.service'
import { ActivityLogModule } from '../activity-log/activity-log.module'

@Module({
  imports: [ActivityLogModule],
  controllers: [CommissionsController],
  providers: [CommissionsService],
  exports: [CommissionsService],
})
export class CommissionsModule {}
```

- [ ] **Step 4: Register in app.module.ts**

Add to `apps/api/src/app.module.ts`:

```typescript
import { CommissionsModule } from './modules/commissions/commissions.module'
```

Add `CommissionsModule` to the imports array.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/joao.vitor/Desktop/GOON-OS && git add apps/api/src/modules/commissions/ apps/api/src/app.module.ts && git commit -m "feat(commissions): add commissions module with CRUD, summary, and bulk creation"
```

---

## Task 3: Expenses Module — Backend

**Files:**
- Create: `apps/api/src/modules/expenses/expenses.module.ts`
- Create: `apps/api/src/modules/expenses/expenses.controller.ts`
- Create: `apps/api/src/modules/expenses/expenses.service.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create expenses.service.ts**

```typescript
// apps/api/src/modules/expenses/expenses.service.ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    category?: string
    status?: string
    recurrence?: string
    month?: number
    year?: number
    page?: number
    limit?: number
  }) {
    const { category, status, recurrence, month, year, page = 1, limit = 20 } = params
    const where: Record<string, unknown> = {}

    if (category) where.category = category
    if (status) where.status = status
    if (recurrence) where.recurrence = recurrence

    if (month && year) {
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 1)
      where.dueDate = { gte: start, lt: end }
    } else if (year) {
      const start = new Date(year, 0, 1)
      const end = new Date(year + 1, 0, 1)
      where.dueDate = { gte: start, lt: end }
    }

    const skip = (page - 1) * limit

    const [data, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.expense.count({ where }),
    ])

    return {
      data: data.map(e => ({ ...e, value: Number(e.value) })),
      total,
      page,
      limit,
    }
  }

  async getSummary(params: { month?: number; year?: number }) {
    const { month, year } = params
    const where: Record<string, unknown> = {}

    if (month && year) {
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 1)
      where.dueDate = { gte: start, lt: end }
    }

    const [previstoAgg, pagoAgg] = await this.prisma.$transaction([
      this.prisma.expense.aggregate({
        where: { ...where, status: 'PREVISTO' },
        _sum: { value: true },
        _count: true,
      }),
      this.prisma.expense.aggregate({
        where: { ...where, status: 'PAGO' },
        _sum: { value: true },
        _count: true,
      }),
    ])

    const byCategory = await this.prisma.expense.groupBy({
      by: ['category'],
      where,
      _sum: { value: true },
    })

    return {
      totalPrevisto: Number(previstoAgg._sum.value ?? 0),
      totalPago: Number(pagoAgg._sum.value ?? 0),
      byCategory: byCategory.map(c => ({ category: c.category, total: Number(c._sum.value ?? 0) })),
    }
  }

  async create(dto: {
    description: string
    category: string
    value: number
    recurrence: string
    dueDate: Date | string
    status?: string
    notes?: string
  }) {
    return this.prisma.expense.create({
      data: {
        description: dto.description,
        category: dto.category,
        value: dto.value,
        recurrence: dto.recurrence,
        dueDate: new Date(dto.dueDate),
        status: dto.status ?? 'PREVISTO',
        notes: dto.notes,
      },
    }).then(e => ({ ...e, value: Number(e.value) }))
  }

  async update(id: string, dto: {
    description?: string
    category?: string
    value?: number
    recurrence?: string
    dueDate?: Date | string
    status?: string
    paidAt?: Date | string
    notes?: string
  }) {
    const existing = await this.prisma.expense.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Expense ${id} not found`)

    return this.prisma.expense.update({
      where: { id },
      data: {
        description: dto.description,
        category: dto.category,
        value: dto.value,
        recurrence: dto.recurrence,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: dto.status,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
        notes: dto.notes,
      },
    }).then(e => ({ ...e, value: Number(e.value) }))
  }

  async markAsPaid(id: string) {
    const existing = await this.prisma.expense.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Expense ${id} not found`)

    return this.prisma.expense.update({
      where: { id },
      data: { status: 'PAGO', paidAt: new Date() },
    }).then(e => ({ ...e, value: Number(e.value) }))
  }

  async delete(id: string) {
    const existing = await this.prisma.expense.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Expense ${id} not found`)

    return this.prisma.expense.delete({ where: { id } })
  }
}
```

- [ ] **Step 2: Create expenses.controller.ts**

```typescript
// apps/api/src/modules/expenses/expenses.controller.ts
import { Controller, Get, Post, Put, Patch, Delete, Param, Query, Body, HttpCode } from '@nestjs/common'
import { ExpensesService } from './expenses.service'

@Controller('api/expenses')
export class ExpensesController {
  constructor(private service: ExpensesService) {}

  @Get()
  findAll(
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('recurrence') recurrence?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      category,
      status,
      recurrence,
      month: month ? parseInt(month) : undefined,
      year: year ? parseInt(year) : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    })
  }

  @Get('summary')
  getSummary(
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.service.getSummary({
      month: month ? parseInt(month) : undefined,
      year: year ? parseInt(year) : undefined,
    })
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: {
    description: string
    category: string
    value: number
    recurrence: string
    dueDate: string
    status?: string
    notes?: string
  }) {
    return this.service.create(dto)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: {
    description?: string
    category?: string
    value?: number
    recurrence?: string
    dueDate?: string
    status?: string
    paidAt?: string
    notes?: string
  }) {
    return this.service.update(id, dto)
  }

  @Patch(':id/pay')
  markAsPaid(@Param('id') id: string) {
    return this.service.markAsPaid(id)
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id)
  }
}
```

- [ ] **Step 3: Create expenses.module.ts**

```typescript
// apps/api/src/modules/expenses/expenses.module.ts
import { Module } from '@nestjs/common'
import { ExpensesController } from './expenses.controller'
import { ExpensesService } from './expenses.service'

@Module({
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
```

- [ ] **Step 4: Register in app.module.ts**

Add to `apps/api/src/app.module.ts`:

```typescript
import { ExpensesModule } from './modules/expenses/expenses.module'
```

Add `ExpensesModule` to imports array.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/joao.vitor/Desktop/GOON-OS && git add apps/api/src/modules/expenses/ apps/api/src/app.module.ts && git commit -m "feat(expenses): add expenses module with CRUD, summary, and categories"
```

---

## Task 4: Enhance closeDeal — Auto-create Payments + Commissions

**Files:**
- Modify: `apps/api/src/modules/crm/crm.service.ts`
- Modify: `apps/api/src/modules/crm/crm.module.ts`

- [ ] **Step 1: Import dependencies in crm.module.ts**

Update `apps/api/src/modules/crm/crm.module.ts` to import PaymentsModule and CommissionsModule:

```typescript
import { Module } from '@nestjs/common'
import { CrmController } from './crm.controller'
import { CrmService } from './crm.service'
import { ActivityLogModule } from '../activity-log/activity-log.module'
import { PaymentsModule } from '../payments/payments.module'
import { CommissionsModule } from '../commissions/commissions.module'

@Module({
  imports: [ActivityLogModule, PaymentsModule, CommissionsModule],
  controllers: [CrmController],
  providers: [CrmService],
})
export class CrmModule {}
```

- [ ] **Step 2: Ensure PaymentsModule exports PaymentsService**

Check `apps/api/src/modules/payments/payments.module.ts` and add `exports: [PaymentsService]` if not present.

- [ ] **Step 3: Inject PaymentsService and CommissionsService into CrmService**

Update `apps/api/src/modules/crm/crm.service.ts` constructor:

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ActivityLogService } from '../activity-log/activity-log.service'
import { PaymentsService } from '../payments/payments.service'
import { CommissionsService } from '../commissions/commissions.service'

// ... existing constants ...

@Injectable()
export class CrmService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
    private paymentsService: PaymentsService,
    private commissionsService: CommissionsService,
  ) {}
```

- [ ] **Step 4: Enhance closeDeal to auto-create payments and commissions**

Replace the closeDeal method in `apps/api/src/modules/crm/crm.service.ts`. Add `commissionPercentage` to the DTO:

```typescript
  async closeDeal(
    id: string,
    dto: {
      saleValue: number
      paymentMethod: string
      saleInstallments: number
      installmentValue: number
      productId: string
      paymentDay?: number // day of month (1-31), defaults to today
      commissionPercentage?: number // ex: 10 = 10%, defaults to 10
    },
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      select: { id: true, companyName: true, leadStage: true, salesRep: true },
    })

    if (!client) {
      throw new NotFoundException(`Cliente com ID ${id} não encontrado`)
    }

    const now = new Date()
    const paymentDay = dto.paymentDay ?? now.getDate()

    // 1. Update client: PROSPECT → ACTIVE, leadStage → FECHADO
    const updated = await this.prisma.client.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        leadStage: 'FECHADO',
        saleValue: dto.saleValue,
        paymentMethod: dto.paymentMethod,
        saleInstallments: dto.saleInstallments,
        installmentValue: dto.installmentValue,
        closedAt: now,
      },
    })

    // 2. Create client plan
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } })
    if (!product) {
      throw new NotFoundException(`Produto com ID ${dto.productId} não encontrado`)
    }

    const plan = await this.prisma.clientPlan.create({
      data: {
        clientId: id,
        productId: dto.productId,
        value: dto.saleValue,
        paymentType: dto.paymentMethod,
        installments: dto.saleInstallments,
        installmentValue: dto.installmentValue,
        startDate: now,
        paymentDay,
      },
    })

    // 3. Create onboarding (if not exists)
    const existingOnboarding = await this.prisma.onboarding.findUnique({ where: { clientId: id } })
    if (!existingOnboarding) {
      await this.prisma.onboarding.create({
        data: { clientId: id, currentStage: 'CLIENT_CLOSED' },
      })
    }

    // 4. Auto-create payment installments (Fluxo de Caixa — Entradas)
    const payments = await this.paymentsService.createBulk(id, plan.id, {
      totalInstallments: dto.saleInstallments,
      value: dto.installmentValue,
      startDate: now,
      paymentDay,
    })

    // 5. Auto-create commissions (if salesRep exists)
    let commissions: unknown[] = []
    const salesRep = client.salesRep
    if (salesRep) {
      const percentage = dto.commissionPercentage ?? 10
      commissions = await this.commissionsService.createForPayments(
        id,
        salesRep,
        percentage,
        payments.map(p => ({
          id: p.id,
          installment: p.installment,
          totalInstallments: p.totalInstallments,
          value: typeof p.value === 'number' ? p.value : Number(p.value),
        })),
      )
    }

    // 6. Log activity
    await this.activityLog.log({
      clientId: id,
      entityType: 'CRM',
      entityId: id,
      action: 'DEAL_CLOSED',
      fromValue: client.leadStage ?? undefined,
      toValue: 'FECHADO',
      description: `Lead ${client.companyName} fechado — ${product.name} R$${dto.saleValue} | ${dto.saleInstallments}x R$${dto.installmentValue} | ${payments.length} parcelas + ${commissions.length} comissões criadas`,
    })

    return { client: updated, plan, paymentsCreated: payments.length, commissionsCreated: commissions.length }
  }
```

- [ ] **Step 5: Commit**

```bash
cd C:/Users/joao.vitor/Desktop/GOON-OS && git add apps/api/src/modules/crm/ apps/api/src/modules/payments/ && git commit -m "feat(crm): closeDeal auto-creates payments and commissions"
```

---

## Task 5: Cancellation Cascade Logic

**Files:**
- Modify: `apps/api/src/modules/clients/clients.service.ts`

- [ ] **Step 1: Read current clients.service.ts**

Read `apps/api/src/modules/clients/clients.service.ts` to understand the current update/delete methods.

- [ ] **Step 2: Add cancelClient method or enhance status change**

When a client's status is changed to INACTIVE or CANCELLED, cascade:

```typescript
  async cancelClient(id: string) {
    const client = await this.prisma.client.findUnique({ where: { id } })
    if (!client) throw new NotFoundException(`Client ${id} not found`)

    // 1. Cancel pending payments
    const cancelledPayments = await this.prisma.payment.updateMany({
      where: { clientId: id, status: { in: ['PENDING', 'SCHEDULED'] } },
      data: { status: 'CANCELLED' },
    })

    // 2. Cancel pending commissions
    const cancelledCommissions = await this.prisma.commission.updateMany({
      where: { clientId: id, status: 'PENDING' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    })

    // 3. Cancel active plans
    await this.prisma.clientPlan.updateMany({
      where: { clientId: id, status: 'ACTIVE' },
      data: { status: 'CANCELLED' },
    })

    // 4. Update client status
    const updated = await this.prisma.client.update({
      where: { id },
      data: { status: 'INACTIVE' },
    })

    await this.activityLog.log({
      clientId: id,
      entityType: 'CLIENT',
      entityId: id,
      action: 'CANCELLED',
      description: `Cliente cancelado — ${cancelledPayments.count} pagamentos e ${cancelledCommissions.count} comissões cancelados`,
    })

    return updated
  }
```

- [ ] **Step 3: Add endpoint to clients.controller.ts**

```typescript
  @Patch(':id/cancel')
  cancelClient(@Param('id') id: string) {
    return this.service.cancelClient(id)
  }
```

- [ ] **Step 4: Commit**

```bash
cd C:/Users/joao.vitor/Desktop/GOON-OS && git add apps/api/src/modules/clients/ && git commit -m "feat(clients): add cancellation cascade for payments and commissions"
```

---

## Task 6: User Roles + Route Protection — Backend

**Files:**
- Create: `apps/api/src/auth/roles.decorator.ts`
- Create: `apps/api/src/auth/roles.guard.ts`
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/jwt.strategy.ts`

- [ ] **Step 1: Create roles.decorator.ts**

```typescript
// apps/api/src/auth/roles.decorator.ts
import { SetMetadata } from '@nestjs/common'

export const ROLES_KEY = 'roles'
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)
```

- [ ] **Step 2: Create roles.guard.ts**

```typescript
// apps/api/src/auth/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from './roles.decorator'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiredRoles) return true // no @Roles() = public to authenticated users

    const { user } = context.switchToHttp().getRequest()
    return requiredRoles.includes(user.role)
  }
}
```

- [ ] **Step 3: Update jwt.strategy.ts to include role**

In `apps/api/src/auth/jwt.strategy.ts`, update the validate method to return role:

```typescript
  async validate(payload: { sub: string; email: string; role: string }) {
    return { id: payload.sub, email: payload.email, role: payload.role }
  }
```

- [ ] **Step 4: Update auth.service.ts to include role in JWT and response**

```typescript
  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user) throw new UnauthorizedException('Credenciais inválidas')

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) throw new UnauthorizedException('Credenciais inválidas')

    const payload = { sub: user.id, email: user.email, role: user.role }
    return {
      access_token: this.jwt.sign(payload),
      refresh_token: this.jwt.sign(payload, { expiresIn: '30d' }),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new UnauthorizedException()
    return { id: user.id, name: user.name, email: user.email, role: user.role }
  }
```

- [ ] **Step 5: Apply @Roles() to sensitive controllers**

Example — protect commissions pay action (gestao only):

```typescript
// In commissions.controller.ts
import { UseGuards } from '@nestjs/common'
import { RolesGuard } from '../../auth/roles.guard'
import { Roles } from '../../auth/roles.decorator'

@Controller('api/commissions')
@UseGuards(RolesGuard)
export class CommissionsController {
  // ...

  @Patch(':id/pay')
  @Roles('gestao')
  markAsPaid(@Param('id') id: string) {
    return this.service.markAsPaid(id)
  }
}
```

Apply similar protection:
- Expenses: full CRUD = `gestao` only
- Dashboard financial KPIs: `gestao` and `analitico`
- CRM: `comercial`, `analitico`, `gestao`
- Onboarding: `analitico`, `gestao`

- [ ] **Step 6: Register RolesGuard globally or per-controller**

Since not all routes need roles, keep it per-controller with `@UseGuards(RolesGuard)`.

- [ ] **Step 7: Update existing users in DB with role**

```bash
cd C:/Users/joao.vitor/Desktop/GOON-OS/apps/api && npx prisma db execute --stdin <<< "UPDATE \"User\" SET role = 'gestao' WHERE role IS NULL OR role = '';"
```

Or via Prisma Studio: `npx prisma studio`

- [ ] **Step 8: Commit**

```bash
cd C:/Users/joao.vitor/Desktop/GOON-OS && git add apps/api/src/auth/ && git commit -m "feat(auth): add role-based access control with @Roles decorator and RolesGuard"
```

---

## Task 7: Enhanced Dashboard — Financial Consolidation

**Files:**
- Modify: `apps/api/src/modules/dashboard/dashboard.service.ts`
- Modify: `apps/api/src/modules/dashboard/dashboard.module.ts`

- [ ] **Step 1: Import ExpensesService and CommissionsService**

Update dashboard.module.ts to import ExpensesModule and CommissionsModule.

- [ ] **Step 2: Inject services and add financial consolidation**

Add to the end of the `getStats()` method in dashboard.service.ts:

```typescript
    // 11. Expenses summary for current month
    const [expensesPrevistoAgg, expensesPagoAgg] = await this.prisma.$transaction([
      this.prisma.expense.aggregate({
        where: { status: 'PREVISTO', dueDate: { gte: startOfMonth, lt: endOfMonth } },
        _sum: { value: true },
      }),
      this.prisma.expense.aggregate({
        where: { status: 'PAGO', dueDate: { gte: startOfMonth, lt: endOfMonth } },
        _sum: { value: true },
      }),
    ])

    const totalExpensesPrevisto = Number(expensesPrevistoAgg._sum.value ?? 0)
    const totalExpensesPago = Number(expensesPagoAgg._sum.value ?? 0)

    // 12. Commissions summary for current month
    const [commissionsPendingAgg, commissionsPaidAgg] = await this.prisma.$transaction([
      this.prisma.commission.aggregate({
        where: { status: 'PENDING', createdAt: { gte: startOfMonth, lt: endOfMonth } },
        _sum: { value: true },
      }),
      this.prisma.commission.aggregate({
        where: { status: 'PAID', paidAt: { gte: startOfMonth, lt: endOfMonth } },
        _sum: { value: true },
      }),
    ])

    const totalCommissionsPending = Number(commissionsPendingAgg._sum.value ?? 0)
    const totalCommissionsPaid = Number(commissionsPaidAgg._sum.value ?? 0)

    // 13. Net balance = entradas recebidas - despesas pagas - comissões pagas
    const netBalance = totalReceived - totalExpensesPago - totalCommissionsPaid
    const projectedBalance = (totalReceived + totalPending) - (totalExpensesPrevisto + totalExpensesPago) - (totalCommissionsPending + totalCommissionsPaid)
```

Then add to the return object:

```typescript
      financialConsolidation: {
        entradas: { received: totalReceived, pending: totalPending, overdue: totalOverdue },
        expenses: { previsto: totalExpensesPrevisto, pago: totalExpensesPago },
        commissions: { pending: totalCommissionsPending, paid: totalCommissionsPaid },
        netBalance,
        projectedBalance,
      },
```

- [ ] **Step 3: Commit**

```bash
cd C:/Users/joao.vitor/Desktop/GOON-OS && git add apps/api/src/modules/dashboard/ && git commit -m "feat(dashboard): add financial consolidation with expenses and commissions"
```

---

## Task 8: Frontend — Commissions Page

**Files:**
- Create: `apps/web/src/app/(dashboard)/commissions/page.tsx`

- [ ] **Step 1: Create commissions page**

Build page with:
- KPI strip: Total a Pagar (PENDING), Total Pago, breakdown by vendedor
- Filter by: vendedor (dropdown), status (PENDING/PAID/CANCELLED), mês/ano
- Table: Cliente | Vendedor | Parcela | Valor Base | % | Valor Comissão | Status | Ações
- Action: "Marcar como Pago" button (PATCH /api/commissions/:id/pay)
- Follow existing retro brutalist style from payments page

```typescript
// apps/web/src/app/(dashboard)/commissions/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'

interface Commission {
  id: string
  clientId: string
  salesRep: string
  percentage: number
  baseValue: number
  value: number
  installment: number
  totalInstallments: number
  status: string
  paidAt: string | null
  client: { id: string; companyName: string }
  payment: { id: string; dueDate: string; status: string }
}

interface Summary {
  totalToPay: number
  totalToPayCount: number
  totalPaid: number
  totalPaidCount: number
  bySalesRep: Record<string, { pending: number; paid: number; cancelled: number }>
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#e6a800',
  PAID: '#006600',
  CANCELLED: '#cc0000',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  CANCELLED: 'Cancelado',
}

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [salesRepFilter, setSalesRepFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const loadData = useCallback(async () => {
    const params = new URLSearchParams()
    if (salesRepFilter) params.set('salesRep', salesRepFilter)
    if (statusFilter) params.set('status', statusFilter)
    if (month) params.set('month', String(month))
    if (year) params.set('year', String(year))
    params.set('page', String(page))
    params.set('limit', '20')

    const [list, sum] = await Promise.all([
      apiFetch<{ data: Commission[]; total: number }>(`/api/commissions?${params}`),
      apiFetch<Summary>(`/api/commissions/summary?month=${month}&year=${year}`),
    ])

    setCommissions(list.data)
    setTotal(list.total)
    setSummary(sum)
  }, [salesRepFilter, statusFilter, month, year, page])

  useEffect(() => { loadData() }, [loadData])

  const handlePay = async (id: string) => {
    await apiFetch(`/api/commissions/${id}/pay`, { method: 'PATCH' })
    loadData()
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: 20, marginBottom: 16 }}>COMISSÕES</h1>

      {/* KPI Strip */}
      {summary && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ background: '#e6a800', color: 'white', padding: '12px 20px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase' }}>A Pagar</div>
            <div style={{ fontSize: 18 }}>{fmt(summary.totalToPay)}</div>
            <div style={{ fontSize: 10 }}>{summary.totalToPayCount} parcelas</div>
          </div>
          <div style={{ background: '#006600', color: 'white', padding: '12px 20px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase' }}>Pago</div>
            <div style={{ fontSize: 18 }}>{fmt(summary.totalPaid)}</div>
            <div style={{ fontSize: 10 }}>{summary.totalPaidCount} parcelas</div>
          </div>
          {Object.entries(summary.bySalesRep).map(([rep, vals]) => (
            <div key={rep} style={{ background: 'var(--retro-gray)', padding: '12px 20px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase' }}>{rep}</div>
              <div style={{ fontSize: 14 }}>Pendente: {fmt(vals.pending)}</div>
              <div style={{ fontSize: 14 }}>Pago: {fmt(vals.paid)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input placeholder="Vendedor" value={salesRepFilter} onChange={e => setSalesRepFilter(e.target.value)} style={{ padding: '6px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '6px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          <option value="">Todos</option>
          <option value="PENDING">Pendente</option>
          <option value="PAID">Pago</option>
          <option value="CANCELLED">Cancelado</option>
        </select>
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))} style={{ padding: '6px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('pt-BR', { month: 'long' })}</option>
          ))}
        </select>
        <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} style={{ width: 80, padding: '6px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }} />
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'black', color: 'white', textTransform: 'uppercase' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Cliente</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Vendedor</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Parcela</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Base</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>%</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Comissão</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Vencimento</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {commissions.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #ccc' }}>
                <td style={{ padding: '8px 12px' }}>{c.client.companyName}</td>
                <td style={{ padding: '8px 12px' }}>{c.salesRep}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>{c.installment}/{c.totalInstallments}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(c.baseValue)}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>{c.percentage}%</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{fmt(c.value)}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>{new Date(c.payment.dueDate).toLocaleDateString('pt-BR')}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <span style={{ background: STATUS_COLORS[c.status] ?? '#888', color: 'white', padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{STATUS_LABELS[c.status] ?? c.status}</span>
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  {c.status === 'PENDING' && (
                    <button onClick={() => handlePay(c.id)} style={{ background: '#006600', color: 'white', border: '2px solid black', padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700 }}>PAGAR</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '4px 12px', border: '2px solid black', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>Anterior</button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, padding: '4px 8px' }}>{page} / {Math.ceil(total / 20)}</span>
          <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)} style={{ padding: '4px 12px', border: '2px solid black', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>Próximo</button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/Users/joao.vitor/Desktop/GOON-OS && git add apps/web/src/app/\(dashboard\)/commissions/ && git commit -m "feat(web): add commissions page with KPIs, filters, and pay action"
```

---

## Task 9: Frontend — Expenses Page

**Files:**
- Create: `apps/web/src/app/(dashboard)/expenses/page.tsx`

- [ ] **Step 1: Create expenses page**

Build page with:
- KPI strip: Total Previsto, Total Pago, by category
- Filters: category, status, recurrence, mês/ano
- Table: Descrição | Categoria | Valor | Recorrência | Vencimento | Status | Ações
- Actions: Criar, Editar, Marcar como Pago, Excluir
- Modal for create/edit

```typescript
// apps/web/src/app/(dashboard)/expenses/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'

interface Expense {
  id: string
  description: string
  category: string
  value: number
  recurrence: string
  dueDate: string
  status: string
  paidAt: string | null
  notes: string | null
}

interface Summary {
  totalPrevisto: number
  totalPago: number
  byCategory: Array<{ category: string; total: number }>
}

const CATEGORIES = ['SISTEMAS', 'MARKETING', 'PESSOAS', 'ESTRUTURA', 'OUTRO']
const RECURRENCES = ['UNICA', 'MENSAL', 'TRIMESTRAL', 'ANUAL']
const CATEGORY_LABELS: Record<string, string> = { SISTEMAS: 'Sistemas', MARKETING: 'Marketing', PESSOAS: 'Pessoas', ESTRUTURA: 'Estrutura', OUTRO: 'Outro' }
const RECURRENCE_LABELS: Record<string, string> = { UNICA: 'Única', MENSAL: 'Mensal', TRIMESTRAL: 'Trimestral', ANUAL: 'Anual' }

const emptyForm = { description: '', category: 'SISTEMAS', value: '', recurrence: 'MENSAL', dueDate: '', notes: '' }

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  const loadData = useCallback(async () => {
    const params = new URLSearchParams()
    if (categoryFilter) params.set('category', categoryFilter)
    if (statusFilter) params.set('status', statusFilter)
    if (month) params.set('month', String(month))
    if (year) params.set('year', String(year))
    params.set('page', String(page))
    params.set('limit', '20')

    const [list, sum] = await Promise.all([
      apiFetch<{ data: Expense[]; total: number }>(`/api/expenses?${params}`),
      apiFetch<Summary>(`/api/expenses/summary?month=${month}&year=${year}`),
    ])

    setExpenses(list.data)
    setTotal(list.total)
    setSummary(sum)
  }, [categoryFilter, statusFilter, month, year, page])

  useEffect(() => { loadData() }, [loadData])

  const handleSave = async () => {
    const body = { ...form, value: parseFloat(form.value) }
    if (editId) {
      await apiFetch(`/api/expenses/${editId}`, { method: 'PUT', body: JSON.stringify(body) })
    } else {
      await apiFetch('/api/expenses', { method: 'POST', body: JSON.stringify(body) })
    }
    setShowModal(false)
    setEditId(null)
    setForm(emptyForm)
    loadData()
  }

  const handleEdit = (e: Expense) => {
    setEditId(e.id)
    setForm({ description: e.description, category: e.category, value: String(e.value), recurrence: e.recurrence, dueDate: e.dueDate.slice(0, 10), notes: e.notes ?? '' })
    setShowModal(true)
  }

  const handlePay = async (id: string) => {
    await apiFetch(`/api/expenses/${id}/pay`, { method: 'PATCH' })
    loadData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir despesa?')) return
    await apiFetch(`/api/expenses/${id}`, { method: 'DELETE' })
    loadData()
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: 20 }}>DESPESAS</h1>
        <button onClick={() => { setEditId(null); setForm(emptyForm); setShowModal(true) }} style={{ background: 'black', color: 'white', border: '2px solid black', padding: '8px 16px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>+ NOVA DESPESA</button>
      </div>

      {/* KPI Strip */}
      {summary && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ background: '#e6a800', color: 'white', padding: '12px 20px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase' }}>Previsto</div>
            <div style={{ fontSize: 18 }}>{fmt(summary.totalPrevisto)}</div>
          </div>
          <div style={{ background: '#006600', color: 'white', padding: '12px 20px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase' }}>Pago</div>
            <div style={{ fontSize: 18 }}>{fmt(summary.totalPago)}</div>
          </div>
          {summary.byCategory.map(c => (
            <div key={c.category} style={{ background: 'var(--retro-gray)', padding: '12px 20px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase' }}>{CATEGORY_LABELS[c.category] ?? c.category}</div>
              <div style={{ fontSize: 14 }}>{fmt(c.total)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ padding: '6px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          <option value="">Todas categorias</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '6px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          <option value="">Todos status</option>
          <option value="PREVISTO">Previsto</option>
          <option value="PAGO">Pago</option>
        </select>
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))} style={{ padding: '6px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('pt-BR', { month: 'long' })}</option>
          ))}
        </select>
        <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} style={{ width: 80, padding: '6px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }} />
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'black', color: 'white', textTransform: 'uppercase' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Descrição</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Categoria</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Valor</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Recorrência</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Vencimento</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map(e => (
              <tr key={e.id} style={{ borderBottom: '1px solid #ccc' }}>
                <td style={{ padding: '8px 12px' }}>{e.description}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>{CATEGORY_LABELS[e.category] ?? e.category}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{fmt(e.value)}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>{RECURRENCE_LABELS[e.recurrence] ?? e.recurrence}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>{new Date(e.dueDate).toLocaleDateString('pt-BR')}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <span style={{ background: e.status === 'PAGO' ? '#006600' : '#e6a800', color: 'white', padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{e.status}</span>
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center', display: 'flex', gap: 4, justifyContent: 'center' }}>
                  <button onClick={() => handleEdit(e)} style={{ background: 'var(--retro-blue)', color: 'white', border: '2px solid black', padding: '4px 8px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700 }}>EDITAR</button>
                  {e.status === 'PREVISTO' && (
                    <button onClick={() => handlePay(e.id)} style={{ background: '#006600', color: 'white', border: '2px solid black', padding: '4px 8px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700 }}>PAGAR</button>
                  )}
                  <button onClick={() => handleDelete(e.id)} style={{ background: '#cc0000', color: 'white', border: '2px solid black', padding: '4px 8px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700 }}>X</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--retro-gray)', border: '3px solid black', padding: 24, width: 400, maxWidth: '90vw' }}>
            <h2 style={{ fontFamily: 'var(--font-pixel)', fontSize: 16, marginBottom: 16 }}>{editId ? 'EDITAR' : 'NOVA'} DESPESA</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input placeholder="Descrição" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={inputStyle} />
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
              <input type="number" placeholder="Valor" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} style={inputStyle} />
              <select value={form.recurrence} onChange={e => setForm(f => ({ ...f, recurrence: e.target.value }))} style={inputStyle}>
                {RECURRENCES.map(r => <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>)}
              </select>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} style={inputStyle} />
              <textarea placeholder="Observações" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, minHeight: 60 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setEditId(null) }} style={{ padding: '8px 16px', border: '2px solid black', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>CANCELAR</button>
              <button onClick={handleSave} style={{ background: 'black', color: 'white', padding: '8px 16px', border: '2px solid black', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>SALVAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/Users/joao.vitor/Desktop/GOON-OS && git add apps/web/src/app/\(dashboard\)/expenses/ && git commit -m "feat(web): add expenses page with CRUD, KPIs, and category filters"
```

---

## Task 10: Frontend — Update Sidebar + Role-based Menu

**Files:**
- Modify: `apps/web/src/components/Sidebar.tsx`
- Modify: `apps/web/src/hooks/useAuth.ts`

- [ ] **Step 1: Update useAuth to expose role**

Read `apps/web/src/hooks/useAuth.ts` and add `role` to the user object returned from `/api/auth/me`.

- [ ] **Step 2: Update Sidebar NAV_ITEMS and add role filtering**

Add Comissões and Despesas to NAV_ITEMS:

```typescript
import { type LucideIcon, LayoutDashboard, Building2, Package, FileText, GitBranch, DollarSign, AlertTriangle, LogOut, ChevronLeft, ChevronRight, Users, Percent, Receipt } from 'lucide-react'

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',   label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/crm',         label: 'CRM',        icon: Users },
  { href: '/clients',     label: 'Clientes',   icon: Building2 },
  { href: '/products',    label: 'Programas',   icon: Package },
  { href: '/contracts',   label: 'Contratos',  icon: FileText },
  { href: '/onboarding',  label: 'Onboarding', icon: GitBranch },
  { href: '/payments',    label: 'Financeiro', icon: DollarSign },
  { href: '/commissions', label: 'Comissões',  icon: Percent },
  { href: '/expenses',    label: 'Despesas',   icon: Receipt },
  { href: '/pendencies',  label: 'Pendências', icon: AlertTriangle },
]
```

Add role-based visibility. Pass `userRole` prop to Sidebar:

```typescript
const ROLE_ACCESS: Record<string, string[]> = {
  comercial: ['/dashboard', '/crm'],
  analitico: ['/dashboard', '/crm', '/clients', '/products', '/contracts', '/onboarding', '/pendencies'],
  gestao: [], // empty = access all
}

// Inside Sidebar component, filter navItems:
const visibleItems = userRole && ROLE_ACCESS[userRole]?.length
  ? navItems.filter(item => ROLE_ACCESS[userRole].includes(item.href))
  : navItems
```

- [ ] **Step 3: Commit**

```bash
cd C:/Users/joao.vitor/Desktop/GOON-OS && git add apps/web/src/components/Sidebar.tsx apps/web/src/hooks/useAuth.ts && git commit -m "feat(web): add commissions/expenses to sidebar with role-based menu visibility"
```

---

## Task 11: Frontend — Dashboard Financial Consolidation

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Read current dashboard page**

Read `apps/web/src/app/(dashboard)/dashboard/page.tsx` to understand the current layout.

- [ ] **Step 2: Add financial consolidation section**

After the existing financial KPIs section, add a new "Balanço do Mês" section showing:
- Entradas (recebidas + pendentes + inadimplentes)
- Saídas (despesas previstas + pagas)
- Comissões (pendentes + pagas)
- Saldo Líquido (netBalance)
- Saldo Projetado (projectedBalance)

Use the `financialConsolidation` object from the dashboard API response. Style as retro brutalist cards matching existing dashboard style.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/joao.vitor/Desktop/GOON-OS && git add apps/web/src/app/\(dashboard\)/dashboard/ && git commit -m "feat(web): add financial consolidation section to dashboard"
```

---

## Execution Order Summary

| # | Task | Type | Dependencies |
|---|------|------|-------------|
| 1 | Prisma Schema (Commission, Expense, User.role) | Schema | None |
| 2 | Commissions Module Backend | Backend | Task 1 |
| 3 | Expenses Module Backend | Backend | Task 1 |
| 4 | Enhance closeDeal (auto payments + commissions) | Backend | Tasks 2, 3 |
| 5 | Cancellation Cascade | Backend | Tasks 2, 3 |
| 6 | User Roles + Route Protection | Backend | Task 1 |
| 7 | Dashboard Financial Consolidation Backend | Backend | Tasks 2, 3 |
| 8 | Commissions Page Frontend | Frontend | Task 2 |
| 9 | Expenses Page Frontend | Frontend | Task 3 |
| 10 | Sidebar + Role-based Menu | Frontend | Task 6 |
| 11 | Dashboard Financial Consolidation Frontend | Frontend | Task 7 |

**Parallel groups:**
- Tasks 2 + 3 can run in parallel (both depend only on Task 1)
- Tasks 4 + 5 + 6 + 7 can partially parallelize after 2+3
- Tasks 8 + 9 can run in parallel
- Tasks 10 + 11 can run in parallel
