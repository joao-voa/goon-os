import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { GoogleCalendarService } from './google-calendar.service'

const TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: 'Mentoria individual', GRUPO: 'Mentoria em grupo', CS: 'CS', DIAGNOSTICO: 'Diagnóstico',
  PLANO_VOO: 'Plano de voo', KICKOFF: 'Kickoff', FOLLOW_UP: 'Follow up', RG: 'Ritual de gestão',
  COMERCIAL: 'Reunião comercial', ALINHAMENTO: 'Alinhamento interno', OUTRO: 'Outro',
}

@Injectable()
export class MeetingsService {
  constructor(private prisma: PrismaService, private gcal: GoogleCalendarService) {}

  // ===== Google Agenda =====

  /**
   * Espelha a reunião na agenda Google do mentor. Nunca derruba a operação:
   * se o Google falhar, a reunião fica salva no GOON e o erro vai para
   * googleSyncError (dá pra tentar de novo em POST /:id/sync).
   * Reunião em grupo = um único evento; todas as linhas guardam o mesmo id.
   */
  async syncToGoogle(meetingId: string) {
    if (!this.gcal.enabled) return
    const m = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { client: { select: { companyName: true, email: true } } },
    })
    if (!m) return
    const group = m.googleEventId
      ? await this.prisma.meeting.findMany({
          where: { googleEventId: m.googleEventId },
          include: { client: { select: { companyName: true, email: true } } },
        })
      : [m]
    const ids = group.map(g => g.id)
    const others = group.length - 1

    try {
      const target = await this.gcal.calendarFor(m.mentorName)
      let eventId = m.googleEventId
      let calendar = m.googleCalendar

      // cancelada/reagendada (o horário antigo sai), ou sem mentor com agenda: tira do Google
      if (m.status === 'CANCELLED' || m.status === 'RESCHEDULED' || !target) {
        if (eventId && calendar && others === 0) await this.gcal.deleteEvent(calendar, eventId, m.inviteClient)
        await this.prisma.meeting.update({
          where: { id: m.id },
          data: { googleEventId: null, googleCalendar: null, meetLink: null, googleSyncError: null },
        })
        return
      }

      // trocou de mentor: sai da agenda antiga
      if (eventId && calendar && calendar !== target && others === 0) {
        await this.gcal.deleteEvent(calendar, eventId, false)
        eventId = null
      }
      calendar = target

      // reunião passada só registrada no GOON não vira evento novo
      if (!eventId && (m.status !== 'SCHEDULED' || m.date.getTime() < Date.now() - 3600000)) return

      const names = [...new Set(group.map(g => g.client?.companyName).filter(Boolean))] as string[]
      const attendees = m.inviteClient
        ? [...new Set(group.map(g => g.client?.email?.trim().toLowerCase()).filter((e): e is string => !!e))]
        : []
      const input = {
        summary: m.type === 'GRUPO' || names.length !== 1 ? m.title : `${m.title} · ${names[0]}`,
        description: [
          TYPE_LABELS[m.type] ?? m.type,
          names.length ? `Cliente${names.length > 1 ? 's' : ''}: ${names.join(', ')}` : null,
          m.mentorName ? `Mentor: ${m.mentorName}` : null,
          m.notes ? `\n${m.notes}` : null,
          '\nAgendado pelo GOON OS',
        ].filter(Boolean).join('\n'),
        start: m.date,
        durationMin: m.duration,
        attendees,
        sendInvites: attendees.length > 0,
        requestId: `goon-${m.id}`,
      }
      const ev = eventId
        ? await this.gcal.updateEvent(calendar, eventId, input)
        : await this.gcal.createEvent(calendar, input)

      await this.prisma.meeting.updateMany({
        where: { id: { in: ids } },
        data: { googleEventId: ev.id, googleCalendar: calendar, meetLink: ev.meetLink, googleSyncError: null },
      })
    } catch (err) {
      await this.prisma.meeting.updateMany({
        where: { id: { in: ids } },
        data: { googleSyncError: (err as Error).message.slice(0, 500) },
      })
    }
  }

  calendarInfo() { return this.gcal.info() }

  async calendarConfig() {
    const [mentorCalendars, used] = await Promise.all([
      this.prisma.mentorCalendar.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.meeting.findMany({ where: { mentorName: { not: null } }, distinct: ['mentorName'], select: { mentorName: true } }),
    ])
    return {
      ...this.gcal.info(),
      mentors: mentorCalendars,
      knownMentorNames: used.map(u => u.mentorName).filter(Boolean),
    }
  }

  async upsertMentorCalendar(dto: { name: string; email: string; isActive?: boolean }) {
    const name = dto.name?.trim()
    const email = dto.email?.trim().toLowerCase()
    if (!name || !email || !email.includes('@')) throw new BadRequestException('Informe nome e e-mail')
    return this.prisma.mentorCalendar.upsert({
      where: { name },
      create: { name, email, isActive: dto.isActive ?? true },
      update: { email, isActive: dto.isActive ?? true },
    })
  }

  async removeMentorCalendar(id: string) {
    await this.prisma.mentorCalendar.delete({ where: { id } })
    return { deleted: true }
  }

  /** Testa o acesso à agenda (delegação no Workspace) lendo o dia de hoje. */
  async testCalendar(email: string) {
    const from = new Date(); from.setHours(0, 0, 0, 0)
    const to = new Date(from.getTime() + 86400000)
    try {
      const events = await this.gcal.busy(email.trim().toLowerCase(), from, to)
      return { ok: true, eventsToday: events.length }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }

  /** Compromissos do mentor no Google no intervalo, marcando os que são reuniões do GOON. */
  async mentorBusy(mentorName: string, from: string, to: string) {
    const calendar = await this.gcal.calendarFor(mentorName)
    if (!this.gcal.enabled || !calendar) return { calendar: null, events: [] }
    const events = await this.gcal.busy(calendar, new Date(from), new Date(to))
    const goon = await this.prisma.meeting.findMany({
      where: { googleEventId: { in: events.map(e => e.id) } },
      select: { id: true, googleEventId: true, title: true, client: { select: { companyName: true } } },
    })
    const byEvent = new Map(goon.map(g => [g.googleEventId, g]))
    return {
      calendar,
      events: events.map(e => {
        const g = byEvent.get(e.id)
        return { start: e.start, end: e.end, allDay: e.allDay, goon: g ? { meetingId: g.id, title: g.title, client: g.client?.companyName ?? null } : null }
      }),
    }
  }

  async findAll(params: { month?: number; year?: number; mentorName?: string; clientId?: string; status?: string }) {
    const { month, year, mentorName, clientId, status } = params
    const where: Record<string, unknown> = {}

    if (mentorName) where.mentorName = mentorName
    if (clientId) where.clientId = clientId
    if (status) where.status = status

    if (month && year) {
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 1)
      where.date = { gte: start, lt: end }
    } else if (year) {
      const start = new Date(year, 0, 1)
      const end = new Date(year + 1, 0, 1)
      where.date = { gte: start, lt: end }
    }

    return this.prisma.meeting.findMany({
      where,
      include: { client: { select: { id: true, companyName: true } } },
      orderBy: { date: 'asc' },
    })
  }

  async findByClient(clientId: string) {
    return this.prisma.meeting.findMany({
      where: { clientId },
      orderBy: { date: 'desc' },
    })
  }

  async create(dto: {
    clientId?: string
    title: string
    type: string
    category?: string
    date: string
    duration?: number
    mentorName?: string
    notes?: string
    inviteClient?: boolean
  }) {
    if (dto.clientId) {
      const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } })
      if (!client) throw new NotFoundException('Cliente nao encontrado')
    }

    // Auto-detect category from type
    const category = dto.category ?? (
      ['RG', 'ALINHAMENTO'].includes(dto.type) ? 'GESTAO' :
      dto.type === 'COMERCIAL' ? 'COMERCIAL' : 'MENTORIA'
    )

    const created = await this.prisma.meeting.create({
      data: {
        clientId: dto.clientId ?? null,
        title: dto.title,
        type: dto.type,
        category,
        date: new Date(dto.date),
        duration: dto.duration ?? 60,
        mentorName: dto.mentorName,
        notes: dto.notes,
        inviteClient: !!dto.inviteClient,
      },
    })
    await this.syncToGoogle(created.id)
    return this.prisma.meeting.findUnique({
      where: { id: created.id },
      include: { client: { select: { id: true, companyName: true } } },
    })
  }

  /**
   * Mentoria em grupo: cria a mesma reunião para TODOS os clientes ativos de um
   * programa (ex.: GOON Infinity). Assim a cadência de cada um é atualizada e
   * eles saem da lista de atenção de uma vez.
   */
  async createGroup(dto: {
    program: string
    title: string
    date: string
    duration?: number
    mentorName?: string
    notes?: string
    status?: string
    inviteClient?: boolean
  }) {
    const clients = await this.prisma.client.findMany({
      where: {
        status: 'ACTIVE',
        plans: { some: { status: 'ACTIVE', product: { code: dto.program.toUpperCase() } } },
      },
      select: { id: true, companyName: true },
    })
    if (clients.length === 0) throw new NotFoundException('Nenhum cliente ativo nesse programa')

    const date = new Date(dto.date)
    const status = dto.status ?? 'SCHEDULED'
    const created = await this.prisma.$transaction(
      clients.map(c => this.prisma.meeting.create({
        data: {
          clientId: c.id,
          title: dto.title,
          type: 'GRUPO',
          category: 'MENTORIA',
          date,
          duration: dto.duration ?? 60,
          mentorName: dto.mentorName,
          notes: dto.notes,
          status,
          doneAt: status === 'DONE' ? new Date() : null,
          inviteClient: !!dto.inviteClient,
        },
      })),
    )
    // um evento só no Google para o grupo inteiro
    if (created.length) {
      await this.syncToGoogle(created[0].id)
      const first = await this.prisma.meeting.findUnique({ where: { id: created[0].id } })
      if (first?.googleEventId) {
        await this.prisma.meeting.updateMany({
          where: { id: { in: created.map(c => c.id) } },
          data: { googleEventId: first.googleEventId, googleCalendar: first.googleCalendar, meetLink: first.meetLink },
        })
        await this.syncToGoogle(created[0].id) // agora com todos os convidados do grupo
      }
    }
    return { created: created.length, clients: clients.map(c => c.companyName) }
  }

  async update(id: string, dto: {
    title?: string
    type?: string
    date?: string
    duration?: number
    mentorName?: string
    notes?: string
    status?: string
    inviteClient?: boolean
  }) {
    const existing = await this.prisma.meeting.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Reuniao nao encontrada')

    const data: Record<string, unknown> = {}
    if (dto.title !== undefined) data.title = dto.title
    if (dto.type !== undefined) data.type = dto.type
    if (dto.date !== undefined) data.date = new Date(dto.date)
    if (dto.duration !== undefined) data.duration = dto.duration
    if (dto.mentorName !== undefined) data.mentorName = dto.mentorName
    if (dto.notes !== undefined) data.notes = dto.notes
    if (dto.status !== undefined) {
      data.status = dto.status
      if (dto.status === 'DONE') data.doneAt = new Date()
    }
    if (dto.inviteClient !== undefined) data.inviteClient = dto.inviteClient

    await this.prisma.meeting.update({ where: { id }, data })
    // só o que muda o evento dispara o Google (marcar como realizada não mexe)
    const touchesEvent = ['title', 'type', 'date', 'duration', 'mentorName', 'notes', 'inviteClient'].some(k => k in data)
      || data.status === 'CANCELLED' || data.status === 'RESCHEDULED'
      || (data.status === 'SCHEDULED' && ['CANCELLED', 'RESCHEDULED'].includes(existing.status))
    if (touchesEvent) await this.syncToGoogle(id)
    return this.prisma.meeting.findUnique({
      where: { id },
      include: { client: { select: { id: true, companyName: true } } },
    })
  }

  async remove(id: string) {
    const m = await this.prisma.meeting.findUnique({ where: { id } })
    if (m?.googleEventId && m.googleCalendar && this.gcal.enabled) {
      const others = await this.prisma.meeting.count({ where: { googleEventId: m.googleEventId, id: { not: id } } })
      if (others === 0) {
        try { await this.gcal.deleteEvent(m.googleCalendar, m.googleEventId, m.inviteClient) } catch { /* segue: apaga no GOON mesmo assim */ }
      }
    }
    await this.prisma.meeting.delete({ where: { id } })
    return { deleted: true }
  }

  async getClientCadence(clientId: string) {
    const now = new Date()
    const lastMeeting = await this.prisma.meeting.findFirst({
      where: { clientId, status: 'DONE', type: { not: 'CS' } },
      orderBy: { date: 'desc' },
    })
    const nextMeeting = await this.prisma.meeting.findFirst({
      where: { clientId, status: 'SCHEDULED', date: { gte: now }, type: { not: 'CS' } },
      orderBy: { date: 'asc' },
    })
    const totalDone = await this.prisma.meeting.count({ where: { clientId, status: 'DONE', type: { not: 'CS' } } })
    const totalScheduled = await this.prisma.meeting.count({ where: { clientId, status: 'SCHEDULED' } })
    const totalNoShow = await this.prisma.meeting.count({ where: { clientId, status: 'NO_SHOW' } })

    const daysSinceLastMeeting = lastMeeting ? Math.floor((now.getTime() - lastMeeting.date.getTime()) / (1000 * 60 * 60 * 24)) : null

    // Health: green (< 14 days), yellow (14-30 days), red (> 30 days or no meetings)
    let health: 'green' | 'yellow' | 'red' = 'red'
    if (daysSinceLastMeeting !== null) {
      if (daysSinceLastMeeting <= 14) health = 'green'
      else if (daysSinceLastMeeting <= 30) health = 'yellow'
    }

    return {
      lastMeeting: lastMeeting ? { date: lastMeeting.date, type: lastMeeting.type, title: lastMeeting.title } : null,
      nextMeeting: nextMeeting ? { date: nextMeeting.date, type: nextMeeting.type, title: nextMeeting.title } : null,
      daysSinceLastMeeting,
      totalDone,
      totalScheduled,
      totalNoShow,
      health,
    }
  }

  async getAllClientsCadence() {
    const now = new Date()
    // Todos os clientes ativos com algum plano ativo (inclui grupo GI/TTSG).
    // A cadência de reunião só se aplica a programas individuais; grupo entra
    // apenas por financeiro/vencido.
    const clients = await this.prisma.client.findMany({
      where: {
        status: 'ACTIVE',
        mentorshipEnded: false, // mentoria encerrada não aparece na agenda
        plans: { some: { status: 'ACTIVE' } },
      },
      select: {
        id: true,
        companyName: true,
        plans: {
          where: { status: 'ACTIVE' },
          select: { endDate: true, renewalStatus: true, product: { select: { code: true, name: true } } },
        },
      },
    })

    const result: Array<{
      clientId: string; companyName: string; programCode: string | null; programName: string | null
      lastMeetingDate: Date | null; nextMeetingDate: Date | null; daysSinceLastMeeting: number | null
      doneMeetingsCount: number; overdueCount: number; overdueValue: number; planExpired: boolean
      reasons: string[]; health: 'red' | 'yellow' | 'green'
    }> = []
    for (const client of clients) {
      const [lastMeeting, nextMeeting, doneMeetingsCount, overdue, futurePaymentCount] = await Promise.all([
        // CS (Customer Success) não conta na cadência
        this.prisma.meeting.findFirst({
          where: { clientId: client.id, status: 'DONE', type: { not: 'CS' } },
          orderBy: { date: 'desc' },
          select: { date: true },
        }),
        this.prisma.meeting.findFirst({
          where: { clientId: client.id, status: 'SCHEDULED', date: { gte: now }, type: { not: 'CS' } },
          orderBy: { date: 'asc' },
          select: { date: true, type: true },
        }),
        this.prisma.meeting.count({ where: { clientId: client.id, status: 'DONE', type: { not: 'CS' } } }),
        this.prisma.payment.findMany({
          where: {
            clientId: client.id,
            OR: [{ status: 'OVERDUE' }, { status: 'PENDING', dueDate: { lt: now } }],
          },
          select: { value: true },
        }),
        this.prisma.payment.count({
          where: { clientId: client.id, status: { in: ['PENDING', 'SCHEDULED'] }, dueDate: { gte: now } },
        }),
      ])

      const daysSince = lastMeeting ? Math.floor((now.getTime() - lastMeeting.date.getTime()) / (1000 * 60 * 60 * 24)) : null
      const overdueCount = overdue.length
      const overdueValue = overdue.reduce((s, p) => s + Number(p.value), 0)

      // Programa principal (prioriza individual p/ rótulo; senão o 1º plano ativo)
      const indivPlan = client.plans.find(p => ['GE', 'TTS', 'AURA'].includes(p.product.code)) ?? client.plans[0]
      const programCode = indivPlan?.product.code ?? null
      const programName = indivPlan?.product.name ?? null
      const isIndividual = ['GE', 'TTS', 'AURA'].includes(programCode ?? '')

      // Vencido: renovação sinalizada, OU contrato acabou E não há nenhuma parcela futura
      // (evita falso positivo de ciclo antigo quando o cliente já renovou / segue faturando)
      const endDates = client.plans.map(p => p.endDate).filter((d): d is Date => !!d)
      const maxEnd = endDates.length ? new Date(Math.max(...endDates.map(d => d.getTime()))) : null
      const renewalFlag = client.plans.some(p => ['PENDING', 'NOTIFIED'].includes(p.renewalStatus ?? ''))
      const planExpired = renewalFlag || (!!maxEnd && maxEnd < now && futurePaymentCount === 0)

      // Cadência só se aplica a programas individuais e só é "gap" se não há
      // reunião futura marcada (marcar reunião = já agiu)
      // Cadência vale pra todos (individual e grupo). Grupo é atualizado pela
      // reunião de grupo (que registra presença de todos do programa).
      void isIndividual
      const cadenceGap = !nextMeeting && (daysSince === null || daysSince > 30)

      const reasons: string[] = []
      if (overdueCount > 0) reasons.push('FINANCEIRO')
      if (planExpired) reasons.push('VENCIDO')
      if (cadenceGap) reasons.push('SEM_REUNIAO')

      // Severidade: financeiro/vencido são críticos (não some com reunião); cadência é atenção leve
      let health: 'red' | 'yellow' | 'green' = 'green'
      if (overdueCount > 0 || planExpired) health = 'red'
      else if (cadenceGap) health = 'yellow'

      result.push({
        clientId: client.id,
        companyName: client.companyName,
        programCode,
        programName,
        lastMeetingDate: lastMeeting?.date ?? null,
        nextMeetingDate: nextMeeting?.date ?? null,
        daysSinceLastMeeting: daysSince,
        doneMeetingsCount,
        overdueCount,
        overdueValue,
        planExpired,
        reasons,
        health,
      })
    }

    return result
  }

  async getStats() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(today)
    endOfWeek.setDate(endOfWeek.getDate() + 7)

    const [todayCount, weekCount, totalDone, totalScheduled] = await this.prisma.$transaction([
      this.prisma.meeting.count({ where: { date: { gte: today, lt: new Date(today.getTime() + 86400000) }, status: 'SCHEDULED' } }),
      this.prisma.meeting.count({ where: { date: { gte: today, lt: endOfWeek }, status: 'SCHEDULED' } }),
      this.prisma.meeting.count({ where: { status: 'DONE' } }),
      this.prisma.meeting.count({ where: { status: 'SCHEDULED' } }),
    ])

    return { todayCount, weekCount, totalDone, totalScheduled }
  }
}
