import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    userEmail?: string
    method?: string
    search?: string
    from?: string
    to?: string
    page?: number
    limit?: number
  }) {
    const { userEmail, method, search, from, to, page = 1, limit = 50 } = params
    const where: Record<string, unknown> = {}
    if (userEmail) where.userEmail = userEmail
    if (method) where.method = method
    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { path: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (from || to) {
      const range: Record<string, Date> = {}
      if (from) range.gte = new Date(from)
      if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); range.lte = d }
      where.createdAt = range
    }

    const take = Math.min(Number(limit) || 50, 200)
    const skip = ((Number(page) || 1) - 1) * take

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.auditLog.count({ where }),
    ])
    return { data, total, page: Number(page) || 1, limit: take }
  }

  // usuários distintos (pro filtro) + contagem de ações
  async getUsers() {
    const grouped = await this.prisma.auditLog.groupBy({
      by: ['userEmail'],
      _count: true,
      orderBy: { _count: { userEmail: 'desc' } },
    })
    return grouped.map(g => ({ userEmail: g.userEmail, count: g._count }))
  }
}
