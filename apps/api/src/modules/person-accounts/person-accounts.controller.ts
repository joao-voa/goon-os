import { Controller, Get, Post, Put, Delete, Param, Query, Body, HttpCode, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'
import { PersonAccountsService } from './person-accounts.service'

@UseGuards(JwtAuthGuard)
@Controller('api/person-accounts')
export class PersonAccountsController {
  constructor(private service: PersonAccountsService) {}

  @Get()
  findAll() {
    return this.service.findAll()
  }

  @Get('summary')
  getSummary() {
    return this.service.getSummary()
  }

  @Get(':id/extract')
  getExtract(
    @Param('id') id: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.service.getExtract(id, {
      month: month ? parseInt(month, 10) : undefined,
      year: year ? parseInt(year, 10) : undefined,
    })
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: { name: string; type: string; aliases?: string[]; notes?: string }) {
    return this.service.create(dto)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: { name?: string; type?: string; aliases?: string[]; notes?: string; isActive?: boolean }) {
    return this.service.update(id, dto)
  }

  @Post(':id/pay')
  pay(@Param('id') id: string, @Body() dto: { amount: number; notes?: string; date?: string }) {
    return this.service.pay(id, dto)
  }

  @Post('sync')
  sync() {
    return this.service.sync()
  }

  @Delete('transactions/:txId')
  deleteTransaction(@Param('txId') txId: string) {
    return this.service.deleteTransaction(txId)
  }
}
