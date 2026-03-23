import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ActivityLogService } from '../activity-log/activity-log.service'

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
  ) {}

  async findAll(params: {
    clientId?: string
    status?: string
    product?: string
    page?: number
    limit?: number
  }) {
    const { clientId, status, product, page = 1, limit = 20 } = params

    const where: Record<string, unknown> = {}
    if (clientId) where.clientId = clientId
    if (status) where.status = status
    if (product) {
      where.clientPlan = {
        product: { code: product.toUpperCase() },
      }
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
      data: data.map(p => ({ ...p, value: p.value.toNumber() })),
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

    return payments.map(p => ({ ...p, value: p.value.toNumber() }))
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
    },
  ) {
    const { totalInstallments, value, startDate, paymentDay, contractId } = params

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
        totalInstallments,
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
