import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

const DAY = 1000 * 60 * 60 * 24
const ATTENTION_DAYS = 14 // dias sem sessão para acender atenção (ajustável)

@Injectable()
export class MentorshipService {
  constructor(private prisma: PrismaService) {}

  // ---------- Helpers ----------

  /** mentor de um cliente: profile.mentorName ou o 1º PlanMentor (≠ Giulliano) do plano ativo */
  private async deriveMentor(clientId: string): Promise<string | null> {
    const pm = await this.prisma.planMentor.findFirst({
      where: { plan: { clientId, status: 'ACTIVE' }, NOT: { mentorName: { contains: 'Giulliano' } } },
      orderBy: { value: 'desc' },
    })
    return pm?.mentorName ?? null
  }

  private attention(overdueCount: number, daysSinceContact: number | null): boolean {
    return overdueCount > 0 || (daysSinceContact !== null && daysSinceContact > ATTENTION_DAYS)
  }

  // ---------- Cockpit / board ----------

  async getCockpit(params: { status?: string; mentor?: string; attention?: string; q?: string } = {}) {
    const profiles = await this.prisma.menteeProfile.findMany({
      where: {
        status: params.status || undefined,
        mentorName: params.mentor || undefined,
      },
      orderBy: { enrolledAt: 'desc' },
    })
    const clientIds = profiles.map(p => p.clientId)
    if (clientIds.length === 0) return { mentees: [], total: 0 }

    const [clients, actions, studies, meetings] = await Promise.all([
      this.prisma.client.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, companyName: true, responsible: true, segment: true, plans: { where: { status: 'ACTIVE' }, take: 1, select: { product: { select: { code: true } } } } },
      }),
      this.prisma.actionItem.findMany({ where: { clientId: { in: clientIds }, done: false } }),
      this.prisma.sessionCaseStudy.findMany({ where: { clientId: { in: clientIds } }, orderBy: { sessionDate: 'desc' } }),
      this.prisma.meeting.findMany({ where: { clientId: { in: clientIds }, status: 'DONE' }, select: { clientId: true, date: true }, orderBy: { date: 'desc' } }),
    ])
    const clientMap = new Map(clients.map(c => [c.id, c]))
    const lastMeeting = new Map<string, Date>()
    for (const m of meetings) if (m.clientId && !lastMeeting.has(m.clientId)) lastMeeting.set(m.clientId, m.date)
    const lastStudy = new Map<string, typeof studies[number]>()
    for (const s of studies) if (!lastStudy.has(s.clientId)) lastStudy.set(s.clientId, s)

    const now = Date.now()
    let mentees = profiles.map(p => {
      const c = clientMap.get(p.clientId)
      const open = actions.filter(a => a.clientId === p.clientId)
      const overdue = open.filter(a => a.dueDate && a.dueDate.getTime() < now)
      const contactDates = [p.lastContactAt, lastMeeting.get(p.clientId)].filter(Boolean) as Date[]
      const lastContact = contactDates.length ? new Date(Math.max(...contactDates.map(d => d.getTime()))) : null
      const daysSinceContact = lastContact ? Math.floor((now - lastContact.getTime()) / DAY) : null
      const study = lastStudy.get(p.clientId)
      return {
        clientId: p.clientId,
        company: c?.companyName ?? '(cliente removido)',
        responsible: c?.responsible ?? null,
        segment: c?.segment ?? null,
        tier: c?.plans[0]?.product?.code ?? null,
        mentorName: p.mentorName,
        status: p.status,
        color: p.color,
        openActions: open.length,
        overdueActions: overdue.length,
        lastContact,
        daysSinceContact,
        attention: this.attention(overdue.length, daysSinceContact),
        lastMetrics: study ? { faturamentoAno: study.faturamentoAno, numVendas: study.numVendas, ticketMedio: study.ticketMedio, roas: study.roas, seguidoresIg: study.seguidoresIg, sessionDate: study.sessionDate } : null,
      }
    })

    if (params.attention === 'true') mentees = mentees.filter(m => m.attention)
    if (params.q) {
      const q = params.q.toLowerCase()
      mentees = mentees.filter(m => m.company.toLowerCase().includes(q) || (m.responsible ?? '').toLowerCase().includes(q))
    }
    // atenção primeiro, depois mais tempo sem contato
    mentees.sort((a, b) => Number(b.attention) - Number(a.attention) || (b.daysSinceContact ?? -1) - (a.daysSinceContact ?? -1))
    return { mentees, total: mentees.length }
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
    const profile = await this.prisma.menteeProfile.findUnique({ where: { clientId } })
    if (!profile) throw new NotFoundException('Cliente não está em acompanhamento')
    const [client, studies, actions, meetings] = await Promise.all([
      this.prisma.client.findUnique({ where: { id: clientId }, select: { id: true, companyName: true, responsible: true, email: true, whatsapp: true, phone: true, segment: true, plans: { where: { status: 'ACTIVE' }, select: { product: { select: { code: true, name: true } } } } } }),
      this.prisma.sessionCaseStudy.findMany({ where: { clientId }, orderBy: { sessionDate: 'desc' } }),
      this.prisma.actionItem.findMany({ where: { clientId }, orderBy: [{ done: 'asc' }, { dueDate: 'asc' }] }),
      this.prisma.meeting.findMany({ where: { clientId }, orderBy: { date: 'desc' }, take: 20, select: { id: true, title: true, type: true, date: true, status: true, notes: true } }),
    ])
    const now = Date.now()
    const openOverdue = actions.filter(a => !a.done && a.dueDate && a.dueDate.getTime() < now).length
    return {
      profile,
      client,
      attention: this.attention(openOverdue, profile.lastContactAt ? Math.floor((now - profile.lastContactAt.getTime()) / DAY) : null),
      caseStudies: studies,
      actionItems: actions,
      meetings,
    }
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

  async updateProfile(clientId: string, dto: { mentorName?: string; status?: string; color?: string; notes?: string }) {
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
    faturamentoAno?: number; numVendas?: number; ticketMedio?: number; investimentoTrafego?: number; roas?: number; seguidoresIg?: number
    situacaoAtual?: string; oQueTrabalhou?: string; proximosPassos?: string
  }) {
    const profile = await this.prisma.menteeProfile.findUnique({ where: { clientId: dto.clientId } })
    if (!profile) throw new NotFoundException('Cliente não está em acompanhamento')
    const sessionDate = dto.sessionDate ? new Date(dto.sessionDate) : new Date()
    const study = await this.prisma.sessionCaseStudy.create({
      data: {
        clientId: dto.clientId, meetingId: dto.meetingId ?? null, sessionDate,
        mentorName: dto.mentorName ?? profile.mentorName,
        faturamentoAno: dto.faturamentoAno ?? null, numVendas: dto.numVendas ?? null, ticketMedio: dto.ticketMedio ?? null,
        investimentoTrafego: dto.investimentoTrafego ?? null, roas: dto.roas ?? null, seguidoresIg: dto.seguidoresIg ?? null,
        situacaoAtual: dto.situacaoAtual ?? null, oQueTrabalhou: dto.oQueTrabalhou ?? null, proximosPassos: dto.proximosPassos ?? null,
      },
    })
    // registrar contato
    await this.prisma.menteeProfile.update({ where: { clientId: dto.clientId }, data: { lastContactAt: sessionDate, updatedAt: new Date() } })
    return study
  }

  // ---------- Ações (O QUE · QUEM · QUANDO · check) ----------

  async createActionItem(dto: { clientId: string; what: string; who?: string; dueDate?: string; caseStudyId?: string }) {
    const profile = await this.prisma.menteeProfile.findUnique({ where: { clientId: dto.clientId } })
    if (!profile) throw new NotFoundException('Cliente não está em acompanhamento')
    return this.prisma.actionItem.create({
      data: { clientId: dto.clientId, what: dto.what, who: dto.who ?? null, dueDate: dto.dueDate ? new Date(dto.dueDate) : null, caseStudyId: dto.caseStudyId ?? null },
    })
  }

  async updateActionItem(id: string, dto: { what?: string; who?: string; dueDate?: string; done?: boolean }) {
    const data: Record<string, unknown> = {}
    if (dto.what !== undefined) data.what = dto.what
    if (dto.who !== undefined) data.who = dto.who
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null
    if (dto.done !== undefined) { data.done = dto.done; data.completedAt = dto.done ? new Date() : null }
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
