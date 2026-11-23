import { BadRequestException, Injectable } from '@nestjs/common'
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
  async getSummary(params: { months?: string; year?: number; product?: string; category?: string; costCenter?: string }) {
    const { year } = params
    const split = (v?: string) => (v ?? '').split(',').map(x => x.trim()).filter(Boolean)
    // meses escolhidos (1-12, vários): busca do 1º ao último e filtra os do meio que não foram marcados
    const months = year ? split(params.months).map(Number).filter(m => m >= 1 && m <= 12) : []
    const monthSet = months.length ? new Set(months) : null
    const inSel = (d: Date | null | undefined) => !monthSet || (!!d && monthSet.has(d.getUTCMonth() + 1))
    const now = new Date()
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
    const start = year ? new Date(Date.UTC(year, months.length ? Math.min(...months) - 1 : 0, 1)) : new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
    const end = year ? new Date(Date.UTC(year, months.length ? Math.max(...months) : 12, 1)) : new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1))
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

    const [recebidosAll, aReceberAll, vencidosAll, expensesAll, commissionsAll, standbyAll] = await this.prisma.$transaction([
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
      // Standby: parcelas congeladas (informativo, fora dos totais)
      this.prisma.payment.findMany({
        where: { dueDate: period, inCarteira: false, ...planWhere, ...STANDBY_FROZEN_PAYMENT },
        select: paySelect, orderBy: { dueDate: 'asc' },
      }),
    ])
    const recebidos = recebidosAll.filter(p => inSel(p.paidAt))
    const aReceber = aReceberAll.filter(p => inSel(p.dueDate))
    const vencidos = vencidosAll.filter(p => inSel(p.dueDate))
    const expenses = expensesAll.filter(e => inSel(e.dueDate))
    const commissions = commissionsAll.filter(c => inSel(c.status === 'PAID' ? c.paidAt : c.payment.dueDate))
    const standby = standbyAll.filter(p => inSel(p.dueDate))

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
      standby: bucket(standby.map(p => payItem(p, p.dueDate))),
      saldoRealizado: entradas.recebido.total - saidas.pago.total - comPago,
      saldoProjetado: totalEntradas - totalSaidas,
      totalEntradas, totalSaidas,
    }
  }

  // ===== Caixa: visão diária com projeção =====

  private static dayKey(d: Date) { return d.toISOString().slice(0, 10) }

  /**
   * Movimento de caixa dia a dia no intervalo [from, to] (YYYY-MM-DD, UTC).
   * Entradas: parcela paga entra no dia do pagamento; não paga entra no vencimento
   * (se ainda não venceu). Saídas: despesa paga no dia do pagamento; prevista no
   * vencimento; prevista já vencida entra HOJE (conta a pagar atrasada).
   * Mesmas exclusões do fluxo: carteira, standby, perdidos e repasse do Giulliano
   * (MENTORIA Giulliano). Comissões entram pelas despesas "Comissao ..." (sem
   * contar o model Commission de novo). Parcelas vencidas e não pagas ficam fora
   * do dia a dia: vão em `overdueIn` (risco, não caixa certo).
   */
  async getCashView(fromStr?: string, toStr?: string) {
    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const parse = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null)
    const from = parse(fromStr) ?? new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
    const to = parse(toStr) ?? new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0))
    const end = new Date(to.getTime() + 86400000)
    const key = CashflowService.dayKey

    const standbyClients = await this.prisma.client.findMany({ where: { standby: true }, select: { companyName: true } })
    const isFrozenExpense = mentorExpenseOfClients(standbyClients.map(c => c.companyName))
    const lostClient = { leadStage: { notIn: ['RECUPERAR', 'PERDIDO'] }, payments: { none: { inCarteira: true } } }

    const paySel = { id: true, value: true, dueDate: true, paidAt: true, status: true, installment: true, totalInstallments: true, client: { select: { id: true, companyName: true } }, clientPlan: { select: { product: { select: { code: true } } } } } as const
    const [paid, toReceive, overdue, expenses, balance] = await Promise.all([
      this.prisma.payment.findMany({ where: { status: 'PAID', paidAt: { gte: from, lt: end }, inCarteira: false }, select: paySel }),
      this.prisma.payment.findMany({
        where: { status: { in: ['PENDING', 'SCHEDULED', 'OVERDUE'] }, dueDate: { gte: from > today ? from : today, lt: end }, inCarteira: false, NOT: STANDBY_FROZEN_PAYMENT, client: lostClient },
        select: paySel,
      }),
      this.prisma.payment.findMany({
        where: { status: { in: ['PENDING', 'OVERDUE'] }, dueDate: { lt: today }, inCarteira: false, NOT: STANDBY_FROZEN_PAYMENT, client: lostClient },
        select: paySel, orderBy: { dueDate: 'asc' },
      }),
      this.prisma.expense.findMany({
        where: {
          NOT: { AND: [{ category: 'MENTORIA' }, { description: { contains: 'Giulliano' } }] },
          OR: [
            { status: 'PAGO', OR: [{ paidAt: { gte: from, lt: end } }, { paidAt: null, dueDate: { gte: from, lt: end } }] },
            { status: { not: 'PAGO' }, dueDate: { lt: end } },
          ],
        },
        select: { id: true, description: true, category: true, costCenter: true, value: true, dueDate: true, paidAt: true, status: true },
      }),
      this.prisma.cashBalance.findFirst({ orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] }),
    ])

    type Item = { date: string; kind: 'in' | 'out'; realized: boolean; name: string; detail: string; value: number; category: string; late?: boolean }
    const items: Item[] = []
    const payName = (p: (typeof paid)[number]) => p.client?.companyName ?? 'Cliente'
    const payDetail = (p: (typeof paid)[number]) => `${p.clientPlan?.product?.code ?? ''} parcela ${p.installment}/${p.totalInstallments}`.trim()
    for (const p of paid) items.push({ date: key(p.paidAt!), kind: 'in', realized: true, name: payName(p), detail: payDetail(p), value: Number(p.value), category: 'RECEITA' })
    for (const p of toReceive) items.push({ date: key(p.dueDate), kind: 'in', realized: false, name: payName(p), detail: payDetail(p), value: Number(p.value), category: 'RECEITA' })
    for (const e of expenses) {
      if (isFrozenExpense(e)) continue
      const base = { kind: 'out' as const, name: e.description, detail: e.costCenter ?? '', value: Number(e.value), category: e.category }
      if (e.status === 'PAGO') {
        const d = e.paidAt ?? e.dueDate
        if (d >= from && d < end) items.push({ ...base, date: key(d), realized: true })
      } else if (e.dueDate < today) {
        if (today >= from && today < end) items.push({ ...base, date: key(today), realized: false, late: true, detail: `venceu ${e.dueDate.toISOString().slice(8, 10)}/${e.dueDate.toISOString().slice(5, 7)}` })
      } else if (e.dueDate >= from) {
        items.push({ ...base, date: key(e.dueDate), realized: false })
      }
    }
    items.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || b.value - a.value)

    return {
      from: key(from), to: key(to), today: key(today),
      balance: balance ? { date: key(balance.date), value: Number(balance.value), note: balance.note, at: balance.createdAt } : null,
      items,
      overdueIn: {
        total: overdue.reduce((s, p) => s + Number(p.value), 0),
        items: overdue.map(p => ({ date: key(p.dueDate), name: payName(p), detail: payDetail(p), value: Number(p.value) })),
      },
    }
  }

  /** Referências para a projeção: ticket e caixa por venda, custo médio mensal. */
  async getCashStats() {
    const now = new Date()
    const sixAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, 1))
    const threeAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1))
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const [plans, costs] = await Promise.all([
      this.prisma.clientPlan.findMany({
        where: { startDate: { gte: sixAgo }, status: { not: 'CANCELLED' }, client: { leadStage: { notIn: ['RECUPERAR', 'PERDIDO'] } } },
        select: { value: true, startDate: true, payments: { where: { status: 'PAID' }, select: { value: true, paidAt: true } } },
      }),
      this.prisma.expense.findMany({
        where: { status: 'PAGO', dueDate: { gte: threeAgo, lt: monthStart }, category: { notIn: ['MENTORIA', 'IMPOSTOS'] }, NOT: { AND: [{ category: 'PESSOAL' }, { description: { contains: 'Giulliano' } }] } },
        select: { value: true },
      }),
    ])
    const sold = plans.reduce((s, p) => s + Number(p.value), 0)
    // caixa que a venda traz no próprio mês (o que importa pra fechar o mês)
    const firstMonthCash = plans.reduce((s, p) => s + p.payments
      .filter(x => x.paidAt && x.paidAt.getUTCFullYear() === p.startDate.getUTCFullYear() && x.paidAt.getUTCMonth() === p.startDate.getUTCMonth())
      .reduce((a, x) => a + Number(x.value), 0), 0)
    const n = plans.length || 1
    return {
      salesLast6: plans.length,
      avgTicket: Math.round(sold / n),
      avgCashPerSale: Math.round(firstMonthCash / n),
      avgSalesPerMonth: Math.round(plans.length / 6 * 10) / 10,
      avgMonthlyCost: Math.round(costs.reduce((s, e) => s + Number(e.value), 0) / 3),
    }
  }

  async setCashBalance(dto: { date?: string; value: number; note?: string }, userEmail?: string) {
    const v = Number(dto.value)
    if (!Number.isFinite(v)) throw new BadRequestException('Informe o saldo')
    const d = dto.date && /^\d{4}-\d{2}-\d{2}$/.test(dto.date) ? new Date(`${dto.date}T00:00:00Z`) : (() => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())) })()
    return this.prisma.cashBalance.create({ data: { date: d, value: v, note: dto.note?.trim() || null, userEmail: userEmail ?? null } })
  }

}
