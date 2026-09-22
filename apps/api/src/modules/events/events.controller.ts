import { Controller, Post, Body, HttpCode } from '@nestjs/common'
import { CrmService } from '../crm/crm.service'

// PÚBLICO — sem JwtAuthGuard. Formulário de captação de leads em eventos.
@Controller('api/public')
export class EventsController {
  constructor(private crm: CrmService) {}

  @Post('event-lead')
  @HttpCode(201)
  eventLead(@Body() dto: {
    responsible: string; companyName?: string; whatsapp?: string; email?: string
    instagram?: string; segment?: string; estimatedRevenue?: string; notes?: string; eventName?: string; leadSource?: string
  }) {
    return this.crm.createEventLead(dto)
  }
}
