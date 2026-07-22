import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class CashflowService {
  constructor(private prisma: PrismaService) {}

  async getMonthly(year: number) {
    const yearStart = new Date(year, 0, 1)
    const yearEnd = new Date(year + 1, 0, 1)

    // Clientes em recuperação de crédito / carteira de cobrança: suas parcelas
    // FUTURAS (PENDING) não entram na projeção do fluxo (receita incerta).
    const carteiraClients = await this.prisma.client.findMany({
      where: {
        OR: [
          { leadStage: 'RECUPERAR' },
          { payments: { some: { inCarteira: true } } },
        ],
      },
      select: { id: true },
    })
    const carteiraSet = new Set(carteiraClients.map(c => c.id))

    // Fetch all data for the year in 3 queries
    const [payments, expenses, commissions] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where: { dueDate: { gte: yearStart, lt: yearEnd } },
        select: { dueDate: true, paidAt: true, value: true, status: true, client: { select: { id: true, companyName: true } } },
      }),
      this.prisma.expense.findMany({
        where: {
          dueDate: { gte: yearStart, lt: yearEnd },
          NOT: { AND: [{ category: 'MENTORIA' }, { description: { contains: 'Giulliano' } }] },
        },
        select: { dueDate: true, value: true, status: true, category: true, description: true },
      }),
      this.prisma.commission.findMany({
        where: {
          OR: [
            { createdAt: { gte: yearStart, lt: yearEnd } },
            { paidAt: { gte: yearStart, lt: yearEnd } },
          ],
        },
        select: { createdAt: true, paidAt: true, value: true, status: true },
      }),
    ])

    // Build monthly buckets
    const months = Array.from({ length: 12 }, (_, m) => ({
      month: m + 1,
      year,
      label: new Date(year, m, 1).toLocaleString('pt-BR', { month: 'long' }),
      entradas: { received: 0, pending: 0, overdue: 0, total: 0, overdueClients: [] as Array<{ id: string; companyName: string; value: number }> },
      saidas: { previsto: 0, pago: 0, total: 0, byCategory: {} as Record<string, number>, items: [] as Array<{ description: string; category: string; value: number; status: string }> },
      comissoes: { pending: 0, paid: 0, total: 0 },
      saldo: 0,
      saldoProjetado: 0,
    }))

    // Distribute payments into months
    for (const pay of payments) {
      const m = new Date(pay.dueDate).getMonth()
      const val = Number(pay.value)
      // Parcela futura (PENDING) de cliente em carteira/recuperação: fora do fluxo
      if (pay.status === 'PENDING' && pay.client && carteiraSet.has(pay.client.id)) continue
      if (pay.status === 'PAID') months[m].entradas.received += val
      else if (pay.status === 'PENDING') months[m].entradas.pending += val
      else if (pay.status === 'OVERDUE') {
        months[m].entradas.overdue += val
        const client = (pay as any).client
        if (client) {
          months[m].entradas.overdueClients.push({ id: client.id, companyName: client.companyName, value: val })
        }
      }
    }

    // Distribute expenses into months (with category breakdown)
    for (const e of expenses) {
      const m = new Date(e.dueDate).getMonth()
      const val = Number(e.value)
      const cat = (e as any).category ?? 'OUTRO'
      if (e.status === 'PAGO') months[m].saidas.pago += val
      else if (e.status === 'PREVISTO') months[m].saidas.previsto += val
      months[m].saidas.byCategory[cat] = (months[m].saidas.byCategory[cat] ?? 0) + val
      months[m].saidas.items.push({ description: (e as any).description ?? '', category: cat, value: val, status: e.status })
    }

    // Distribute commissions into months (by createdAt for pending, paidAt for paid)
    for (const c of commissions) {
      const val = Number(c.value)
      if (c.status === 'PAID' && c.paidAt) {
        const m = new Date(c.paidAt).getMonth()
        if (m >= 0 && m < 12) months[m].comissoes.paid += val
      } else if (c.status === 'PENDING') {
        const m = new Date(c.createdAt).getMonth()
        if (m >= 0 && m < 12) months[m].comissoes.pending += val
      }
    }

    // Compute totals per month
    for (const m of months) {
      m.entradas.total = m.entradas.received + m.entradas.pending + m.entradas.overdue
      m.saidas.total = m.saidas.previsto + m.saidas.pago
      m.comissoes.total = m.comissoes.pending + m.comissoes.paid
      m.saldo = m.entradas.received - m.saidas.pago - m.comissoes.paid
      m.saldoProjetado = m.entradas.total - m.saidas.total - m.comissoes.total
    }

    // Year totals
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
