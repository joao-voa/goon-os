import { Module } from '@nestjs/common'
import { EventsController } from './events.controller'
import { CrmModule } from '../crm/crm.module'

@Module({
  imports: [CrmModule],
  controllers: [EventsController],
})
export class EventsModule {}
