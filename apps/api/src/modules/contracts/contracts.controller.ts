import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { Response } from 'express'
import { ContractsService } from './contracts.service'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'

@Controller('api/contracts')
@UseGuards(JwtAuthGuard)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  findAll(
    @Query('clientId') clientId?: string,
    @Query('status') status?: string,
    @Query('product') product?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.contractsService.findAll({
      clientId,
      status,
      product,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    })
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: { clientId: string; clientPlanId?: string; templateType: string }) {
    return this.contractsService.create(dto)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contractsService.findOne(id)
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: { dynamicFields?: Record<string, string>; isSigned?: boolean; signatureDate?: string },
  ) {
    return this.contractsService.update(id, dto)
  }

  @Patch(':id/status')
  changeStatus(@Param('id') id: string, @Body() dto: { status: string }) {
    return this.contractsService.changeStatus(id, dto.status)
  }

  @Post(':id/generate-pdf')
  async generatePdf(@Param('id') id: string, @Res() res: Response) {
    const html = await this.contractsService.generateHtml(id)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(html)
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const html = await this.contractsService.getHtml(id)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(html)
  }
}
