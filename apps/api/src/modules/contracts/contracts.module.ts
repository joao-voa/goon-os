import { Module } from '@nestjs/common'
import { ContractsService } from './contracts.service'
import { ContractsController } from './contracts.controller'
import { PdfService } from './pdf.service'
import { DocxService } from './docx.service'

@Module({
  controllers: [ContractsController],
  providers: [ContractsService, PdfService, DocxService],
  exports: [ContractsService, DocxService],
})
export class ContractsModule {}
