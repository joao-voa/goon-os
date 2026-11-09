import { Module } from '@nestjs/common'
import { MeetingsController } from './meetings.controller'
import { MeetingsService } from './meetings.service'
import { GoogleCalendarService } from './google-calendar.service'
import { MentoriaBridgeService } from './mentoria-bridge.service'
import { MentoriaController } from './mentoria.controller'

@Module({
  controllers: [MeetingsController, MentoriaController],
  providers: [MeetingsService, GoogleCalendarService, MentoriaBridgeService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
