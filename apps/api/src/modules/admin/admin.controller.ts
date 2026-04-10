import { Controller, Get, Post, Put, Delete, Param, Body, HttpCode, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'
import { AdminService } from './admin.service'

@UseGuards(JwtAuthGuard)
@Controller('api/admin/users')
export class AdminController {
  constructor(private service: AdminService) {}

  @Get()
  findAll() {
    return this.service.findAllUsers()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findUser(id)
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: {
    name: string
    email: string
    password: string
    role: string
    allowedModules?: string
  }) {
    return this.service.createUser(dto)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: {
    name?: string
    email?: string
    password?: string
    role?: string
    allowedModules?: string
    isActive?: boolean
  }) {
    return this.service.updateUser(id, dto)
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.deleteUser(id)
  }
}
