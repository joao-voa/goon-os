import { Module } from '@nestjs/common'
import { CrmController } from './crm.controller'
import { CrmService } from './crm.service'
import { ActivityLogModule } from '../activity-log/activity-log.module'
import { PaymentsModule } from '../payments/payments.module'
import { CommissionsModule } from '../commissions/commissions.module'
import { ExpensesModule } from '../expenses/expenses.module'

@Module({
  imports: [ActivityLogModule, PaymentsModule, CommissionsModule, ExpensesModule],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
