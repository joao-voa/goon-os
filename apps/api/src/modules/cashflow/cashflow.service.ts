import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { NOT_CARTEIRA_CLIENT_FILTER, STANDBY_FROZEN_COMMISSION, STANDBY_FROZEN_PAYMENT, mentorExpenseOfClients } from '../../shared/constants'

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

    // Clientes em standby: parcelas não pagas, comissões pendentes e repasses
    // de mentoria ainda não pagos ficam congelados (fora do fluxo).
    const standbyClients = await this.prisma.client.findMany({ where: { standby: true }, select: { companyName: true } })
    const isStandbyMentorExpense = mentorExpenseOfClients(standbyClients.map(c => c.companyName))

    // Fetch all data for the year in 3 queries
    const [payments, expenses, commissions] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        // Parcelas em carteira de cobrança (98/98, 99/99 — churn) ficam FORA do
        // fluxo de caixa, independente do status (inclusive as que venceram).
        where: { dueDate: { gte: yearStart, lt: yearEnd }, inCarteira: false, NOT: STANDBY_FROZEN_PAYMENT },
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
          NOT: STANDBY_FROZEN_COMMISSION,
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
      // Camadas de gestão: separa custo real da operação, distribuição (repasses)
      // e o pessoal do Giulliano — que não é da empresa.
      layers: { impostos: 0, custoOperacao: 0, distribuicao: 0, pessoalGiu: 0 },
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
      if (isStandbyMentorExpense(e)) continue
      const m = new Date(e.dueDate).getMonth()
      const val = Number(e.value)
      const cat = (e as any).category ?? 'OUTRO'
      const desc = (e as any).description ?? ''
      if (e.status === 'PAGO') months[m].saidas.pago += val
      else if (e.status === 'PREVISTO') months[m].saidas.previsto += val
      months[m].saidas.byCategory[cat] = (months[m].saidas.byCategory[cat] ?? 0) + val
      months[m].saidas.items.push({ description: desc, category: cat, value: val, status: e.status })

      // Camada de gestão da despesa:
      //  IMPOSTOS → impostos · MENTORIA → distribuição (repasse) ·
      //  PESSOAL+Giulliano → pessoal Giu · resto → custo da operação
      const layer = cat === 'IMPOSTOS' ? 'impostos'
        : cat === 'MENTORIA' ? 'distribuicao'
        : (cat === 'PESSOAL' && /giulliano/i.test(desc)) ? 'pessoalGiu'
        : 'custoOperacao'
      months[m].layers[layer] += val
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
        impostos: acc.impostos + m.layers.impostos,
        custoOperacao: acc.custoOperacao + m.layers.custoOperacao,
        distribuicao: acc.distribuicao + m.layers.distribuicao,
        pessoalGiu: acc.pessoalGiu + m.layers.pessoalGiu,
      }),
      { entradas: 0, entradasReceived: 0, saidas: 0, saidasPago: 0, comissoes: 0, comissoesPaid: 0, saldo: 0, saldoProjetado: 0, impostos: 0, custoOperacao: 0, distribuicao: 0, pessoalGiu: 0 },
    )

    return { year, months, totals }
  }

  /**
   * Resumo financeiro (entradas × saídas) de um período, com filtros.
   * Sem `year` = mês corrente. `product` filtra entradas e comissões (planos);
   * `category`/`costCenter` filtram as despesas. Mesmas exclusões do fluxo:
   * carteira de cobrança, standby, pessoal do Giulliano.
   * Cada card traz a lista de itens pra abrir ao clicar.
   */
  async getSummary(params: { month?: number; year?: number; product?: string; category?: string; costCenter?: string }) {
    const { month, year } = params
    const now = new Date()
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
    const start = month && year ? new Date(Date.UTC(year, month - 1, 1)) : year ? new Date(Date.UTC(year, 0, 1)) : new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
    const end = month && year ? new Date(Date.UTC(year, month, 1)) : year ? new Date(Date.UTC(year + 1, 0, 1)) : new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1))
    const split = (v?: string) => (v ?? '').split(',').map(x => x.trim()).filter(Boolean)
    const codes = split(params.product).map(c => c.toUpperCase())
    const cats = split(params.category)
    const centers = split(params.costCenter)
    const planWhere = codes.length ? { clientPlan: { product: { code: { in: codes } } } } : {}
    const period = { gte: start, lt: end }

    const standbyClients = await this.prisma.client.findMany({ where: { standby: true }, select: { companyName: true } })
    const isFrozenExpense = mentorExpenseOfClients(standbyClients.map(c => c.companyName))

    const paySelect = {
      id: true, value: true, dueDate: true, paidAt: true, status: true, installment: true, totalInstallments: true,
      client: { select: { id: true, companyName: true } },
      clientPlan: { select: { product: { select: { code: true } } } },
    } as const
    const includeCommissions = cats.length === 0 || cats.includes('COMISSAO')

    const [recebidos, aReceber, vencidos, expenses, commissions] = await this.prisma.$transaction([
      this.prisma.payment.findMany({ where: { status: 'PAID', paidAt: period, ...planWhere }, select: paySelect, orderBy: { paidAt: 'asc' } }),
      this.prisma.payment.findMany({
        where: { status: { in: ['PENDING', 'SCHEDULED'] }, dueDate: { gte: start > today ? start : today, lt: end }, inCarteira: false, ...planWhere, ...NOT_CARTEIRA_CLIENT_FILTER },
        select: paySelect, orderBy: { dueDate: 'asc' },
      }),
      this.prisma.payment.findMany({
        where: {
          dueDate: { gte: start, lt: end < today ? end : today }, inCarteira: false, ...planWhere,
          OR: [{ status: 'OVERDUE' }, { status: 'PENDING' }],
          NOT: STANDBY_FROZEN_PAYMENT,
          client: { leadStage: { notIn: ['RECUPERAR', 'PERDIDO'] }, payments: { none: { inCarteira: true } } },
        },
        select: paySelect, orderBy: { dueDate: 'asc' },
      }),
      this.prisma.expense.findMany({
        where: {
          dueDate: period,
          NOT: { AND: [{ category: 'MENTORIA' }, { description: { contains: 'Giulliano' } }] },
          ...(cats.length ? { category: { in: cats } } : {}),
          ...(centers.length ? { costCenter: { in: centers } } : {}),
        },
        select: { id: true, description: true, category: true, costCenter: true, value: true, dueDate: true, status: true },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.commission.findMany({
        where: includeCommissions ? {
          NOT: STANDBY_FROZEN_COMMISSION,
          ...(codes.length ? { payment: planWhere } : {}),
          OR: [
            { status: 'PAID', paidAt: period },
            { status: 'PENDING', payment: { dueDate: period } },
          ],
        } : { id: '__none__' },
        select: { id: true, salesRep: true, value: true, status: true, paidAt: true, installment: true, totalInstallments: true, payment: { select: { dueDate: true } }, client: { select: { id: true, companyName: true } } },
      }),
    ])

    type Item = { id: string; date: string; name: string; detail: string; value: number; status: string; clientId?: string }
    const payItem = (p: typeof recebidos[number], date: Date): Item => ({
      id: p.id, date: date.toISOString(), name: p.client.companyName, clientId: p.client.id,
      detail: `${p.clientPlan?.product?.code ?? ''} · parcela ${p.installment}/${p.totalInstallments}`.replace(/^ · /, ''),
      value: Number(p.value), status: p.status,
    })
    const bucket = (items: Item[]) => ({ total: items.reduce((s, i) => s + i.value, 0), count: items.length, items })

    const exp = expenses.filter(e => !isFrozenExpense(e))
    const expItem = (e: typeof exp[number]): Item => ({
      id: e.id, date: e.dueDate.toISOString(), name: e.description,
      detail: [e.category, e.costCenter].filter(Boolean).join(' · '), value: Number(e.value), status: e.status,
    })
    const pago = exp.filter(e => e.status === 'PAGO').map(expItem)
    const aPagar = exp.filter(e => e.status !== 'PAGO' && e.dueDate >= today).map(expItem)
    const atrasado = exp.filter(e => e.status !== 'PAGO' && e.dueDate < today).map(expItem)
    const com = commissions.map(c => ({
      id: c.id, date: (c.status === 'PAID' && c.paidAt ? c.paidAt : c.payment.dueDate).toISOString(),
      name: c.client.companyName, clientId: c.client.id, detail: `${c.salesRep} · parcela ${c.installment}/${c.totalInstallments}`,
      value: Number(c.value), status: c.status,
    }))

    const entradas = { recebido: bucket(recebidos.map(p => payItem(p, p.paidAt ?? p.dueDate))), aReceber: bucket(aReceber.map(p => payItem(p, p.dueDate))), vencido: bucket(vencidos.map(p => payItem(p, p.dueDate))) }
    const comBucket = bucket(com)
    const comPago = com.filter(c => c.status === 'PAID').reduce((s, c) => s + c.value, 0)
    const saidas = { pago: bucket(pago), aPagar: bucket(aPagar), atrasado: bucket(atrasado), comissoes: { ...comBucket, pago: comPago, pendente: comBucket.total - comPago } }

    const totalEntradas = entradas.recebido.total + entradas.aReceber.total + entradas.vencido.total
    const totalSaidas = saidas.pago.total + saidas.aPagar.total + saidas.atrasado.total + comBucket.total
    return {
      period: { start: start.toISOString(), end: end.toISOString() },
      entradas, saidas,
      saldoRealizado: entradas.recebido.total - saidas.pago.total - comPago,
      saldoProjetado: totalEntradas - totalSaidas,
      totalEntradas, totalSaidas,
    }
  }
}
