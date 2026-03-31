# CRM — Kanban de Leads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CRM sales pipeline (Kanban de Leads) to GOON OS, reusing the existing Client model with new lead-specific fields, a dedicated kanban board, and sidebar navigation.

**Architecture:** Extend the Client model with CRM fields (leadStage, leadSource, salesRep, saleValue, paymentMethod, installments, installmentValue, closedAt). Create a new CRM API module with its own controller/service for pipeline-specific operations. Build a frontend kanban page reusing the existing KanbanBoard/dnd-kit pattern from the onboarding module. Clients with status=PROSPECT appear in the CRM pipeline; moving to "Fechado" transitions them to ACTIVE.

**Tech Stack:** NestJS 11, Prisma 6.19, Next.js 16, React 19, @dnd-kit, Neon PostgreSQL

---

## File Structure

### Backend (apps/api/src)
| File | Responsibility |
|------|---------------|
| `prisma/schema.prisma` | Add CRM fields to Client model |
| `modules/crm/crm.module.ts` | CRM module declaration |
| `modules/crm/crm.controller.ts` | CRM-specific endpoints (pipeline, stage change) |
| `modules/crm/crm.service.ts` | CRM business logic (findPipeline, changeStage, closeDeal) |
| `modules/clients/dto/create-client.dto.ts` | Add new optional CRM fields |
| `modules/clients/dto/update-client.dto.ts` | Add new optional CRM fields |
| `app.module.ts` | Import CrmModule |

### Frontend (apps/web/src)
| File | Responsibility |
|------|---------------|
| `lib/constants.ts` | Add LEAD_STAGES, LEAD_STAGE_LABELS, LEAD_STAGE_COLORS |
| `app/(dashboard)/crm/page.tsx` | CRM Kanban page with pipeline view |
| `components/Sidebar.tsx` | Add CRM nav item |
| `app/(dashboard)/layout.tsx` | Add CRM to bottom nav |

---

## Task 1: Add CRM Fields to Prisma Schema

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add CRM fields to Client model**

In `apps/api/prisma/schema.prisma`, add these fields to the Client model, right after the `goonFitScore` field and before the `status` field:

```prisma
  // CRM fields
  leadStage        String?   // NOVO_LEAD, CONTATO_FEITO, PROPOSTA_ENVIADA, NEGOCIACAO, FECHADO, PERDIDO
  leadSource       String?   // instagram, indicacao, evento, site, outro
  salesRep         String?   // nome do vendedor
  saleValue        Decimal?  @db.Decimal(10, 2)
  paymentMethod    String?   // BOLETO, PIX
  saleInstallments Int?
  installmentValue Decimal?  @db.Decimal(10, 2)
  leadNotes        String?   // observações / histórico de contatos
  closedAt         DateTime? // data de fechamento
```

- [ ] **Step 2: Add index for leadStage**

Add inside the Client model indexes section:

```prisma
  @@index([leadStage])
```

- [ ] **Step 3: Push schema to database**

```bash
cd apps/api && npx prisma db push
```

Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(crm): add lead fields to Client model"
```

---

## Task 2: Update Client DTOs

**Files:**
- Modify: `apps/api/src/modules/clients/dto/create-client.dto.ts`
- Modify: `apps/api/src/modules/clients/dto/update-client.dto.ts`

- [ ] **Step 1: Add CRM fields to CreateClientDto**

In `apps/api/src/modules/clients/dto/create-client.dto.ts`, add these fields after `goonFitScore` and before the closing `}`:

```typescript
  @IsOptional() @IsString()
  leadStage?: string

  @IsOptional() @IsString()
  leadSource?: string

  @IsOptional() @IsString()
  salesRep?: string

  @IsOptional()
  saleValue?: number

  @IsOptional() @IsString()
  paymentMethod?: string

  @IsOptional() @IsInt() @Min(1)
  saleInstallments?: number

  @IsOptional()
  installmentValue?: number

  @IsOptional() @IsString()
  leadNotes?: string
