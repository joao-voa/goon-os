import { Module } from '@nestjs/common'
import { CrmController } from './crm.controller'
import { CrmService } from './crm.service'
import { ActivityLogModule } from '../activity-log/activity-log.module'
import { PaymentsModule } from '../payments/payments.module'
import { CommissionsModule } from '../commissions/commissions.module'

@Module({
  imports: [ActivityLogModule, PaymentsModule, CommissionsModule],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
