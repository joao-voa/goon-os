import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

const DAY = 1000 * 60 * 60 * 24
const ATTENTION_DAYS = 14 // dias sem sessão para acender atenção (ajustável)

@Injectable()
export class MentorshipService {
  constructor(private prisma: PrismaService) {}

  // ---------- Helpers ----------

  /** Mentor que conduz as sessões: TikTok (TTS/TTSG) → Carol; todo o resto → Giulliano. */
  private mentorForProduct(code: string | null | undefined): string {
    return code && ['TTS', 'TTSG'].includes(code) ? 'Carol Valladão' : 'Giulliano'
  }
  private async deriveMentor(clientId: string): Promise<string> {
    const plan = await this.prisma.clientPlan.findFirst({
      where: { clientId, status: 'ACTIVE' },
      orderBy: { value: 'desc' },
      select: { product: { select: { code: true } } },
    })
    return this.mentorForProduct(plan?.product.code)
  }

  private attention(overdueCount: number, daysSinceContact: number | null): boolean {
    return overdueCount > 0 || (daysSinceContact !== null && daysSinceContact > ATTENTION_DAYS)
  }

  // ---------- Cockpit / board ----------

  async getCockpit(params: { status?: string; mentor?: string; attention?: string; q?: string } = {}) {
    // TODOS os clientes ativos (com plano ativo) — não exige inscrição.
    const clients = await this.prisma.client.findMany({
      where: { status: 'ACTIVE', plans: { some: { status: 'ACTIVE' } } },
      select: {
        id: true, companyName: true, responsible: true, segment: true,
        plans: { where: { status: 'ACTIVE' }, take: 1, select: { product: { select: { code: true } } }, orderBy: { value: 'desc' } },
      },
      orderBy: { companyName: 'asc' },
    })
    const clientIds = clients.map(c => c.id)
    if (clientIds.length === 0) return { mentees: [], total: 0 }

    const [profiles, actions, studies, meetings, metrics] = await Promise.all([
      this.prisma.menteeProfile.findMany({ where: { clientId: { in: clientIds } } }),
      this.prisma.actionItem.findMany({ where: { clientId: { in: clientIds }, done: false } }),
      this.prisma.sessionCaseStudy.findMany({ where: { clientId: { in: clientIds } }, orderBy: { sessionDate: 'desc' } }),
      this.prisma.meeting.findMany({ where: { clientId: { in: clientIds }, status: 'DONE' }, select: { clientId: true, date: true }, orderBy: { date: 'desc' } }),
      this.prisma.monthlyMetric.findMany({ where: { clientId: { in: clientIds } }, orderBy: { month: 'desc' } }),
    ])
    const profileMap = new Map(profiles.map(p => [p.clientId, p]))
    const lastMeeting = new Map<string, Date>()
    for (const m of meetings) if (m.clientId && !lastMeeting.has(m.clientId)) lastMeeting.set(m.clientId, m.date)
    const lastStudy = new Map<string, typeof studies[number]>()
    for (const s of studies) if (!lastStudy.has(s.clientId)) lastStudy.set(s.clientId, s)
    const lastMetric = new Map<string, typeof metrics[number]>()
    for (const m of metrics) if (!lastMetric.has(m.clientId)) lastMetric.set(m.clientId, m)

    const now = Date.now()
    let mentees = clients.map(c => {
      const p = profileMap.get(c.id)
      const mentorName = p?.mentorName ?? this.mentorForProduct(c.plans[0]?.product?.code)
      const open = actions.filter(a => a.clientId === c.id)
      const overdue = open.filter(a => a.dueDate && a.dueDate.getTime() < now)
      const contactDates = [p?.lastContactAt, lastMeeting.get(c.id)].filter(Boolean) as Date[]
      const lastContact = contactDates.length ? new Date(Math.max(...contactDates.map(d => d.getTime()))) : null
      const daysSinceContact = lastContact ? Math.floor((now - lastContact.getTime()) / DAY) : null
      const study = lastStudy.get(c.id)
      const metric = lastMetric.get(c.id)
      return {
        clientId: c.id,
        company: c.companyName,
        responsible: c.responsible ?? null,
        segment: c.segment ?? null,
        tier: c.plans[0]?.product?.code ?? null,
        mentorName,
        status: p?.status ?? 'ACTIVE',
        color: p?.color ?? null,
        openActions: open.length,
        overdueActions: overdue.length,
        lastContact,
        daysSinceContact,
        enrolled: !!p,
        attention: this.attention(overdue.length, daysSinceContact),
        lastMetrics: (metric || study) ? { faturamentoMes: metric?.faturamento ?? study?.faturamentoMes ?? null, faturamentoAno: study?.faturamentoAno ?? null, clientesAtivos: metric?.clientesAtivos ?? study?.clientesAtivos ?? null, estoqueQtd: metric?.estoqueQtd ?? study?.estoqueQtd ?? null, estoqueValor: metric?.estoqueValor ?? study?.estoqueValor ?? null, numVendas: metric?.numVendas ?? study?.numVendas ?? null, ticketMedio: metric?.ticketMedio ?? study?.ticketMedio ?? null, roas: metric?.roas ?? study?.roas ?? null, seguidoresIg: metric?.seguidoresIg ?? study?.seguidoresIg ?? null, sessionDate: study?.sessionDate ?? null } : null,
      }
    })

    if (params.mentor) mentees = mentees.filter(m => m.mentorName === params.mentor)

    if (params.attention === 'true') mentees = mentees.filter(m => m.attention)
    if (params.q) {
      const q = params.q.toLowerCase()
      mentees = mentees.filter(m => m.company.toLowerCase().includes(q) || (m.responsible ?? '').toLowerCase().includes(q))
    }
    // atenção primeiro, depois mais tempo sem contato
    mentees.sort((a, b) => Number(b.attention) - Number(a.attention) || (b.daysSinceContact ?? -1) - (a.daysSinceContact ?? -1))
    return { mentees, total: mentees.length }
  }

