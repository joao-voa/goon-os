import { Module } from '@nestjs/common'
import { MentorshipService } from './mentorship.service'
import { MentorshipController } from './mentorship.controller'

@Module({
  controllers: [MentorshipController],
  providers: [MentorshipService],
  exports: [MentorshipService],
})
export class MentorshipModule {}
