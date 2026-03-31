import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ActivityLogService } from '../activity-log/activity-log.service'

const VALID_LEAD_STAGES = [
  'NOVO_LEAD',
  'CONTATO_FEITO',
  'PROPOSTA_ENVIADA',
  'NEGOCIACAO',
  'FECHADO',
  'PERDIDO',
]

const STAGE_LABELS: Record<string, string> = {
  NOVO_LEAD: 'Novo Lead',
  CONTATO_FEITO: 'Contato Feito',
  PROPOSTA_ENVIADA: 'Proposta Enviada',
  NEGOCIACAO: 'Negociação',
  FECHADO: 'Fechado',
  PERDIDO: 'Perdido',
}

@Injectable()
export class CrmService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
  ) {}

  async findPipeline(params: { salesRep?: string; leadSource?: string }) {
    const { salesRep, leadSource } = params

    const where: Record<string, unknown> = {
      status: 'PROSPECT',
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
    },
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      select: { id: true, companyName: true, leadStage: true },
    })

    if (!client) {
      throw new NotFoundException(`Cliente com ID ${id} não encontrado`)
    }

    const now = new Date()

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
      },
    })

    // 3. Create onboarding (if not exists)
    const existingOnboarding = await this.prisma.onboarding.findUnique({ where: { clientId: id } })
    if (!existingOnboarding) {
      await this.prisma.onboarding.create({
        data: { clientId: id, currentStage: 'CLIENT_CLOSED' },
      })
    }

    // 4. Log activity
    await this.activityLog.log({
      clientId: id,
      entityType: 'CRM',
      entityId: id,
      action: 'DEAL_CLOSED',
      fromValue: client.leadStage ?? undefined,
      toValue: 'FECHADO',
      description: `Lead ${client.companyName} fechado — ${product.name} R$${dto.saleValue}`,
    })

    return { client: updated, plan }
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
  }) {
    const client = await this.prisma.client.create({
      data: {
        ...dto,
        status: 'PROSPECT',
        leadStage: 'NOVO_LEAD',
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
