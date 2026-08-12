import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'
import { MentorshipService } from './mentorship.service'

@UseGuards(JwtAuthGuard)
@Controller('api/mentorship')
export class MentorshipController {
  constructor(private service: MentorshipService) {}

  @Get('cockpit')
  cockpit(@Query('status') status?: string, @Query('mentor') mentor?: string, @Query('attention') attention?: string, @Query('q') q?: string) {
    return this.service.getCockpit({ status, mentor, attention, q })
  }

  @Get('kpis')
  kpis() {
    return this.service.getDashboardKpis()
  }

  @Get('overview')
  overview() {
    return this.service.getOverview()
  }

  @Get('available-clients')
  available() {
    return this.service.getAvailableClients()
  }

  @Get('clients/:clientId')
  detail(@Param('clientId') clientId: string) {
    return this.service.getClientDetail(clientId)
  }

  @Post('enroll')
  @HttpCode(201)
  enroll(@Body() dto: { clientId: string; mentorName?: string }) {
    return this.service.enroll(dto)
  }

  @Patch('profile/:clientId')
  updateProfile(@Param('clientId') clientId: string, @Body() dto: { mentorName?: string; status?: string; color?: string; notes?: string; mainPains?: string; goal?: string }) {
    return this.service.updateProfile(clientId, dto)
  }

  @Delete('profile/:clientId')
  unenroll(@Param('clientId') clientId: string) {
    return this.service.unenroll(clientId)
  }

  @Post('case-studies')
  @HttpCode(201)
  createCaseStudy(@Body() dto: Parameters<MentorshipService['createCaseStudy']>[0]) {
    return this.service.createCaseStudy(dto)
  }

  @Post('action-items')
  @HttpCode(201)
  createAction(@Body() dto: { clientId: string; what: string; who?: string; dueDate?: string; caseStudyId?: string }) {
    return this.service.createActionItem(dto)
  }

  @Patch('action-items/:id')
  updateAction(@Param('id') id: string, @Body() dto: { what?: string; who?: string; dueDate?: string; done?: boolean; status?: string }) {
    return this.service.updateActionItem(id, dto)
  }

  @Delete('action-items/:id')
  deleteAction(@Param('id') id: string) {
    return this.service.deleteActionItem(id)
  }

  @Get('templates')
  templates() {
    return this.service.listTemplates()
  }

  @Post('templates')
  @HttpCode(201)
  createTemplate(@Body() dto: { name: string; description?: string; items: Array<{ what: string; who?: string; offsetDays?: number }> }) {
    return this.service.createTemplate(dto)
  }

  @Post('templates/:id/apply')
  @HttpCode(201)
  applyTemplate(@Param('id') id: string, @Body() dto: { clientId: string }) {
    return this.service.applyTemplate(id, dto.clientId)
  }
}
