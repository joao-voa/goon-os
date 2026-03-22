import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class ActivityLogService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    clientId?: string
    entityType: string
    entityId: string
    action: string
    fromValue?: string
    toValue?: string
    description?: string
    userId?: string
  }) {
    return this.prisma.activityLog.create({ data: params })
  }

  async findByClient(clientId: string, limit = 20) {
    return this.prisma.activityLog.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  async findRecent(limit = 10) {
    return this.prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { client: { select: { id: true, companyName: true } } },
    })
  }
}
