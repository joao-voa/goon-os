import { Injectable, Logger } from '@nestjs/common'
import { JWT } from 'google-auth-library'
import { PrismaService } from '../../prisma/prisma.service'

/**
 * Google Agenda via conta de serviço do Workspace com delegação em todo o
 * domínio: o GOON OS age "como" o mentor (subject = e-mail dele) e escreve
 * direto na agenda dele. Ninguém precisa conectar conta.
 *
 * Credencial: GOOGLE_SERVICE_ACCOUNT_JSON (o JSON da chave, puro ou em base64).
 * Sem a variável, a integração fica desligada e as reuniões seguem só no GOON.
 */
const SCOPES = ['https://www.googleapis.com/auth/calendar']
const API = 'https://www.googleapis.com/calendar/v3'
const TZ = 'America/Sao_Paulo'

type ServiceAccount = { client_email: string; private_key: string; client_id?: string }

export type CalendarEventInput = {
  summary: string
  description?: string
  start: Date
  durationMin: number
  attendees?: string[]
  sendInvites: boolean
  requestId: string // idempotência do link do Meet
}

@Injectable()
export class GoogleCalendarService {
  private readonly log = new Logger('GoogleCalendar')
  private sa: ServiceAccount | null | undefined
  private clients = new Map<string, JWT>()

  constructor(private prisma: PrismaService) {}

  private account(): ServiceAccount | null {
    if (this.sa !== undefined) return this.sa
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()
    if (!raw) return (this.sa = null)
    try {
      const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
      const parsed = JSON.parse(json) as ServiceAccount
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n')
      this.sa = parsed
    } catch (e) {
      this.log.error(`GOOGLE_SERVICE_ACCOUNT_JSON inválido: ${(e as Error).message}`)
      this.sa = null
    }
    return this.sa
  }

  get enabled() { return !!this.account() }

  info() {
    const sa = this.account()
    return { enabled: !!sa, serviceAccountEmail: sa?.client_email ?? null, clientId: sa?.client_id ?? null, scopes: SCOPES }
  }

  private async call<T>(asEmail: string, method: string, path: string, body?: unknown): Promise<T> {
    const sa = this.account()
    if (!sa) throw new Error('Integração com Google Agenda não configurada')
    let client = this.clients.get(asEmail)
    if (!client) {
      client = new JWT({ email: sa.client_email, key: sa.private_key, scopes: SCOPES, subject: asEmail })
      this.clients.set(asEmail, client)
    }
    const { token } = await client.getAccessToken()
    // Google limita rajadas por usuário (403 rateLimitExceeded / 429): tenta de novo com espera crescente
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${API}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (res.status === 204) return undefined as T
      const data = await res.json().catch(() => ({}))
      if (res.ok) return data as T
      const msg = (data as { error?: { message?: string } }).error?.message ?? res.statusText
      const retryable = res.status === 429 || res.status >= 500 || (res.status === 403 && /rate limit/i.test(msg))
      if (retryable && attempt < 4) {
        await new Promise(r => setTimeout(r, 800 * 2 ** attempt + Math.random() * 300))
        continue
      }
      throw new Error(`Google ${res.status}: ${msg}`)
    }
  }

  /** E-mail da agenda do mentor (MentorCalendar.name, sem diferenciar maiúsculas). */
  async calendarFor(mentorName?: string | null): Promise<string | null> {
    if (!mentorName?.trim()) return null
    const m = await this.prisma.mentorCalendar.findFirst({
      where: { name: { equals: mentorName.trim(), mode: 'insensitive' }, isActive: true },
      select: { email: true },
    })
    return m?.email ?? null
  }

  private body(e: CalendarEventInput) {
    const end = new Date(e.start.getTime() + e.durationMin * 60000)
    return {
      summary: e.summary,
      description: e.description,
      start: { dateTime: e.start.toISOString(), timeZone: TZ },
      end: { dateTime: end.toISOString(), timeZone: TZ },
      attendees: (e.attendees ?? []).map(email => ({ email })),
      conferenceData: { createRequest: { requestId: e.requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      reminders: { useDefault: true },
    }
  }

  async createEvent(calendar: string, e: CalendarEventInput) {
    const ev = await this.call<{ id: string; hangoutLink?: string }>(
      calendar, 'POST',
      `/calendars/primary/events?conferenceDataVersion=1&sendUpdates=${e.sendInvites ? 'all' : 'none'}`,
      this.body(e),
    )
    return { id: ev.id, meetLink: ev.hangoutLink ?? null }
  }

  async updateEvent(calendar: string, eventId: string, e: CalendarEventInput) {
    const ev = await this.call<{ id: string; hangoutLink?: string }>(
      calendar, 'PATCH',
      `/calendars/primary/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1&sendUpdates=${e.sendInvites ? 'all' : 'none'}`,
      this.body(e),
    )
    return { id: ev.id, meetLink: ev.hangoutLink ?? null }
  }

  async deleteEvent(calendar: string, eventId: string, notify: boolean) {
    try {
      await this.call(calendar, 'DELETE', `/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=${notify ? 'all' : 'none'}`)
    } catch (err) {
      // já apagado no Google: segue
      if (!/Google (404|410)/.test((err as Error).message)) throw err
    }
  }

  /** Compromissos que ocupam a agenda do mentor no intervalo (ignora "disponível" e recusados). */
  async busy(calendar: string, from: Date, to: Date) {
    type Ev = {
      id: string; status?: string; transparency?: string
      start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }
      attendees?: { self?: boolean; responseStatus?: string }[]
    }
    const qs = new URLSearchParams({
      timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250', timeZone: TZ,
    })
    const r = await this.call<{ items?: Ev[] }>(calendar, 'GET', `/calendars/primary/events?${qs}`)
    return (r.items ?? [])
      .filter(e => e.status !== 'cancelled' && e.transparency !== 'transparent')
      .filter(e => !e.attendees?.some(a => a.self && a.responseStatus === 'declined'))
      .map(e => ({
        id: e.id,
        start: e.start?.dateTime ?? e.start?.date ?? '',
        end: e.end?.dateTime ?? e.end?.date ?? '',
        allDay: !e.start?.dateTime,
      }))
  }
}
