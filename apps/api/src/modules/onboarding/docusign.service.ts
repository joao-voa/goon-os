import { Injectable, Logger } from '@nestjs/common'
import { createSign } from 'crypto'

/**
 * DocuSign eSignature (REST v2.1) com JWT Grant: o GOON OS age como o usuário
 * da conta DocuSign (consentimento dado uma vez). Sem as variáveis, desligado.
 *
 * DOCUSIGN_INTEGRATION_KEY  · chave da app (Apps and Keys)
 * DOCUSIGN_USER_ID          · API Username (GUID) de quem envia
 * DOCUSIGN_ACCOUNT_ID       · API Account ID
 * DOCUSIGN_PRIVATE_KEY      · chave RSA privada (PEM ou base64 do PEM)
 * DOCUSIGN_ENV              · "demo" (sandbox) ou "prod"
 * DOCUSIGN_WEBHOOK_TOKEN    · segredo no link do aviso de assinatura (Connect)
 */
type Signer = { name: string; email: string }

@Injectable()
export class DocusignService {
  private readonly log = new Logger('DocuSign')
  private token: { value: string; exp: number } | null = null
  private baseUri: string | null = null

  private get cfg() {
    const ik = process.env.DOCUSIGN_INTEGRATION_KEY, user = process.env.DOCUSIGN_USER_ID
    const account = process.env.DOCUSIGN_ACCOUNT_ID, raw = process.env.DOCUSIGN_PRIVATE_KEY?.trim()
    if (!ik || !user || !account || !raw) return null
    const key = (raw.includes('BEGIN') ? raw : Buffer.from(raw, 'base64').toString('utf8')).replace(/\\n/g, '\n')
    const prod = process.env.DOCUSIGN_ENV === 'prod'
    return { ik, user, account, key, authHost: prod ? 'account.docusign.com' : 'account-d.docusign.com' }
  }

  get enabled() { return !!this.cfg }

  /** Link para dar o consentimento (uma vez) ao usuário que envia. */
  consentUrl(redirect = 'https://goon-os-web.vercel.app') {
    const c = this.cfg
    if (!c) return null
    return `https://${c.authHost}/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${c.ik}&redirect_uri=${encodeURIComponent(redirect)}`
  }

  private async accessToken() {
    const c = this.cfg!
    if (this.token && this.token.exp > Date.now() + 60_000) return this.token.value
    const now = Math.floor(Date.now() / 1000)
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: c.ik, sub: c.user, aud: c.authHost, iat: now, exp: now + 3600, scope: 'signature impersonation' })}`
    const sig = createSign('RSA-SHA256').update(unsigned).sign(c.key).toString('base64url')
    const res = await fetch(`https://${c.authHost}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
    })
    const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string }
    if (!res.ok || !data.access_token) {
      throw new Error(data.error === 'consent_required' ? 'DocuSign: falta dar o consentimento à integração' : `DocuSign auth: ${data.error ?? res.status}`)
    }
    this.token = { value: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1000 }
    return this.token.value
  }

  private async api<T>(method: string, path: string, body?: unknown, raw = false): Promise<T> {
    const c = this.cfg!
    const token = await this.accessToken()
    if (!this.baseUri) {
      const ui = await fetch(`https://${c.authHost}/oauth/userinfo`, { headers: { Authorization: `Bearer ${token}` } })
      const info = (await ui.json()) as { accounts?: Array<{ account_id: string; base_uri: string }> }
      const acc = info.accounts?.find(a => a.account_id === c.account)
      if (!acc) throw new Error('DocuSign: conta não encontrada para esse usuário')
      this.baseUri = acc.base_uri
    }
    const res = await fetch(`${this.baseUri}/restapi/v2.1/accounts/${c.account}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string; errorCode?: string }
      throw new Error(`DocuSign ${res.status}: ${err.message ?? err.errorCode ?? res.statusText}`)
    }
    return (raw ? Buffer.from(await res.arrayBuffer()) : await res.json()) as T
  }

  /** Cria e envia o envelope. Cada signatário assina em ordem (1º cliente, depois GOON). */
  async send(opts: { subject: string; filename: string; base64: string; signers: Signer[]; webhookUrl?: string }) {
    const ext = (opts.filename.split('.').pop() ?? 'pdf').toLowerCase()
    const env = await this.api<{ envelopeId: string; status: string }>('POST', '/envelopes', {
      emailSubject: opts.subject.slice(0, 100),
      documents: [{ documentBase64: opts.base64, name: opts.filename, fileExtension: ext, documentId: '1' }],
      recipients: {
        // sem campos marcados: o signatário assina onde quiser (assinatura livre)
        signers: opts.signers.map((s, i) => ({ email: s.email, name: s.name, recipientId: String(i + 1), routingOrder: String(i + 1) })),
      },
      ...(opts.webhookUrl ? {
        eventNotification: {
          url: opts.webhookUrl,
          requireAcknowledgment: 'true',
          eventData: { version: 'restv2.1', format: 'json' },
          envelopeEvents: ['completed', 'declined', 'voided', 'delivered'].map(e => ({ envelopeEventStatusCode: e })),
        },
      } : {}),
      status: 'sent',
    })
    return env
  }

  async status(envelopeId: string) {
    return this.api<{ status: string; completedDateTime?: string }>('GET', `/envelopes/${envelopeId}`)
  }

  /** PDF final assinado (todos os documentos + certificado). */
  async signedPdf(envelopeId: string) {
    return this.api<Buffer>('GET', `/envelopes/${envelopeId}/documents/combined`, undefined, true)
  }

  logError(msg: string) { this.log.warn(msg) }
}
