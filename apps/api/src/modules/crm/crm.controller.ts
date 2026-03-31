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
  constructor(private readonly crmService: CrmService) {}

  @Get('pipeline')
  findPipeline(
    @Query('salesRep') salesRep?: string,
    @Query('leadSource') leadSource?: string,
  ) {
    return this.crmService.findPipeline({ salesRep, leadSource })
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
    return this.crmService.createLead(dto)
  }

  @Patch(':id/stage')
  changeStage(@Param('id') id: string, @Body() dto: { toStage: string }) {
    return this.crmService.changeStage(id, dto.toStage)
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
    return this.crmService.closeDeal(id, dto)
  }
}
