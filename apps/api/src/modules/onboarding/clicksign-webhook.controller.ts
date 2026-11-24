import { Controller, Headers, HttpCode, Post, Req, UnauthorizedException, type RawBodyRequest } from '@nestjs/common'
import type { Request } from 'express'
import { OnboardingService } from './onboarding.service'
import { ClicksignService } from './clicksign.service'

/**
 * Webhook da ClickSign (público, conferido por HMAC no header Content-Hmac).
 * document_closed/auto_close = todos assinaram: anexa o PDF assinado e marca "Contrato assinado".
 * Outros eventos (sign, refusal, cancel) só atualizam o status no card.
 */
@Controller('api/integrations/clicksign')
export class ClicksignWebhookController {
  constructor(private onboarding: OnboardingService, private clicksign: ClicksignService) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('content-hmac') hmac?: string) {
    if (!this.clicksign.verifyWebhook(req.rawBody, hmac)) throw new UnauthorizedException()
    const body = req.body as Record<string, any>
    const event: string = body?.event?.name ?? ''
    // o documento pode vir como objeto ou lista, com id em "id" ou "key"; metadata traz o onboarding
    const docs = ([] as any[]).concat(body?.document ?? body?.documents ?? [])
    const ids = docs.flatMap(d => [d?.id, d?.key]).filter(Boolean) as string[]
    const onboardingId = docs.map(d => d?.metadata?.onboardingId).find(Boolean) as string | undefined
    await this.onboarding.signatureEvent({ event, documentIds: ids, onboardingId })
    return { ok: true }
  }
}
