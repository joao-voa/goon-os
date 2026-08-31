import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common'
import type { Response } from 'express'
import { ClientsService } from './clients.service'
import { CreateClientDto } from './dto/create-client.dto'
import { UpdateClientDto } from './dto/update-client.dto'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'

@Controller('api/clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('segment') segment?: string,
    @Query('product') product?: string,
    @Query('expired') expired?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
  ) {
    return this.clientsService.findAll({
      search,
      status,
      segment,
      product,
      expired,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      sort: sort ?? 'companyName',
    })
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto)
  }

  @Patch(':id/cancel')
  cancelClient(@Param('id') id: string) {
    return this.clientsService.cancelClient(id)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id)
  }

  // ---- Documentos do cliente (contrato assinado etc.) ----

  @Get(':id/documents')
  listDocuments(@Param('id') id: string) {
    return this.clientsService.listDocuments(id)
  }

  @Post(':id/documents')
  @HttpCode(HttpStatus.CREATED)
  addDocument(
    @Param('id') id: string,
    @Body() dto: { filename: string; data: string; mimeType?: string; size?: number; type?: string; notes?: string },
  ) {
    return this.clientsService.addDocument(id, dto)
  }

  @Get(':id/documents/:docId/download')
  async downloadDocument(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Res() res: Response,
  ) {
    const doc = await this.clientsService.getDocument(id, docId)
    const buffer = Buffer.from(doc.data, 'base64')
    res.setHeader('Content-Type', doc.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.filename)}"`)
    res.send(buffer)
  }

  @Delete(':id/documents/:docId')
  removeDocument(@Param('id') id: string, @Param('docId') docId: string) {
    return this.clientsService.removeDocument(id, docId)
  }
}
