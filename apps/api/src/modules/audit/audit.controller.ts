import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { AuditService } from './audit.service'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'
import { OwnerGuard } from '../../auth/owner.guard'

// Acesso restrito ao dono (João) — OwnerGuard.
@Controller('api/audit-logs')
@UseGuards(JwtAuthGuard, OwnerGuard)
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  findAll(
    @Query('userEmail') userEmail?: string,
    @Query('method') method?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      userEmail, method, search, from, to,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    })
  }

  @Get('users')
  getUsers() {
    return this.service.getUsers()
  }
}
