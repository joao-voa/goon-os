import { Controller, Get, Post, Put, Patch, Body, Param, UseGuards, HttpCode, HttpStatus, Res } from '@nestjs/common'
import type { Response } from 'express'
import { OnboardingService } from './onboarding.service'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'

@Controller('api/onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get()
  findAll() {
    return this.onboardingService.findAll()
  }

  @Get('board')
  board() {
    return this.onboardingService.board()
  }

  @Patch(':id/checklist')
  setItem(@Param('id') id: string, @Body() body: { key: string; done: boolean | null }) {
    return this.onboardingService.setItem(id, body.key, body.done ?? null)
  }

  @Get('contract-templates')
  listTemplates() {
    return this.onboardingService.listTemplates()
  }

  @Put('contract-templates')
  saveTemplate(@Body() body: { code: string; name?: string; filename: string; data: string }) {
    return this.onboardingService.saveTemplate(body)
  }

  @Get('signature/info')
  signatureInfo() {
    return this.onboardingService.signatureInfo()
  }

  @Post(':id/signature')
  sendForSignature(@Param('id') id: string, @Body() body: { filename: string; data: string; mimeType?: string; signers: Array<{ name: string; email: string }>; replace?: boolean }) {
    return this.onboardingService.sendForSignature(id, body)
  }

  @Post(':id/signature/remind')
  remindSignature(@Param('id') id: string) {
    return this.onboardingService.remindSignature(id)
  }

  @Post(':id/signature/refresh')
  refreshSignature(@Param('id') id: string) {
    return this.onboardingService.refreshSignature(id)
  }

  @Get(':id/contract/draft')
  contractDraft(@Param('id') id: string) {
    return this.onboardingService.contractDraft(id)
  }

  @Post(':id/contract/send')
  sendGeneratedContract(@Param('id') id: string, @Body() body: { template: string; fields: Record<string, string>; signers: Array<{ name: string; email: string }>; replace?: boolean }) {
    return this.onboardingService.sendGeneratedContract(id, body)
  }

  @Post(':id/contract/generate')
  async generateContract(@Param('id') id: string, @Body() body: { template: string; fields: Record<string, string>; format?: 'docx' | 'pdf' }, @Res() res: Response) {
    const r = await this.onboardingService.generateContract(id, body, body.format === 'pdf' ? 'pdf' : 'docx')
    res.set({
      'Content-Type': r.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(r.filename)}"`,
      'X-Missing-Fields': r.missing.join(','),
      'Access-Control-Expose-Headers': 'Content-Disposition, X-Missing-Fields',
    })
    res.send(r.buffer)
  }

  @Patch(':id/contract-data')
  saveContractData(@Param('id') id: string, @Body() body: { text: string }) {
    return this.onboardingService.saveContractData(id, body.text ?? '')
  }

  @Patch(':id/notes')
  setNotes(@Param('id') id: string, @Body() body: { notes: string }) {
    return this.onboardingService.setNotes(id, body.notes ?? '')
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: { clientId: string }) {
    return this.onboardingService.create(body.clientId)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.onboardingService.findOne(id)
  }

  @Patch(':id/stage')
  changeStage(@Param('id') id: string, @Body() body: { toStage: string }) {
    return this.onboardingService.changeStage(id, body.toStage)
  }
}
