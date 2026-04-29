import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ActivityLogService } from '../activity-log/activity-log.service'
import { PaymentsService } from '../payments/payments.service'
import { CommissionsService } from '../commissions/commissions.service'
import { ExpensesService } from '../expenses/expenses.service'
import { TAX_RATE, getNextCommissionPaymentDate } from '../../shared/constants'

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
        selectedModules: true,
        estimatedRevenue: true,
        segment: true,
        suggestedProduct: true,
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
      firstInstallmentDate?: string
      commissionPercentage?: number
      wasAdvanced?: boolean
      advanceValue?: number
      closedAt?: string
      entryValue?: number
    },
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      select: { id: true, companyName: true, leadStage: true, salesRep: true },
    })

    if (!client) {
      throw new NotFoundException(`Cliente com ID ${id} não encontrado`)
    }

    const now = dto.closedAt ? new Date(dto.closedAt) : new Date()

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
        wasAdvanced: dto.wasAdvanced ?? false,
        advanceValue: dto.advanceValue ?? null,
      },
    })

    // 3. Create onboarding (if not exists)
    const existingOnboarding = await this.prisma.onboarding.findUnique({ where: { clientId: id } })
    if (!existingOnboarding) {
      await this.prisma.onboarding.create({
        data: { clientId: id, currentStage: 'CLIENT_CLOSED' },
      })
    }

    // 4. Create entry payment (if exists)
    let entryPayment: { id: string; value: number } | null = null
    if (dto.entryValue && dto.entryValue > 0) {
      const created = await this.prisma.payment.create({
        data: {
          clientId: id,
          clientPlanId: plan.id,
          installment: 0,
          totalInstallments: dto.saleInstallments + 1,
          dueDate: now,
          value: dto.entryValue,
          status: 'PAID',
          paidAt: now,
        },
      })
      entryPayment = { id: created.id, value: dto.entryValue }
    }

    // 5. Auto-create payment installments
    const firstDate = dto.firstInstallmentDate ? new Date(dto.firstInstallmentDate) : (() => { const d = new Date(now); d.setDate(d.getDate() + 30); return d })()
    const paymentDay = dto.paymentDay ?? firstDate.getDate()
    const payments = await this.paymentsService.createBulk(id, plan.id, {
      totalInstallments: dto.saleInstallments,
      value: dto.installmentValue,
      startDate: firstDate,
      paymentDay,
    })

    // 6. Auto-create commissions (if salesRep exists)
    let commissionsCreated = 0
    const salesRep = client.salesRep
    if (salesRep) {
      const percentage = dto.commissionPercentage ?? 10

      if (dto.wasAdvanced && dto.advanceValue) {
        // Cartão adiantado: comissão sobre o valor adiantado, tudo de uma vez
        await this.commissionsService.createForPayments(
          id,
          salesRep,
          percentage,
          [{
            id: payments[0].id,
            installment: 1,
            totalInstallments: 1,
            value: dto.advanceValue,
          }],
        )
        commissionsCreated = 1
      } else {
        // Entry commission: paid D+5
        if (entryPayment) {
          const entryLiquid = entryPayment.value * (1 - TAX_RATE)
          const entryCommissionValue = Math.round(entryLiquid * percentage) / 100
          const d5 = new Date(now)
          d5.setDate(d5.getDate() + 5)

          await this.prisma.commission.create({
            data: {
              clientId: id,
              paymentId: entryPayment.id,
              salesRep,
              percentage,
              baseValue: entryPayment.value,
              value: entryCommissionValue,
              installment: 0,
              totalInstallments: payments.length + 1,
              status: 'PENDING',
            },
          })

          await this.expensesService.create({
            description: `Comissao entrada ${salesRep} — ${client.companyName} (D+5)`,
            category: 'PESSOAS',
            value: entryCommissionValue,
            recurrence: 'UNICA',
            dueDate: d5,
            notes: `Comissao sobre entrada R$${entryPayment.value}. Repasse D+5.`,
          })
          commissionsCreated++
        }

        // Installment commissions
        const commissions = await this.commissionsService.createForPayments(
          id,
          salesRep,
          percentage,
          payments.map(p => ({
            id: p.id,
            installment: (entryPayment ? 1 : 0) + p.installment,
            totalInstallments: (entryPayment ? 1 : 0) + payments.length,
            value: typeof p.value === 'number' ? p.value : Number(p.value),
          })),
        )
        commissionsCreated += commissions.length
      }
    }

    // 7. Auto-create expense for commissions (if any)
    if (commissionsCreated > 0 && salesRep) {
      const percentage = dto.commissionPercentage ?? 10
      let totalCommissionValue: number

      if (dto.wasAdvanced && dto.advanceValue) {
        totalCommissionValue = Math.round(dto.advanceValue * (1 - TAX_RATE) * percentage) / 100
      } else {
        const allValues = [
          ...(entryPayment ? [entryPayment.value] : []),
          ...payments.map(p => typeof p.value === 'number' ? p.value : Number(p.value)),
        ]
        totalCommissionValue = allValues.reduce((sum, val) => sum + Math.round(val * (1 - TAX_RATE) * percentage) / 100, 0)
      }

      const commPayDate = getNextCommissionPaymentDate(now)

      await this.expensesService.create({
        description: `Comissao ${salesRep} — ${client.companyName}${dto.wasAdvanced ? ' (adiantado)' : ''}`,
        category: 'PESSOAS',
        value: Math.round(totalCommissionValue * 100) / 100,
        recurrence: 'UNICA',
        dueDate: commPayDate,
        notes: `Auto-gerada ao fechar venda. ${dto.wasAdvanced ? 'Valor adiantado: R$' + dto.advanceValue : commissionsCreated + ' parcelas' + (entryPayment ? ' (inclui entrada)' : '')}.`,
      })
    }

    // 7. Auto-create expense for tax (6% per installment)
    const allPayments = [...(entryPayment ? [{ value: entryPayment.value, dueDate: now, installment: 0 }] : []), ...payments.map(pay => ({ value: typeof pay.value === 'number' ? pay.value : Number(pay.value), dueDate: pay.dueDate ?? now, installment: pay.installment }))]
    for (const pay of allPayments) {
      const taxValue = Math.round(pay.value * TAX_RATE * 100) / 100
      if (taxValue > 0) {
        await this.expensesService.create({
          description: `Imposto 6% — ${client.companyName} P${pay.installment}`,
          category: 'IMPOSTOS',
          value: taxValue,
          recurrence: 'UNICA',
          dueDate: pay.dueDate,
          notes: `Imposto sobre parcela R$${pay.value}`,
        })
      }
    }

    // 8. Log activity
    await this.activityLog.log({
      clientId: id,
      entityType: 'CRM',
      entityId: id,
      action: 'DEAL_CLOSED',
      fromValue: client.leadStage ?? undefined,
      toValue: 'FECHADO',
      description: `Lead ${client.companyName} fechado — ${product.name} R$${dto.saleValue}${entryPayment ? ' (entrada R$' + dto.entryValue + ')' : ''} | ${payments.length} parcelas + ${commissionsCreated} comissoes criadas`,
    })

    return { client: updated, plan, paymentsCreated: payments.length + (entryPayment ? 1 : 0), commissionsCreated }
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

  async syncFromSheets(): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const SHEETS = [
      {
        name: 'Meta Ads',
        url: 'https://docs.google.com/spreadsheets/d/1q8aLXTZiEvE8FE2d9NSnm50CZJVwz9G7Oy3EnS33FhY/gviz/tq?tqx=out:csv&sheet=0',
        type: 'meta' as const,
      },
      {
        name: 'Respondi',
        url: 'https://docs.google.com/spreadsheets/d/1ahwY6sYpWT0WSv42J6zKtGPtg5PjCWncDCJXHX28Zp0/gviz/tq?tqx=out:csv&sheet=0',
        type: 'respondi' as const,
      },
    ]

    let imported = 0
    let skipped = 0
    const errors: string[] = []

    for (const sheet of SHEETS) {
      try {
        const response = await fetch(sheet.url)
        if (!response.ok) {
          errors.push(`${sheet.name}: erro ao acessar planilha (${response.status})`)
          continue
        }
        const csv = await response.text()
        const rows = this.parseCsv(csv)
        if (rows.length <= 1) continue // header only

        const header = rows[0]
        const dataRows = rows.slice(1)

        for (const row of dataRows) {
          try {
            const record = this.mapRow(header, row)
            const lead = sheet.type === 'meta'
              ? this.parseMetaLead(record)
              : this.parseRespondiLead(record)

            if (!lead || !lead.companyName || lead.companyName.length < 2) {
              skipped++
              continue
            }

            // Skip spam/invalid leads
            if (this.isSpamLead(lead, record)) {
              skipped++
              continue
            }

            // Check duplicate by email or whatsapp
            const orConditions: Array<Record<string, string>> = []
            if (lead.email) orConditions.push({ email: lead.email })
            if (lead.whatsapp) orConditions.push({ whatsapp: lead.whatsapp })

            if (orConditions.length > 0) {
              const existing = await this.prisma.client.findFirst({
                where: { OR: orConditions },
              })
              if (existing) {
                skipped++
                continue
              }
            }

            await this.prisma.client.create({ data: lead })
            imported++
          } catch {
            skipped++
          }
        }
      } catch (err) {
        errors.push(`${sheet.name}: ${err instanceof Error ? err.message : 'erro desconhecido'}`)
      }
    }

    return { imported, skipped, errors }
  }

  private parseCsv(csv: string): string[][] {
    const rows: string[][] = []
    let current = ''
    let inQuotes = false
    let row: string[] = []

    for (let i = 0; i < csv.length; i++) {
      const char = csv[i]
      const next = csv[i + 1]

      if (inQuotes) {
        if (char === '"' && next === '"') {
          current += '"'
          i++
        } else if (char === '"') {
          inQuotes = false
        } else {
          current += char
        }
      } else {
        if (char === '"') {
          inQuotes = true
        } else if (char === ',') {
          row.push(current)
          current = ''
        } else if (char === '\n' || (char === '\r' && next === '\n')) {
          row.push(current)
          current = ''
          rows.push(row)
          row = []
          if (char === '\r') i++
        } else {
          current += char
        }
      }
    }
    if (current || row.length > 0) {
      row.push(current)
      rows.push(row)
    }
    return rows
  }

  private mapRow(header: string[], row: string[]): Record<string, string> {
    const record: Record<string, string> = {}
    for (let i = 0; i < header.length; i++) {
      record[header[i]] = row[i] ?? ''
    }
    return record
  }

  private parseMetaLead(r: Record<string, string>) {
    const companyName = r['qual_o_nome_da_sua_marca?']?.trim()
    const responsible = r['full_name']?.trim()
    const whatsapp = r['whatsapp_number']?.trim() || null
    const email = r['email']?.trim() || null
    const cargo = r['qual_é_seu_cargo_na_empresa?']?.trim()
    const faturamento = r['qual_é_seu_faturamento_anual?']?.trim()
    const instagram = r['deixe_aqui_o_instagram_da_sua_marca:_@']?.trim()
    const website = r['website']?.trim()
    const platform = r['platform']?.trim()
    const createdTime = r['created_time']?.trim()

    const notes = [
      cargo ? `Cargo: ${cargo}` : null,
      instagram ? `IG: ${instagram}` : null,
      website ? `Site: ${website}` : null,
    ].filter(Boolean).join(' | ')

    return {
      companyName: companyName || responsible || '',
      responsible: responsible || companyName || '',
      whatsapp,
      phone: whatsapp,
      email,
      estimatedRevenue: faturamento || null,
      segment: 'Moda',
      status: 'PROSPECT',
      leadStage: 'NOVO',
      leadSource: platform === 'fb' ? 'facebook' : 'instagram',
      leadNotes: notes || null,
      stageChangedAt: createdTime ? new Date(createdTime) : new Date(),
      createdAt: createdTime ? new Date(createdTime) : new Date(),
    }
  }

  private parseRespondiLead(r: Record<string, string>) {
    const fullName = r['Qual o seu nome completo?']?.trim()
    const nickname = r['E como você prefere ser chamado?']?.trim()
    const email = r['Qual o seu email?']?.trim() || null
    const whatsapp = r['Qual o seu Whatsapp com DDD?']?.trim() || null
    const companyName = r['Qual o nome da sua marca, ___?']?.trim()
    const cargo = r['E qual é o seu cargo na empresa?']?.trim()
    const faturamento = r['Qual é o seu faturamento anual?']?.trim()
    const createdTime = r['Data']?.trim()

    const notes = [
      cargo ? `Cargo: ${cargo}` : null,
      'Fonte: Respondi',
    ].filter(Boolean).join(' | ')

    return {
      companyName: companyName || fullName || '',
      responsible: nickname || fullName || '',
      whatsapp: whatsapp ? `+${whatsapp.replace(/\D/g, '')}` : null,
      phone: whatsapp ? `+${whatsapp.replace(/\D/g, '')}` : null,
      email,
      estimatedRevenue: faturamento || null,
      segment: 'Moda',
      status: 'PROSPECT',
      leadStage: 'NOVO',
      leadSource: 'site',
      leadNotes: notes || null,
      stageChangedAt: createdTime ? new Date(createdTime) : new Date(),
      createdAt: createdTime ? new Date(createdTime) : new Date(),
    }
  }

  private isSpamLead(lead: { companyName: string; responsible: string; email?: string | null }, raw: Record<string, string>): boolean {
    const name = lead.companyName.toLowerCase()
    const cargo = (raw['qual_é_seu_cargo_na_empresa?'] || raw['E qual é o seu cargo na empresa?'] || '').toLowerCase()
    const faturamento = (raw['qual_é_seu_faturamento_anual?'] || raw['Qual é o seu faturamento anual?'] || '').toLowerCase()

    // Name too short or numeric
    if (name.length < 3 || /^\d+$/.test(name)) return true
    // All fields identical (test/spam)
    if (name === cargo && cargo === faturamento) return true
    // Known spam patterns
    if (/^(sim|nao|teste|99|00)$/i.test(faturamento)) return true

    return false
  }

  async getSuggestions() {
    const [salesReps, mentors] = await Promise.all([
      this.prisma.client.findMany({
        where: { salesRep: { not: null } },
        select: { salesRep: true },
        distinct: ['salesRep'],
      }),
      this.prisma.planMentor.findMany({
        select: { mentorName: true },
        distinct: ['mentorName'],
      }),
    ])

    return {
      salesReps: salesReps.map(s => s.salesRep).filter(Boolean),
      mentors: mentors.map(m => m.mentorName),
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
    selectedModules?: string
    productInterest?: string
    suggestedProduct?: string
  }) {
    const { productInterest, ...clientData } = dto
    if (productInterest && !clientData.suggestedProduct) {
      // Map productInterest (id) to product code
      const product = await this.prisma.product.findUnique({ where: { id: productInterest } })
      if (product) clientData.suggestedProduct = product.code
    }
    const client = await this.prisma.client.create({
      data: {
        ...clientData,
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
