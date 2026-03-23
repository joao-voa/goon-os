import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    // 1. Total active clients
    const totalActiveClients = await this.prisma.client.count({ where: { status: 'ACTIVE' } })

    // 2. New clients this month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const newClientsThisMonth = await this.prisma.client.count({
      where: { createdAt: { gte: startOfMonth } },
    })

    // 3. Total revenue (sum of active plans' value)
    const activePlans = await this.prisma.clientPlan.findMany({
      where: { status: 'ACTIVE' },
      select: { value: true, productId: true, product: { select: { code: true } } },
    })

    const totalRevenue = activePlans.reduce((sum, p) => sum + Number(p.value), 0)

    // 4. Revenue by product
    const revenueByProduct: Record<string, number> = { GE: 0, GI: 0, GS: 0 }
    for (const plan of activePlans) {
      const code = plan.product.code
      revenueByProduct[code] = (revenueByProduct[code] ?? 0) + Number(plan.value)
    }

    // 5. Pipeline summary (onboarding stages count)
    const onboardings = await this.prisma.onboarding.groupBy({
      by: ['currentStage'],
      _count: true,
    })
    const pipelineSummary = onboardings.map(o => ({ stage: o.currentStage, count: o._count }))

    // 6. Contracts status
    const contracts = await this.prisma.contract.groupBy({
      by: ['status'],
      _count: true,
    })
    const contractsStatus = contracts.map(c => ({ status: c.status, count: c._count }))

    // 7. Recent activity (last 10)
    const recentActivity = await this.prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { client: { select: { id: true, companyName: true } } },
    })

    return {
      kpis: { totalActiveClients, newClientsThisMonth, totalRevenue, revenueByProduct },
      pipelineSummary,
      contractsStatus,
      recentActivity,
    }
  }
}
