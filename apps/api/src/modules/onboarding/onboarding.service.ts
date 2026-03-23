import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ActivityLogService } from '../activity-log/activity-log.service'

const VALID_STAGES = [
  'CLIENT_CLOSED',
  'SYSTEM_REGISTERED',
  'INFO_COLLECTED',
  'CONTRACT_DRAFTED',
  'CONTRACT_SENT',
  'CONTRACT_SIGNED',
  'INITIAL_PAYMENT',
  'BILLING_CREATED',
  'KICKOFF_SCHEDULED',
  'ONBOARDING_DONE',
]

const STAGE_LABELS: Record<string, string> = {
  CLIENT_CLOSED: 'Cliente Fechado',
  SYSTEM_REGISTERED: 'Cadastro no Sistema',
  INFO_COLLECTED: 'Coleta de Informações',
  CONTRACT_DRAFTED: 'Elaboração do Contrato',
  CONTRACT_SENT: 'Envio do Contrato',
  CONTRACT_SIGNED: 'Assinatura',
  INITIAL_PAYMENT: 'Pagamento Inicial',
  BILLING_CREATED: 'Geração de Boletos',
  KICKOFF_SCHEDULED: 'Kickoff Agendado',
  ONBOARDING_DONE: 'Onboarding Finalizado',
}

function daysAgo(date: Date): number {
  const diffMs = Date.now() - date.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

@Injectable()
export class OnboardingService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
  ) {}

  async findAll() {
    const onboardings = await this.prisma.onboarding.findMany({
      include: {
        client: {
          select: {
            id: true,
            companyName: true,
            responsible: true,
            phone: true,
            plans: {
              where: { status: 'ACTIVE' },
              take: 1,
              include: {
                product: { select: { code: true } },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    // Fetch last STAGE_CHANGED log for each onboarding to compute daysInStage
    const results = await Promise.all(
      onboardings.map(async (ob) => {
        const lastStageLog = await this.prisma.activityLog.findFirst({
          where: {
            entityType: 'ONBOARDING',
            entityId: ob.id,
            action: 'STAGE_CHANGED',
          },
          orderBy: { createdAt: 'desc' },
        })

        const stageChangedAt = lastStageLog ? lastStageLog.createdAt : ob.updatedAt
        const daysInStage = daysAgo(stageChangedAt)

        const firstActivePlan = ob.client.plans[0] ?? null

        return {
          id: ob.id,
          clientId: ob.clientId,
          currentStage: ob.currentStage,
          notes: ob.notes,
          createdAt: ob.createdAt,
          updatedAt: ob.updatedAt,
          daysInStage,
          productCode: firstActivePlan?.product?.code ?? null,
          client: {
            companyName: ob.client.companyName,
            responsible: ob.client.responsible,
            phone: ob.client.phone,
          },
        }
      }),
    )

    return results
  }

  async findOne(id: string) {
    const ob = await this.prisma.onboarding.findUnique({
      where: { id },
      include: {
        client: {
          include: {
            plans: {
              where: { status: 'ACTIVE' },
              take: 1,
              include: { product: { select: { code: true, name: true } } },
            },
          },
        },
      },
    })

    if (!ob) {
      throw new NotFoundException(`Onboarding com ID ${id} não encontrado`)
    }

    const activityLogs = await this.prisma.activityLog.findMany({
      where: { entityType: 'ONBOARDING', entityId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    const lastStageLog = activityLogs.find((l) => l.action === 'STAGE_CHANGED') ?? null
    const stageChangedAt = lastStageLog ? lastStageLog.createdAt : ob.updatedAt
    const daysInStage = daysAgo(stageChangedAt)

    return {
      ...ob,
      daysInStage,
      productCode: ob.client.plans[0]?.product?.code ?? null,
      activityLogs,
    }
  }

  async create(clientId: string) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } })
    if (!client) {
      throw new NotFoundException(`Cliente com ID ${clientId} não encontrado`)
    }

    const existing = await this.prisma.onboarding.findUnique({ where: { clientId } })
    if (existing) {
      throw new BadRequestException('Este cliente já possui um onboarding')
    }

    const ob = await this.prisma.onboarding.create({
      data: { clientId, currentStage: 'CLIENT_CLOSED' },
    })

    await this.activityLog.log({
      clientId,
      entityType: 'ONBOARDING',
      entityId: ob.id,
      action: 'CREATED',
      description: `Onboarding criado para ${client.companyName}`,
    })

    return ob
  }

  async changeStage(id: string, toStage: string) {
    if (!VALID_STAGES.includes(toStage)) {
      throw new BadRequestException(`Etapa inválida: ${toStage}`)
    }

    const ob = await this.prisma.onboarding.findUnique({
      where: { id },
      include: { client: { select: { id: true, companyName: true } } },
    })

    if (!ob) {
      throw new NotFoundException(`Onboarding com ID ${id} não encontrado`)
    }

    const fromStage = ob.currentStage
    const fromLabel = STAGE_LABELS[fromStage] ?? fromStage
    const toLabel = STAGE_LABELS[toStage] ?? toStage

    const updated = await this.prisma.onboarding.update({
      where: { id },
      data: { currentStage: toStage },
    })

    await this.activityLog.log({
      clientId: ob.client.id,
      entityType: 'ONBOARDING',
      entityId: ob.id,
      action: 'STAGE_CHANGED',
      fromValue: fromStage,
      toValue: toStage,
      description: `Onboarding movido de ${fromLabel} para ${toLabel}`,
    })

    return updated
  }
}