  /** Visão geral consolidada de todos os clientes ativos (faturamento somado, série mensal, ranking) */
  async getOverview() {
    const clients = await this.prisma.client.findMany({
      where: { status: 'ACTIVE', plans: { some: { status: 'ACTIVE' } } },
      select: { id: true, companyName: true, responsible: true, plans: { where: { status: 'ACTIVE' }, take: 1, orderBy: { value: 'desc' }, select: { product: { select: { code: true } } } } },
    })
    const clientIds = clients.map(c => c.id)
    const [profiles, metrics] = await Promise.all([
      this.prisma.menteeProfile.findMany({ where: { clientId: { in: clientIds } } }),
      clientIds.length ? this.prisma.monthlyMetric.findMany({ where: { clientId: { in: clientIds } }, orderBy: { month: 'desc' } }) : Promise.resolve([]),
    ])
    const profileMap = new Map(profiles.map(p => [p.clientId, p]))
    const mentorOf = (c: typeof clients[number]) => profileMap.get(c.id)?.mentorName ?? this.mentorForProduct(c.plans[0]?.product?.code)

    // última métrica por cliente (metrics em ordem de mês desc → primeira = mês mais recente)
    const lastMetric = new Map<string, typeof metrics[number]>()
    for (const m of metrics) if (!lastMetric.has(m.clientId)) lastMetric.set(m.clientId, m)

    // série mensal somada de faturamento entre todos os clientes
    const monthlyMap = new Map<string, number>()
    for (const m of metrics) {
      if (m.faturamento == null) continue
      monthlyMap.set(m.month, (monthlyMap.get(m.month) ?? 0) + m.faturamento)
    }
    const monthly = [...monthlyMap.entries()].map(([month, faturamento]) => ({ month, faturamento })).sort((a, b) => a.month.localeCompare(b.month))

    // totais a partir da última métrica de cada cliente
    let faturamentoMes = 0, clientesAtivos = 0, estoqueQtd = 0, estoqueValor = 0, comDados = 0
    const byMentorMap = new Map<string, { mentor: string; faturamentoMes: number; mentees: number }>()
    const rows = clients.map(c => {
      const st = lastMetric.get(c.id)
      const mentor = mentorOf(c)
      const fm = st?.faturamento ?? null
      if (fm != null) { faturamentoMes += fm; comDados++ }
      if (st?.clientesAtivos != null) clientesAtivos += st.clientesAtivos
      if (st?.estoqueQtd != null) estoqueQtd += st.estoqueQtd
      if (st?.estoqueValor != null) estoqueValor += st.estoqueValor
      const mb = byMentorMap.get(mentor) ?? { mentor, faturamentoMes: 0, mentees: 0 }
      mb.faturamentoMes += fm ?? 0; mb.mentees++
      byMentorMap.set(mentor, mb)
      return { clientId: c.id, company: c.companyName, responsible: c.responsible ?? null, mentor, faturamentoMes: fm, clientesAtivos: st?.clientesAtivos ?? null, estoqueValor: st?.estoqueValor ?? null, month: st?.month ?? null }
    }).sort((a, b) => (b.faturamentoMes ?? -1) - (a.faturamentoMes ?? -1))

    return {
      totals: { faturamentoMes, clientesAtivos, estoqueQtd, estoqueValor, mentees: clients.length, comDados },
      byMentor: [...byMentorMap.values()].sort((a, b) => b.faturamentoMes - a.faturamentoMes),
      monthly,
      clients: rows,
    }
  }