```

- [ ] **Step 2: Add same fields to UpdateClientDto**

Read the current `update-client.dto.ts`. If it extends CreateClientDto with PartialType, no changes needed. If it's a separate class, add the same fields. Most likely it uses `PartialType(CreateClientDto)` or mirrors the same fields — check and add if needed.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/clients/dto/
git commit -m "feat(crm): add CRM fields to client DTOs"
```

---

## Task 3: Create CRM Backend Module

**Files:**
- Create: `apps/api/src/modules/crm/crm.module.ts`
- Create: `apps/api/src/modules/crm/crm.service.ts`
- Create: `apps/api/src/modules/crm/crm.controller.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create CRM service**

Create `apps/api/src/modules/crm/crm.service.ts`:

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ActivityLogService } from '../activity-log/activity-log.service'

const VALID_LEAD_STAGES = [
  'NOVO_LEAD',
  'CONTATO_FEITO',
  'PROPOSTA_ENVIADA',
  'NEGOCIACAO',
  'FECHADO',
  'PERDIDO',
]

const STAGE_LABELS: Record<string, string> = {
  NOVO_LEAD: 'Novo Lead',
  CONTATO_FEITO: 'Contato Feito',
  PROPOSTA_ENVIADA: 'Proposta Enviada',
  NEGOCIACAO: 'Negociação',
  FECHADO: 'Fechado',
  PERDIDO: 'Perdido',
}

@Injectable()
export class CrmService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
  ) {}

  async findPipeline(params: { salesRep?: string; leadSource?: string }) {
    const { salesRep, leadSource } = params

    const where: Record<string, unknown> = {
      status: 'PROSPECT',
      leadStage: { not: null },
    }

    if (salesRep) where.salesRep = salesRep
    if (leadSource) where.leadSource = leadSource

    const leads = await this.prisma.client.findMany({
      where,
      select: {
        id: true,
        companyName: true,
        responsible: true,
        phone: true,
        whatsapp: true,
        email: true,
        leadStage: true,
        leadSource: true,
        salesRep: true,
        saleValue: true,
        paymentMethod: true,
        saleInstallments: true,
        installmentValue: true,
        leadNotes: true,
        createdAt: true,
        closedAt: true,
        plans: {
          where: { status: 'ACTIVE' },
          take: 1,
          include: { product: { select: { code: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return leads.map(lead => ({
      ...lead,
      saleValue: lead.saleValue ? Number(lead.saleValue) : null,
      installmentValue: lead.installmentValue ? Number(lead.installmentValue) : null,
      productCode: lead.plans[0]?.product?.code ?? null,
      plans: undefined,
    }))
  }

  async changeStage(id: string, toStage: string) {
    if (!VALID_LEAD_STAGES.includes(toStage)) {
      throw new BadRequestException(`Etapa inválida: ${toStage}`)
    }

    const client = await this.prisma.client.findUnique({
      where: { id },
      select: { id: true, companyName: true, leadStage: true, status: true },
    })

    if (!client) {
      throw new NotFoundException(`Cliente com ID ${id} não encontrado`)
    }

    const fromStage = client.leadStage
    const fromLabel = fromStage ? (STAGE_LABELS[fromStage] ?? fromStage) : 'Nenhum'
    const toLabel = STAGE_LABELS[toStage] ?? toStage

    if (toStage === 'FECHADO') {
      throw new BadRequestException(
        'Use o endpoint /api/crm/:id/close para fechar um lead',
      )
    }

    const updated = await this.prisma.client.update({
      where: { id },
      data: {
        leadStage: toStage,
        status: toStage === 'PERDIDO' ? 'INACTIVE' : 'PROSPECT',
      },
    })

    await this.activityLog.log({
      clientId: id,
      entityType: 'CRM',
      entityId: id,
      action: 'STAGE_CHANGED',
      fromValue: fromStage ?? undefined,
      toValue: toStage,
      description: `Lead movido de ${fromLabel} para ${toLabel}`,
    })

    return updated
  }

  async closeDeal(
    id: string,
    dto: {
      saleValue: number
      paymentMethod: string
      saleInstallments: number
      installmentValue: number
      productId: string
    },
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      select: { id: true, companyName: true, leadStage: true },
    })

    if (!client) {
      throw new NotFoundException(`Cliente com ID ${id} não encontrado`)
    }

    const now = new Date()

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
      },
    })

    // 3. Create onboarding (if not exists)
    const existingOnboarding = await this.prisma.onboarding.findUnique({ where: { clientId: id } })
    if (!existingOnboarding) {
      await this.prisma.onboarding.create({
        data: { clientId: id, currentStage: 'CLIENT_CLOSED' },
      })
    }

    // 4. Log activity
    await this.activityLog.log({
      clientId: id,
      entityType: 'CRM',
      entityId: id,
      action: 'DEAL_CLOSED',
      fromValue: client.leadStage ?? undefined,
      toValue: 'FECHADO',
      description: `Lead ${client.companyName} fechado — ${product.name} R$${dto.saleValue}`,
    })

    return { client: updated, plan }
  }

  async createLead(dto: {
    companyName: string
    responsible: string
    phone?: string
    whatsapp?: string
    email?: string
    leadSource?: string
    salesRep?: string
    leadNotes?: string
    segment?: string
  }) {
    const client = await this.prisma.client.create({
      data: {
        ...dto,
        status: 'PROSPECT',
        leadStage: 'NOVO_LEAD',
      },
    })

    await this.activityLog.log({
      clientId: client.id,
      entityType: 'CRM',
      entityId: client.id,
      action: 'LEAD_CREATED',
      description: `Lead ${client.companyName} criado`,
    })

    return client
  }
}
```

