import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class MeetingsService {
  constructor(private prisma: PrismaService) {}

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

    return this.prisma.meeting.create({
      data: {
        clientId: dto.clientId ?? null,
        title: dto.title,
        type: dto.type,
        category,
        date: new Date(dto.date),
        duration: dto.duration ?? 60,
        mentorName: dto.mentorName,
        notes: dto.notes,
      },
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
          status: dto.status ?? 'SCHEDULED',
        },
      })),
    )
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

    return this.prisma.meeting.update({
      where: { id },
      data,
      include: { client: { select: { id: true, companyName: true } } },
    })
  }

  async remove(id: string) {
    await this.prisma.meeting.delete({ where: { id } })
    return { deleted: true }
  }

  async getClientCadence(clientId: string) {
    const now = new Date()
    const lastMeeting = await this.prisma.meeting.findFirst({
      where: { clientId, status: 'DONE' },
      orderBy: { date: 'desc' },
    })
    const nextMeeting = await this.prisma.meeting.findFirst({
      where: { clientId, status: 'SCHEDULED', date: { gte: now } },
      orderBy: { date: 'asc' },
    })
    const totalDone = await this.prisma.meeting.count({ where: { clientId, status: 'DONE' } })
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
        this.prisma.meeting.findFirst({
          where: { clientId: client.id, status: 'DONE' },
          orderBy: { date: 'desc' },
          select: { date: true },
        }),
        this.prisma.meeting.findFirst({
          where: { clientId: client.id, status: 'SCHEDULED', date: { gte: now } },
          orderBy: { date: 'asc' },
          select: { date: true, type: true },
        }),
        this.prisma.meeting.count({ where: { clientId: client.id, status: 'DONE' } }),
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
