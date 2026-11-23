import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common'
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

  @Get('summary')
  getSummary(
    @Query('months') months?: string,
    @Query('year') year?: string,
    @Query('product') product?: string,
    @Query('category') category?: string,
    @Query('costCenter') costCenter?: string,
  ) {
    return this.service.getSummary({
      months,
      year: year ? parseInt(year, 10) : undefined,
      product, category, costCenter,
    })
  }

  @Get('view')
  getCashView(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getCashView(from, to)
  }

  @Get('stats')
  getCashStats() {
    return this.service.getCashStats()
  }

  @Post('balance')
  setCashBalance(@Body() dto: { date?: string; value: number; note?: string }, @Req() req: { user?: { email?: string } }) {
    return this.service.setCashBalance(dto, req.user?.email)
  }

}
