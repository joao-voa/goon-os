import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { ActivityLogModule } from './modules/activity-log/activity-log.module'
import { ClientsModule } from './modules/clients/clients.module'
import { ProductsModule } from './modules/products/products.module'
import { PlansModule } from './modules/plans/plans.module'
import { ContractsModule } from './modules/contracts/contracts.module'
import { OnboardingModule } from './modules/onboarding/onboarding.module'
import { DashboardModule } from './modules/dashboard/dashboard.module'
import { PaymentsModule } from './modules/payments/payments.module'
import { PendenciesModule } from './modules/pendencies/pendencies.module'
import { CrmModule } from './modules/crm/crm.module'
import { CommissionsModule } from './modules/commissions/commissions.module'
import { ExpensesModule } from './modules/expenses/expenses.module'
import { CashflowModule } from './modules/cashflow/cashflow.module'
import { AdminModule } from './modules/admin/admin.module'
import { MeetingsModule } from './modules/meetings/meetings.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ActivityLogModule,
    ClientsModule,
    ProductsModule,
    PlansModule,
    ContractsModule,
    OnboardingModule,
    DashboardModule,
    PaymentsModule,
    PendenciesModule,
    CrmModule,
    CommissionsModule,
    ExpensesModule,
    CashflowModule,
    MeetingsModule,
    AdminModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
