import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'

// Acesso restrito ao dono (João). Outros admins NÃO passam.
export const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'joaovitorafonso@gmail.com'

@Injectable()
export class OwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest()
    if (!user || user.email?.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
      throw new ForbiddenException('Acesso restrito ao dono')
    }
    return true
  }
}
