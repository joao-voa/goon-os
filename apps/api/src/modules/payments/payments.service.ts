import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ActivityLogService } from '../activity-log/activity-log.service'
import { NOT_CARTEIRA_CLIENT_FILTER } from '../../shared/constants'

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
  ) {}

  async getKpis() {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const [recebidoMes, totalPendente, totalVencido, totalPago, receitaTotal, receitaPorMes] = await this.prisma.$transaction([
      // Recebido este mês
      this.prisma.payment.aggregate({
        where: { status: 'PAID', paidAt: { gte: startOfMonth, lt: endOfMonth } },
        _sum: { value: true },
        _count: true,
      }),
      // Total pendente
      this.prisma.payment.aggregate({
        where: { status: 'PENDING', ...NOT_CARTEIRA_CLIENT_FILTER },
        _sum: { value: true },
        _count: true,
      }),
      // Total vencido
      this.prisma.payment.aggregate({
        where: { status: 'OVERDUE' },
        _sum: { value: true },
        _count: true,
      }),
      // Total pago (all time)
      this.prisma.payment.aggregate({
        where: { status: 'PAID' },
        _sum: { value: true },
        _count: true,
      }),
      // Receita total contratada (todos os planos ativos)
      this.prisma.clientPlan.aggregate({
        where: { status: 'ACTIVE' },
        _sum: { value: true },
      }),
      // A receber este mês (pendentes com vencimento no mês)
      this.prisma.payment.aggregate({
        where: { status: 'PENDING', dueDate: { gte: startOfMonth, lt: endOfMonth }, ...NOT_CARTEIRA_CLIENT_FILTER },
        _sum: { value: true },
        _count: true,
      }),
    ])

    return {
      recebidoMes: Number(recebidoMes._sum.value ?? 0),
      recebidoMesCount: recebidoMes._count,
      aReceberMes: Number(receitaPorMes._sum.value ?? 0),
      aReceberMesCount: receitaPorMes._count,
      totalPendente: Number(totalPendente._sum.value ?? 0),
      totalPendenteCount: totalPendente._count,
      totalVencido: Number(totalVencido._sum.value ?? 0),
      totalVencidoCount: totalVencido._count,
      totalPago: Number(totalPago._sum.value ?? 0),
      totalPagoCount: totalPago._count,
      receitaContratada: Number(receitaTotal._sum.value ?? 0),
    }
  }

  /**
   * Carteira de recebíveis (futuro), fora da carteira de recuperação.
   * Contratos (planos ativos) classificados por SAÚDE (em dia × atrasado)
   * e por VIGÊNCIA (vigente × encerrado a renovar). Recuperação excluída de tudo.
   */
  async getReceivables() {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Recebíveis futuros: parcelas PENDING a vencer, sem carteira de recuperação
    const [futuros, activePlans] = await Promise.all([
      this.prisma.payment.findMany({
        where: { status: 'PENDING', dueDate: { gte: today }, ...NOT_CARTEIRA_CLIENT_FILTER },
        select: { value: true, dueDate: true },
      }),
      this.prisma.clientPlan.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, clientId: true, value: true, endDate: true, product: { select: { code: true, name: true } }, client: { select: { companyName: true, leadStage: true } } },
      }),
    ])

    // recebíveis futuros por mês
    let futTotal = 0
    const byMonthMap = new Map<string, { total: number; count: number }>()
    for (const p of futuros) {
      const v = Number(p.value); futTotal += v
      const key = `${p.dueDate.getFullYear()}-${String(p.dueDate.getMonth() + 1).padStart(2, '0')}`
      const cur = byMonthMap.get(key) ?? { total: 0, count: 0 }
      cur.total += v; cur.count++; byMonthMap.set(key, cur)
    }
    const byMonth = [...byMonthMap.entries()].map(([month, x]) => ({ month, ...x })).sort((a, b) => a.month.localeCompare(b.month))

    // pagamentos dos clientes com plano ativo (pra saúde) + detectar quem está em recuperação
    const clientIds = [...new Set(activePlans.map(p => p.clientId))]
    const payments = clientIds.length ? await this.prisma.payment.findMany({
      where: { clientId: { in: clientIds }, status: { not: 'CANCELLED' } },
      select: { clientId: true, clientPlanId: true, status: true, dueDate: true, value: true, inCarteira: true },
    }) : []

    const recovery = new Set<string>()
    for (const p of activePlans) if (p.client.leadStage === 'RECUPERAR') recovery.add(p.clientId)
    for (const pay of payments) if (pay.inCarteira) recovery.add(pay.clientId)

    const plans = activePlans.filter(p => !recovery.has(p.clientId))
    const isOver = (pay: typeof payments[number]) => pay.status === 'OVERDUE' || (pay.status === 'PENDING' && pay.dueDate.getTime() < today.getTime())
    const planOverdue = (plan: typeof plans[number]) => {
      const own = payments.filter(x => x.clientPlanId === plan.id)
      const pool = own.length ? own : payments.filter(x => x.clientId === plan.clientId)
      return pool.filter(isOver)
    }

    const emDia: typeof plans = [], atrasados: { company: string; code: string; value: number; overdue: number; overdueCount: number }[] = []
    for (const p of plans) {
      const over = planOverdue(p)
      if (over.length === 0) { emDia.push(p); continue }
      atrasados.push({ company: p.client.companyName, code: p.product.code, value: Number(p.value), overdue: over.reduce((s, x) => s + Number(x.value), 0), overdueCount: over.length })
    }
    atrasados.sort((a, b) => b.overdue - a.overdue)

    const vigentes = plans.filter(p => !p.endDate || p.endDate.getTime() >= today.getTime())
    const encerrados = plans.filter(p => p.endDate && p.endDate.getTime() < today.getTime())
      .map(p => ({ company: p.client.companyName, code: p.product.code, value: Number(p.value), endDate: p.endDate! }))
      .sort((a, b) => a.endDate.getTime() - b.endDate.getTime())

    const sumV = (arr: { value: number }[]) => arr.reduce((s, x) => s + x.value, 0)
    return {
      futuros: { total: futTotal, count: futuros.length, byMonth },
      saude: {
        emDia: emDia.length,
        emDiaValor: emDia.reduce((s, p) => s + Number(p.value), 0),
        atrasados: atrasados.length,
        atrasadosValor: sumV(atrasados),
        atrasadoAReceber: atrasados.reduce((s, a) => s + a.overdue, 0),
        listaAtrasados: atrasados,
      },
      vigencia: {
        vigentes: vigentes.length,
        vigentesValor: vigentes.reduce((s, p) => s + Number(p.value), 0),
        encerrados: encerrados.length,
        encerradosValor: sumV(encerrados),
        listaEncerrados: encerrados,
      },
      recuperacaoExcluidos: recovery.size,
      totalContratos: plans.length,
    }
  }

  async findAll(params: {
    clientId?: string
    status?: string
    product?: string
    month?: number
    year?: number
    page?: number
    limit?: number
  }) {
    const { clientId, status, product, month, year, page = 1, limit = 20 } = params

    const where: Record<string, unknown> = {}
    if (clientId) where.clientId = clientId
    if (status) where.status = status
    if (product) {
      where.clientPlan = {
        product: { code: product.toUpperCase() },
      }
    }
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
      this.prisma.payment.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        skip,
        take: limit,
        include: {
          client: { select: { id: true, companyName: true } },
          clientPlan: { select: { id: true, product: { select: { code: true, name: true } } } },
        },
      }),
      this.prisma.payment.count({ where }),
    ])

    return {
      data: data.map(p => ({
        ...p,
        value: p.value.toNumber(),
        installmentNumber: p.installment,
        programName: p.clientPlan?.product?.name ?? null,
        productCode: p.clientPlan?.product?.code ?? null,
      })),
      total,
      page,
      limit,
    }
  }

  async findByClient(clientId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { clientId },
      orderBy: { dueDate: 'asc' },
      include: {
        client: { select: { id: true, companyName: true } },
        clientPlan: { select: { id: true, product: { select: { code: true, name: true } } } },
      },
    })

    return payments.map(p => ({
      ...p,
      value: p.value.toNumber(),
      installmentNumber: p.installment,
      programName: p.clientPlan?.product?.name ?? null,
      productCode: p.clientPlan?.product?.code ?? null,
    }))
  }

  async create(dto: {
    clientId: string
    clientPlanId?: string
    contractId?: string
    installment: number
    totalInstallments: number
    dueDate: Date | string
    value: number
    status?: string
    paidAt?: Date | string
    observation?: string
  }) {
    const payment = await this.prisma.payment.create({
      data: {
        clientId: dto.clientId,
        clientPlanId: dto.clientPlanId,
        contractId: dto.contractId,
        installment: dto.installment,
        totalInstallments: dto.totalInstallments,
        dueDate: new Date(dto.dueDate),
        value: dto.value,
        status: dto.status ?? 'PENDING',
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
        observation: dto.observation,
      },
    })

    await this.activityLog.log({
      clientId: payment.clientId,
      entityType: 'PAYMENT',
      entityId: payment.id,
      action: 'CREATED',
      description: `Parcela ${payment.installment}/${payment.totalInstallments} criada — vencimento ${new Date(payment.dueDate).toLocaleDateString('pt-BR')}`,
    })

    return { ...payment, value: payment.value.toNumber() }
  }

  async createBulk(
    clientId: string,
    planId: string | undefined,
    params: {
      totalInstallments: number
      value: number
      startDate: Date | string
      paymentDay: number
      contractId?: string
      labelTotal?: number // "/N" mostrado (quando difere da qtd criada, ex.: há entrada)
    },
  ) {
    const { totalInstallments, value, startDate, paymentDay, contractId } = params
    const labelTotal = params.labelTotal ?? totalInstallments

    const start = new Date(startDate)
    const payments: Array<{
      clientId: string
      clientPlanId: string | null
      contractId: string | null
      installment: number
      totalInstallments: number
      dueDate: Date
      value: number
      status: string
    }> = []

    for (let i = 0; i < totalInstallments; i++) {
      const dueDate = new Date(start.getFullYear(), start.getMonth() + i, paymentDay)
      payments.push({
        clientId,
        clientPlanId: planId ?? null,
        contractId: contractId ?? null,
        installment: i + 1,
        totalInstallments: labelTotal,
        dueDate,
        value,
        status: 'PENDING',
      })
    }

    const created = await this.prisma.$transaction(
      payments.map(p => this.prisma.payment.create({ data: p })),
    )

    await this.activityLog.log({
      clientId,
      entityType: 'PAYMENT',
      entityId: planId ?? clientId,
      action: 'BULK_CREATED',
      description: `${totalInstallments} parcelas criadas`,
    })

    return created.map(p => ({ ...p, value: p.value.toNumber() }))
  }

  async update(
    id: string,
    dto: {
      dueDate?: Date | string
      value?: number
      status?: string
      paidAt?: Date | string
      observation?: string
    },
  ) {
    const existing = await this.prisma.payment.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Payment ${id} not found`)

    const payment = await this.prisma.payment.update({
      where: { id },
      data: {
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        value: dto.value,
        status: dto.status,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
        observation: dto.observation,
      },
    })

    return { ...payment, value: payment.value.toNumber() }
  }

  async markAsPaid(id: string, paidAt?: Date | string) {
    const existing = await this.prisma.payment.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Payment ${id} not found`)

    const payment = await this.prisma.payment.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: paidAt ? new Date(paidAt) : new Date(),
      },
    })

    await this.activityLog.log({
      clientId: payment.clientId,
      entityType: 'PAYMENT',
      entityId: payment.id,
      action: 'PAID',
      fromValue: 'PENDING',
      toValue: 'PAID',
      description: `Parcela ${payment.installment}/${payment.totalInstallments} marcada como paga`,
    })

    return { ...payment, value: payment.value.toNumber() }
  }

  async toggleCarteira(id: string, inCarteira: boolean) {
    const existing = await this.prisma.payment.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Payment ${id} not found`)
    const payment = await this.prisma.payment.update({ where: { id }, data: { inCarteira } })
    return { ...payment, value: payment.value.toNumber() }
  }

  async markAsOverdue() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const result = await this.prisma.payment.updateMany({
      where: {
        status: 'PENDING',
        dueDate: { lt: today },
      },
      data: { status: 'OVERDUE' },
    })

    return { updated: result.count }
  }
}
