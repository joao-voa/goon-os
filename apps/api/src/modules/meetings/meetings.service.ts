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
    const clients = await this.prisma.client.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, companyName: true },
    })

    const result: Array<{ clientId: string; lastMeetingDate: Date | null; nextMeetingDate: Date | null; daysSinceLastMeeting: number | null; health: string }> = []
    for (const client of clients) {
      const lastMeeting = await this.prisma.meeting.findFirst({
        where: { clientId: client.id, status: 'DONE' },
        orderBy: { date: 'desc' },
        select: { date: true },
      })
      const nextMeeting = await this.prisma.meeting.findFirst({
        where: { clientId: client.id, status: 'SCHEDULED', date: { gte: now } },
        orderBy: { date: 'asc' },
        select: { date: true },
      })
      const daysSince = lastMeeting ? Math.floor((now.getTime() - lastMeeting.date.getTime()) / (1000 * 60 * 60 * 24)) : null
      let health: string = 'red'
      if (daysSince !== null) {
        if (daysSince <= 14) health = 'green'
        else if (daysSince <= 30) health = 'yellow'
      }

      result.push({
        clientId: client.id,
        lastMeetingDate: lastMeeting?.date ?? null,
        nextMeetingDate: nextMeeting?.date ?? null,
        daysSinceLastMeeting: daysSince,
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
