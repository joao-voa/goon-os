import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ActivityLogService } from '../activity-log/activity-log.service'
import { PaymentsService } from '../payments/payments.service'
import { CommissionsService } from '../commissions/commissions.service'
import { ExpensesService } from '../expenses/expenses.service'

const VALID_LEAD_STAGES = [
  'NOVO',
  'FOLLOW_UP',
  'EM_NEGOCIACAO',
  'FECHADO',
  'PERDIDO',
]

const STAGE_LABELS: Record<string, string> = {
  NOVO: 'Novo',
  FOLLOW_UP: 'Follow Up',
  EM_NEGOCIACAO: 'Em Negociacao',
  FECHADO: 'Fechado',
  PERDIDO: 'Perdido',
}

@Injectable()
export class CrmService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
    private paymentsService: PaymentsService,
    private commissionsService: CommissionsService,
    private expensesService: ExpensesService,
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
        stageChangedAt: true,
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
        stageChangedAt: new Date(),
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
      paymentDay?: number
      commissionPercentage?: number
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
        paymentDay: dto.paymentDay ?? now.getDate(),
      },
    })

    // 3. Create onboarding (if not exists)
    const existingOnboarding = await this.prisma.onboarding.findUnique({ where: { clientId: id } })
    if (!existingOnboarding) {
      await this.prisma.onboarding.create({
        data: { clientId: id, currentStage: 'CLIENT_CLOSED' },
      })
    }

    // 4. Auto-create payment installments
    const paymentDay = dto.paymentDay ?? now.getDate()
    const payments = await this.paymentsService.createBulk(id, plan.id, {
      totalInstallments: dto.saleInstallments,
      value: dto.installmentValue,
      startDate: now,
      paymentDay,
    })

    // 5. Auto-create commissions (if salesRep exists)
    let commissionsCreated = 0
    const salesRep = client.salesRep
    if (salesRep) {
      const percentage = dto.commissionPercentage ?? 10
      const commissions = await this.commissionsService.createForPayments(
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
      commissionsCreated = commissions.length
    }

    // 6. Auto-create expense for commissions (if any)
    if (commissionsCreated > 0 && salesRep) {
      const totalCommissionValue = payments.reduce((sum, p) => {
        const val = typeof p.value === 'number' ? p.value : Number(p.value)
        return sum + Math.round(val * (dto.commissionPercentage ?? 10)) / 100
      }, 0)

      // Determine payment date based on closing rule (day 2/10)
      const day = now.getDate()
      const commPayDate = day <= 2
        ? new Date(now.getFullYear(), now.getMonth(), 10)
        : new Date(now.getFullYear(), now.getMonth() + 1, 10)

      await this.expensesService.create({
        description: `Comissao ${salesRep} — ${client.companyName}`,
        category: 'PESSOAS',
        value: Math.round(totalCommissionValue * 100) / 100,
        recurrence: 'UNICA',
        dueDate: commPayDate,
        notes: `Auto-gerada ao fechar venda. ${commissionsCreated} parcelas.`,
      })
    }

    // 7. Auto-create expense for tax (6% of sale value)
    const taxValue = Math.round(dto.saleValue * 0.06 * 100) / 100
    if (taxValue > 0) {
      await this.expensesService.create({
        description: `Imposto 6% — ${client.companyName}`,
        category: 'OUTRO',
        value: taxValue,
        recurrence: 'UNICA',
        dueDate: now,
        notes: `Imposto sobre faturamento de R$${dto.saleValue}. Auto-gerado.`,
      })
    }

    // 8. Log activity
    await this.activityLog.log({
      clientId: id,
      entityType: 'CRM',
      entityId: id,
      action: 'DEAL_CLOSED',
      fromValue: client.leadStage ?? undefined,
      toValue: 'FECHADO',
      description: `Lead ${client.companyName} fechado — ${product.name} R$${dto.saleValue} | ${payments.length} parcelas + ${commissionsCreated} comissoes criadas`,
    })

    return { client: updated, plan, paymentsCreated: payments.length, commissionsCreated }
  }

  async getInteractions(clientId: string) {
    return this.prisma.leadInteraction.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async addInteraction(dto: {
    clientId: string
    type: string
    description: string
    userName?: string
    scheduledAt?: Date | string
  }) {
    const interaction = await this.prisma.leadInteraction.create({
      data: {
        clientId: dto.clientId,
        type: dto.type,
        description: dto.description,
        userName: dto.userName,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      },
    })

    await this.activityLog.log({
      clientId: dto.clientId,
      entityType: 'CRM',
      entityId: interaction.id,
      action: 'INTERACTION_ADDED',
      description: `${dto.type}: ${dto.description.substring(0, 100)}`,
    })

    return interaction
  }

  async getMetrics() {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // All prospects
    const prospects = await this.prisma.client.findMany({
      where: { leadStage: { not: null } },
      select: { id: true, leadStage: true, salesRep: true, stageChangedAt: true, createdAt: true, closedAt: true, saleValue: true },
    })

    // Count by stage
    const byStage: Record<string, number> = {}
    for (const p of prospects) {
      byStage[p.leadStage!] = (byStage[p.leadStage!] ?? 0) + 1
    }

    // Total leads this month
    const newThisMonth = prospects.filter(p => p.createdAt >= startOfMonth).length

    // Closed this month
    const closedThisMonth = prospects.filter(p => p.leadStage === 'FECHADO' && p.closedAt && p.closedAt >= startOfMonth)
    const closedCount = closedThisMonth.length
    const closedValue = closedThisMonth.reduce((sum, p) => sum + Number(p.saleValue ?? 0), 0)

    // Lost this month
    const lostThisMonth = prospects.filter(p => p.leadStage === 'PERDIDO' && p.stageChangedAt && p.stageChangedAt >= startOfMonth).length

    // Conversion rate
    const totalWithOutcome = closedCount + lostThisMonth
    const conversionRate = totalWithOutcome > 0 ? Math.round((closedCount / totalWithOutcome) * 100) : 0

    // Average days in current stage
    const activeLeads = prospects.filter(p => p.leadStage && !['FECHADO', 'PERDIDO'].includes(p.leadStage))
    const avgDaysInStage = activeLeads.length > 0
      ? Math.round(activeLeads.reduce((sum, p) => {
          const from = p.stageChangedAt ?? p.createdAt
          return sum + (now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
        }, 0) / activeLeads.length)
      : 0

    // Performance by salesRep
    const repStats: Record<string, { total: number; closed: number; lost: number; value: number }> = {}
    for (const p of prospects) {
      const rep = p.salesRep ?? 'Sem vendedor'
      if (!repStats[rep]) repStats[rep] = { total: 0, closed: 0, lost: 0, value: 0 }
      repStats[rep].total++
      if (p.leadStage === 'FECHADO') {
        repStats[rep].closed++
        repStats[rep].value += Number(p.saleValue ?? 0)
      }
      if (p.leadStage === 'PERDIDO') repStats[rep].lost++
    }

    // Stale leads (> 7 days without movement)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const staleLeads = activeLeads.filter(p => {
      const from = p.stageChangedAt ?? p.createdAt
      return from < sevenDaysAgo
    }).length

    // Scheduled follow-ups
    const pendingFollowUps = await this.prisma.leadInteraction.count({
      where: { scheduledAt: { gte: now }, type: 'FOLLOW_UP' },
    })

    return {
      byStage,
      newThisMonth,
      closedThisMonth: closedCount,
      closedValueThisMonth: closedValue,
      lostThisMonth,
      conversionRate,
      avgDaysInStage,
      staleLeads,
      pendingFollowUps,
      bySalesRep: repStats,
    }
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
        leadStage: 'NOVO',
        stageChangedAt: new Date(),
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
