import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ActivityLogService } from '../activity-log/activity-log.service'
import { CreateClientDto } from './dto/create-client.dto'
import { UpdateClientDto } from './dto/update-client.dto'

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
  ) {}

  async findAll(params: {
    search?: string
    status?: string
    segment?: string
    product?: string
    page?: number
    limit?: number
    sort?: string
  }) {
    const { search, status, segment, product, page = 1, limit = 20, sort = 'companyName' } = params

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { responsible: { contains: search, mode: 'insensitive' } },
        { cnpj: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (segment) {
      where.segment = { contains: segment, mode: 'insensitive' }
    }

    if (product) {
      where.plans = {
        some: {
          product: { code: product.toUpperCase() },
        },
      }
    }

    const validSortFields: Record<string, object> = {
      companyName: { companyName: 'asc' },
      createdAt: { createdAt: 'desc' },
      goonFitScore: { goonFitScore: 'desc' },
    }

    const orderBy = validSortFields[sort] ?? { companyName: 'asc' }

    const skip = (page - 1) * limit

    const [data, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          plans: {
            where: { status: 'ACTIVE' },
            take: 1,
            include: {
              product: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
      this.prisma.client.count({ where }),
    ])

    return { data, total, page, limit }
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        plans: {
          include: {
            product: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        contracts: {
          orderBy: { createdAt: 'desc' },
        },
        onboarding: true,
        activityLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!client) {
      throw new NotFoundException(`Cliente com ID ${id} não encontrado`)
    }

    return client
  }

  async create(dto: CreateClientDto) {
    const client = await this.prisma.client.create({ data: dto })

    await this.activityLog.log({
      clientId: client.id,
      entityType: 'CLIENT',
      entityId: client.id,
      action: 'CREATED',
      description: `Cliente ${client.companyName} criado`,
    })

    return client
  }

  async update(id: string, dto: UpdateClientDto) {
    const existing = await this.prisma.client.findUnique({ where: { id } })

    if (!existing) {
      throw new NotFoundException(`Cliente com ID ${id} não encontrado`)
    }

    const client = await this.prisma.client.update({ where: { id }, data: dto })

    await this.activityLog.log({
      clientId: client.id,
      entityType: 'CLIENT',
      entityId: client.id,
      action: 'UPDATED',
      description: `Cliente ${client.companyName} atualizado`,
    })

    return client
  }

  async remove(id: string) {
    const existing = await this.prisma.client.findUnique({ where: { id } })

    if (!existing) {
      throw new NotFoundException(`Cliente com ID ${id} não encontrado`)
    }

    const oldStatus = existing.status

    // Cancel active plans
    await this.prisma.clientPlan.updateMany({
      where: { clientId: id, status: 'ACTIVE' },
      data: { status: 'CANCELLED' },
    })

    // Cancel draft contracts
    await this.prisma.contract.updateMany({
      where: { clientId: id, status: 'DRAFT' },
      data: { status: 'CANCELLED' },
    })

    // Set client to INACTIVE
    const client = await this.prisma.client.update({
      where: { id },
      data: { status: 'INACTIVE' },
    })

    await this.activityLog.log({
      clientId: client.id,
      entityType: 'CLIENT',
      entityId: client.id,
      action: 'STATUS_CHANGED',
      fromValue: oldStatus,
      toValue: 'INACTIVE',
      description: `Cliente ${client.companyName} inativado`,
    })

    return client
  }

  async cancelClient(id: string) {
    const client = await this.prisma.client.findUnique({ where: { id } })
    if (!client) throw new NotFoundException(`Client ${id} not found`)

    // 1. Cancel pending payments
    const cancelledPayments = await this.prisma.payment.updateMany({
      where: { clientId: id, status: { in: ['PENDING', 'SCHEDULED'] } },
      data: { status: 'CANCELLED' },
    })

    // 2. Cancel pending commissions
    const cancelledCommissions = await this.prisma.commission.updateMany({
      where: { clientId: id, status: 'PENDING' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    })

    // 3. Cancel active plans
    await this.prisma.clientPlan.updateMany({
      where: { clientId: id, status: 'ACTIVE' },
      data: { status: 'CANCELLED' },
    })

    // 4. Update client status
    const updated = await this.prisma.client.update({
      where: { id },
      data: { status: 'INACTIVE' },
    })

    await this.activityLog.log({
      clientId: id,
      entityType: 'CLIENT',
      entityId: id,
      action: 'CANCELLED',
      description: `Cliente cancelado — ${cancelledPayments.count} pagamentos e ${cancelledCommissions.count} comissoes cancelados`,
    })

    return updated
  }
}
