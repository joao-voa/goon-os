import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { PrismaModule } from '../../prisma/prisma.module'
import { AuditService } from './audit.service'
import { AuditController } from './audit.controller'
import { AuditInterceptor } from './audit.interceptor'

@Module({
  imports: [PrismaModule],
  controllers: [AuditController],
  providers: [
    AuditService,
    // Interceptor global: registra toda mutação (POST/PUT/PATCH/DELETE).
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AuditModule {}
