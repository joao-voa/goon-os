import { Body, Controller, Delete, Get, Headers, Param, Post, Query, UnauthorizedException } from '@nestjs/common'
import { timingSafeEqual } from 'crypto'
import { PrismaService } from '../../prisma/prisma.service'
import { MeetingsService } from './meetings.service'
import { MENTORIA_SOURCE, fromMentoriaStatus } from './mentoria-bridge.service'

const KIND_LABEL: Record<string, string> = { d1: 'D1', acompanhamento: 'Acompanhamento', encerramento: 'Encerramento' }

/**
 * Entrada do GOON Mentoria (servidor a servidor, sem login): encontro criado,
 * remarcado, cancelado ou excluído lá vira reunião aqui e vai para o Google.
 * Auth: Authorization: Bearer MENTORIA_SYNC_SECRET.
 */
@Controller('api/integrations/mentoria')
export class MentoriaController {
  constructor(private prisma: PrismaService, private meetings: MeetingsService) {}

  private auth(header?: string) {
    const secret = process.env.MENTORIA_SYNC_SECRET
    const got = header?.replace(/^Bearer\s+/i, '') ?? ''
    if (!secret || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) {
      throw new UnauthorizedException()
    }
  }

  /** Agenda do GOON OS para o Calendário GOON do Mentoria (só leitura). Sem os encontros que vieram de lá. */
  @Get('agenda')
  async agenda(@Headers('authorization') authorization: string, @Query('from') from?: string, @Query('to') to?: string) {
    this.auth(authorization)
    const start = from && !Number.isNaN(Date.parse(from)) ? new Date(from) : new Date(Date.now() - 31 * 864e5)
    const end = to && !Number.isNaN(Date.parse(to)) ? new Date(to) : new Date(start.getTime() + 93 * 864e5)
    const rows = await this.prisma.meeting.findMany({
      where: { date: { gte: start, lt: end }, OR: [{ externalSource: null }, { externalSource: { not: MENTORIA_SOURCE } }] },
      select: { id: true, googleEventId: true, title: true, type: true, category: true, date: true, duration: true, status: true, mentorName: true, meetLink: true, client: { select: { companyName: true } } },
      orderBy: { date: 'asc' },
      take: 1000,
    })
    // reunião em grupo: uma linha por cliente com o mesmo evento no Google -> um item só
    const out = new Map<string, { id: string; title: string; type: string; category: string; date: string; duration: number; status: string; mentorName: string | null; meetLink: string | null; clients: string[] }>()
    for (const { client, date, googleEventId, ...m } of rows) {
      const key = googleEventId ?? m.id
      const cur = out.get(key)
      if (cur) {
        if (client?.companyName) cur.clients.push(client.companyName)
        continue
      }
      out.set(key, { ...m, date: date.toISOString(), clients: client?.companyName ? [client.companyName] : [] })
    }
    return [...out.values()]
  }

  @Post('meetings')
  async upsert(
    @Headers('authorization') authorization: string,
    @Body() dto: { externalId: string; tenantSlug: string; tenantName?: string | null; kind?: string; scheduledAt: string; status?: string; mentor?: string | null },
  ) {
    this.auth(authorization)
    if (!dto?.externalId || !dto.tenantSlug || !dto.scheduledAt) return { linked: false, error: 'dados incompletos' }

    // marca sem vínculo: liga pelo nome do cliente quando bate; senão a reunião sai sem cliente (o Meet e o Google saem igual)
    let link = await this.prisma.mentoriaTenantLink.findUnique({ where: { tenantSlug: dto.tenantSlug } })
    const tenantName = dto.tenantName?.trim() || dto.tenantSlug
    if (!link) {
      const match = await this.prisma.client.findMany({ where: { companyName: { equals: tenantName, mode: 'insensitive' } }, select: { id: true }, take: 2 })
      if (match.length === 1) {
        link = await this.prisma.mentoriaTenantLink.create({ data: { tenantSlug: dto.tenantSlug, tenantName, clientId: match[0].id } })
      }
    }
    const client = link ? await this.prisma.client.findUnique({ where: { id: link.clientId }, select: { companyName: true } }) : null

    // agenda: mentor da mentoria (se tiver agenda Google cadastrada), senão o padrão da marca
    const mentorCal = dto.mentor?.trim()
      ? await this.prisma.mentorCalendar.findFirst({ where: { name: { equals: dto.mentor.trim(), mode: 'insensitive' }, isActive: true } })
      : null
    const mentorName = mentorCal?.name ?? link?.mentorName ?? 'Giulliano'
    const status = fromMentoriaStatus(dto.status ?? 'agendado')
    const kind = dto.kind ?? 'acompanhamento'

    const existing = await this.prisma.meeting.findUnique({
      where: { externalSource_externalId: { externalSource: MENTORIA_SOURCE, externalId: dto.externalId } },
    })
    let id: string
    if (existing) {
      await this.meetings.update(existing.id, { date: dto.scheduledAt, mentorName, status }, { fromMentoria: true })
      id = existing.id
    } else {
      const created = await this.meetings.create({
        clientId: link?.clientId,
        title: `Mentoria - GOON & ${client?.companyName ?? link?.tenantName ?? tenantName}`,
        type: kind === 'd1' ? 'KICKOFF' : 'INDIVIDUAL',
        category: 'MENTORIA',
        date: dto.scheduledAt,
        duration: 120,
        mentorName,
        notes: `Encontro ${KIND_LABEL[kind] ?? kind} (GOON Mentoria)`,
      }, { fromMentoria: true })
      id = created!.id
      await this.prisma.meeting.update({ where: { id }, data: { externalSource: MENTORIA_SOURCE, externalId: dto.externalId } })
      if (status !== 'SCHEDULED') await this.meetings.update(id, { status }, { fromMentoria: true })
    }
    const m = await this.prisma.meeting.findUnique({ where: { id }, select: { id: true, meetLink: true, googleSyncError: true, mentorName: true } })
    return { linked: true, goonosMeetingId: m?.id, meetLink: m?.meetLink ?? null, mentor: m?.mentorName ?? null, error: m?.googleSyncError ?? null }
  }

  @Delete('meetings/:externalId')
  async remove(@Headers('authorization') authorization: string, @Param('externalId') externalId: string) {
    this.auth(authorization)
    const existing = await this.prisma.meeting.findUnique({
      where: { externalSource_externalId: { externalSource: MENTORIA_SOURCE, externalId } },
    })
    if (existing) await this.meetings.remove(existing.id, { fromMentoria: true })
    return { deleted: !!existing }
  }
}
