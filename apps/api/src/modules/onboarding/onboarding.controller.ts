import { Controller, Get, Post, Patch, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
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

  @Get('signature/info')
  signatureInfo() {
    return this.onboardingService.signatureInfo()
  }

  @Post(':id/signature')
  sendForSignature(@Param('id') id: string, @Body() body: { filename: string; data: string; mimeType?: string; signers: Array<{ name: string; email: string }> }) {
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
