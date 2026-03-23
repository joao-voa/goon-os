import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'
import { PaymentsService } from './payments.service'

@Controller()
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('api/payments')
  findAll(
    @Query('clientId') clientId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentsService.findAll({
      clientId,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    })
  }

  @Get('api/clients/:clientId/payments')
  findByClient(@Param('clientId') clientId: string) {
    return this.paymentsService.findByClient(clientId)
  }

  @Post('api/payments')
  create(
    @Body()
    dto: {
      clientId: string
      clientPlanId?: string
      contractId?: string
      installment: number
      totalInstallments: number
      dueDate: string
      value: number
      status?: string
      paidAt?: string
      observation?: string
    },
  ) {
    return this.paymentsService.create(dto)
  }

  @Post('api/payments/bulk')
  createBulk(
    @Body()
    dto: {
      clientId: string
      planId?: string
      totalInstallments: number
      value: number
      startDate: string
      paymentDay: number
      contractId?: string
    },
  ) {
    return this.paymentsService.createBulk(dto.clientId, dto.planId, {
      totalInstallments: dto.totalInstallments,
      value: dto.value,
      startDate: dto.startDate,
      paymentDay: dto.paymentDay,
      contractId: dto.contractId,
    })
  }

  @Put('api/payments/:id')
  update(
    @Param('id') id: string,
    @Body()
    dto: {
      dueDate?: string
      value?: number
      status?: string
      paidAt?: string
      observation?: string
    },
  ) {
    return this.paymentsService.update(id, dto)
  }

  @Patch('api/payments/:id/pay')
  markAsPaid(
    @Param('id') id: string,
    @Body() body: { paidAt?: string },
  ) {
    return this.paymentsService.markAsPaid(id, body?.paidAt)
  }

  @Post('api/payments/check-overdue')
  checkOverdue() {
    return this.paymentsService.markAsOverdue()
  }
}
