import { Controller, Get, Post, Put, Patch, Param, Query, Body, HttpCode } from '@nestjs/common'
import { CommissionsService } from './commissions.service'

@Controller('api/commissions')
export class CommissionsController {
  constructor(private service: CommissionsService) {}

  @Get()
  findAll(
    @Query('salesRep') salesRep?: string,
    @Query('status') status?: string,
    @Query('clientId') clientId?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      salesRep,
      status,
      clientId,
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

  @Post('manual')
  @HttpCode(201)
  createManual(
    @Body() dto: {
      clientId: string
      salesRep: string
      percentage: number
      baseValue: number
      installments: number
    },
  ) {
    return this.service.createManual(dto)
  }

  @Put(':id')
  updateCommission(
    @Param('id') id: string,
    @Body() dto: {
      salesRep?: string
      percentage?: number
      baseValue?: number
      value?: number
    },
  ) {
    return this.service.updateCommission(id, dto)
  }

  @Patch(':id/pay')
  markAsPaid(@Param('id') id: string) {
    return this.service.markAsPaid(id)
  }

  @Patch(':id/revert')
  revertToPending(@Param('id') id: string) {
    return this.service.revertToPending(id)
  }
}
