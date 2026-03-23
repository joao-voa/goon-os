import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ActivityLogService } from '../activity-log/activity-log.service'

@Injectable()
export class PendenciesService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
  ) {}

  async findAll(params: { status?: string; type?: string; clientId?: string }) {
    const { status, type, clientId } = params

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (type) where.type = type
    if (clientId) where.clientId = clientId

    const pendencies = await this.prisma.pendency.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, companyName: true } },
      },
    })

    return pendencies
  }

  async create(dto: {
    clientId: string
    type: string
    status?: string
    description?: string
    relatedId?: string
  }) {
    const pendency = await this.prisma.pendency.create({
      data: {
        clientId: dto.clientId,
        type: dto.type,
        status: dto.status ?? 'OPEN',
        description: dto.description,
        relatedId: dto.relatedId,
      },
    })

    return pendency
  }

  async update(
    id: string,
    dto: {
      status?: string
      description?: string
      type?: string
    },
  ) {
    const existing = await this.prisma.pendency.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Pendency ${id} not found`)

    return this.prisma.pendency.update({ where: { id }, data: dto })
  }

  async resolve(id: string) {
    const existing = await this.prisma.pendency.findUnique({
      where: { id },
      include: { client: { select: { id: true } } },
    })
    if (!existing) throw new NotFoundException(`Pendency ${id} not found`)

    const pendency = await this.prisma.pendency.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    })

    await this.activityLog.log({
      clientId: existing.client.id,
      entityType: 'PENDENCY',
      entityId: id,
      action: 'RESOLVED',
      fromValue: 'OPEN',
      toValue: 'RESOLVED',
      description: `Pendência ${existing.type} resolvida`,
    })

    return pendency
  }

  async generateAutomatic(): Promise<number> {
    let newCount = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dueSoonThreshold = new Date(today)
    dueSoonThreshold.setDate(dueSoonThreshold.getDate() + 5)

    const renewalThreshold = new Date(today)
    renewalThreshold.setDate(renewalThreshold.getDate() + 90)

    // Helper: check if open pendency already exists
    const exists = async (type: string, clientId: string, relatedId?: string) => {
      const existing = await this.prisma.pendency.findFirst({
        where: {
          type,
          clientId,
          relatedId: relatedId ?? null,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      })
      return !!existing
    }

    // 1. CONTRACT_UNSIGNED: contracts where isSigned = false
    const unsignedContracts = await this.prisma.contract.findMany({
      where: { isSigned: false, status: { not: 'CANCELLED' } },
      select: { id: true, clientId: true },
    })

    for (const contract of unsignedContracts) {
      if (!(await exists('CONTRACT_UNSIGNED', contract.clientId, contract.id))) {
        await this.prisma.pendency.create({
          data: {
            clientId: contract.clientId,
            type: 'CONTRACT_UNSIGNED',
            status: 'OPEN',
            description: 'Contrato não assinado',
            relatedId: contract.id,
          },
        })
        newCount++
      }
    }

    // 2. PAYMENT_OVERDUE: payments with status OVERDUE
    const overduePayments = await this.prisma.payment.findMany({
      where: { status: 'OVERDUE' },
      select: { id: true, clientId: true },
    })

    for (const payment of overduePayments) {
      if (!(await exists('PAYMENT_OVERDUE', payment.clientId, payment.id))) {
        await this.prisma.pendency.create({
          data: {
            clientId: payment.clientId,
            type: 'PAYMENT_OVERDUE',
            status: 'OPEN',
            description: 'Boleto vencido sem pagamento',
            relatedId: payment.id,
          },
        })
        newCount++
      }
    }

    // 3. PAYMENT_DUE_SOON: PENDING payments with dueDate within 5 days
    const dueSoonPayments = await this.prisma.payment.findMany({
      where: {
        status: 'PENDING',
        dueDate: { gte: today, lte: dueSoonThreshold },
      },
      select: { id: true, clientId: true },
    })

    for (const payment of dueSoonPayments) {
      if (!(await exists('PAYMENT_DUE_SOON', payment.clientId, payment.id))) {
        await this.prisma.pendency.create({
          data: {
            clientId: payment.clientId,
            type: 'PAYMENT_DUE_SOON',
            status: 'OPEN',
            description: 'Boleto vence em breve',
            relatedId: payment.id,
          },
        })
        newCount++
      }
    }

    // 4. RENEWAL_PENDING: clients where plan endDate is within 90 days
    const renewalPlans = await this.prisma.clientPlan.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { gte: today, lte: renewalThreshold },
      },
      select: { id: true, clientId: true, endDate: true },
    })

    for (const plan of renewalPlans) {
      if (!(await exists('RENEWAL_PENDING', plan.clientId, plan.id))) {
        await this.prisma.pendency.create({
          data: {
            clientId: plan.clientId,
            type: 'RENEWAL_PENDING',
            status: 'OPEN',
            description: 'Contrato próximo do vencimento — renovação necessária',
            relatedId: plan.id,
          },
        })
        newCount++
      }
    }

    return newCount
  }
}