- [ ] **Step 2: Create CRM controller**

Create `apps/api/src/modules/crm/crm.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { CrmService } from './crm.service'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'

@Controller('api/crm')
@UseGuards(JwtAuthGuard)
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get('pipeline')
  findPipeline(
    @Query('salesRep') salesRep?: string,
    @Query('leadSource') leadSource?: string,
  ) {
    return this.crmService.findPipeline({ salesRep, leadSource })
  }

  @Post('leads')
  @HttpCode(HttpStatus.CREATED)
  createLead(
    @Body()
    dto: {
      companyName: string
      responsible: string
      phone?: string
      whatsapp?: string
      email?: string
      leadSource?: string
      salesRep?: string
      leadNotes?: string
      segment?: string
    },
  ) {
    return this.crmService.createLead(dto)
  }

  @Patch(':id/stage')
  changeStage(@Param('id') id: string, @Body() dto: { toStage: string }) {
    return this.crmService.changeStage(id, dto.toStage)
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  closeDeal(
    @Param('id') id: string,
    @Body()
    dto: {
      saleValue: number
      paymentMethod: string
      saleInstallments: number
      installmentValue: number
      productId: string
    },
  ) {
    return this.crmService.closeDeal(id, dto)
  }
}
```

- [ ] **Step 3: Create CRM module**

Create `apps/api/src/modules/crm/crm.module.ts`:

```typescript
import { Module } from '@nestjs/common'
import { CrmController } from './crm.controller'
import { CrmService } from './crm.service'
import { ActivityLogModule } from '../activity-log/activity-log.module'

@Module({
  imports: [ActivityLogModule],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
```

- [ ] **Step 4: Register CrmModule in AppModule**

In `apps/api/src/app.module.ts`, add the import:

```typescript
import { CrmModule } from './modules/crm/crm.module'
```

And add `CrmModule` to the `imports` array.

- [ ] **Step 5: Verify API starts**

```bash
cd apps/api && npx nest start
```

Expected: No errors. Routes mapped:
- `GET /api/crm/pipeline`
- `POST /api/crm/leads`
- `PATCH /api/crm/:id/stage`
- `POST /api/crm/:id/close`

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/crm/ apps/api/src/app.module.ts
git commit -m "feat(crm): create CRM module with pipeline, stage change, close deal"
```

---

## Task 4: Add CRM Constants to Frontend

**Files:**
- Modify: `apps/web/src/lib/constants.ts`

- [ ] **Step 1: Add lead stage constants**

At the end of `apps/web/src/lib/constants.ts`, add:

```typescript
export const LEAD_STAGES = [
  'NOVO_LEAD',
  'CONTATO_FEITO',
  'PROPOSTA_ENVIADA',
  'NEGOCIACAO',
  'FECHADO',
  'PERDIDO',
] as const

