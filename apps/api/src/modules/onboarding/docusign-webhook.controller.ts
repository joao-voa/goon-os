import { Body, Controller, HttpCode, Post, Query, UnauthorizedException } from '@nestjs/common'
import { OnboardingService } from './onboarding.service'

/**
 * Aviso do DocuSign (Connect por envelope, JSON): status do envelope mudou.
 * Público, protegido pelo token no link (DOCUSIGN_WEBHOOK_TOKEN). Concluído = anexa o PDF assinado.
 */
@Controller('api/integrations/docusign')
export class DocusignWebhookController {
  constructor(private onboarding: OnboardingService) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Query('token') token: string, @Body() body: { event?: string; data?: { envelopeId?: string; envelopeSummary?: { status?: string } } }) {
    if (!process.env.DOCUSIGN_WEBHOOK_TOKEN || token !== process.env.DOCUSIGN_WEBHOOK_TOKEN) throw new UnauthorizedException()
    const envelopeId = body?.data?.envelopeId
    if (!envelopeId) return { ok: true }
    // o status vem no resumo; se não vier, o serviço consulta o DocuSign
    const status = body.data?.envelopeSummary?.status ?? (body.event?.replace(/^envelope-/, '') || undefined)
    await this.onboarding.syncSignature(envelopeId, status)
    return { ok: true }
  }
}
