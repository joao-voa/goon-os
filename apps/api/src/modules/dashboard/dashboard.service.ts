import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { daysUntil } from '../clients/renewal.util'

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

    // 8. Pendencies KPIs
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [
      totalOpenPendencies,
      contractUnsigned,
      paymentOverduePendencies,
      renewalPending,
    ] = await this.prisma.$transaction([
      this.prisma.pendency.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      this.prisma.pendency.count({ where: { type: 'CONTRACT_UNSIGNED', status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      this.prisma.pendency.count({ where: { type: 'PAYMENT_OVERDUE', status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      this.prisma.pendency.count({ where: { type: 'RENEWAL_PENDING', status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    ])

    // 9. Financial KPIs
    const endOfMonth = new Date(startOfMonth)
    endOfMonth.setMonth(endOfMonth.getMonth() + 1)

    const [paidPayments, pendingPayments, overduePayments] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where: { status: 'PAID', paidAt: { gte: startOfMonth, lt: endOfMonth } },
        select: { value: true },
      }),
      this.prisma.payment.findMany({
        where: { status: 'PENDING' },
        select: { value: true },
      }),
      this.prisma.payment.findMany({
        where: { status: 'OVERDUE' },
        select: { value: true },
      }),
    ])

    const totalReceived = paidPayments.reduce((sum, p) => sum + Number(p.value), 0)
    const totalPending = pendingPayments.reduce((sum, p) => sum + Number(p.value), 0)
    const totalOverdue = overduePayments.reduce((sum, p) => sum + Number(p.value), 0)
    const overdueCount = overduePayments.length

    // MRR: sum of active plan values (treating each as monthly)
    const mrr = totalRevenue

    const averageTicket = totalActiveClients > 0 ? totalRevenue / totalActiveClients : 0

    // 10. Renewal clients (plans with endDate within 90 days)
    const renewalThreshold = new Date(today)
    renewalThreshold.setDate(renewalThreshold.getDate() + 90)

    const renewalPlans = await this.prisma.clientPlan.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { gte: today, lte: renewalThreshold },
      },
      select: {
        id: true,
        endDate: true,
        client: { select: { id: true, companyName: true } },
      },
      orderBy: { endDate: 'asc' },
    })

    const renewalClients = renewalPlans.map(plan => ({
      id: plan.client.id,
      companyName: plan.client.companyName,
      contractEndDate: plan.endDate,
      daysLeft: plan.endDate ? daysUntil(plan.endDate) : null,
    }))

    return {
      kpis: { totalActiveClients, newClientsThisMonth, totalRevenue, revenueByProduct },
      pipelineSummary,
      contractsStatus,
      recentActivity,
      pendencies: {
        total: totalOpenPendencies,
        contractUnsigned,
        paymentOverdue: paymentOverduePendencies,
        renewalPending,
      },
      financialKpis: {
        mrr,
        totalReceived,
        totalPending,
        totalOverdue,
        overdueCount,
        averageTicket,
      },
      renewals: {
        count: renewalClients.length,
        clients: renewalClients,
      },
    }
  }
}
