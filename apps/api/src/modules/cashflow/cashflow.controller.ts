import { Controller, Get, Query } from '@nestjs/common'
import { CashflowService } from './cashflow.service'

@Controller('api/cashflow')
export class CashflowController {
  constructor(private service: CashflowService) {}

  @Get()
  getMonthly(@Query('year') year?: string) {
    const y = year ? parseInt(year) : new Date().getFullYear()
    return this.service.getMonthly(y)
  }
}
