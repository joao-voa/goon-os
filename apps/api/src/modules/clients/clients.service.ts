import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
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
    expired?: string
    page?: number
    limit?: number
    sort?: string
  }) {
    const { search, status, segment, product, expired, page = 1, limit = 20, sort = 'companyName' } = params

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

    // Vencido: plano ativo com fim no passado E sem parcela futura (igual à agenda)
    if (expired === 'true' || expired === 'false') {
      const now = new Date()
      const isExpired = {
        AND: [
          { plans: { some: { status: 'ACTIVE', endDate: { lt: now } } } },
          { payments: { none: { status: { in: ['PENDING', 'SCHEDULED'] }, dueDate: { gte: now } } } },
        ],
      }
      where.AND = expired === 'true' ? [isExpired] : [{ NOT: isExpired }]
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
            select: { id: true, status: true, endDate: true, product: { select: { id: true, code: true, name: true } } },
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

    // Check if client has real data (plans, payments)
    const plansCount = await this.prisma.clientPlan.count({ where: { clientId: id } })
    const paymentsCount = await this.prisma.payment.count({ where: { clientId: id } })

    if (plansCount === 0 && paymentsCount === 0) {
      // No plans/payments — hard delete
      await this.prisma.leadInteraction.deleteMany({ where: { clientId: id } })
      await this.prisma.activityLog.deleteMany({ where: { clientId: id } })
      await this.prisma.pendency.deleteMany({ where: { clientId: id } })
      await this.prisma.onboarding.deleteMany({ where: { clientId: id } })
      await this.prisma.contract.deleteMany({ where: { clientId: id } })
      await this.prisma.client.delete({ where: { id } })
      return { deleted: true, companyName: existing.companyName }
    }

    const oldStatus = existing.status

    // Has data — soft delete (inactivate)
    await this.prisma.clientPlan.updateMany({
      where: { clientId: id, status: 'ACTIVE' },
      data: { status: 'CANCELLED' },
    })

    await this.prisma.contract.updateMany({
      where: { clientId: id, status: 'DRAFT' },
      data: { status: 'CANCELLED' },
    })

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

  // ---- Documentos do cliente (ex: contrato assinado) ----

  // Lista metadados dos documentos (sem o base64, que é pesado).
  async listDocuments(clientId: string) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } })
    if (!client) throw new NotFoundException(`Client ${clientId} not found`)
    return this.prisma.clientDocument.findMany({
      where: { clientId },
      select: { id: true, type: true, filename: true, mimeType: true, size: true, notes: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async addDocument(
    clientId: string,
    dto: { filename: string; data: string; mimeType?: string; size?: number; type?: string; notes?: string },
  ) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } })
    if (!client) throw new NotFoundException(`Client ${clientId} not found`)
    if (!dto.data) throw new BadRequestException('Arquivo (base64) obrigatório')

    // Limite de 3MB no arquivo original: o base64 (~1,37x) tem que caber no
    // body de 4,5MB que o serverless do Vercel aceita.
    const MAX = 3 * 1024 * 1024
    const bytes = dto.size ?? Math.floor((dto.data.length * 3) / 4)
    if (bytes > MAX) {
      throw new BadRequestException('Arquivo maior que 3MB. Comprima o PDF ou use um link externo.')
    }

    const doc = await this.prisma.clientDocument.create({
      data: {
        clientId,
        filename: dto.filename,
        data: dto.data,
        mimeType: dto.mimeType ?? 'application/pdf',
        size: bytes,
        type: dto.type ?? 'SIGNED_CONTRACT',
        notes: dto.notes,
      },
      select: { id: true, type: true, filename: true, mimeType: true, size: true, notes: true, createdAt: true },
    })

    await this.activityLog.log({
      clientId,
      entityType: 'CLIENT',
      entityId: clientId,
      action: 'DOCUMENT_ADDED',
      description: `Documento anexado: ${dto.filename}`,
    })

    return doc
  }

  // Retorna o documento COM o base64 (para download).
  async getDocument(clientId: string, docId: string) {
    const doc = await this.prisma.clientDocument.findFirst({ where: { id: docId, clientId } })
    if (!doc) throw new NotFoundException(`Documento ${docId} não encontrado`)
    return doc
  }

  async removeDocument(clientId: string, docId: string) {
    const doc = await this.prisma.clientDocument.findFirst({ where: { id: docId, clientId } })
    if (!doc) throw new NotFoundException(`Documento ${docId} não encontrado`)
    await this.prisma.clientDocument.delete({ where: { id: docId } })
    await this.activityLog.log({
      clientId,
      entityType: 'CLIENT',
      entityId: clientId,
      action: 'DOCUMENT_REMOVED',
      description: `Documento removido: ${doc.filename}`,
    })
    return { success: true }
  }
}
