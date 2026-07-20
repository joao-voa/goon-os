import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ActivityLogService } from '../activity-log/activity-log.service'
import { PaymentsService } from '../payments/payments.service'
import { CommissionsService } from '../commissions/commissions.service'
import { ExpensesService } from '../expenses/expenses.service'
import { TAX_RATE, getNextCommissionPaymentDate } from '../../shared/constants'

// Leads mais antigos que esta data não são reimportados no sync (já entraram)
const SYNC_CUTOFF = new Date('2026-07-15T00:00:00Z')

const VALID_LEAD_STAGES = [
  'NOVO',
  'RECUPERAR',
  'FUP',
  'QUALIFICADO',
  'REUNIAO_AGENDADA',
  'PROPOSTA_ENVIADA',
  'EM_NEGOCIACAO',
  'FECHADO',
  'PERDIDO',
]

const STAGE_LABELS: Record<string, string> = {
  NOVO: 'Novo',
  FOLLOW_UP: 'Conexao',
  FUP: 'Conexao',
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

  async findPipeline(params: { salesRep?: string; leadSource?: string; cardResponsible?: string }) {
    const { salesRep, leadSource, cardResponsible } = params

    const where: Record<string, unknown> = {
      leadStage: { not: null },
    }

    if (salesRep) where.salesRep = salesRep
    if (leadSource) where.leadSource = leadSource
    if (cardResponsible) where.cardResponsible = cardResponsible

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
        entryValue: true,
        leadNotes: true,
        selectedModules: true,
        estimatedRevenue: true,
        segment: true,
        suggestedProduct: true,
        cardResponsible: true,
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

    return leads.map(lead => {
      const fat = CrmService.parseMonthlyRevenue(lead.estimatedRevenue)
      return {
        ...lead,
        saleValue: lead.saleValue ? Number(lead.saleValue) : null,
        installmentValue: lead.installmentValue ? Number(lead.installmentValue) : null,
        entryValue: lead.entryValue ? Number(lead.entryValue) : null,
        productCode: lead.plans[0]?.product?.code ?? null,
        faturamentoBand: CrmService.revenueBand(fat),
        isICP: CrmService.isICP(fat),
        plans: undefined,
      }
    })
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
        entryValue: dto.entryValue && dto.entryValue > 0 ? dto.entryValue : null,
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
          totalInstallments: dto.saleInstallments,
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
      // entrada conta como 1 das parcelas: 12x com entrada = entrada + 11 regulares
      totalInstallments: entryPayment ? dto.saleInstallments - 1 : dto.saleInstallments,
      labelTotal: dto.saleInstallments,
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
    userId?: string
    userName?: string
    scheduledAt?: Date | string
  }) {
    // Autor: resolve o nome pelo usuário logado (JWT)
    let userName = dto.userName
    if (dto.userId && !userName) {
      const u = await this.prisma.user.findUnique({ where: { id: dto.userId }, select: { name: true, email: true } })
      userName = u?.name ?? u?.email ?? undefined
    }
    const interaction = await this.prisma.leadInteraction.create({
      data: {
        clientId: dto.clientId,
        type: dto.type,
        description: dto.description,
        userId: dto.userId,
        userName,
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

  async getMetrics(params: { faturamento?: string } = {}) {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // All prospects (anyone that ever entered the pipeline)
    const allProspects = await this.prisma.client.findMany({
      where: { leadStage: { not: null } },
      select: { id: true, leadStage: true, leadSource: true, salesRep: true, stageChangedAt: true, createdAt: true, closedAt: true, saleValue: true, estimatedRevenue: true },
    })

    // Faturamento / ICP filter (does not change unfiltered ICP split below)
    const filter = params.faturamento
    const prospects = filter && filter !== 'ALL'
      ? allProspects.filter(p => {
          const v = CrmService.parseMonthlyRevenue(p.estimatedRevenue)
          if (filter === 'ICP') return CrmService.isICP(v)
          if (filter === 'FORA') return v !== null && !CrmService.isICP(v)
          if (filter === 'NAO_INFORMADO') return v === null
          return CrmService.revenueBand(v) === filter
        })
      : allProspects

    const norm = (s: string | null) => (s === 'FOLLOW_UP' ? 'FUP' : s)

    // ---- Count by current stage ----
    const byStage: Record<string, number> = {}
    for (const p of prospects) {
      const st = norm(p.leadStage)!
      byStage[st] = (byStage[st] ?? 0) + 1
    }

    // ---- Funnel (cumulative "reached" among non-lost leads) ----
    // A lead at stage N is counted as having passed every earlier stage.
    const nonLost = prospects.filter(p => norm(p.leadStage) !== 'PERDIDO')
    const reached: Record<string, number> = {}
    for (const stage of CrmService.PIPE) reached[stage] = 0
    for (const p of nonLost) {
      const idx = CrmService.PIPE.indexOf(norm(p.leadStage)!)
      if (idx < 0) continue
      for (let i = 0; i <= idx; i++) reached[CrmService.PIPE[i]]++
    }
    const funnel = CrmService.PIPE.map((stage, i) => {
      const count = reached[stage]
      const prev = i > 0 ? reached[CrmService.PIPE[i - 1]] : null
      const conversionFromPrev = prev && prev > 0 ? Math.round((count / prev) * 100) : null
      return { stage, count, conversionFromPrev }
    })
    // Bottleneck = lowest conversion between consecutive stages
    let bottleneck: string | null = null
    let worst = Infinity
    for (const f of funnel) {
      if (f.conversionFromPrev !== null && f.conversionFromPrev < worst) {
        worst = f.conversionFromPrev
        bottleneck = f.stage
      }
    }

    // ---- Cards ----
    const stageCount = (s: string) => byStage[s] ?? 0
    const closedAll = prospects.filter(p => norm(p.leadStage) === 'FECHADO')
    const closedValueTotal = closedAll.reduce((s, p) => s + Number(p.saleValue ?? 0), 0)
    const closedCountTotal = closedAll.length
    const ticketMedio = closedCountTotal > 0 ? Math.round(closedValueTotal / closedCountTotal) : 0

    const activeLeads = prospects.filter(p => !['FECHADO', 'PERDIDO'].includes(norm(p.leadStage)!))
    const newThisMonth = prospects.filter(p => p.createdAt >= startOfMonth).length
    const closedThisMonthArr = prospects.filter(p => norm(p.leadStage) === 'FECHADO' && p.closedAt && p.closedAt >= startOfMonth)
    const closedCount = closedThisMonthArr.length
    const closedValue = closedThisMonthArr.reduce((sum, p) => sum + Number(p.saleValue ?? 0), 0)
    const lostThisMonth = prospects.filter(p => norm(p.leadStage) === 'PERDIDO' && p.stageChangedAt && p.stageChangedAt >= startOfMonth).length

    const cards = {
      leadsAtivos: activeLeads.length,
      novosNoPeriodo: newThisMonth,
      qualificados: stageCount('QUALIFICADO'),
      reunioesAgendadas: stageCount('REUNIAO_AGENDADA'),
      propostasEnviadas: stageCount('PROPOSTA_ENVIADA'),
      emNegociacao: stageCount('EM_NEGOCIACAO'),
      fechadosGanho: stageCount('FECHADO'),
      fechadosPerdido: stageCount('PERDIDO'),
      valorTotalFechado: closedValueTotal,
      ticketMedio,
    }

    // ---- Conversion rate (won vs decided, this month) ----
    const totalWithOutcome = closedCount + lostThisMonth
    const conversionRate = totalWithOutcome > 0 ? Math.round((closedCount / totalWithOutcome) * 100) : 0

    // Average days in current stage
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
      if (norm(p.leadStage) === 'FECHADO') {
        repStats[rep].closed++
        repStats[rep].value += Number(p.saleValue ?? 0)
      }
      if (norm(p.leadStage) === 'PERDIDO') repStats[rep].lost++
    }

    // Stale leads (> 7 days without movement)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const staleLeads = activeLeads.filter(p => {
      const from = p.stageChangedAt ?? p.createdAt
      return from < sevenDaysAgo
    }).length

    const pendingFollowUps = await this.prisma.leadInteraction.count({
      where: { scheduledAt: { gte: now }, type: 'FOLLOW_UP' },
    })

    // ---- Lead source breakdown (volume + quality) ----
    const qIdx = CrmService.PIPE.indexOf('QUALIFICADO')
    const sourceMap: Record<string, { leads: number; qualified: number; closed: number; lostCount: number }> = {}
    for (const p of prospects) {
      const src = p.leadSource ?? 'nao_informado'
      if (!sourceMap[src]) sourceMap[src] = { leads: 0, qualified: 0, closed: 0, lostCount: 0 }
      sourceMap[src].leads++
      const stage = norm(p.leadStage)!
      const idx = CrmService.PIPE.indexOf(stage)
      if (stage !== 'PERDIDO' && idx >= qIdx) sourceMap[src].qualified++
      if (stage === 'FECHADO') sourceMap[src].closed++
      if (stage === 'PERDIDO') sourceMap[src].lostCount++
    }
    const bySource = Object.entries(sourceMap)
      .map(([source, v]) => ({
        source,
        leads: v.leads,
        qualified: v.qualified,
        closed: v.closed,
        conversion: v.leads > 0 ? Math.round((v.closed / v.leads) * 100) : 0,
      }))
      .sort((a, b) => b.closed - a.closed || b.leads - a.leads)

    // ---- ICP split (always over the unfiltered base) ----
    let icpDentro = 0, icpFora = 0, icpNaoInformado = 0
    const byBand: Record<string, number> = {}
    for (const p of allProspects) {
      const v = CrmService.parseMonthlyRevenue(p.estimatedRevenue)
      const band = CrmService.revenueBand(v)
      byBand[band] = (byBand[band] ?? 0) + 1
      if (v === null) icpNaoInformado++
      else if (CrmService.isICP(v)) icpDentro++
      else icpFora++
    }

    // ---- Meetings block (current month) ----
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const monthMeetings = await this.prisma.meeting.findMany({
      where: { date: { gte: startOfMonth, lt: monthEnd } },
      select: { status: true },
    })
    const mCount = (s: string) => monthMeetings.filter(m => m.status === s).length
    const mtgDone = mCount('DONE')
    const mtgCancelled = mCount('CANCELLED')
    const mtgRescheduled = mCount('RESCHEDULED')
    const mtgNoShow = mCount('NO_SHOW')
    const mtgScheduled = mCount('SCHEDULED')
    const mtgTotal = monthMeetings.length
    const meetings = {
      agendadas: mtgTotal,
      feitas: mtgDone,
      canceladas: mtgCancelled,
      reagendadas: mtgRescheduled,
      noShow: mtgNoShow,
      scheduled: mtgScheduled,
      showRate: mtgTotal > 0 ? Math.round((mtgDone / mtgTotal) * 100) : 0,
      feitasPct: mtgTotal > 0 ? Math.round((mtgDone / mtgTotal) * 100) : 0,
      canceladasPct: mtgTotal > 0 ? Math.round((mtgCancelled / mtgTotal) * 100) : 0,
      reagendadasPct: mtgTotal > 0 ? Math.round((mtgRescheduled / mtgTotal) * 100) : 0,
    }

    return {
      // ---- new structured blocks ----
      cards,
      funnel,
      bottleneck,
      meetings,
      bySource,
      icp: { dentro: icpDentro, fora: icpFora, naoInformado: icpNaoInformado, byBand },
      filterApplied: filter ?? 'ALL',
      // ---- legacy fields (kept for compatibility) ----
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

  // ===== Faturamento / ICP helpers =====
  static readonly PIPE = ['NOVO', 'FUP', 'QUALIFICADO', 'REUNIAO_AGENDADA', 'PROPOSTA_ENVIADA', 'EM_NEGOCIACAO', 'FECHADO']
  static readonly ICP_THRESHOLD = 100000 // R$/mês

  /** Best-effort parse of messy free-text monthly revenue into a number (R$/mês). Returns null when unparseable. */
  static parseMonthlyRevenue(raw: string | null | undefined): number | null {
    if (!raw) return null
    let s = String(raw).toLowerCase().trim()
    if (!s) return null
    const original = s
    // "até X" expresses an upper bound — should land in the band *below* X
    // \b não funciona após "é" acentuado; usa fronteira por espaço/início/fim
    const isUpperBound = /(?:^|\s)at[eé](?:\s|$)/.test(original) && !/entre/.test(original)
    // obvious junk / non-answers
    if (/^(0|n[aã]o sei|nao informado|hoje|come[cç]ando|estou come[cç]ando|estamos|comecei|sim|nao|teste)/.test(s)) {
      if (s === '0') return null
    }
    // strip currency + period markers
    s = s.replace(/r\$|\$|\/m[eê]s|por m[eê]s|ao m[eê]s|mensal|mensais|\/ano|anual/g, ' ')

    // detect range "entre X e Y" -> use lower bound X
    const rangeMatch = s.match(/entre(.+?)\be\b(.+)/)
    if (rangeMatch) s = rangeMatch[1]
    // "acima de" / "+" / ">" keep the number as floor
    s = s.replace(/acima de|mais de|>=?|\+/g, ' ')

    // find first numeric token
    const numMatch = s.match(/(\d[\d.,]*)/)
    if (!numMatch) return null
    let token = numMatch[1]

    // multiplier from surrounding text
    let mult = 1
    const after = s.slice(s.indexOf(token) + token.length, s.indexOf(token) + token.length + 12)
    const ctx = (token + ' ' + after)
    if (/\bmm\b|\bmi\b|milh|\bm\b|mtoi|milhao|milhões|milhoes/.test(ctx)) mult = 1_000_000
    else if (/\bk\b|mil\b|\bmil/.test(ctx)) mult = 1_000

    // normalize number formatting
    const hasDot = token.includes('.')
    const hasComma = token.includes(',')
    if (hasDot && hasComma) {
      // 1.200.000,00 -> dots thousands, comma decimal
      token = token.replace(/\./g, '').replace(',', '.')
    } else if (hasComma) {
      token = token.replace(',', '.')
    } else if (hasDot) {
      // ambiguous: "1.2" (decimal, with multiplier) vs "200.000" (thousands)
      if (mult > 1) {
        // keep as decimal
      } else {
        token = token.replace(/\./g, '')
      }
    }
    let value = parseFloat(token)
    if (isNaN(value)) return null
    value = value * mult
    // "até X" -> nudge below X so it bands as up-to-X
    if (isUpperBound) value -= 1

    // sanity bounds: ignore absurd or trivially small
    if (value < 100 || value > 5_000_000_000) return null
    return Math.round(value)
  }

  static revenueBand(value: number | null): string {
    if (value === null) return 'NAO_INFORMADO'
    if (value < 50_000) return 'ATE_50K'
    if (value < 100_000) return '50_100K'
    if (value < 500_000) return '100_500K'
    if (value < 1_000_000) return '500K_1M'
    return 'ACIMA_1M'
  }

  static isICP(value: number | null): boolean {
    return value !== null && value >= CrmService.ICP_THRESHOLD
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

            // Corte de importação: leads mais antigos que 15/07/2026 já foram
            // importados — não sobem de novo.
            if (lead.createdAt && new Date(lead.createdAt) < SYNC_CUTOFF) {
              skipped++
              continue
            }

            // Skip spam/invalid leads
            if (this.isSpamLead(lead, record)) {
              skipped++
              continue
            }

            // Check duplicate by email, whatsapp, or companyName
            const orConditions: Array<Record<string, unknown>> = []
            if (lead.email) orConditions.push({ email: lead.email })
            if (lead.whatsapp) orConditions.push({ whatsapp: lead.whatsapp })
            if (lead.companyName) orConditions.push({ companyName: lead.companyName })

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
      `Plataforma: ${platform === 'fb' ? 'Facebook' : 'Instagram'}`,
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
      leadSource: 'meta_ads',
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
      leadSource: 'respondi',
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
    // Name is a single letter repeated (nnnn, jjj, aaaa) — junk/test entry
    const letters = name.replace(/[^a-zà-ú]/gi, '')
    if (letters.length >= 2 && new Set(letters).size === 1) return true
    // Responsible/contact name is also single-letter junk (e.g. "Jjj")
    const respLetters = (lead.responsible || '').toLowerCase().replace(/[^a-zà-ú]/gi, '')
    if (letters.length <= 4 && respLetters.length >= 2 && new Set(respLetters).size === 1) return true
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
    estimatedRevenue?: string
    productInterest?: string
    suggestedProduct?: string
    cardResponsible?: string
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
