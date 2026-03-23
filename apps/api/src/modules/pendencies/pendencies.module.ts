import { Module } from '@nestjs/common'
import { PendenciesController } from './pendencies.controller'
import { PendenciesService } from './pendencies.service'
import { PrismaModule } from '../../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [PendenciesController],
  providers: [PendenciesService],
  exports: [PendenciesService],
})
export class PendenciesModule {}