export const LEAD_STAGE_LABELS: Record<string, string> = {
  NOVO_LEAD: 'Novo Lead',
  CONTATO_FEITO: 'Contato Feito',
  PROPOSTA_ENVIADA: 'Proposta Enviada',
  NEGOCIACAO: 'Negociação',
  FECHADO: 'Fechado ✅',
  PERDIDO: 'Perdido ❌',
}

export const LEAD_STAGE_COLORS: Record<string, string> = {
  NOVO_LEAD: '#4A78FF',
  CONTATO_FEITO: '#06b6d4',
  PROPOSTA_ENVIADA: '#f59e0b',
  NEGOCIACAO: '#f97316',
  FECHADO: '#22c55e',
  PERDIDO: '#cc0000',
}

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  indicacao: 'Indicação',
  evento: 'Evento',
  site: 'Site',
  outro: 'Outro',
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/constants.ts
git commit -m "feat(crm): add lead stage constants to frontend"
```

---

## Task 5: Build CRM Kanban Page

**Files:**
- Create: `apps/web/src/app/(dashboard)/crm/page.tsx`

- [ ] **Step 1: Create the CRM Kanban page**

Create `apps/web/src/app/(dashboard)/crm/page.tsx`:

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useIsMobile } from '@/hooks/useMediaQuery'
import {
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  LEAD_STAGE_COLORS,
  LEAD_SOURCE_LABELS,
  PRODUCT_COLORS,
  PRODUCT_NAMES,
} from '@/lib/constants'
import dynamic from 'next/dynamic'

const CrmKanbanBoard = dynamic(() => import('@/components/CrmKanbanBoard'), { ssr: false })

// ---- Types ----
interface LeadItem {
  id: string
  companyName: string
  responsible: string
  phone: string | null
  whatsapp: string | null
  email: string | null
  leadStage: string
  leadSource: string | null
  salesRep: string | null
  saleValue: number | null
  paymentMethod: string | null
  saleInstallments: number | null
  installmentValue: number | null
  leadNotes: string | null
  productCode: string | null
  createdAt: string
  closedAt: string | null
}

// ---- Close Deal Modal ----
function CloseDealModal({
  lead,
  products,
  onClose,
  onConfirm,
}: {
  lead: LeadItem
  products: Array<{ id: string; code: string; name: string }>
  onClose: () => void
  onConfirm: (data: {
    saleValue: number
    paymentMethod: string
    saleInstallments: number
    installmentValue: number
    productId: string
  }) => Promise<void>
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [saleValue, setSaleValue] = useState(lead.saleValue?.toString() ?? '')
  const [paymentMethod, setPaymentMethod] = useState(lead.paymentMethod ?? 'BOLETO')
  const [saleInstallments, setSaleInstallments] = useState(lead.saleInstallments?.toString() ?? '1')
  const [submitting, setSubmitting] = useState(false)

  const value = parseFloat(saleValue) || 0
  const installments = parseInt(saleInstallments) || 1
  const installmentVal = installments > 0 ? value / installments : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId || value <= 0 || installments < 1) {
      toast.error('Preencha todos os campos')
      return
    }
    setSubmitting(true)
    try {
      await onConfirm({
        saleValue: value,
        paymentMethod,
        saleInstallments: installments,
        installmentValue: Math.round(installmentVal * 100) / 100,
        productId,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    border: '2px solid black',
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    background: 'white',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    display: 'block',
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'white', border: '2px solid black', boxShadow: '8px 8px 0px 0px #000',
          width: '100%', maxWidth: 420, position: 'relative',
        }}
      >
        <div style={{ background: '#22c55e', color: 'white', padding: '10px 16px', fontFamily: 'var(--font-pixel)', fontSize: 11 }}>
          FECHAR NEGÓCIO — {lead.companyName}
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Programa</label>
            <select value={productId} onChange={e => setProductId(e.target.value)} style={inputStyle}>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Valor Total (R$)</label>
            <input type="number" step="0.01" value={saleValue} onChange={e => setSaleValue(e.target.value)} style={inputStyle} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Forma de Pagamento</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={inputStyle}>
                <option value="BOLETO">Boleto</option>
                <option value="PIX">PIX</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Parcelas</label>
              <input type="number" min="1" value={saleInstallments} onChange={e => setSaleInstallments(e.target.value)} style={inputStyle} required />
            </div>
          </div>
          {installments > 0 && value > 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: '#f0f0f0', padding: '8px 12px', border: '1px solid #ccc' }}>
              {installments}x de R$ {installmentVal.toFixed(2)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '10px', border: '2px solid black', background: 'white',
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              CANCELAR
            </button>
            <button type="submit" disabled={submitting} style={{
              flex: 1, padding: '10px', border: '2px solid black', background: '#22c55e', color: 'white',
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: submitting ? 'wait' : 'pointer',
              boxShadow: '3px 3px 0px 0px #000',
            }}>
              {submitting ? 'FECHANDO...' : 'CONFIRMAR'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

// ---- New Lead Modal ----
function NewLeadModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: (data: {
    companyName: string
    responsible: string
    phone?: string
    whatsapp?: string
    email?: string
    leadSource?: string
    salesRep?: string
    leadNotes?: string
  }) => Promise<void>
}) {
  const [companyName, setCompanyName] = useState('')
  const [responsible, setResponsible] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [leadSource, setLeadSource] = useState('')
  const [salesRep, setSalesRep] = useState('')
  const [leadNotes, setLeadNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!companyName.trim() || !responsible.trim()) {
      toast.error('Nome e responsável são obrigatórios')
      return
    }
    setSubmitting(true)
    try {
      await onConfirm({
        companyName: companyName.trim(),
        responsible: responsible.trim(),
        phone: phone.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        email: email.trim() || undefined,
        leadSource: leadSource || undefined,
        salesRep: salesRep.trim() || undefined,
        leadNotes: leadNotes.trim() || undefined,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', border: '2px solid black',
    fontFamily: 'var(--font-mono)', fontSize: 13, background: 'white',
  }
  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block',
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'white', border: '2px solid black', boxShadow: '8px 8px 0px 0px #000',
          width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ background: '#4A78FF', color: 'white', padding: '10px 16px', fontFamily: 'var(--font-pixel)', fontSize: 11 }}>
          NOVO LEAD
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Empresa / Nome *</label>
            <input value={companyName} onChange={e => setCompanyName(e.target.value)} style={inputStyle} required />
          </div>
          <div>
            <label style={labelStyle}>Responsável *</label>
            <input value={responsible} onChange={e => setResponsible(e.target.value)} style={inputStyle} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Telefone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>WhatsApp</label>
              <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Origem</label>
              <select value={leadSource} onChange={e => setLeadSource(e.target.value)} style={inputStyle}>
                <option value="">Selecione...</option>
                <option value="instagram">Instagram</option>
                <option value="indicacao">Indicação</option>
                <option value="evento">Evento</option>
                <option value="site">Site</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Vendedor</label>
              <input value={salesRep} onChange={e => setSalesRep(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Observações</label>
            <textarea value={leadNotes} onChange={e => setLeadNotes(e.target.value)} rows={3}
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '10px', border: '2px solid black', background: 'white',
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              CANCELAR
            </button>
            <button type="submit" disabled={submitting} style={{
              flex: 1, padding: '10px', border: '2px solid black', background: '#4A78FF', color: 'white',
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: submitting ? 'wait' : 'pointer',
              boxShadow: '3px 3px 0px 0px #000',
            }}>
              {submitting ? 'SALVANDO...' : 'CRIAR LEAD'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

// ---- Main Page ----
export default function CrmPage() {
  const [leads, setLeads] = useState<LeadItem[]>([])
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Array<{ id: string; code: string; name: string }>>([])
  const [closingLead, setClosingLead] = useState<LeadItem | null>(null)
  const [showNewLead, setShowNewLead] = useState(false)
  const isMobile = useIsMobile()

  // Active pipeline stages (exclude FECHADO and PERDIDO from kanban columns)
  const PIPELINE_STAGES = LEAD_STAGES.filter(s => s !== 'FECHADO' && s !== 'PERDIDO')

  const fetchLeads = useCallback(async () => {
    try {
      const data = await apiFetch<LeadItem[]>('/api/crm/pipeline')
      setLeads(data)
    } catch {
      toast.error('Erro ao carregar pipeline')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
    apiFetch<Array<{ id: string; code: string; name: string }>>('/api/products')
      .then(setProducts)
      .catch(() => {})
  }, [fetchLeads])

  async function handleStageChange(id: string, toStage: string) {
    const lead = leads.find(l => l.id === id)
    if (toStage === 'FECHADO' && lead) {
      setClosingLead(lead)
      return
    }
    try {
      await apiFetch(`/api/crm/${id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ toStage }),
      })
      toast.success(`Lead movido para ${LEAD_STAGE_LABELS[toStage] ?? toStage}`)
      fetchLeads()
    } catch {
      toast.error('Erro ao mover lead')
    }
  }

  async function handleCloseDeal(data: {
    saleValue: number
    paymentMethod: string
    saleInstallments: number
    installmentValue: number
    productId: string
  }) {
    if (!closingLead) return
    try {
      await apiFetch(`/api/crm/${closingLead.id}/close`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      toast.success(`${closingLead.companyName} fechado com sucesso!`)
      setClosingLead(null)
      fetchLeads()
    } catch {
      toast.error('Erro ao fechar negócio')
    }
  }

  async function handleCreateLead(data: {
    companyName: string
    responsible: string
    phone?: string
    whatsapp?: string
    email?: string
    leadSource?: string
    salesRep?: string
    leadNotes?: string
  }) {
    try {
      await apiFetch('/api/crm/leads', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      toast.success('Lead criado!')
      setShowNewLead(false)
      fetchLeads()
    } catch {
      toast.error('Erro ao criar lead')
    }
  }

  // KPIs
  const activeLeads = leads.filter(l => l.leadStage !== 'FECHADO' && l.leadStage !== 'PERDIDO')
  const inNegotiation = leads.filter(l => l.leadStage === 'NEGOCIACAO').length
  const closedThisMonth = leads.filter(l => {
    if (l.leadStage !== 'FECHADO' || !l.closedAt) return false
    const d = new Date(l.closedAt)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-pixel)', fontSize: 12 }}>
        CARREGANDO PIPELINE...
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 12,
      }}>
        <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: isMobile ? 14 : 18, margin: 0 }}>
          CRM — PIPELINE
        </h1>
        <button
          onClick={() => setShowNewLead(true)}
          style={{
            padding: '8px 16px', border: '2px solid black', background: '#4A78FF', color: 'white',
            fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            boxShadow: '3px 3px 0px 0px #000',
          }}
        >
          + NOVO LEAD
        </button>
      </div>

      {/* KPIs */}
      <div style={{
        display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr 1fr' : 'repeat(3, 1fr)',
        gap: isMobile ? 8 : 12, marginBottom: 20,
      }}>
        {[
          { label: 'Leads Ativos', value: activeLeads.length, color: '#4A78FF' },
          { label: 'Em Negociação', value: inNegotiation, color: '#f97316' },
          { label: 'Fechados (mês)', value: closedThisMonth, color: '#22c55e' },
        ].map(kpi => (
          <div key={kpi.label} style={{
            border: '2px solid black', boxShadow: '4px 4px 0px 0px #000',
            padding: isMobile ? '10px 8px' : '14px 16px', background: 'white',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: '#666' }}>
              {kpi.label}
            </div>
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: isMobile ? 18 : 24, color: kpi.color, marginTop: 4 }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Kanban Board */}
      <CrmKanbanBoard
        items={activeLeads}
        stages={PIPELINE_STAGES}
        onStageChange={handleStageChange}
        onCardClick={(item) => {
          if (item.leadStage === 'NEGOCIACAO') {
            setClosingLead(item)
          }
        }}
      />

      {/* Modals */}
      {closingLead && (
        <CloseDealModal
          lead={closingLead}
          products={products}
          onClose={() => setClosingLead(null)}
          onConfirm={handleCloseDeal}
        />
      )}
      {showNewLead && (
        <NewLeadModal
          onClose={() => setShowNewLead(false)}
          onConfirm={handleCreateLead}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/crm/
git commit -m "feat(crm): create CRM kanban page with pipeline, new lead, close deal"
```

---

## Task 6: Create CRM Kanban Board Component

**Files:**
- Create: `apps/web/src/components/CrmKanbanBoard.tsx`

- [ ] **Step 1: Create the CRM kanban board component**

Create `apps/web/src/components/CrmKanbanBoard.tsx`. This follows the same pattern as the existing `KanbanBoard.tsx` but for CRM leads:

```tsx
'use client'

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import { LEAD_STAGE_LABELS, LEAD_STAGE_COLORS, LEAD_SOURCE_LABELS } from '@/lib/constants'

interface LeadItem {
  id: string
  companyName: string
  responsible: string
  phone: string | null
  whatsapp: string | null
  email: string | null
  leadStage: string
  leadSource: string | null
  salesRep: string | null
  saleValue: number | null
  leadNotes: string | null
  productCode: string | null
  createdAt: string
}

interface CrmKanbanBoardProps {
  items: LeadItem[]
  stages: readonly string[]
  onStageChange: (id: string, toStage: string) => Promise<void>
  onCardClick: (item: LeadItem) => void
}

function DraggableCard({ item, onClick }: { item: LeadItem; onClick: (item: LeadItem) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id })

  const sourceLabel = item.leadSource ? (LEAD_SOURCE_LABELS[item.leadSource] ?? item.leadSource) : null

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onClick(item)}
      style={{
        background: 'white',
        border: '2px solid black',
        boxShadow: isDragging ? 'none' : '3px 3px 0px 0px #000',
        padding: '10px 12px',
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.4 : 1,
        userSelect: 'none',
        marginBottom: 8,
      }}
    >
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
        {item.companyName}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555', marginBottom: 2 }}>
        {item.responsible}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
        {sourceLabel && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, background: '#e0e0e0',
            padding: '2px 6px', border: '1px solid #999',
          }}>
            {sourceLabel}
          </span>
        )}
        {item.salesRep && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, background: '#dbeafe',
            padding: '2px 6px', border: '1px solid #93c5fd',
          }}>
            {item.salesRep}
          </span>
        )}
        {item.saleValue && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, background: '#dcfce7',
            padding: '2px 6px', border: '1px solid #86efac', fontWeight: 700,
          }}>
            R$ {item.saleValue.toLocaleString('pt-BR')}
          </span>
        )}
      </div>
    </div>
  )
}

