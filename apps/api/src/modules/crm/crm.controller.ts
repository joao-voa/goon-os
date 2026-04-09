import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { CrmService } from './crm.service'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'

@Controller('api/crm')
@UseGuards(JwtAuthGuard)
export class CrmController {
  constructor(private readonly service: CrmService) {}

  @Get('pipeline')
  findPipeline(
    @Query('salesRep') salesRep?: string,
    @Query('leadSource') leadSource?: string,
  ) {
    return this.service.findPipeline({ salesRep, leadSource })
  }

  @Get('metrics')
  getMetrics() {
    return this.service.getMetrics()
  }

  @Get('suggestions')
  getSuggestions() {
    return this.service.getSuggestions()
  }

  @Post('sync-sheets')
  @HttpCode(HttpStatus.OK)
  syncFromSheets() {
    return this.service.syncFromSheets()
  }

  @Post('leads')
  @HttpCode(HttpStatus.CREATED)
  createLead(
    @Body()
    dto: {
      companyName: string
      responsible: string
      phone?: string
      whatsapp?: string
      email?: string
      leadSource?: string
      salesRep?: string
      leadNotes?: string
      segment?: string
    },
  ) {
    return this.service.createLead(dto)
  }

  @Get(':id/interactions')
  getInteractions(@Param('id') id: string) {
    return this.service.getInteractions(id)
  }

  @Post(':id/interactions')
  @HttpCode(201)
  addInteraction(@Param('id') id: string, @Body() dto: {
    type: string
    description: string
    userName?: string
    scheduledAt?: string
  }) {
    return this.service.addInteraction({ ...dto, clientId: id })
  }

  @Patch(':id/stage')
  changeStage(@Param('id') id: string, @Body() dto: { toStage: string }) {
    return this.service.changeStage(id, dto.toStage)
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  closeDeal(
    @Param('id') id: string,
    @Body()
    dto: {
      saleValue: number
      paymentMethod: string
      saleInstallments: number
      installmentValue: number
      productId: string
    },
  ) {
    return this.service.closeDeal(id, dto)
  }
}
