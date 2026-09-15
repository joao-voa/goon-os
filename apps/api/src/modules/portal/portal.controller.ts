import { Controller, Get, Put, Body, Param } from '@nestjs/common'
import { PortalService } from './portal.service'

// PÚBLICO — sem JwtAuthGuard. A "senha" é o token do link na URL.
@Controller('api/portal')
export class PortalController {
  constructor(private portal: PortalService) {}

  @Get(':token')
  get(@Param('token') token: string) {
    return this.portal.getByToken(token)
  }

  @Put(':token/monthly')
  save(@Param('token') token: string, @Body() dto: {
    month: string
    faturamento?: number | null; clientesAtivos?: number | null; estoqueQtd?: number | null; estoqueValor?: number | null
    ticketMedio?: number | null; numVendas?: number | null; investimentoTrafego?: number | null; roas?: number | null; seguidoresIg?: number | null
  }) {
    return this.portal.saveByToken(token, dto)
  }
}
