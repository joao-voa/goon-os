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
    month?: number
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
      description: `Comissao parcela ${commission.installment}/${commission.totalInstallments} paga para ${commission.salesRep}`,
    })

    return {
      ...commission,
      percentage: Number(commission.percentage),
      baseValue: Number(commission.baseValue),
      value: Number(commission.value),
    }
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
    const commissions = payments.map(p => ({
      clientId,
      paymentId: p.id,
      salesRep,
      percentage,
      baseValue: p.value,
      value: Math.round(p.value * percentage) / 100,
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