function DroppableColumn({
  stage,
  items,
  onCardClick,
}: {
  stage: string
  items: LeadItem[]
  onCardClick: (item: LeadItem) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const color = LEAD_STAGE_COLORS[stage] ?? '#888'
  const label = LEAD_STAGE_LABELS[stage] ?? stage

  return (
    <div
      ref={setNodeRef}
      style={{
        minWidth: 260,
        maxWidth: 300,
        flex: '1 0 260px',
        background: isOver ? '#f0f7ff' : '#f5f5f5',
        border: '2px solid black',
        boxShadow: '4px 4px 0px 0px #000',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 260px)',
      }}
    >
      <div style={{
        background: color, color: 'white', padding: '8px 12px',
        fontFamily: 'var(--font-pixel)', fontSize: 9, display: 'flex',
        justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{label}</span>
        <span style={{
          background: 'rgba(255,255,255,0.3)', padding: '2px 8px',
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
        }}>
          {items.length}
        </span>
      </div>
      <div style={{ padding: 8, overflowY: 'auto', flex: 1 }}>
        {items.map(item => (
          <DraggableCard key={item.id} item={item} onClick={onCardClick} />
        ))}
        {items.length === 0 && (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, color: '#999',
            textAlign: 'center', padding: 20,
          }}>
            Nenhum lead
          </div>
        )}
      </div>
    </div>
  )
}

