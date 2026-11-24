import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ActivityLogService } from '../activity-log/activity-log.service'
import { DocusignService } from './docusign.service'

const VALID_STAGES = [
  'CLIENT_CLOSED',
  'CONTRACT_SENT',
  'BILLING_CREATED',
  'KICKOFF_SCHEDULED',
  'ONBOARDING_DONE',
]

const STAGE_LABELS: Record<string, string> = {
  CLIENT_CLOSED: 'Cliente Fechado',
  CONTRACT_SENT: 'Enviar Contrato',
  BILLING_CREATED: 'Geracao de Boletos',
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
    private docusign: DocusignService,
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

    // Batch-fetch the latest STAGE_CHANGED log for all onboardings in ONE query
    const onboardingIds = onboardings.map(ob => ob.id)

    const latestStageLogs = onboardingIds.length > 0
      ? await this.prisma.$queryRaw<Array<{ entityId: string; createdAt: Date }>>`
          SELECT DISTINCT ON ("entityId") "entityId", "createdAt"
          FROM "ActivityLog"
          WHERE "entityType" = 'ONBOARDING'
            AND "action" = 'STAGE_CHANGED'
            AND "entityId" = ANY(${onboardingIds})
          ORDER BY "entityId", "createdAt" DESC
        `
      : []

    const stageLogMap = new Map(
      latestStageLogs.map(log => [log.entityId, log.createdAt]),
    )

    return onboardings.map(ob => {
      const stageChangedAt = stageLogMap.get(ob.id) ?? ob.updatedAt
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
    })
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

  // ===== Checklist (ordem livre) =====
  // Itens do onboarding. Os automáticos vêm dos dados (contrato anexado, cobrança, pagamento,
  // kickoff na agenda); qualquer item pode ser marcado/desmarcado à mão (vale a marcação manual).
  static readonly ITEMS: Array<{ key: string; label: string }> = [
    { key: 'dados_contrato', label: 'Dados do contrato' },
    { key: 'contrato_elaborado', label: 'Contrato elaborado' },
    { key: 'contrato_enviado', label: 'Contrato enviado para assinatura' },
    { key: 'contrato_assinado', label: 'Contrato assinado' },
    { key: 'mastermind', label: 'Mastermind' },
    { key: 'apresentacao_mastermind', label: 'Apresentação Mastermind' },
    { key: 'sistema_goon', label: 'Sistema GOON' },
    { key: 'area_membros', label: 'Área de membros' },
    { key: 'kickoff', label: 'D0 (reunião de onboarding)' },
  ]

  async board() {
    const result = await this.boardRaw()
    const toClose = result.filter(b => b.allDone && b.currentStage !== 'ONBOARDING_DONE').map(b => b.id)
    if (toClose.length) await this.prisma.onboarding.updateMany({ where: { id: { in: toClose } }, data: { currentStage: 'ONBOARDING_DONE' } })
    return result
  }

  private async boardRaw() {
    const obs = await this.prisma.onboarding.findMany({
      include: {
        client: {
          select: {
            id: true, companyName: true, responsible: true, phone: true, whatsapp: true, email: true,
            cnpj: true, address: true, city: true,
            status: true, leadStage: true, standby: true, hasContract: true, closedAt: true,
            plans: { where: { status: 'ACTIVE' }, take: 1, orderBy: { startDate: 'desc' }, select: { product: { select: { code: true } }, startDate: true } },
            documents: { where: { type: 'SIGNED_CONTRACT' }, select: { id: true }, take: 1 },
            contracts: { select: { status: true } },
            payments: { where: { status: { not: 'CANCELLED' } }, select: { status: true, inCarteira: true } },
            // D0 = reunião de onboarding (tipo ONBOARDING). D1 do GOON Mentoria entra como KICKOFF e não conta aqui
            meetings: { where: { type: 'ONBOARDING', status: { notIn: ['CANCELLED', 'RESCHEDULED'] } }, orderBy: { date: 'asc' }, take: 1, select: { date: true, status: true, meetLink: true } },
          },
        },
      },
    })
    return obs.map(ob => {
      const c = ob.client
      const manual = (ob.checklist ?? {}) as Record<string, boolean>
      const kickoff = c.meetings[0] ?? null
      const auto: Record<string, boolean> = {
        // dados para o contrato: CNPJ/CPF, endereço, cidade e e-mail preenchidos no cadastro
        dados_contrato: !!(c.cnpj && c.address && c.city && c.email),
        // contrato gerado no sistema (qualquer status, menos cancelado) ou já anexado
        contrato_elaborado: c.contracts.some(k => k.status !== 'CANCELLED') || c.documents.length > 0,
        contrato_enviado: c.contracts.some(k => ['SENT', 'SIGNED'].includes(k.status)) || c.documents.length > 0,
        // só vale com o contrato assinado ANEXADO (não marca à mão)
        contrato_assinado: c.documents.length > 0,
        mastermind: false,
        apresentacao_mastermind: false,
        sistema_goon: false,
        area_membros: false,
        kickoff: !!kickoff,
      }
      const items = OnboardingService.ITEMS.map(it => {
        const hasManual = it.key !== 'contrato_assinado' && typeof manual[it.key] === 'boolean'
        return { ...it, done: hasManual ? manual[it.key] : auto[it.key], auto: !hasManual && auto[it.key], manual: hasManual }
      })
      const doneCount = items.filter(i => i.done).length
      const inactive = c.status !== 'ACTIVE' || ['PERDIDO', 'RECUPERAR'].includes(c.leadStage ?? '') || c.standby || c.payments.some(p => p.inCarteira)
      const plan = c.plans[0]
      const since = plan?.startDate ?? c.closedAt ?? ob.createdAt
      return {
        id: ob.id, clientId: c.id,
        client: { companyName: c.companyName, responsible: c.responsible, phone: c.phone, whatsapp: c.whatsapp, email: c.email },
        productCode: plan?.product?.code ?? null,
        items, doneCount, total: items.length,
        // concluído: tudo marcado (inclui contrato anexado), ou já finalizado no kanban antigo
        completed: doneCount === items.length || ob.currentStage === 'ONBOARDING_DONE',
        allDone: doneCount === items.length,
        currentStage: ob.currentStage,
        inactive,
        kickoff: kickoff ? { date: kickoff.date, status: kickoff.status, meetLink: kickoff.meetLink } : null,
        daysSinceClose: daysAgo(since),
        notes: ob.notes,
        signature: ob.signEnvelopeId ? { status: ob.signStatus, sentAt: ob.signSentAt, signers: ob.signSigners } : null,
      }
    })
  }

  async setItem(id: string, key: string, done: boolean | null) {
    if (!OnboardingService.ITEMS.some(i => i.key === key)) throw new BadRequestException('Item inválido')
    if (key === 'contrato_assinado') throw new BadRequestException('Contrato assinado só conta com o contrato anexado')
    const ob = await this.prisma.onboarding.findUnique({ where: { id }, include: { client: { select: { id: true, companyName: true } } } })
    if (!ob) throw new NotFoundException('Onboarding não encontrado')
    const checklist = { ...((ob.checklist ?? {}) as Record<string, boolean>) }
    if (done === null) delete checklist[key]
    else checklist[key] = done
    await this.prisma.onboarding.update({ where: { id }, data: { checklist } })
    const label = OnboardingService.ITEMS.find(i => i.key === key)!.label
    await this.activityLog.log({
      clientId: ob.client.id, entityType: 'ONBOARDING', entityId: ob.id, action: 'CHECKLIST',
      toValue: `${key}=${done}`, description: `${label}: ${done === null ? 'volta ao automático' : done ? 'feito' : 'pendente'} (${ob.client.companyName})`,
    })
    // fecha/reabre o onboarding conforme o checklist
    const board = (await this.boardRaw()).find(b => b.id === id)
    if (board) {
      const all = board.items.every(i => i.done)
      if (all && ob.currentStage !== 'ONBOARDING_DONE') await this.prisma.onboarding.update({ where: { id }, data: { currentStage: 'ONBOARDING_DONE' } })
      if (!all && ob.currentStage === 'ONBOARDING_DONE' && done === false) await this.prisma.onboarding.update({ where: { id }, data: { currentStage: 'CLIENT_CLOSED' } })
    }
    return board
  }

  async setNotes(id: string, notes: string) {
    return this.prisma.onboarding.update({ where: { id }, data: { notes: notes.trim() || null } })
  }


  /**
   * Dados do contrato colados do jeito que o cliente mandou ("Rótulo: valor" por linha).
   * Guarda o texto bruto no onboarding e preenche o que der no cadastro do cliente.
   * E-mail e telefone só entram se o cadastro estiver vazio (o e-mail principal recebe os convites).
   */
  async saveContractData(id: string, text: string) {
    const ob = await this.prisma.onboarding.findUnique({ where: { id }, include: { client: true } })
    if (!ob) throw new NotFoundException('Onboarding não encontrado')
    const raw = text.trim()
    if (!raw) throw new BadRequestException('Cole os dados do contrato')

    const norm = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    const fields: Record<string, string> = {}
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([^:]{2,60}):\s*(.+?)\s*$/)
      if (m) fields[norm(m[1]).replace(/\s+/g, ' ').trim()] = m[2]
    }
    const pick = (...keys: string[]) => {
      for (const k of Object.keys(fields)) if (keys.some(x => k.includes(x))) return fields[k]
      return undefined
    }
    const data: Record<string, string> = {}
    const trade = pick('nome fantasia')
    if (trade) data.tradeName = trade
    const doc = Object.entries(fields).find(([k]) => (k.includes('cnpj') || k === 'cpf/cnpj') && !k.includes('responsavel'))?.[1]
    if (doc) data.cnpj = doc
    const resp = pick('responsavel legal', 'nome do responsavel', 'responsavel')
    if (resp && !/cpf/i.test(resp)) data.responsible = resp
    const addr = pick('endereco')
    if (addr) {
      const cep = addr.match(/\d{5}-?\d{3}/)?.[0]
      const uf = addr.match(/[–—-]\s*([A-Z]{2})\b/)?.[1]
      const parts = addr.split(',').map(x => x.trim())
      data.address = parts[0]
      if (parts[1] && /^\d+[\w\s/-]*$/.test(parts[1])) data.addressNumber = parts[1]
      const cityPart = parts.find(p => /[–—-]\s*[A-Z]{2}\b/.test(p))
      if (cityPart) data.city = cityPart.split(/[–—-]/)[0].trim()
      if (uf) data.state = uf
      if (cep) data.zipCode = cep
    }
    const cep2 = pick('cep')
    if (cep2 && !data.zipCode) data.zipCode = cep2
    const cidade = pick('cidade')
    if (cidade && !data.city) data.city = cidade
    const email = pick('e-mail para assinatura', 'email para assinatura', 'e-mail', 'email')
    if (email && !ob.client.email) data.email = email.toLowerCase()
    const tel = pick('telefone', 'whatsapp', 'celular')
    if (tel && !ob.client.phone) data.phone = tel

    if (data.cnpj && data.cnpj !== ob.client.cnpj) {
      const other = await this.prisma.client.findFirst({ where: { cnpj: data.cnpj, id: { not: ob.clientId } }, select: { companyName: true } })
      if (other) throw new BadRequestException(`Esse CNPJ já está no cadastro de ${other.companyName}`)
    }
    await this.prisma.client.update({ where: { id: ob.clientId }, data })
    const checklist = { ...((ob.checklist ?? {}) as Record<string, boolean>), dados_contrato: true }
    await this.prisma.onboarding.update({ where: { id }, data: { notes: raw, checklist } })
    await this.activityLog.log({
      clientId: ob.clientId, entityType: 'ONBOARDING', entityId: ob.id, action: 'CONTRACT_DATA',
      description: `Dados do contrato colados (${Object.keys(data).join(', ') || 'sem campos reconhecidos'})`,
    })
    return { filled: data }
  }


  // ===== Assinatura pelo DocuSign =====
  signatureInfo() {
    return { enabled: this.docusign.enabled, consentUrl: this.docusign.consentUrl() }
  }

  async sendForSignature(id: string, dto: { filename: string; data: string; signers: Array<{ name: string; email: string }> }) {
    if (!this.docusign.enabled) throw new BadRequestException('DocuSign ainda não está ligado')
    const ob = await this.prisma.onboarding.findUnique({ where: { id }, include: { client: { select: { id: true, companyName: true } } } })
    if (!ob) throw new NotFoundException('Onboarding não encontrado')
    const signers = (dto.signers ?? []).map(s => ({ name: s.name?.trim(), email: s.email?.trim().toLowerCase() })).filter(s => s.name && s.email?.includes('@'))
    if (!signers.length) throw new BadRequestException('Informe pelo menos um signatário com nome e e-mail')
    if (!dto.data) throw new BadRequestException('Envie o arquivo do contrato')
    const token = process.env.DOCUSIGN_WEBHOOK_TOKEN
    const api = (process.env.PUBLIC_API_URL ?? 'https://goon-os-api.vercel.app').replace(/\/+$/, '')
    const env = await this.docusign.send({
      subject: `Contrato GOON · ${ob.client.companyName}`,
      filename: dto.filename || 'Contrato.pdf',
      base64: dto.data,
      signers,
      webhookUrl: token ? `${api}/api/integrations/docusign/webhook?token=${encodeURIComponent(token)}` : undefined,
    })
    const checklist = { ...((ob.checklist ?? {}) as Record<string, boolean>), contrato_elaborado: true, contrato_enviado: true }
    await this.prisma.onboarding.update({
      where: { id },
      data: { signEnvelopeId: env.envelopeId, signStatus: env.status ?? 'sent', signSentAt: new Date(), signSigners: signers, checklist },
    })
    await this.activityLog.log({
      clientId: ob.client.id, entityType: 'ONBOARDING', entityId: ob.id, action: 'SIGNATURE_SENT',
      description: `Contrato enviado pelo DocuSign para ${signers.map(s => s.email).join(', ')}`,
    })
    return { envelopeId: env.envelopeId, status: env.status }
  }

  /** Atualiza o status do envelope; se concluído, anexa o PDF assinado no cliente. */
  async syncSignature(envelopeId: string, knownStatus?: string) {
    const ob = await this.prisma.onboarding.findFirst({ where: { signEnvelopeId: envelopeId }, include: { client: { select: { id: true, companyName: true } } } })
    if (!ob) return { found: false }
    const status = knownStatus ?? (await this.docusign.status(envelopeId)).status
    if (status === ob.signStatus && status !== 'completed') return { found: true, status }
    if (status === 'completed' && ob.signStatus !== 'completed') {
      const pdf = await this.docusign.signedPdf(envelopeId)
      await this.prisma.clientDocument.create({
        data: {
          clientId: ob.client.id, type: 'SIGNED_CONTRACT', mimeType: 'application/pdf', size: pdf.length,
          filename: `Contrato assinado - ${ob.client.companyName}.pdf`, data: pdf.toString('base64'),
          notes: `Assinado pelo DocuSign (envelope ${envelopeId})`,
        },
      })
      await this.prisma.client.update({ where: { id: ob.client.id }, data: { hasContract: true } })
      await this.activityLog.log({
        clientId: ob.client.id, entityType: 'ONBOARDING', entityId: ob.id, action: 'SIGNATURE_COMPLETED',
        description: `Contrato assinado no DocuSign e anexado (${ob.client.companyName})`,
      })
    }
    await this.prisma.onboarding.update({ where: { id: ob.id }, data: { signStatus: status } })
    return { found: true, status }
  }

  async refreshSignature(id: string) {
    const ob = await this.prisma.onboarding.findUnique({ where: { id }, select: { signEnvelopeId: true } })
    if (!ob?.signEnvelopeId) throw new BadRequestException('Nenhum envio pelo DocuSign')
    return this.syncSignature(ob.signEnvelopeId)
  }

}
