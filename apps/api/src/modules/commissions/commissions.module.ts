import { Module } from '@nestjs/common'
import { CommissionsController } from './commissions.controller'
import { CommissionsService } from './commissions.service'
import { ActivityLogModule } from '../activity-log/activity-log.module'

@Module({
  imports: [ActivityLogModule],
  controllers: [CommissionsController],
  providers: [CommissionsService],
  exports: [CommissionsService],
})
export class CommissionsModule {}
