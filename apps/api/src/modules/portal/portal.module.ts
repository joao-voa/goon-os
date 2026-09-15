import { Module } from '@nestjs/common'
import { PortalController } from './portal.controller'
import { PortalService } from './portal.service'
import { MentorshipModule } from '../mentorship/mentorship.module'

@Module({
  imports: [MentorshipModule],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
