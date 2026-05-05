import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'
import { TasksService } from './tasks.service'

@UseGuards(JwtAuthGuard)
@Controller('api/tasks')
export class TasksController {
  constructor(private service: TasksService) {}

  @Get()
  findAll(@Query('stage') stage?: string, @Query('assignee') assignee?: string) {
    return this.service.findAll({ stage, assignee })
  }

  @Get('tags')
  getTags() {
    return this.service.getTags()
  }

  @Get('assignees')
  getAssignees() {
    return this.service.getAssignees()
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: {
    title: string
    description?: string
    stage?: string
    priority?: string
    assignee?: string
    dueDate?: string
    tags?: string[]
  }) {
    return this.service.create(dto)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: {
    title?: string
    description?: string
    stage?: string
    priority?: string
    assignee?: string
    dueDate?: string | null
    tags?: string[]
    order?: number
  }) {
    return this.service.update(id, dto)
  }

  @Patch(':id/stage')
  changeStage(@Param('id') id: string, @Body() dto: { stage: string }) {
    return this.service.changeStage(id, dto.stage)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }
}
