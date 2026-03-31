import { Controller, Get, Patch, Param, Query } from '@nestjs/common'
import { CommissionsService } from './commissions.service'

@Controller('api/commissions')
export class CommissionsController {
  constructor(private service: CommissionsService) {}

  @Get()
  findAll(
    @Query('salesRep') salesRep?: string,
    @Query('status') status?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      salesRep,
      status,
      month: month ? parseInt(month) : undefined,
      year: year ? parseInt(year) : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    })
  }

  @Get('summary')
  getSummary(
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.service.getSummary({
      month: month ? parseInt(month) : undefined,
      year: year ? parseInt(year) : undefined,
    })
  }

  @Patch(':id/pay')
  markAsPaid(@Param('id') id: string) {
    return this.service.markAsPaid(id)
  }
}
