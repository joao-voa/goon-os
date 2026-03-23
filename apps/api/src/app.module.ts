import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { ActivityLogModule } from './modules/activity-log/activity-log.module'
import { ClientsModule } from './modules/clients/clients.module'
import { ProductsModule } from './modules/products/products.module'
import { PlansModule } from './modules/plans/plans.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ActivityLogModule,
    ClientsModule,
    ProductsModule,
    PlansModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
