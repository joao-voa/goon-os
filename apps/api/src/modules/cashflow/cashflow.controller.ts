import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'
import { CashflowService } from './cashflow.service'

@UseGuards(JwtAuthGuard)
@Controller('api/cashflow')
export class CashflowController {
  constructor(private service: CashflowService) {}

  @Get()
  getMonthly(@Query('year') year?: string) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear()
    return this.service.getMonthly(y)
  }
}
