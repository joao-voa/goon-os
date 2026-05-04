import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ActivityLogService } from '../activity-log/activity-log.service'
import { getNextCommissionPaymentDate, getNextClosingCutoff } from '../../shared/constants'

@Injectable()
export class CommissionsService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
  ) {}

  async findAll(params: {
    salesRep?: string
    status?: string
    clientId?: string
    month?: number
    year?: number
    page?: number
    limit?: number
  }) {
    const { salesRep, status, clientId, month, year, page = 1, limit = 20 } = params
    const where: Record<string, unknown> = {}

    if (salesRep) where.salesRep = salesRep
    if (status) where.status = status
    if (clientId) where.clientId = clientId

    // Filter by paidAt for paid commissions, payment.dueDate for pending
    if (month && year) {
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 1)
      where.OR = [
        { status: 'PAID', paidAt: { gte: start, lt: end } },
        { status: { not: 'PAID' }, payment: { dueDate: { gte: start, lt: end } } },
      ]
    } else if (year) {
      const start = new Date(year, 0, 1)
      const end = new Date(year + 1, 0, 1)
      where.OR = [
        { status: 'PAID', paidAt: { gte: start, lt: end } },
        { status: { not: 'PAID' }, payment: { dueDate: { gte: start, lt: end } } },
      ]
    }

    const skip = (page - 1) * limit

    const [data, total] = await this.prisma.$transaction([
      this.prisma.commission.findMany({
        where,
        orderBy: { payment: { dueDate: 'asc' } },
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
      where.payment = { dueDate: { gte: start, lt: end } }
    }

    // Fetch all commissions for the period and aggregate in JS
    const allCommissions = await this.prisma.commission.findMany({
      where,
      select: { salesRep: true, status: true, value: true },
    })

    let totalToPaySum = 0, totalToPayCount = 0
    let totalPaidSum = 0, totalPaidCount = 0
    const reps: Record<string, { pending: number; paid: number; cancelled: number }> = {}

    for (const c of allCommissions) {
      const val = Number(c.value)
      if (c.status === 'PENDING') { totalToPaySum += val; totalToPayCount++ }
      if (c.status === 'PAID') { totalPaidSum += val; totalPaidCount++ }

      if (!reps[c.salesRep]) reps[c.salesRep] = { pending: 0, paid: 0, cancelled: 0 }
      const key = c.status.toLowerCase() as 'pending' | 'paid' | 'cancelled'
      reps[c.salesRep][key] += val
    }

    const now = new Date()
    const paymentDate = getNextCommissionPaymentDate(now)
    const nextClosingDate = getNextClosingCutoff(now)

    // Commissions for current closing period (pending, created before closing cutoff)
    const closingCommissions = await this.prisma.commission.aggregate({
      where: {
        status: 'PENDING',
        createdAt: { lte: nextClosingDate },
      },
      _sum: { value: true },
      _count: true,
    })

    // Future commissions (pending, created after closing cutoff)
    const futureCommissions = await this.prisma.commission.aggregate({
      where: {
        status: 'PENDING',
        createdAt: { gt: nextClosingDate },
      },
      _sum: { value: true },
      _count: true,
    })

    return {
      totalToPay: totalToPaySum,
      totalToPayCount: totalToPayCount,
      totalPaid: totalPaidSum,
      totalPaidCount: totalPaidCount,
      bySalesRep: reps,
      closing: {
        cutoffDate: nextClosingDate.toISOString(),
        paymentDate: paymentDate.toISOString(),
        amount: Number(closingCommissions._sum.value ?? 0),
        count: closingCommissions._count,
      },
      future: {
        amount: Number(futureCommissions._sum.value ?? 0),
        count: futureCommissions._count,
      },
    }
  }

  async createManual(dto: {
    clientId: string
    salesRep: string
    percentage: number
    baseValue: number
    installments: number
  }) {
    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } })
    if (!client) throw new NotFoundException(`Cliente ${dto.clientId} nao encontrado`)

    // Find first payment for this client (or create without payment link)
    const payments = await this.prisma.payment.findMany({
      where: { clientId: dto.clientId, status: { in: ['PENDING', 'SCHEDULED'] } },
      orderBy: { dueDate: 'asc' },
      take: dto.installments,
    })

    if (payments.length === 0) {
      throw new BadRequestException('Este cliente nao possui pagamentos. Crie pagamentos antes de atribuir comissoes.')
    }

    const results: Awaited<ReturnType<typeof this.prisma.commission.create>>[] = []
    for (let i = 0; i < dto.installments; i++) {
      const payment = payments[i] ?? payments[0]
      const liquidValue = dto.baseValue * (1 - 0.06)
      const commissionValue = Math.round(liquidValue * dto.percentage) / 100

      const created = await this.prisma.commission.create({
        data: {
          clientId: dto.clientId,
          paymentId: payment.id,
          salesRep: dto.salesRep,
          percentage: dto.percentage,
          baseValue: dto.baseValue,
          value: commissionValue,
          installment: i + 1,
          totalInstallments: dto.installments,
          status: 'PENDING',
        },
      })
      results.push(created)
    }

    await this.activityLog.log({
      clientId: dto.clientId,
      entityType: 'COMMISSION',
      entityId: dto.clientId,
      action: 'MANUAL_CREATED',
      description: `${results.length} comissoes manuais criadas para ${dto.salesRep} (${dto.percentage}%) — ${client.companyName}`,
    })

    return results.map(c => ({
      ...c,
      percentage: Number(c.percentage),
      baseValue: Number(c.baseValue),
      value: Number(c.value),
    }))
  }

  async updateCommission(id: string, dto: {
    salesRep?: string
    percentage?: number
    baseValue?: number
    value?: number
  }) {
    const existing = await this.prisma.commission.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Comissao ${id} nao encontrada`)

    const data: Record<string, unknown> = {}
    if (dto.salesRep !== undefined) data.salesRep = dto.salesRep
    if (dto.percentage !== undefined) data.percentage = dto.percentage
    if (dto.baseValue !== undefined) data.baseValue = dto.baseValue

    // Recalculate value if percentage or baseValue changed
    if (dto.value !== undefined) {
      data.value = dto.value
    } else if (dto.percentage !== undefined || dto.baseValue !== undefined) {
      const pct = dto.percentage ?? Number(existing.percentage)
      const base = dto.baseValue ?? Number(existing.baseValue)
      data.value = Math.round(base * pct) / 100
    }

    const updated = await this.prisma.commission.update({ where: { id }, data })

    return {
      ...updated,
      percentage: Number(updated.percentage),
      baseValue: Number(updated.baseValue),
      value: Number(updated.value),
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
      description: `Comissao parcela ${commission.installment}/${commission.totalInstallments} paga para ${commission.salesRep}`,
    })

    return {
      ...commission,
      percentage: Number(commission.percentage),
      baseValue: Number(commission.baseValue),
      value: Number(commission.value),
    }
  }

  async revertToPending(id: string) {
    const existing = await this.prisma.commission.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Commission ${id} not found`)

    const commission = await this.prisma.commission.update({
      where: { id },
      data: { status: 'PENDING', paidAt: null },
    })

    await this.activityLog.log({
      clientId: commission.clientId,
      entityType: 'COMMISSION',
      entityId: commission.id,
      action: 'REVERTED',
      fromValue: 'PAID',
      toValue: 'PENDING',
      description: `Comissao parcela ${commission.installment}/${commission.totalInstallments} revertida para pendente`,
    })

    return {
      ...commission,
      percentage: Number(commission.percentage),
      baseValue: Number(commission.baseValue),
      value: Number(commission.value),
    }
  }

  async remove(id: string) {
    const existing = await this.prisma.commission.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Commission ${id} not found`)
    await this.prisma.commission.delete({ where: { id } })
    return { deleted: true }
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
        description: `${result.count} comissoes pendentes canceladas por cancelamento do cliente`,
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
    const TAX = 0.06
    const commissions = payments.map(p => {
      const liquidValue = p.value * (1 - TAX)
      return {
      clientId,
      paymentId: p.id,
      salesRep,
      percentage,
      baseValue: p.value,
      value: Math.round(liquidValue * percentage) / 100,
      installment: p.installment,
      totalInstallments: p.totalInstallments,
      status: 'PENDING',
    }})

    const created = await this.prisma.$transaction(
      commissions.map(c => this.prisma.commission.create({ data: c })),
    )

    await this.activityLog.log({
      clientId,
      entityType: 'COMMISSION',
      entityId: clientId,
      action: 'BULK_CREATED',
      description: `${created.length} comissoes criadas para ${salesRep} (${percentage}%)`,
    })

    return created.map(c => ({
      ...c,
      percentage: Number(c.percentage),
      baseValue: Number(c.baseValue),
      value: Number(c.value),
    }))
  }
}
