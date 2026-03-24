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
import { DocxService, ContractFields } from './docx.service'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'

@Controller('api/contracts')
@UseGuards(JwtAuthGuard)
export class ContractsController {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly docxService: DocxService,
  ) {}

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

  // ---- DOCX generation from saved contract ----
  @Post(':id/generate-docx')
  async generateDocxById(@Param('id') id: string, @Res() res: Response) {
    const contract = await this.contractsService.findOne(id)
    const raw = (contract.dynamicFields as Record<string, string>) ?? {}

    // Map stored fields → ContractFields shape
    const fields: ContractFields = {
      nome: raw.contratanteNome ?? raw.responsible ?? '',
      nacionalidade: raw.nacionalidade ?? 'brasileiro(a)',
      profissao: raw.profissao ?? '',
      estadoCivil: raw.estadoCivil ?? '',
      cpf: raw.contratanteCPF ?? '',
      rg: raw.rg ?? '',
      endereco: raw.contratanteEndereco ?? raw.address ?? '',
      enderecoNumero: raw.enderecoNumero ?? '',
      cep: raw.cep ?? '',
      cidade: raw.cidade ?? 'São Paulo',
      estado: raw.estado ?? 'SP',
      email: raw.contratanteEmail ?? '',
      empresa: raw.contratanteEmpresa ?? raw.companyName ?? '',
      cnpj: raw.contratanteCNPJ ?? raw.cnpj ?? '',
      valorTotal: raw.valorTotal ?? raw.value ?? '',
      valorExtenso: raw.valorExtenso ?? '',
      formaPagamento: raw.formaPagamento ?? '',
      programa: raw.productName ?? contract.templateType ?? '',
      duracaoMeses: raw.duracaoMeses ?? raw.duration ?? '6',
      dataContrato: raw.dataContrato ?? new Date().toLocaleDateString('pt-BR'),
    }

    const buffer = await this.docxService.generate(fields)
    const filename = `Contrato_${fields.programa}_${fields.empresa || fields.nome}.docx`
      .replace(/[^a-zA-Z0-9_.\-]/g, '_')

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
    })
    res.send(buffer)
  }

  // ---- DOCX generation from raw fields (no saved contract needed) ----
  @Post('generate-docx')
  @HttpCode(HttpStatus.OK)
  async generateDocxRaw(@Body() fields: ContractFields, @Res() res: Response) {
    const buffer = await this.docxService.generate(fields)
    const filename = `Contrato_${fields.programa}_${fields.empresa || fields.nome}.docx`
      .replace(/[^a-zA-Z0-9_.\-]/g, '_')

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
    })
    res.send(buffer)
  }
}
