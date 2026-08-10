import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { OWNER_EMAIL } from './owner.guard'

// Acesso ao módulo Vendas: dono (João) + conta de teste (temporário).
export const SALES_EMAILS = [OWNER_EMAIL.toLowerCase(), 'teste@teste.com']

@Injectable()
export class SalesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest()
    if (!user || !SALES_EMAILS.includes(user.email?.toLowerCase())) {
      throw new ForbiddenException('Acesso restrito')
    }
    return true
  }
}
