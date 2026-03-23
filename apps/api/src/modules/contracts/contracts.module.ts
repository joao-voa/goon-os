import { Module } from '@nestjs/common'
import { ContractsService } from './contracts.service'
import { ContractsController } from './contracts.controller'
import { PdfService } from './pdf.service'

@Module({
  controllers: [ContractsController],
  providers: [ContractsService, PdfService],
  exports: [ContractsService],
})
export class ContractsModule {}
