import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { PrismaService } from '../../prisma/prisma.service'

const MUTATIONS = ['POST', 'PUT', 'PATCH', 'DELETE']

// Rótulo amigável a partir de método + caminho.
function deriveAction(method: string, path: string): string {
  const p = path.toLowerCase()
  if (p.includes('/auth/login')) return 'Login'
  if (p.includes('/auth/change-password')) return 'Trocou a senha'
  if (p.endsWith('/close')) return 'Fechou venda'
  if (p.includes('/stage')) return 'Moveu etapa do lead'
  if (p.includes('/crm/leads')) return 'Criou lead'
  if (p.includes('/interactions')) return 'Registrou interação'
  if (p.includes('/sync')) return 'Sincronizou'
  if (p.includes('/pay')) return 'Marcou pagamento'

  const seg = path.split('?')[0].split('/').filter(Boolean) // ['api','clients','id']
  const resource = seg[1] ?? path
  const verb: Record<string, string> = { POST: 'Criou', PATCH: 'Atualizou', PUT: 'Atualizou', DELETE: 'Excluiu' }
  const labels: Record<string, string> = {
    clients: 'cliente', commissions: 'comissão', payments: 'pagamento', expenses: 'despesa',
    contracts: 'contrato', meetings: 'reunião', tasks: 'tarefa', pendencies: 'pendência',
    products: 'programa', plans: 'plano', onboarding: 'onboarding', crm: 'lead',
    'person-accounts': 'conta de pessoa', admin: 'admin', mentors: 'mentoria',
  }
  return `${verb[method] ?? method} ${labels[resource] ?? resource}`
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest()
    const method: string = req.method
    if (!MUTATIONS.includes(method)) return next.handle()

    const start = Date.now()
    const path: string = (req.originalUrl ?? req.url ?? '').split('?')[0]

    // não audita o próprio módulo de auditoria
    if (path.includes('/api/audit')) return next.handle()

    const record = (statusCode: number | null) => {
      const user = req.user
      const email = user?.email ?? req.body?.email ?? null
      const ipRaw = (req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || '').toString()
      this.prisma.auditLog.create({
        data: {
          userId: user?.id ?? null,
          userEmail: email,
          userRole: user?.role ?? null,
          method,
          path,
          action: deriveAction(method, path),
          statusCode: statusCode ?? null,
          ip: ipRaw.split(',')[0].trim() || null,
          durationMs: Date.now() - start,
        },
      }).catch(() => { /* auditoria nunca derruba a request */ })
    }

    return next.handle().pipe(
      tap({
        next: () => record(context.switchToHttp().getResponse()?.statusCode ?? null),
        error: (err) => record(err?.status ?? 500),
      }),
    )
  }
}