  async getDashboardKpis() {
    const cockpit = await this.getCockpit()
    const m = cockpit.mentees
    return {
      ativos: m.filter(x => x.status === 'ACTIVE').length,
      total: m.length,
      emAtencao: m.filter(x => x.attention).length,
      acoesPendentes: m.reduce((s, x) => s + x.openActions, 0),
      acoesAtrasadas: m.reduce((s, x) => s + x.overdueActions, 0),
    }
  }

  // ---------- Detalhe do mentorado (jornada) ----------

  async getClientDetail(clientId: string) {
    const [profile, client, studies, actions, meetings, monthlyMetrics, payments] = await Promise.all([
      this.prisma.menteeProfile.findUnique({ where: { clientId } }),
      this.prisma.client.findUnique({
        where: { id: clientId },
        select: {
          id: true, companyName: true, tradeName: true, cnpj: true, responsible: true, email: true, whatsapp: true, phone: true,
          segment: true, city: true, state: true, estimatedRevenue: true, mainPains: true, strategicGoals: true, createdAt: true,
          plans: { where: { status: 'ACTIVE' }, orderBy: { value: 'desc' }, select: { value: true, installments: true, installmentValue: true, paymentType: true, startDate: true, endDate: true, status: true, renewalStatus: true, product: { select: { code: true, name: true } } } },
        },
      }),
      this.prisma.sessionCaseStudy.findMany({ where: { clientId }, orderBy: { sessionDate: 'desc' } }),
      this.prisma.actionItem.findMany({ where: { clientId }, orderBy: [{ done: 'asc' }, { dueDate: 'asc' }] }),
      this.prisma.meeting.findMany({ where: { clientId }, orderBy: { date: 'desc' }, take: 20, select: { id: true, title: true, type: true, date: true, status: true, notes: true } }),
      this.prisma.monthlyMetric.findMany({ where: { clientId }, orderBy: { month: 'asc' } }),
      this.prisma.payment.findMany({ where: { clientId, status: { not: 'CANCELLED' } }, orderBy: { dueDate: 'asc' }, select: { installment: true, totalInstallments: true, dueDate: true, value: true, status: true, paidAt: true } }),
    ])
    if (!client) throw new NotFoundException('Cliente não encontrado')
    // mentor derivado do split se não houver perfil
    const mentorName = profile?.mentorName ?? await this.deriveMentor(clientId)
    const now = Date.now()

    // financeiro / inadimplência
    const activePlan = client.plans[0]
    const isOverdue = (p: typeof payments[number]) => p.status !== 'PAID' && p.dueDate.getTime() < now
    const overduePayments = payments.filter(isOverdue)
    const nextDue = payments.find(p => p.status !== 'PAID' && p.dueDate.getTime() >= now) ?? null
    const paidCount = payments.filter(p => p.status === 'PAID').length
    const billing = {
      plan: activePlan ? {
        code: activePlan.product.code, name: activePlan.product.name,
        value: Number(activePlan.value), installments: activePlan.installments,
        installmentValue: activePlan.installmentValue != null ? Number(activePlan.installmentValue) : null,
        paymentType: activePlan.paymentType, status: activePlan.status, renewalStatus: activePlan.renewalStatus ?? null,
        startDate: activePlan.startDate, endDate: activePlan.endDate ?? null,
      } : null,
      delinquent: overduePayments.length > 0,
      overdueCount: overduePayments.length,
      overdueTotal: overduePayments.reduce((s, p) => s + Number(p.value), 0),
      oldestOverdueDue: overduePayments[0]?.dueDate ?? null,
      nextDue: nextDue ? { dueDate: nextDue.dueDate, value: Number(nextDue.value), installment: nextDue.installment, totalInstallments: nextDue.totalInstallments } : null,
      paidCount, totalPayments: payments.length,
    }
    const openOverdue = actions.filter(a => !a.done && a.dueDate && a.dueDate.getTime() < now).length
    const lastMeeting = meetings.find(m => m.status === 'DONE')?.date ?? null
    const lastContact = profile?.lastContactAt ?? lastMeeting ?? null
    return {
      profile: {
        mentorName,
        status: profile?.status ?? 'ACTIVE',
        mainPains: profile?.mainPains ?? client.mainPains ?? null,
        goal: profile?.goal ?? client.strategicGoals ?? null,
        enrolled: !!profile,
      },
      client: {
        ...client,
        plan: client.plans[0] ? { value: Number(client.plans[0].value), installments: client.plans[0].installments, code: client.plans[0].product.code, name: client.plans[0].product.name } : null,
      },
      attention: this.attention(openOverdue, lastContact ? Math.floor((now - new Date(lastContact).getTime()) / DAY) : null),
      caseStudies: studies,
      actionItems: actions,
      meetings,
      monthlyMetrics,
      billing,
    }
  }

