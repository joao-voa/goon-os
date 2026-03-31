import { Controller, Get, Post, Put, Patch, Delete, Param, Query, Body, HttpCode } from '@nestjs/common'
import { ExpensesService } from './expenses.service'

@Controller('api/expenses')
export class ExpensesController {
  constructor(private service: ExpensesService) {}

  @Get()
  findAll(
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('recurrence') recurrence?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      category,
      status,
      recurrence,
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

  @Post()
  @HttpCode(201)
  create(@Body() dto: {
    description: string
    category: string
    value: number
    recurrence: string
    dueDate: string
    status?: string
    notes?: string
  }) {
    return this.service.create(dto)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: {
    description?: string
    category?: string
    value?: number
    recurrence?: string
    dueDate?: string
    status?: string
    paidAt?: string
    notes?: string
  }) {
    return this.service.update(id, dto)
  }

  @Patch(':id/pay')
  markAsPaid(@Param('id') id: string) {
    return this.service.markAsPaid(id)
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id)
  }
}
