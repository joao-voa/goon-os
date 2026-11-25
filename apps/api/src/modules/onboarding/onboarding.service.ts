import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ActivityLogService } from '../activity-log/activity-log.service'
import { ClicksignService } from './clicksign.service'
import { docxToPdf } from './docx-pdf'
import { CONTRACT_FIELDS, dataLonga, extenso, extensoF, fillDocx, reaisPorExtenso } from './contract-fill'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

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
    private clicksign: ClicksignService,
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
        signature: ob.signEnvelopeId ? { status: ob.signStatus, sentAt: ob.signSentAt, signers: ((ob.signSigners ?? {}) as { signers?: unknown }).signers ?? null } : null,
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


  // ===== Assinatura pela ClickSign =====
  // status no card: sent (enviado), completed (assinado por todos), declined (recusado), voided (cancelado)
  signatureInfo() {
    return { enabled: this.clicksign.enabled, provider: 'clicksign', env: this.clicksign.env }
  }

  async sendForSignature(id: string, dto: { filename: string; data: string; mimeType?: string; signers: Array<{ name: string; email: string }> }) {
    if (!this.clicksign.enabled) throw new BadRequestException('ClickSign ainda não está ligada')
    const ob = await this.prisma.onboarding.findUnique({ where: { id }, include: { client: { select: { id: true, companyName: true } } } })
    if (!ob) throw new NotFoundException('Onboarding não encontrado')
    const signers = (dto.signers ?? []).map(s => ({ name: s.name?.trim(), email: s.email?.trim().toLowerCase() })).filter(s => s.name && s.email?.includes('@'))
    if (!signers.length) throw new BadRequestException('Informe pelo menos um signatário com nome e e-mail')
    if (signers.some(s => s.name.split(/\s+/).length < 2)) throw new BadRequestException('A ClickSign pede nome e sobrenome de cada signatário')
    if (!dto.data) throw new BadRequestException('Envie o PDF do contrato')
    const filename = dto.filename || 'Contrato.pdf'
    if (!filename.toLowerCase().endsWith('.pdf')) throw new BadRequestException('Envie o contrato em PDF (no Word: Arquivo > Salvar como > PDF)')
    const mimeType = 'application/pdf'
    const size = Math.floor((dto.data.length * 3) / 4)
    if (size > 3 * 1024 * 1024) throw new BadRequestException('PDF maior que 3MB')
    // nova versão: o contrato anterior ainda em aberto é cancelado na ClickSign
    if (ob.signStatus === 'completed') throw new BadRequestException('Este contrato já foi assinado')
    const prevDoc = ((ob.signSigners ?? {}) as { documentId?: string }).documentId
    if (ob.signEnvelopeId && prevDoc && ob.signStatus === 'sent') {
      await this.clicksign.cancelDocument(ob.signEnvelopeId, prevDoc).catch(err => console.warn('ClickSign cancelar anterior:', (err as Error).message))
    }
    const r = await this.clicksign.send({
      name: `Contrato GOON · ${ob.client.companyName}`, filename, base64: dto.data, mimeType, signers, metadata: { onboardingId: ob.id },
    })
    // guarda a versão enviada (PDF) nos documentos do cliente
    const sent = { mimeType, size, filename, data: dto.data }
    await this.prisma.clientDocument.create({
      data: {
        clientId: ob.client.id, type: 'CONTRACT_SENT', mimeType: sent.mimeType, size: sent.size, filename: `Enviado para assinatura - ${sent.filename}`, data: sent.data,
        notes: `Versão enviada para assinatura pela ClickSign (envelope ${r.envelopeId})`,
      },
    })
    const checklist = { ...((ob.checklist ?? {}) as Record<string, boolean>), contrato_elaborado: true, contrato_enviado: true }
    await this.prisma.onboarding.update({
      where: { id },
      data: { signEnvelopeId: r.envelopeId, signStatus: 'sent', signSentAt: new Date(), signSigners: { provider: 'clicksign', documentId: r.documentId, signers }, checklist },
    })
    await this.activityLog.log({
      clientId: ob.client.id, entityType: 'ONBOARDING', entityId: ob.id, action: 'SIGNATURE_SENT',
      description: `Contrato enviado pela ClickSign para ${signers.map(s => s.email).join(', ')}`,
    })
    return { envelopeId: r.envelopeId, status: 'sent' }
  }

  private async completeSignature(ob: { id: string; signEnvelopeId: string | null; signStatus: string | null; signSigners: unknown; client: { id: string; companyName: string } }) {
    if (ob.signStatus === 'completed' || !ob.signEnvelopeId) return
    const documentId = ((ob.signSigners ?? {}) as { documentId?: string }).documentId
    if (!documentId) return
    const pdf = await this.clicksign.downloadSigned(ob.signEnvelopeId, documentId)
    await this.prisma.clientDocument.create({
      data: {
        clientId: ob.client.id, type: 'SIGNED_CONTRACT', mimeType: 'application/pdf', size: pdf.length,
        filename: `Contrato assinado - ${ob.client.companyName}.pdf`, data: pdf.toString('base64'),
        notes: `Assinado pela ClickSign (envelope ${ob.signEnvelopeId})`,
      },
    })
    await this.prisma.client.update({ where: { id: ob.client.id }, data: { hasContract: true } })
    await this.prisma.onboarding.update({ where: { id: ob.id }, data: { signStatus: 'completed' } })
    await this.activityLog.log({
      clientId: ob.client.id, entityType: 'ONBOARDING', entityId: ob.id, action: 'SIGNATURE_COMPLETED',
      description: `Contrato assinado na ClickSign e anexado (${ob.client.companyName})`,
    })
  }

  /** Evento do webhook: acha o onboarding pelo metadata ou pelo id do documento. */
  async signatureEvent(e: { event: string; documentIds: string[]; onboardingId?: string }) {
    const include = { client: { select: { id: true, companyName: true } } } as const
    let ob = e.onboardingId ? await this.prisma.onboarding.findUnique({ where: { id: e.onboardingId }, include }) : null
    if (!ob && e.documentIds.length) {
      const all = await this.prisma.onboarding.findMany({ where: { signEnvelopeId: { not: null } }, include })
      ob = all.find(o => e.documentIds.includes(((o.signSigners ?? {}) as { documentId?: string }).documentId ?? '')) ?? null
    }
    if (!ob) return { found: false }
    // evento de uma versão antiga (cancelada ao reenviar) não mexe no envio atual
    const current = ((ob.signSigners ?? {}) as { documentId?: string }).documentId
    if (current && e.documentIds.length && !e.documentIds.includes(current)) return { found: true, stale: true }
    if (['document_closed', 'auto_close', 'close'].includes(e.event)) await this.completeSignature(ob)
    else if (e.event === 'refusal') await this.prisma.onboarding.update({ where: { id: ob.id }, data: { signStatus: 'declined' } })
    else if (e.event === 'cancel') await this.prisma.onboarding.update({ where: { id: ob.id }, data: { signStatus: 'voided' } })
    else if (e.event === 'sign') await this.syncSigners(ob)
    return { found: true }
  }

  async remindSignature(id: string) {
    const ob = await this.prisma.onboarding.findUnique({ where: { id }, include: { client: { select: { id: true, companyName: true } } } })
    if (!ob?.signEnvelopeId) throw new BadRequestException('Nenhum envio para assinatura')
    if (ob.signStatus === 'completed') throw new BadRequestException('O contrato já foi assinado')
    await this.clicksign.remind(ob.signEnvelopeId, 'Lembrete: o contrato da GOON está aguardando a sua assinatura.')
    await this.activityLog.log({ clientId: ob.client.id, entityType: 'ONBOARDING', entityId: ob.id, action: 'SIGNATURE_REMINDER', description: `Lembrete de assinatura reenviado pela ClickSign (${ob.client.companyName})` })
    return { ok: true }
  }

  /** Marca em signSigners quem já assinou (para o lembrete "cliente assinou, falta a GOON"). */
  private async syncSigners(ob: { id: string; signEnvelopeId: string | null; signSigners: unknown }) {
    const meta = (ob.signSigners ?? {}) as { documentId?: string; signers?: Array<{ name: string; email: string; signedAt?: string | null }> }
    if (!ob.signEnvelopeId || !meta.documentId || !meta.signers?.length) return
    const signed = await this.clicksign.signedBy(ob.signEnvelopeId, meta.documentId).catch(() => null)
    if (!signed) return
    const signers = meta.signers.map(sg => ({ ...sg, signedAt: signed[sg.email.toLowerCase()] ?? sg.signedAt ?? null }))
    await this.prisma.onboarding.update({ where: { id: ob.id }, data: { signSigners: { ...meta, signers } } })
  }

  /** Consulta manual (botão ↻ do card). */
  async refreshSignature(id: string) {
    const ob = await this.prisma.onboarding.findUnique({ where: { id }, include: { client: { select: { id: true, companyName: true } } } })
    if (!ob?.signEnvelopeId) throw new BadRequestException('Nenhum envio para assinatura')
    const documentId = ((ob.signSigners ?? {}) as { documentId?: string }).documentId
    if (!documentId) throw new BadRequestException('Envio sem documento')
    await this.syncSigners(ob)
    const d = await this.clicksign.document(ob.signEnvelopeId, documentId)
    if (d.status === 'closed') { await this.completeSignature(ob); return { status: 'completed' } }
    const map: Record<string, string> = { running: 'sent', canceled: 'voided', cancelled: 'voided', refused: 'declined' }
    const status = map[d.status] ?? ob.signStatus ?? 'sent'
    await this.prisma.onboarding.update({ where: { id }, data: { signStatus: status } })
    return { status }
  }


  // ===== Contrato a partir do modelo (.docx com {{CAMPOS}}) =====
  async listTemplates() {
    return this.prisma.contractTemplate.findMany({ select: { code: true, name: true, filename: true, updatedAt: true }, orderBy: { code: 'asc' } })
  }

  async saveTemplate(dto: { code: string; name?: string; filename: string; data: string }) {
    const code = dto.code?.trim().toUpperCase()
    if (!code || !dto.data) throw new BadRequestException('Informe o programa e o arquivo do modelo')
    return this.prisma.contractTemplate.upsert({
      where: { code },
      create: { code, name: dto.name?.trim() || code, filename: dto.filename, data: dto.data },
      update: { name: dto.name?.trim() || code, filename: dto.filename, data: dto.data },
      select: { code: true, name: true, filename: true, updatedAt: true },
    })
  }

  /** Campos sugeridos para o contrato: dados colados + cadastro + plano. */
  async contractDraft(id: string) {
    const ob = await this.prisma.onboarding.findUnique({
      where: { id },
      include: {
        client: {
          include: {
            plans: { where: { status: { not: 'CANCELLED' } }, orderBy: { startDate: 'desc' }, take: 1, include: { product: { select: { code: true, name: true } }, payments: { where: { status: { not: 'CANCELLED' } }, orderBy: { dueDate: 'asc' } } } },
          },
        },
      },
    })
    if (!ob) throw new NotFoundException('Onboarding não encontrado')
    const c = ob.client, plan = c.plans[0]
    const notes = ob.notes ?? ''
    const fromNotes = (...labels: string[]) => {
      for (const line of notes.split(/\r?\n/)) {
        const m = line.replace(/^[\s*•-]+/, '').match(/^([^:]{2,60}):\s*(.+)$/)
        if (!m) continue
        const k = m[1].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        if (labels.some(l => k.includes(l))) return m[2].trim()
      }
      return ''
    }
    const fmtCpf = (v: string) => { const d = v.replace(/\D/g, ''); return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : v }
    const fmtCnpj = (v: string) => { const d = v.replace(/\D/g, ''); return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : v }
    const fmtTel = (v: string) => { let d = v.replace(/\D/g, ''); if (d.startsWith('55') && d.length > 11) d = d.slice(2); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : v }

    const endereco = [c.address, c.addressNumber ? `nº ${c.addressNumber}` : '', c.neighborhood, c.city && c.state ? `${c.city}/${c.state}` : (c.city ?? ''), c.zipCode ? `CEP ${c.zipCode}` : '']
      .filter(Boolean).join(', ')
    const months = plan?.cycleDuration ?? (plan?.endDate && plan?.startDate ? Math.max(1, Math.round((plan.endDate.getTime() - plan.startDate.getTime()) / (30.44 * 864e5))) : 6)
    const value = plan ? Number(plan.value) : 0
    const pays = plan?.payments ?? []
    const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    // frases no formato dos modelos: forma de pagamento primeiro, datas dd/mm/aaaa;
    // CONDICAO completa "O investimento é de {{VALOR_TOTAL}}, " (minúscula no início, ponto no fim)
    const dmy = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
    const forma = plan?.paymentType === 'CARTAO' ? 'cartão de crédito' : plan?.paymentType === 'PIX' ? 'PIX' : 'boleto bancário'
    const Forma = forma.charAt(0).toUpperCase() + forma.slice(1)
    let resumo = '', condicao = ''
    if (pays.length === 1) {
      const p = pays[0]
      const pago = p.status === 'PAID'
      resumo = `${Forma}, pagamento à vista${pago ? ', integralmente pago nesta data' : ` em ${dmy(p.dueDate)}`}`
      condicao = `pago por ${forma}, à vista${pago ? ', já integralmente quitado nesta data' : `, com vencimento em ${dmy(p.dueDate)}`}.`
    } else if (pays.length > 1) {
      // entrada pode ter vindo em mais de um pagamento (ex.: parte paga + saldo): soma tudo
      const entries = pays.filter(p => p.installment === 0)
      const entry = entries.length ? { value: entries.reduce((a, p) => a + Number(p.value), 0), dueDate: entries[0].dueDate } : null
      const rest = pays.filter(p => p.installment !== 0)
      const same = rest.length > 0 && rest.every(p => Number(p.value) === Number(rest[0].value))
      const dia = rest[0]?.dueDate.getUTCDate()
      const parc = same ? `${rest.length} parcelas de ${brl(Number(rest[0].value))}` : `${rest.length} parcelas conforme cronograma`
      resumo = `${Forma}, ${entry ? `entrada de ${brl(Number(entry.value))} em ${dmy(entry.dueDate)} e ` : ''}${parc}${dia ? ` todo dia ${dia}` : ''}`
      condicao = `pago por ${forma}, ${entry ? `com entrada de ${brl(Number(entry.value))} em ${dmy(entry.dueDate)} e ` : 'em '}${same ? `${rest.length} (${extensoF(rest.length)}) parcelas mensais de ${brl(Number(rest[0].value))}` : `${rest.length} (${extensoF(rest.length)}) parcelas mensais conforme cronograma`}${rest[0] ? `, a primeira em ${dmy(rest[0].dueDate)}` : ''}${dia ? `, com vencimento todo dia ${dia}` : ''}.`
    }
    // condições estruturadas (prazo, forma, parcelas) para configurar o contrato na tela
    const entryPays = pays.filter(p => p.installment === 0)
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const terms = {
      months,
      startDate: plan?.startDate ? iso(plan.startDate) : iso(new Date()),
      paymentType: plan?.paymentType === 'CARTAO' ? 'CARTAO' : plan?.paymentType === 'PIX' ? 'PIX' : 'BOLETO',
      paidUpfront: pays.length === 1 && pays[0].status === 'PAID',
      cardInstallments: plan?.paymentType === 'CARTAO' ? (plan.installments ?? 1) : 1,
      installments: [
        ...(entryPays.length ? [{ dueDate: iso(entryPays[0].dueDate), value: entryPays.reduce((a, p) => a + Number(p.value), 0), entry: true }] : []),
        ...pays.filter(p => p.installment !== 0).map(p => ({ dueDate: iso(p.dueDate), value: Number(p.value), entry: false })),
      ],
    }
    const code = plan?.product?.code ?? null
    const fields: Record<string, string> = {
      RAZAO_SOCIAL: fromNotes('razao social') || c.companyName,
      NOME_FANTASIA: c.tradeName || fromNotes('nome fantasia') || c.companyName,
      CNPJ: c.cnpj ? fmtCnpj(c.cnpj) : fmtCnpj(fromNotes('cnpj')),
      ENDERECO: endereco || fromNotes('endereco'),
      REPRESENTANTE: c.responsible || fromNotes('responsavel'),
      CPF: fmtCpf(fromNotes('cpf')),
      EMAIL: fromNotes('e-mail para assinatura', 'email para assinatura', 'e-mail', 'email') || c.email || '',
      TELEFONE: fmtTel(fromNotes('telefone', 'whatsapp') || c.phone || c.whatsapp || ''),
      CICLO: `${months} (${extenso(months)}) meses`,
      CICLO_CURTO: `${months} MESES`,
      DATA_INICIO: plan?.startDate ? dataLonga(plan.startDate) : '',
      VALOR_TOTAL: value ? reaisPorExtenso(value) : '',
      RESUMO_PAGAMENTO: resumo,
      CONDICAO_PAGAMENTO: condicao,
      // hoje no horário de Brasília (à noite o UTC já virou o dia)
      DATA_ASSINATURA: dataLonga(new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }) + ' UTC')),
    }
    const templates = await this.listTemplates()
    return {
      fields, fieldList: CONTRACT_FIELDS, templates, terms,
      suggestedTemplate: templates.some(t => t.code === code) ? code : null,
      productCode: code, productName: plan?.product?.name ?? null,
    }
  }

  /** Gera pelo modelo e já manda pra ClickSign, sem baixar nada. */
  async sendGeneratedContract(id: string, dto: { template: string; fields: Record<string, string>; signers: Array<{ name: string; email: string }> }) {
    const g = await this.generateContract(id, dto, 'pdf')
    if (g.missing.length) throw new BadRequestException(`Preencha antes de enviar: ${g.missing.join(', ')}`)
    return this.sendForSignature(id, { filename: g.filename, data: g.buffer.toString('base64'), signers: dto.signers })
  }

  async generateContract(id: string, dto: { template: string; fields: Record<string, string> }, format: 'docx' | 'pdf' = 'docx') {
    const ob = await this.prisma.onboarding.findUnique({ where: { id }, include: { client: { select: { id: true, companyName: true } } } })
    if (!ob) throw new NotFoundException('Onboarding não encontrado')
    const t = await this.prisma.contractTemplate.findUnique({ where: { code: dto.template } })
    if (!t) throw new BadRequestException('Modelo de contrato não encontrado')
    const { buffer, missing } = await fillDocx(t.data, dto.fields ?? {})
    const checklist = { ...((ob.checklist ?? {}) as Record<string, boolean>), contrato_elaborado: true }
    await this.prisma.onboarding.update({ where: { id }, data: { checklist } })
    const safe = (dto.fields?.NOME_FANTASIA || ob.client.companyName).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')
    const base = `CONTRATO_GOON_${t.name.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_${safe}`
    if (format === 'pdf') return { buffer: await docxToPdf(buffer, t.name.toUpperCase()), missing, filename: `${base}.pdf`, mimeType: 'application/pdf' }
    return { buffer, missing, filename: `${base}.docx`, mimeType: DOCX_MIME }
  }

}
