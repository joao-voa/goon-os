import { Module } from '@nestjs/common'
import { MeetingsController } from './meetings.controller'
import { MeetingsService } from './meetings.service'
import { GoogleCalendarService } from './google-calendar.service'

@Module({
  controllers: [MeetingsController],
  providers: [MeetingsService, GoogleCalendarService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
