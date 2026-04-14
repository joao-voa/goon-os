import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'
import { MeetingsService } from './meetings.service'

@UseGuards(JwtAuthGuard)
@Controller('api/meetings')
export class MeetingsController {
  constructor(private service: MeetingsService) {}

  @Get()
  findAll(
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('mentorName') mentorName?: string,
    @Query('clientId') clientId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll({
      month: month ? parseInt(month, 10) : undefined,
      year: year ? parseInt(year, 10) : undefined,
      mentorName,
      clientId,
      status,
    })
  }

  @Get('stats')
  getStats() {
    return this.service.getStats()
  }

  @Get('cadence')
  getAllClientsCadence() {
    return this.service.getAllClientsCadence()
  }

  @Get('client/:clientId')
  findByClient(@Param('clientId') clientId: string) {
    return this.service.findByClient(clientId)
  }

  @Get('client/:clientId/cadence')
  getClientCadence(@Param('clientId') clientId: string) {
    return this.service.getClientCadence(clientId)
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: {
    clientId: string
    title: string
    type: string
    date: string
    duration?: number
    mentorName?: string
    notes?: string
  }) {
    return this.service.create(dto)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: {
    title?: string
    type?: string
    date?: string
    duration?: number
    mentorName?: string
    notes?: string
    status?: string
  }) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }
}
