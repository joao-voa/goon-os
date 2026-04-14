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
    clientId: string
    title: string
    type: string
    date: string
    duration?: number
    mentorName?: string
    notes?: string
  }) {
    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } })
    if (!client) throw new NotFoundException('Cliente nao encontrado')

    return this.prisma.meeting.create({
      data: {
        clientId: dto.clientId,
        title: dto.title,
        type: dto.type,
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