export default function CrmKanbanBoard({ items, stages, onStageChange, onCardClick }: CrmKanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const activeItem = activeId ? items.find(i => i.id === activeId) ?? null : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const itemId = active.id as string
    const toStage = over.id as string
    const item = items.find(i => i.id === itemId)
    if (item && item.leadStage !== toStage) {
      onStageChange(itemId, toStage)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12 }}>
        {stages.map(stage => (
          <DroppableColumn
            key={stage}
            stage={stage}
            items={items.filter(i => i.leadStage === stage)}
            onCardClick={onCardClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeItem && (
          <div style={{
            background: 'white', border: '2px solid black', boxShadow: '6px 6px 0px 0px #000',
            padding: '10px 12px', transform: 'rotate(3deg)', opacity: 0.95,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>
              {activeItem.companyName}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555' }}>
              {activeItem.responsible}
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/CrmKanbanBoard.tsx
git commit -m "feat(crm): create CRM kanban board component with drag-drop"
```

---

## Task 7: Add CRM to Navigation

**Files:**
- Modify: `apps/web/src/components/Sidebar.tsx`
- Modify: `apps/web/src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Add CRM to sidebar nav items**

In `apps/web/src/components/Sidebar.tsx`, add the `Users` icon to the import from `lucide-react`:

```typescript
import { type LucideIcon, LayoutDashboard, Building2, Package, FileText, GitBranch, DollarSign, AlertTriangle, LogOut, ChevronLeft, ChevronRight, Users } from 'lucide-react'
```

Then add the CRM item to `NAV_ITEMS` array, as the **second item** (after Dashboard, before Clientes):

```typescript
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/crm',        label: 'CRM',        icon: Users },
  { href: '/clients',    label: 'Clientes',   icon: Building2 },
  { href: '/products',   label: 'Programas',  icon: Package },
  { href: '/contracts',  label: 'Contratos',  icon: FileText },
  { href: '/onboarding', label: 'Onboarding', icon: GitBranch },
  { href: '/payments',   label: 'Financeiro', icon: DollarSign },
  { href: '/pendencies', label: 'Pendências', icon: AlertTriangle },
]
```

- [ ] **Step 2: Add CRM to mobile bottom nav**

In `apps/web/src/app/(dashboard)/layout.tsx`, add `Users` to the lucide-react import:

```typescript
import { LayoutDashboard, Building2, Package, FileText, DollarSign, AlertTriangle, GitBranch, Users } from 'lucide-react'
```

Then add CRM to the `BOTTOM_NAV` array as the second item. Since mobile bottom nav supports max ~7 items, replace or reorder as needed:

```typescript
const BOTTOM_NAV = [
  { href: '/dashboard',  label: 'Home',    Icon: LayoutDashboard },
  { href: '/crm',        label: 'CRM',     Icon: Users },
  { href: '/clients',    label: 'Clientes', Icon: Building2 },
  { href: '/contracts',  label: 'Contr.',  Icon: FileText },
  { href: '/payments',   label: 'Financ.', Icon: DollarSign },
  { href: '/pendencies', label: 'Pend.',   Icon: AlertTriangle },
]
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/Sidebar.tsx apps/web/src/app/\(dashboard\)/layout.tsx
git commit -m "feat(crm): add CRM to sidebar and mobile bottom nav"
```

---

## Summary

| Task | Type | What it Does |
|------|------|-------------|
| 1 | Schema | Add CRM fields to Client (leadStage, leadSource, salesRep, saleValue, etc.) |
| 2 | DTOs | Update CreateClientDto and UpdateClientDto with new fields |
| 3 | Backend | Create CRM module (pipeline, createLead, changeStage, closeDeal) |
| 4 | Constants | Add lead stage constants to frontend |
| 5 | Frontend | Build CRM Kanban page with modals (new lead, close deal) |
| 6 | Component | Build CrmKanbanBoard with drag-drop (same pattern as onboarding) |
| 7 | Navigation | Add CRM to sidebar and mobile bottom nav |
