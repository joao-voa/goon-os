import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { PersonAccountsController } from './person-accounts.controller'
import { PersonAccountsService } from './person-accounts.service'

@Module({
  imports: [PrismaModule],
  controllers: [PersonAccountsController],
  providers: [PersonAccountsService],
  exports: [PersonAccountsService],
})
export class PersonAccountsModule {}
