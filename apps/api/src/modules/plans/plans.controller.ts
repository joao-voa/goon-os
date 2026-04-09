import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { PlansService } from './plans.service'
import { CreatePlanDto } from './dto/create-plan.dto'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'

@Controller('api')
@UseGuards(JwtAuthGuard)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get('clients/:clientId/plans')
  findByClient(@Param('clientId') clientId: string) {
    return this.plansService.findByClient(clientId)
  }

  @Post('clients/:clientId/plans')
  @HttpCode(HttpStatus.CREATED)
  create(@Param('clientId') clientId: string, @Body() dto: CreatePlanDto) {
    return this.plansService.create(clientId, dto)
  }

  @Put('plans/:id')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      value?: number
      paymentType?: string
      installments?: number
      installmentValue?: number
      cycleDuration?: number
      startDate?: string
      endDate?: string
      notes?: string
      status?: string
    },
  ) {
    return this.plansService.update(id, body)
  }

  @Delete('plans/:id')
  cancel(@Param('id') id: string) {
    return this.plansService.cancel(id)
  }

  // ---- Mentors ----

  @Get('plans/:planId/mentors')
  getMentors(@Param('planId') planId: string) {
    return this.plansService.getMentors(planId)
  }

  @Post('plans/:planId/mentors')
  @HttpCode(HttpStatus.CREATED)
  addMentor(
    @Param('planId') planId: string,
    @Body() dto: { mentorName: string; value: number; notes?: string },
  ) {
    return this.plansService.addMentor(planId, dto)
  }

  @Put('mentors/:mentorId')
  updateMentor(
    @Param('mentorId') mentorId: string,
    @Body() dto: { mentorName?: string; value?: number; notes?: string },
  ) {
    return this.plansService.updateMentor(mentorId, dto)
  }

  @Delete('mentors/:mentorId')
  removeMentor(@Param('mentorId') mentorId: string) {
    return this.plansService.removeMentor(mentorId)
  }
}
