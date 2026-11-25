import { Injectable } from '@nestjs/common'
import { createHmac, timingSafeEqual } from 'crypto'

/**
 * ClickSign API v3 (envelopes). Sem CLICKSIGN_ACCESS_TOKEN, desligado.
 *
 * CLICKSIGN_ACCESS_TOKEN   · token da API (Configurações > API na ClickSign)
 * CLICKSIGN_ENV            · "sandbox" (padrão) ou "prod"
 * CLICKSIGN_WEBHOOK_SECRET · segredo do webhook (HMAC SHA-256 no header Content-Hmac)
 *
 * Fluxo: cria envelope → sobe o documento → signatários (cada um com requisito de
 * qualificação "assinar" e autenticação por e-mail) → ativa (status running) e a
 * ClickSign manda os e-mails. Quando todos assinam: evento document_closed.
 */
type Signer = { name: string; email: string }

@Injectable()
export class ClicksignService {
  private get cfg() {
    const token = process.env.CLICKSIGN_ACCESS_TOKEN?.trim()
    if (!token) return null
    const host = process.env.CLICKSIGN_ENV === 'prod' ? 'https://app.clicksign.com' : 'https://sandbox.clicksign.com'
    return { token, base: `${host}/api/v3` }
  }

  get enabled() { return !!this.cfg }
  get env() { return process.env.CLICKSIGN_ENV === 'prod' ? 'prod' : 'sandbox' }

  private async api<T>(method: string, path: string, data?: unknown): Promise<T> {
    const c = this.cfg!
    const res = await fetch(`${c.base}${path}`, {
      method,
      headers: { Authorization: c.token, 'Content-Type': 'application/vnd.api+json', Accept: 'application/vnd.api+json' },
      body: data ? JSON.stringify({ data }) : undefined,
    })
    const body = (await res.json().catch(() => ({}))) as { data?: unknown; errors?: Array<{ detail?: string; title?: string }> }
    if (!res.ok) {
      const msg = body.errors?.map(e => e.detail ?? e.title).filter(Boolean).join('; ') || res.statusText
      throw new Error(`ClickSign ${res.status}: ${msg}`)
    }
    return body.data as T
  }

  /** Cria, sobe o documento, adiciona signatários e envia. Devolve os ids do envelope e do documento. */
  async send(opts: { name: string; filename: string; base64: string; mimeType: string; signers: Signer[]; metadata: Record<string, string> }) {
    type Res = { id: string; attributes?: { status?: string } }
    const env = await this.api<Res>('POST', '/envelopes', {
      type: 'envelopes',
      attributes: { name: opts.name.slice(0, 100), locale: 'pt-BR', auto_close: true, remind_interval: 3, default_subject: opts.name.slice(0, 100) },
    })
    const doc = await this.api<Res>('POST', `/envelopes/${env.id}/documents`, {
      type: 'documents',
      attributes: { filename: opts.filename, content_base64: `data:${opts.mimeType};base64,${opts.base64}`, metadata: opts.metadata },
    })
    for (const s of opts.signers) {
      const signer = await this.api<Res>('POST', `/envelopes/${env.id}/signers`, {
        type: 'signers',
        attributes: {
          name: s.name, email: s.email, has_documentation: false, refusable: false,
          communicate_events: { signature_request: 'email', signature_reminder: 'email', document_signed: 'email' },
        },
      })
      const rel = { document: { data: { type: 'documents', id: doc.id } }, signer: { data: { type: 'signers', id: signer.id } } }
      // assina como parte do contrato + autenticação por token no e-mail
      await this.api('POST', `/envelopes/${env.id}/requirements`, { type: 'requirements', attributes: { action: 'agree', role: 'sign' }, relationships: rel })
      await this.api('POST', `/envelopes/${env.id}/requirements`, { type: 'requirements', attributes: { action: 'provide_evidence', auth: 'email' }, relationships: rel })
    }
    const active = await this.api<Res>('PATCH', `/envelopes/${env.id}`, { id: env.id, type: 'envelopes', attributes: { status: 'running' } })
    return { envelopeId: env.id, documentId: doc.id, status: active.attributes?.status ?? 'running' }
  }

  /** Status do documento: closed = assinado por todos. Devolve também o link do PDF assinado (vale 5 min). */
  async document(envelopeId: string, documentId: string) {
    const d = await this.api<{ attributes?: { status?: string }; links?: { files?: { signed?: string } } }>('GET', `/envelopes/${envelopeId}/documents/${documentId}`)
    return { status: d.attributes?.status ?? 'unknown', signedUrl: d.links?.files?.signed ?? null }
  }

  /** Arquivo original (como a ClickSign guardou; .docx vira PDF lá). Link vale 5 min. */
  async downloadOriginal(envelopeId: string, documentId: string) {
    const d = await this.api<{ links?: { files?: { original?: string } } }>('GET', `/envelopes/${envelopeId}/documents/${documentId}`)
    const url = d.links?.files?.original
    if (!url) return null
    const res = await fetch(url)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  }

  async downloadSigned(envelopeId: string, documentId: string) {
    const d = await this.document(envelopeId, documentId)
    if (!d.signedUrl) throw new Error('ClickSign: PDF assinado ainda não disponível')
    const res = await fetch(d.signedUrl) // link temporário, sem Authorization
    if (!res.ok) throw new Error(`ClickSign download ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  }

  /** Lembrete manual: reenvia o pedido de assinatura para quem ainda não assinou (envelope precisa estar em andamento). */
  async remind(envelopeId: string, message?: string) {
    return this.api('POST', `/envelopes/${envelopeId}/notifications`, { type: 'notifications', attributes: message ? { message } : {} })
  }

  /** Confere o header Content-Hmac (sha256=<hex>) contra o corpo cru. */
  verifyWebhook(raw: Buffer | undefined, header: string | undefined) {
    const secret = process.env.CLICKSIGN_WEBHOOK_SECRET
    if (!secret || !raw || !header) return false
    const want = Buffer.from(`sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`)
    const got = Buffer.from(header.trim())
    return got.length === want.length && timingSafeEqual(got, want)
  }
}
