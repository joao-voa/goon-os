import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

interface MonthData {
  month: number
  year: number
  label: string
  entradas: { received: number; pending: number; overdue: number; total: number }
  saidas: { previsto: number; pago: number; total: number }
  comissoes: { pending: number; paid: number; total: number }
  saldo: number
  saldoProjetado: number
}

@Injectable()
export class CashflowService {
  constructor(private prisma: PrismaService) {}

  async getMonthly(year: number) {
    const months: MonthData[] = []

    for (let m = 0; m < 12; m++) {
      const start = new Date(year, m, 1)
      const end = new Date(year, m + 1, 1)
      const label = start.toLocaleString('pt-BR', { month: 'long' })

      // Entradas (payments)
      const [paidAgg, pendingAgg, overdueAgg] = await this.prisma.$transaction([
        this.prisma.payment.aggregate({
          where: { status: 'PAID', dueDate: { gte: start, lt: end } },
          _sum: { value: true },
        }),
        this.prisma.payment.aggregate({
          where: { status: 'PENDING', dueDate: { gte: start, lt: end } },
          _sum: { value: true },
        }),
        this.prisma.payment.aggregate({
          where: { status: 'OVERDUE', dueDate: { gte: start, lt: end } },
          _sum: { value: true },
        }),
      ])

      const received = Number(paidAgg._sum.value ?? 0)
      const pending = Number(pendingAgg._sum.value ?? 0)
      const overdue = Number(overdueAgg._sum.value ?? 0)

      // Saidas (expenses)
      const [expPrevistoAgg, expPagoAgg] = await this.prisma.$transaction([
        this.prisma.expense.aggregate({
          where: { status: 'PREVISTO', dueDate: { gte: start, lt: end } },
          _sum: { value: true },
        }),
        this.prisma.expense.aggregate({
          where: { status: 'PAGO', dueDate: { gte: start, lt: end } },
          _sum: { value: true },
        }),
      ])

      const expPrevisto = Number(expPrevistoAgg._sum.value ?? 0)
      const expPago = Number(expPagoAgg._sum.value ?? 0)

      // Comissoes
      const [comPendingAgg, comPaidAgg] = await this.prisma.$transaction([
        this.prisma.commission.aggregate({
          where: { status: 'PENDING', createdAt: { gte: start, lt: end } },
          _sum: { value: true },
        }),
        this.prisma.commission.aggregate({
          where: { status: 'PAID', paidAt: { gte: start, lt: end } },
          _sum: { value: true },
        }),
      ])

      const comPending = Number(comPendingAgg._sum.value ?? 0)
      const comPaid = Number(comPaidAgg._sum.value ?? 0)

      const entradasTotal = received + pending + overdue
      const saidasTotal = expPrevisto + expPago
      const comissoesTotal = comPending + comPaid

      months.push({
        month: m + 1,
        year,
        label,
        entradas: { received, pending, overdue, total: entradasTotal },
        saidas: { previsto: expPrevisto, pago: expPago, total: saidasTotal },
        comissoes: { pending: comPending, paid: comPaid, total: comissoesTotal },
        saldo: received - expPago - comPaid,
        saldoProjetado: entradasTotal - saidasTotal - comissoesTotal,
      })
    }

    // Totals
    const totals = months.reduce(
      (acc, m) => ({
        entradas: acc.entradas + m.entradas.total,
        entradasReceived: acc.entradasReceived + m.entradas.received,
        saidas: acc.saidas + m.saidas.total,
        saidasPago: acc.saidasPago + m.saidas.pago,
        comissoes: acc.comissoes + m.comissoes.total,
        comissoesPaid: acc.comissoesPaid + m.comissoes.paid,
        saldo: acc.saldo + m.saldo,
        saldoProjetado: acc.saldoProjetado + m.saldoProjetado,
      }),
      { entradas: 0, entradasReceived: 0, saidas: 0, saidasPago: 0, comissoes: 0, comissoesPaid: 0, saldo: 0, saldoProjetado: 0 },
    )

    return { year, months, totals }
  }
}
