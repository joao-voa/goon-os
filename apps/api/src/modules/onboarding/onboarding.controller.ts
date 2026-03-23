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
