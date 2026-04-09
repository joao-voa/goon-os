import { Module } from '@nestjs/common'
import { PlansService } from './plans.service'
import { PlansController } from './plans.controller'
import { ExpensesModule } from '../expenses/expenses.module'

@Module({
  imports: [ExpensesModule],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
