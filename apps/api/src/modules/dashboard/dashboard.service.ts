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

    // 3. Total revenue (aggregate in DB)
    const revenueAgg = await this.prisma.clientPlan.aggregate({
      where: { status: 'ACTIVE' },
      _sum: { value: true },
    })
    const totalRevenue = Number(revenueAgg._sum.value ?? 0)

    // 4. Revenue by product (groupBy in DB)
    const revenueByProductRaw = await this.prisma.clientPlan.groupBy({
      by: ['productId'],
      where: { status: 'ACTIVE' },
      _sum: { value: true },
    })

    const products = await this.prisma.product.findMany({
      where: { id: { in: revenueByProductRaw.map(r => r.productId) } },
      select: { id: true, code: true },
    })
    const productCodeMap = new Map(products.map(p => [p.id, p.code]))

    const revenueByProduct: Record<string, number> = { GE: 0, GI: 0, GS: 0 }
    for (const row of revenueByProductRaw) {
      const code = productCodeMap.get(row.productId) ?? 'UNKNOWN'
      revenueByProduct[code] = Number(row._sum.value ?? 0)
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

    const endOfMonth = new Date(startOfMonth)
    endOfMonth.setMonth(endOfMonth.getMonth() + 1)

    // 9. Financial KPIs (aggregate in DB)
    const [paidAgg, pendingAgg, overdueAgg] = await this.prisma.$transaction([
      this.prisma.payment.aggregate({
        where: { status: 'PAID', paidAt: { gte: startOfMonth, lt: endOfMonth } },
        _sum: { value: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'PENDING' },
        _sum: { value: true },
        _count: true,
      }),
      this.prisma.payment.aggregate({
        where: { status: 'OVERDUE' },
        _sum: { value: true },
        _count: true,
      }),
    ])

    const totalReceived = Number(paidAgg._sum.value ?? 0)
    const totalPending = Number(pendingAgg._sum.value ?? 0)
    const totalOverdue = Number(overdueAgg._sum.value ?? 0)
    const overdueCount = overdueAgg._count ?? 0

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

    // 11. Expenses summary for current month
    const [expensesPrevistoAgg, expensesPagoAgg] = await this.prisma.$transaction([
      this.prisma.expense.aggregate({
        where: { status: 'PREVISTO', dueDate: { gte: startOfMonth, lt: endOfMonth } },
        _sum: { value: true },
      }),
      this.prisma.expense.aggregate({
        where: { status: 'PAGO', dueDate: { gte: startOfMonth, lt: endOfMonth } },
        _sum: { value: true },
      }),
    ])

    const totalExpensesPrevisto = Number(expensesPrevistoAgg._sum.value ?? 0)
    const totalExpensesPago = Number(expensesPagoAgg._sum.value ?? 0)

    // 12. Commissions summary for current month
    const [commissionsPendingAgg, commissionsPaidAgg] = await this.prisma.$transaction([
      this.prisma.commission.aggregate({
        where: { status: 'PENDING', createdAt: { gte: startOfMonth, lt: endOfMonth } },
        _sum: { value: true },
      }),
      this.prisma.commission.aggregate({
        where: { status: 'PAID', paidAt: { gte: startOfMonth, lt: endOfMonth } },
        _sum: { value: true },
      }),
    ])

    const totalCommissionsPending = Number(commissionsPendingAgg._sum.value ?? 0)
    const totalCommissionsPaid = Number(commissionsPaidAgg._sum.value ?? 0)

    // 13. Pipeline de negociacao (leads ativos com saleValue)
    const negotiationLeads = await this.prisma.client.findMany({
      where: {
        status: 'PROSPECT',
        leadStage: { in: ['NOVO', 'FOLLOW_UP', 'EM_NEGOCIACAO'] },
        saleValue: { not: null },
      },
      select: {
        id: true,
        companyName: true,
        leadStage: true,
        saleValue: true,
        salesRep: true,
      },
    })

    const negotiationTotal = negotiationLeads.reduce((sum, l) => sum + Number(l.saleValue ?? 0), 0)
    const negotiationCount = negotiationLeads.length

    // 14. Net balance = entradas recebidas - despesas pagas - comissoes pagas
    const netBalance = totalReceived - totalExpensesPago - totalCommissionsPaid
    const projectedBalance = (totalReceived + totalPending) - (totalExpensesPrevisto + totalExpensesPago) - (totalCommissionsPending + totalCommissionsPaid)

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
      negotiation: {
        total: negotiationTotal,
        count: negotiationCount,
        leads: negotiationLeads.map(l => ({
          id: l.id,
          companyName: l.companyName,
          stage: l.leadStage,
          value: Number(l.saleValue),
          salesRep: l.salesRep,
        })),
      },
      financialConsolidation: {
        entradas: { received: totalReceived, pending: totalPending, overdue: totalOverdue },
        expenses: { previsto: totalExpensesPrevisto, pago: totalExpensesPago },
        commissions: { pending: totalCommissionsPending, paid: totalCommissionsPaid },
        netBalance,
        projectedBalance,
      },
    }
  }
}
