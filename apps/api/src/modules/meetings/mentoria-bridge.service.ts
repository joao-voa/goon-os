import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

/**
 * Ponte com o GOON Mentoria (app separado, Supabase + Netlify). As agendas
 * conversam nos dois sentidos:
 *  - GOON OS -> Mentoria: reunião de mentoria individual de cliente ligado a uma
 *    marca (MentoriaTenantLink) vira/atualiza o encontro lá (POST/DELETE
 *    {MENTORIA_API_URL}/api/integrations/goonos/meetings).
 *  - Mentoria -> GOON OS: MentoriaController recebe e grava aqui (e o Google sai daqui).
 * Autenticação dos dois lados: Bearer MENTORIA_SYNC_SECRET. Sem as variáveis, desligado.
 */
export const MENTORIA_SOURCE = 'goonmentoria'

export const toMentoriaStatus = (s: string) =>
  s === 'DONE' ? 'realizado' : s === 'SCHEDULED' ? 'agendado' : 'cancelado'
export const fromMentoriaStatus = (s: string) =>
  s === 'realizado' ? 'DONE' : s === 'cancelado' ? 'CANCELLED' : 'SCHEDULED'

@Injectable()
export class MentoriaBridgeService {
  private readonly log = new Logger('MentoriaBridge')
  constructor(private prisma: PrismaService) {}

  private get cfg() {
    const url = process.env.MENTORIA_API_URL?.replace(/\/+$/, '')
    const secret = process.env.MENTORIA_SYNC_SECRET
    return url && secret ? { url, secret } : null
  }

  get enabled() { return !!this.cfg }

  private async call(method: string, path: string, body?: unknown) {
    const cfg = this.cfg!
    const res = await fetch(`${cfg.url}${path}`, {
      method,
      headers: { Authorization: `Bearer ${cfg.secret}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`GOON Mentoria ${res.status}: ${(data as { error?: string }).error ?? res.statusText}`)
    return data as Record<string, unknown>
  }

  /** Reunião do GOON OS -> encontro no GOON Mentoria. Silencioso: erro só vai para o log. */
  async push(meetingId: string) {
    if (!this.cfg) return
    const m = await this.prisma.meeting.findUnique({ where: { id: meetingId } })
    if (!m?.clientId || m.category !== 'MENTORIA' || m.type === 'GRUPO') return
    const link = await this.prisma.mentoriaTenantLink.findFirst({ where: { clientId: m.clientId } })
    if (!link) return
    try {
      const r = await this.call('POST', '/api/integrations/goonos/meetings', {
        goonosMeetingId: m.id,
        externalId: m.externalSource === MENTORIA_SOURCE ? m.externalId : null,
        tenantSlug: link.tenantSlug,
        kind: ['KICKOFF', 'DIAGNOSTICO', 'PLANO_VOO'].includes(m.type) ? 'd1' : 'acompanhamento',
        scheduledAt: m.date.toISOString(),
        status: toMentoriaStatus(m.status),
        meetLink: m.meetLink,
      })
      const id = typeof r.id === 'string' ? r.id : null
      if (id && (m.externalSource !== MENTORIA_SOURCE || m.externalId !== id)) {
        await this.prisma.meeting.update({ where: { id: m.id }, data: { externalSource: MENTORIA_SOURCE, externalId: id } })
      }
    } catch (err) {
      this.log.warn(`push ${m.id}: ${(err as Error).message}`)
    }
  }

  /** Reunião excluída no GOON OS -> exclui o encontro lá. */
  async remove(m: { externalSource: string | null; externalId: string | null }) {
    if (!this.cfg || m.externalSource !== MENTORIA_SOURCE || !m.externalId) return
    try {
      await this.call('DELETE', `/api/integrations/goonos/meetings/${encodeURIComponent(m.externalId)}`)
    } catch (err) {
      this.log.warn(`remove ${m.externalId}: ${(err as Error).message}`)
    }
  }
}
