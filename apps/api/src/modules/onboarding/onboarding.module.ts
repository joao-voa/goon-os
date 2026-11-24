import { Module } from '@nestjs/common'
import { OnboardingService } from './onboarding.service'
import { OnboardingController } from './onboarding.controller'
import { DocusignService } from './docusign.service'
import { DocusignWebhookController } from './docusign-webhook.controller'

@Module({
  controllers: [OnboardingController, DocusignWebhookController],
  providers: [OnboardingService, DocusignService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
