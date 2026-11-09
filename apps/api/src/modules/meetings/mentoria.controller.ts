import { Body, Controller, Delete, Headers, Param, Post, UnauthorizedException } from '@nestjs/common'
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

  @Post('meetings')
  async upsert(
    @Headers('authorization') authorization: string,
    @Body() dto: { externalId: string; tenantSlug: string; kind?: string; scheduledAt: string; status?: string; mentor?: string | null },
  ) {
    this.auth(authorization)
    if (!dto?.externalId || !dto.tenantSlug || !dto.scheduledAt) return { linked: false, error: 'dados incompletos' }

    const link = await this.prisma.mentoriaTenantLink.findUnique({ where: { tenantSlug: dto.tenantSlug } })
    if (!link) return { linked: false }
    const client = await this.prisma.client.findUnique({ where: { id: link.clientId }, select: { companyName: true } })

    // agenda: mentor da mentoria (se tiver agenda Google cadastrada), senão o padrão da marca
    const mentorCal = dto.mentor?.trim()
      ? await this.prisma.mentorCalendar.findFirst({ where: { name: { equals: dto.mentor.trim(), mode: 'insensitive' }, isActive: true } })
      : null
    const mentorName = mentorCal?.name ?? link.mentorName
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
        clientId: link.clientId,
        title: `Mentoria - GOON & ${client?.companyName ?? link.tenantName}`,
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
