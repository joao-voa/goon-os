import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ActivityLogService } from '../activity-log/activity-log.service'
import { PdfService } from './pdf.service'

const fmtBRL = (n: unknown) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(Number(n))

const fmtDate = (d: unknown) => new Date(d as string).toLocaleDateString('pt-BR')

function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

function buildPaymentDescription(plan: {
  paymentType: string
  value: { toNumber: () => number }
  installments?: number | null
  installmentValue?: { toNumber: () => number } | null
  paymentDay?: number | null
}): string {
  if (plan.paymentType === 'CASH') {
    return `${fmtBRL(plan.value.toNumber())} à vista`
  }
  const installments = plan.installments ?? 1
  const installmentValue = plan.installmentValue ? fmtBRL(plan.installmentValue.toNumber()) : fmtBRL(plan.value.toNumber() / installments)
  const day = plan.paymentDay ? `, vencimento todo dia ${plan.paymentDay}` : ''
  return `${installments}x de ${installmentValue} via boleto${day}`
}

@Injectable()
export class ContractsService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
    private pdfService: PdfService,
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
      this.prisma.contract.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, companyName: true, responsible: true } },
          clientPlan: {
            include: {
              product: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
      this.prisma.contract.count({ where }),
    ])

    return { data, total, page, limit }
  }

  async findOne(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, companyName: true, responsible: true } },
        clientPlan: {
          include: {
            product: { select: { id: true, code: true, name: true } },
          },
        },
      },
    })

    if (!contract) {
      throw new NotFoundException(`Contrato com ID ${id} não encontrado`)
    }

    return contract
  }

  async create(dto: { clientId: string; clientPlanId?: string; templateType: string }) {
    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } })
    if (!client) {
      throw new NotFoundException(`Cliente com ID ${dto.clientId} não encontrado`)
    }

    let plan: {
      value: { toNumber: () => number }
      paymentType: string
      installments?: number | null
      installmentValue?: { toNumber: () => number } | null
      startDate: Date
      endDate?: Date | null
      cycleDuration?: number | null
      paymentDay?: number | null
      product: { name: string; code: string }
    } | null = null

    if (dto.clientPlanId) {
      plan = await this.prisma.clientPlan.findUnique({
        where: { id: dto.clientPlanId },
        include: { product: { select: { id: true, code: true, name: true } } },
      })
      if (!plan) {
        throw new NotFoundException(`Plano com ID ${dto.clientPlanId} não encontrado`)
      }
    }

    const addressParts = [
      client.address,
      client.addressNumber,
      client.neighborhood,
      client.city,
      client.state,
      client.zipCode,
    ].filter(Boolean)

    const dynamicFields: Record<string, string> = {
      // New template fields
      contratanteNome: client.responsible,
      contratanteCPF: '',
      contratanteEndereco: addressParts.length > 0 ? addressParts.join(', ') : '',
      contratanteEmail: client.email ?? '',
      contratanteEmpresa: client.companyName,
      contratanteCNPJ: client.cnpj ?? '',
      valorTotal: plan ? fmtBRL(plan.value.toNumber()) : '',
      formaPagamento: plan ? buildPaymentDescription(plan) : '',
      valorParcela: plan?.installmentValue ? fmtBRL(plan.installmentValue.toNumber()) : '',
      numParcelas: plan?.installments?.toString() ?? '',
      diaVencimento: plan?.paymentDay?.toString() ?? '',
      vigenciaInicio: plan ? fmtDate(plan.startDate) : '',
      vigenciaFim: plan?.endDate ? fmtDate(plan.endDate) : '',
      acessoFim: plan ? fmtDate(addMonths(plan.startDate, 12)) : '',
      dataContrato: fmtDate(new Date()),
      cidadeForo: 'São Paulo/SP',
      productName: plan?.product?.name ?? dto.templateType,
      // Legacy fields (kept for backward compatibility)
      companyName: client.companyName,
      cnpj: client.cnpj ?? '—',
      responsible: client.responsible,
      address: addressParts.length > 0 ? addressParts.join(', ') : '—',
      value: plan ? fmtBRL(plan.value.toNumber()) : '—',
      installments: plan?.installments?.toString() ?? '—',
      installmentValue: plan?.installmentValue ? fmtBRL(plan.installmentValue.toNumber()) : '—',
      startDate: plan ? fmtDate(plan.startDate) : '—',
      endDate: plan?.endDate ? fmtDate(plan.endDate) : '—',
      duration: plan?.cycleDuration?.toString() ?? '—',
    }

    const contract = await this.prisma.contract.create({
      data: {
        clientId: dto.clientId,
        clientPlanId: dto.clientPlanId ?? null,
        templateType: dto.templateType,
        dynamicFields,
      },
      include: {
        client: { select: { id: true, companyName: true, responsible: true } },
        clientPlan: {
          include: {
            product: { select: { id: true, code: true, name: true } },
          },
        },
      },
    })

    await this.activityLog.log({
      clientId: client.id,
      entityType: 'CONTRACT',
      entityId: contract.id,
      action: 'CREATED',
      description: `Contrato ${dto.templateType} criado para ${client.companyName}`,
    })

    return contract
  }

  async update(
    id: string,
    dto: {
      dynamicFields?: Record<string, string>
      isSigned?: boolean
      signatureDate?: string
    },
  ) {
    const existing = await this.prisma.contract.findUnique({ where: { id } })
    if (!existing) {
      throw new NotFoundException(`Contrato com ID ${id} não encontrado`)
    }

    const updateData: Record<string, unknown> = {}

    if (dto.dynamicFields !== undefined) {
      updateData.dynamicFields = dto.dynamicFields
    }

    if (dto.isSigned !== undefined) {
      updateData.isSigned = dto.isSigned
      if (dto.isSigned) {
        updateData.signatureDate = dto.signatureDate ? new Date(dto.signatureDate) : new Date()
        // Also advance status to SIGNED if not already
        if (existing.status !== 'SIGNED' && existing.status !== 'CANCELLED') {
          updateData.status = 'SIGNED'
          updateData.signedAt = updateData.signatureDate
        }
      } else {
        updateData.signatureDate = null
      }
    }

    const contract = await this.prisma.contract.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { id: true, companyName: true, responsible: true } },
        clientPlan: {
          include: {
            product: { select: { id: true, code: true, name: true } },
          },
        },
      },
    })

    const description = dto.isSigned
      ? `Contrato marcado como assinado`
      : `Campos do contrato atualizados`

    await this.activityLog.log({
      clientId: existing.clientId,
      entityType: 'CONTRACT',
      entityId: contract.id,
      action: 'UPDATED',
      description,
    })

    return contract
  }

  async changeStatus(id: string, newStatus: string) {
    const contract = await this.prisma.contract.findUnique({ where: { id } })
    if (!contract) {
      throw new NotFoundException(`Contrato com ID ${id} não encontrado`)
    }

    const currentStatus = contract.status
    const validTransitions: Record<string, string[]> = {
      DRAFT: ['SENT', 'CANCELLED'],
      SENT: ['SIGNED', 'CANCELLED'],
      SIGNED: ['CANCELLED'],
      CANCELLED: [],
    }

    const allowed = validTransitions[currentStatus] ?? []
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Transição de status inválida: ${currentStatus} → ${newStatus}`,
      )
    }

    const updateData: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'SENT') updateData.sentAt = new Date()
    if (newStatus === 'SIGNED') updateData.signedAt = new Date()

    const updated = await this.prisma.contract.update({
      where: { id },
      data: updateData,
    })

    await this.activityLog.log({
      clientId: contract.clientId,
      entityType: 'CONTRACT',
      entityId: id,
      action: 'STATUS_CHANGED',
      fromValue: currentStatus,
      toValue: newStatus,
      description: `Contrato ${contract.templateType}: status alterado de ${currentStatus} para ${newStatus}`,
    })

    return updated
  }

  async generateHtml(id: string) {
    const contract = await this.prisma.contract.findUnique({ where: { id } })
    if (!contract) {
      throw new NotFoundException(`Contrato com ID ${id} não encontrado`)
    }

    const fields = contract.dynamicFields as Record<string, string>

    // Validate required fields (support both old and new field names)
    const required = fields['contratanteNome']
      ? ['contratanteNome', 'productName', 'valorTotal']
      : ['companyName', 'responsible', 'productName', 'value', 'startDate']
    const missing = required.filter(f => !fields[f] || fields[f] === '—')
    if (missing.length > 0) {
      throw new BadRequestException({
        message: 'Campos obrigatórios ausentes para geração do contrato',
        missingFields: missing,
      })
    }

    const html = this.pdfService.generateHtml(contract.templateType, fields)

    const newVersion = (contract.version ?? 1) + 1
    await this.prisma.contract.update({
      where: { id },
      data: {
        generatedPdfUrl: html,
        version: newVersion,
      },
    })

    await this.activityLog.log({
      clientId: contract.clientId,
      entityType: 'CONTRACT',
      entityId: id,
      action: 'GENERATED',
      description: `Contrato ${contract.templateType} gerado (versão ${newVersion})`,
    })

    return html
  }

  async getHtml(id: string) {
    const contract = await this.prisma.contract.findUnique({ where: { id } })
    if (!contract) {
      throw new NotFoundException(`Contrato com ID ${id} não encontrado`)
    }

    if (!contract.generatedPdfUrl) {
      throw new BadRequestException('Contrato ainda não foi gerado. Use POST /generate-pdf primeiro.')
    }

    return contract.generatedPdfUrl
  }
}