  /** upsert de métrica mensal (faturamento/clientes/estoque) — chave clientId+month */
  async upsertMonthlyMetric(clientId: string, dto: { month: string; faturamento?: number | null; clientesAtivos?: number | null; estoqueQtd?: number | null; estoqueValor?: number | null; ticketMedio?: number | null; numVendas?: number | null; investimentoTrafego?: number | null; roas?: number | null; seguidoresIg?: number | null; note?: string | null }) {
    const data = {
      faturamento: dto.faturamento ?? null, clientesAtivos: dto.clientesAtivos ?? null,
      estoqueQtd: dto.estoqueQtd ?? null, estoqueValor: dto.estoqueValor ?? null,
      ticketMedio: dto.ticketMedio ?? null, numVendas: dto.numVendas ?? null,
      investimentoTrafego: dto.investimentoTrafego ?? null, roas: dto.roas ?? null, seguidoresIg: dto.seguidoresIg ?? null,
      note: dto.note ?? null,
    }
    const metric = await this.prisma.monthlyMetric.upsert({
      where: { clientId_month: { clientId, month: dto.month } },
      create: { clientId, month: dto.month, ...data },
      update: data,
    })
    // garante perfil + marca contato
    let profile = await this.prisma.menteeProfile.findUnique({ where: { clientId } })
    if (!profile) profile = await this.prisma.menteeProfile.create({ data: { clientId, mentorName: await this.deriveMentor(clientId) } })
    await this.prisma.menteeProfile.update({ where: { clientId }, data: { updatedAt: new Date() } })
    return metric
  }

