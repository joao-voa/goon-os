import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ActivityLogService } from '../activity-log/activity-log.service'

@Injectable()
export class PendenciesService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
  ) {}

  async findAll(params: {
    status?: string
    type?: string
    clientId?: string
    page?: number
    limit?: number
  }) {
    const { status, type, clientId, page = 1, limit = 50 } = params

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (type) where.type = type
    if (clientId) where.clientId = clientId

    const skip = (page - 1) * limit

    const [data, total] = await this.prisma.$transaction([
      this.prisma.pendency.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          client: { select: { id: true, companyName: true } },
        },
      }),
      this.prisma.pendency.count({ where }),
    ])

    return { data, total, page, limit }
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

    // Fetch ALL open/in-progress pendencies upfront (single query)
    const existingPendencies = await this.prisma.pendency.findMany({
      where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      select: { type: true, clientId: true, relatedId: true },
    })

    // Build a Set for O(1) lookups
    const existsSet = new Set(
      existingPendencies.map(p => `${p.type}|${p.clientId}|${p.relatedId ?? ''}`),
    )

    const exists = (type: string, clientId: string, relatedId?: string) =>
      existsSet.has(`${type}|${clientId}|${relatedId ?? ''}`)

    // 1. CONTRACT_UNSIGNED
    const unsignedContracts = await this.prisma.contract.findMany({
      where: { isSigned: false, status: { not: 'CANCELLED' } },
      select: { id: true, clientId: true },
    })

    // 2. PAYMENT_OVERDUE
    const overduePayments = await this.prisma.payment.findMany({
      where: { status: 'OVERDUE' },
      select: { id: true, clientId: true },
    })

    // 3. PAYMENT_DUE_SOON
    const dueSoonPayments = await this.prisma.payment.findMany({
      where: {
        status: 'PENDING',
        dueDate: { gte: today, lte: dueSoonThreshold },
      },
      select: { id: true, clientId: true },
    })

    // 4. RENEWAL_PENDING
    const renewalPlans = await this.prisma.clientPlan.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { gte: today, lte: renewalThreshold },
      },
      select: { id: true, clientId: true },
    })

    // Collect all new pendencies to create in a single transaction
    const toCreate: Array<{
      clientId: string
      type: string
      status: string
      description: string
      relatedId: string | null
    }> = []

    for (const contract of unsignedContracts) {
      if (!exists('CONTRACT_UNSIGNED', contract.clientId, contract.id)) {
        toCreate.push({
          clientId: contract.clientId,
          type: 'CONTRACT_UNSIGNED',
          status: 'OPEN',
          description: 'Contrato não assinado',
          relatedId: contract.id,
        })
      }
    }

    for (const payment of overduePayments) {
      if (!exists('PAYMENT_OVERDUE', payment.clientId, payment.id)) {
        toCreate.push({
          clientId: payment.clientId,
          type: 'PAYMENT_OVERDUE',
          status: 'OPEN',
          description: 'Boleto vencido sem pagamento',
          relatedId: payment.id,
        })
      }
    }

    for (const payment of dueSoonPayments) {
      if (!exists('PAYMENT_DUE_SOON', payment.clientId, payment.id)) {
        toCreate.push({
          clientId: payment.clientId,
          type: 'PAYMENT_DUE_SOON',
          status: 'OPEN',
          description: 'Boleto vence em breve',
          relatedId: payment.id,
        })
      }
    }

    for (const plan of renewalPlans) {
      if (!exists('RENEWAL_PENDING', plan.clientId, plan.id)) {
        toCreate.push({
          clientId: plan.clientId,
          type: 'RENEWAL_PENDING',
          status: 'OPEN',
          description: 'Contrato próximo do vencimento — renovação necessária',
          relatedId: plan.id,
        })
      }
    }

    // Batch create all pendencies in a single transaction
    if (toCreate.length > 0) {
      await this.prisma.$transaction(
        toCreate.map(data => this.prisma.pendency.create({ data })),
      )
      newCount = toCreate.length
    }

    return newCount
  }
}
