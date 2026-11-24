import { Module } from '@nestjs/common'
import { OnboardingService } from './onboarding.service'
import { OnboardingController } from './onboarding.controller'
import { ClicksignService } from './clicksign.service'
import { ClicksignWebhookController } from './clicksign-webhook.controller'

@Module({
  controllers: [OnboardingController, ClicksignWebhookController],
  providers: [OnboardingService, ClicksignService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