  async deleteMonthlyMetric(clientId: string, month: string) {
    await this.prisma.monthlyMetric.deleteMany({ where: { clientId, month } })
    return { ok: true }
  }

  /** clientes ativos ainda NÃO em acompanhamento (pra inscrever) */
  async getAvailableClients() {
    const enrolled = await this.prisma.menteeProfile.findMany({ select: { clientId: true } })
    const ids = enrolled.map(e => e.clientId)
    const clients = await this.prisma.client.findMany({
      where: { id: { notIn: ids.length ? ids : ['_none_'] }, plans: { some: { status: 'ACTIVE' } } },
      select: { id: true, companyName: true, responsible: true, plans: { where: { status: 'ACTIVE' }, take: 1, select: { product: { select: { code: true } } } } },
      orderBy: { companyName: 'asc' },
    })
    return clients.map(c => ({ id: c.id, company: c.companyName, responsible: c.responsible, tier: c.plans[0]?.product?.code ?? null }))
  }

  // ---------- Inscrição / perfil ----------

  async enroll(dto: { clientId: string; mentorName?: string }) {
    const exists = await this.prisma.menteeProfile.findUnique({ where: { clientId: dto.clientId } })
    if (exists) throw new BadRequestException('Cliente já está em acompanhamento')
    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } })
    if (!client) throw new NotFoundException('Cliente não encontrado')
    const mentorName = dto.mentorName || (await this.deriveMentor(dto.clientId))
    return this.prisma.menteeProfile.create({ data: { clientId: dto.clientId, mentorName } })
  }

  async updateProfile(clientId: string, dto: { mentorName?: string; status?: string; color?: string; notes?: string; mainPains?: string; goal?: string }) {
    await this.prisma.menteeProfile.update({ where: { clientId }, data: { ...dto, updatedAt: new Date() } })
    return this.getClientDetail(clientId)
  }

  async unenroll(clientId: string) {
    await this.prisma.menteeProfile.delete({ where: { clientId } })
    return { removed: true }
  }

  // ---------- Estudo de caso (por sessão) ----------

  async createCaseStudy(dto: {
    clientId: string; meetingId?: string; sessionDate?: string; mentorName?: string
    faturamentoMes?: number; faturamentoAno?: number; clientesAtivos?: number; estoqueQtd?: number; estoqueValor?: number
    numVendas?: number; ticketMedio?: number; investimentoTrafego?: number; roas?: number; seguidoresIg?: number
    numClientes?: number
    vendasPorCanal?: Array<{ canal: string; valor: number }>
    customFields?: Array<{ label: string; value: string }>
    materiais?: Array<{ label: string; url?: string }>
    situacaoAtual?: string; oQueTrabalhou?: string; proximosPassos?: string; transcricao?: string; pontosPrincipais?: string
  }) {
    let profile = await this.prisma.menteeProfile.findUnique({ where: { clientId: dto.clientId } })
    if (!profile) profile = await this.prisma.menteeProfile.create({ data: { clientId: dto.clientId, mentorName: dto.mentorName ?? await this.deriveMentor(dto.clientId) } })
    const sessionDate = dto.sessionDate ? new Date(dto.sessionDate) : new Date()
    const study = await this.prisma.sessionCaseStudy.create({
      data: {
        clientId: dto.clientId, meetingId: dto.meetingId ?? null, sessionDate,
        mentorName: dto.mentorName ?? profile.mentorName,
        faturamentoMes: dto.faturamentoMes ?? null, faturamentoAno: dto.faturamentoAno ?? null,
        clientesAtivos: dto.clientesAtivos ?? null, estoqueQtd: dto.estoqueQtd ?? null, estoqueValor: dto.estoqueValor ?? null,
        numVendas: dto.numVendas ?? null, ticketMedio: dto.ticketMedio ?? null,
        investimentoTrafego: dto.investimentoTrafego ?? null, roas: dto.roas ?? null, seguidoresIg: dto.seguidoresIg ?? null,
        numClientes: dto.numClientes ?? null,
        vendasPorCanal: dto.vendasPorCanal ? (dto.vendasPorCanal as object) : undefined,
        customFields: dto.customFields ? (dto.customFields as object) : undefined,
        materiais: dto.materiais ? (dto.materiais as object) : undefined,
        situacaoAtual: dto.situacaoAtual ?? null, oQueTrabalhou: dto.oQueTrabalhou ?? null, proximosPassos: dto.proximosPassos ?? null,
        transcricao: dto.transcricao ?? null, pontosPrincipais: dto.pontosPrincipais ?? null,
      },
    })
    // registrar contato
    await this.prisma.menteeProfile.update({ where: { clientId: dto.clientId }, data: { lastContactAt: sessionDate, updatedAt: new Date() } })
    return study
  }

  // ---------- Ações (O QUE · QUEM · QUANDO · check) ----------

  async createActionItem(dto: { clientId: string; what: string; who?: string; dueDate?: string; caseStudyId?: string }) {
    const profile = await this.prisma.menteeProfile.findUnique({ where: { clientId: dto.clientId } })
    if (!profile) await this.prisma.menteeProfile.create({ data: { clientId: dto.clientId, mentorName: await this.deriveMentor(dto.clientId) } })
    return this.prisma.actionItem.create({
      data: { clientId: dto.clientId, what: dto.what, who: dto.who ?? null, dueDate: dto.dueDate ? new Date(dto.dueDate) : null, caseStudyId: dto.caseStudyId ?? null },
    })
  }

  async updateActionItem(id: string, dto: { what?: string; who?: string; dueDate?: string; done?: boolean; status?: string }) {
    const data: Record<string, unknown> = {}
    if (dto.what !== undefined) data.what = dto.what
    if (dto.who !== undefined) data.who = dto.who
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null
    if (dto.status !== undefined) {
      data.status = dto.status
      // mantém o boolean 'done' em sincronia com o kanban
      data.done = dto.status === 'DONE'
      data.completedAt = dto.status === 'DONE' ? new Date() : null
    }
    if (dto.done !== undefined) {
      data.done = dto.done
      data.completedAt = dto.done ? new Date() : null
      if (data.status === undefined) data.status = dto.done ? 'DONE' : 'TODO'
    }
    return this.prisma.actionItem.update({ where: { id }, data })
  }

  async deleteActionItem(id: string) {
    await this.prisma.actionItem.delete({ where: { id } })
    return { deleted: true }
  }

  // ---------- Fluxos padrão (templates) ----------

  listTemplates() {
    return this.prisma.flowTemplate.findMany({ orderBy: { createdAt: 'desc' } })
  }

  createTemplate(dto: { name: string; description?: string; items: Array<{ what: string; who?: string; offsetDays?: number }> }) {
    if (!dto.name || !Array.isArray(dto.items) || dto.items.length === 0) throw new BadRequestException('Template precisa de nome e itens')
    return this.prisma.flowTemplate.create({ data: { name: dto.name, description: dto.description ?? null, items: dto.items } })
  }

  async applyTemplate(templateId: string, clientId: string) {
    const tpl = await this.prisma.flowTemplate.findUnique({ where: { id: templateId } })
    if (!tpl) throw new NotFoundException('Template não encontrado')
    const items = (tpl.items as Array<{ what: string; who?: string; offsetDays?: number }>) ?? []
    const now = Date.now()
    const created = await this.prisma.$transaction(
      items.map(it => this.prisma.actionItem.create({
        data: { clientId, what: it.what, who: it.who ?? null, dueDate: it.offsetDays != null ? new Date(now + it.offsetDays * DAY) : null },
      })),
    )
    return { created: created.length }
  }
}
