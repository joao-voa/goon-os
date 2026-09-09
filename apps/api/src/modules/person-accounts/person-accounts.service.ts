import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class PersonAccountsService {
  constructor(private prisma: PrismaService) {}

  // Splits de mentoria de clientes em CARTEIRA DE COBRANÇA que ainda não foram
  // pagos (status ≠ PAGO) correspondem a parcelas que não vão cair — logo o
  // mentor não recebe esse valor. Esses lançamentos são desconsiderados na
  // visão de pagamento por pessoa. Retorna os sourceId (id da despesa) a excluir.
  private async carteiraMentorSourceIds(): Promise<Set<string>> {
    const carteira = await this.prisma.client.findMany({
      where: { payments: { some: { inCarteira: true } } },
      select: { companyName: true },
    })
    const names = carteira.map(c => c.companyName.toLowerCase())
    if (names.length === 0) return new Set<string>()
    const exps = await this.prisma.expense.findMany({
      where: { category: 'MENTORIA', status: { not: 'PAGO' } },
      select: { id: true, description: true },
    })
    return new Set(
      exps.filter(e => names.some(n => e.description.toLowerCase().includes(n))).map(e => e.id),
    )
  }

  async findAll() {
    const excluded = await this.carteiraMentorSourceIds()
    const persons = await this.prisma.person.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        transactions: {
          select: { type: true, value: true, date: true, description: true, sourceId: true, notes: true },
          orderBy: { date: 'asc' },
        },
      },
    })

    return persons.map(p => {
      const txns = p.transactions.filter(t => !(t.sourceId && excluded.has(t.sourceId)))
      const debits = txns.filter(t => t.type === 'DEBIT')
      const credits = txns.filter(t => t.type === 'CREDIT')
      const totalDebits = debits.reduce((s, t) => s + Number(t.value), 0)
      const totalCredits = credits.reduce((s, t) => s + Number(t.value), 0)

      // Match credits to debits by sourceId or description
      // Match credits to debits: credit.notes stores the debit description it pays for
      const paidSourceIds = new Set(credits.filter(c => c.sourceId).map(c => c.sourceId))
      const paidNotes = new Set(credits.map(c => c.notes).filter(Boolean))

      const upcomingDebits = debits.map(d => {
        const paid = (d.sourceId && paidSourceIds.has(d.sourceId)) || paidNotes.has(d.description)
        return { date: d.date, value: Number(d.value), description: d.description, paid }
      })

      return {
        id: p.id,
        name: p.name,
        type: p.type,
        aliases: p.aliases ? JSON.parse(p.aliases) : [],
        isActive: p.isActive,
        notes: p.notes,
        totalDebits,
        totalCredits,
        balance: totalDebits - totalCredits,
        debits: upcomingDebits,
      }
    })
  }

  async getExtract(personId: string, params?: { month?: number; year?: number }) {
    const person = await this.prisma.person.findUnique({ where: { id: personId } })
    if (!person) throw new NotFoundException('Pessoa nao encontrada')

    const where: Record<string, unknown> = { personId }
    if (params?.month && params?.year) {
      const start = new Date(params.year, params.month - 1, 1)
      const end = new Date(params.year, params.month, 1)
      where.date = { gte: start, lt: end }
    } else if (params?.year) {
      const start = new Date(params.year, 0, 1)
      const end = new Date(params.year + 1, 0, 1)
      where.date = { gte: start, lt: end }
    }

    const excluded = await this.carteiraMentorSourceIds()

    const transactionsRaw = await this.prisma.personTransaction.findMany({
      where,
      orderBy: { date: 'asc' },
    })
    const transactions = transactionsRaw.filter(t => !(t.sourceId && excluded.has(t.sourceId)))

    const allTx = await this.prisma.personTransaction.findMany({
      where: { personId },
      select: { type: true, value: true, sourceId: true },
    })
    const allTxFiltered = allTx.filter(t => !(t.sourceId && excluded.has(t.sourceId)))
    const totalDebits = allTxFiltered.filter(t => t.type === 'DEBIT').reduce((s, t) => s + Number(t.value), 0)
    const totalCredits = allTxFiltered.filter(t => t.type === 'CREDIT').reduce((s, t) => s + Number(t.value), 0)

    return {
      person: { ...person, aliases: person.aliases ? JSON.parse(person.aliases) : [] },
      totalDebits,
      totalCredits,
      balance: totalDebits - totalCredits,
      transactions: transactions.map(t => ({ ...t, value: Number(t.value) })),
    }
  }

  async create(dto: { name: string; type: string; aliases?: string[]; notes?: string }) {
    const existing = await this.prisma.person.findUnique({ where: { name: dto.name } })
    if (existing) throw new BadRequestException('Pessoa ja cadastrada')

    return this.prisma.person.create({
      data: {
        name: dto.name,
        type: dto.type,
        aliases: dto.aliases ? JSON.stringify(dto.aliases) : null,
        notes: dto.notes,
      },
    })
  }

  async update(id: string, dto: { name?: string; type?: string; aliases?: string[]; notes?: string; isActive?: boolean }) {
    const existing = await this.prisma.person.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Pessoa nao encontrada')

    return this.prisma.person.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        aliases: dto.aliases ? JSON.stringify(dto.aliases) : undefined,
        notes: dto.notes,
        isActive: dto.isActive,
      },
    })
  }

  async pay(personId: string, dto: { amount: number; notes?: string; date?: string }) {
    const person = await this.prisma.person.findUnique({ where: { id: personId } })
    if (!person) throw new NotFoundException('Pessoa nao encontrada')
    if (dto.amount <= 0) throw new BadRequestException('Valor deve ser positivo')

    // Prevent duplicate: if notes matches an existing credit for this person, block it
    if (dto.notes) {
      const existing = await this.prisma.personTransaction.findFirst({
        where: { personId, type: 'CREDIT', notes: dto.notes },
      })
      if (existing) throw new BadRequestException('Essa parcela ja foi paga')
    }

    const tx = await this.prisma.personTransaction.create({
      data: {
        personId,
        type: 'CREDIT',
        source: 'MANUAL',
        description: `Pagamento para ${person.name}`,
        value: dto.amount,
        date: dto.date ? new Date(dto.date) : new Date(),
        notes: dto.notes,
      },
    })

    // Cruza com a aba Mentorias: se o débito veio de uma despesa de mentoria,
    // marca a despesa como paga (mesmo pagamento, sem check em dois lugares).
    await this.linkMentoriaExpense(personId, dto.notes, true)

    return { ...tx, value: Number(tx.value) }
  }

  async revertPay(personId: string, notes: string) {
    const tx = await this.prisma.personTransaction.findFirst({
      where: { personId, type: 'CREDIT', notes },
    })
    if (!tx) throw new NotFoundException('Pagamento nao encontrado')
    await this.prisma.personTransaction.delete({ where: { id: tx.id } })
    await this.linkMentoriaExpense(personId, notes, false)
    return { reverted: true }
  }

  /** Reflete o pagamento/estorno da Conta Pessoas na despesa de mentoria ligada (via débito). */
  private async linkMentoriaExpense(personId: string, notes: string | undefined, paid: boolean) {
    if (!notes) return
    const debit = await this.prisma.personTransaction.findFirst({
      where: { personId, type: 'DEBIT', description: notes },
    })
    if (debit?.source !== 'MENTORIA' || !debit.sourceId) return
    const exp = await this.prisma.expense.findUnique({ where: { id: debit.sourceId } })
    if (!exp) return
    await this.prisma.expense.update({
      where: { id: exp.id },
      data: paid
        ? { status: 'PAGO', paidValue: exp.value, paidAt: new Date() }
        : { status: 'PREVISTO', paidValue: 0, paidAt: null },
    })
  }

  async deleteTransaction(txId: string) {
    const tx = await this.prisma.personTransaction.findUnique({ where: { id: txId } })
    if (!tx) throw new NotFoundException('Transacao nao encontrada')
    if (tx.source !== 'MANUAL') throw new BadRequestException('Somente transacoes manuais podem ser excluidas')
    await this.prisma.personTransaction.delete({ where: { id: txId } })
    return { deleted: true }
  }

  async sync() {
    const persons = await this.prisma.person.findMany()
    const nameMap = new Map<string, string>()

    for (const p of persons) {
      nameMap.set(p.name.toLowerCase(), p.id)
      if (p.aliases) {
        const aliases: string[] = JSON.parse(p.aliases)
        for (const a of aliases) nameMap.set(a.toLowerCase(), p.id)
      }
    }

    let syncedCommissions = 0
    let syncedExpenses = 0

    // Sync commissions
    const commissions = await this.prisma.commission.findMany({
      include: { client: { select: { companyName: true } } },
    })

    for (const c of commissions) {
      const personId = nameMap.get(c.salesRep.toLowerCase())
      if (!personId) continue

      const existingTx = await this.prisma.personTransaction.findFirst({
        where: { source: 'COMMISSION', sourceId: c.id },
      })
      if (existingTx) continue

      // Create DEBIT
      await this.prisma.personTransaction.create({
        data: {
          personId,
          type: 'DEBIT',
          source: 'COMMISSION',
          sourceId: c.id,
          description: `Comissao ${c.client.companyName} P${c.installment} (${c.percentage}%)`,
          value: Number(c.value),
          date: c.paidAt ?? c.createdAt,
        },
      })
      syncedCommissions++

      // If commission is PAID, also create auto-CREDIT
      if (c.status === 'PAID' && c.paidAt) {
        await this.prisma.personTransaction.create({
          data: {
            personId,
            type: 'CREDIT',
            source: 'COMMISSION',
            sourceId: c.id,
            description: `Pago comissao ${c.client.companyName} P${c.installment}`,
            value: Number(c.value),
            date: c.paidAt,
          },
        })
      }
    }

    // Sync mentor expenses (category MENTORIA, excluding Giulliano)
    const expenses = await this.prisma.expense.findMany({
      where: {
        category: 'MENTORIA',
        NOT: { description: { contains: 'Giulliano' } },
      },
    })

    // Não gerar lançamento para split de mentoria de cliente em carteira que
    // ainda não foi pago (parcela que não vai cair — mentor não recebe).
    const carteiraExcluded = await this.carteiraMentorSourceIds()

    for (const e of expenses) {
      if (carteiraExcluded.has(e.id)) continue

      const match = e.description.match(/Mentoria\s+(.+?)\s+—/)
      if (!match) continue

      const mentorName = match[1]
      const personId = nameMap.get(mentorName.toLowerCase())
      if (!personId) continue

      const existingTx = await this.prisma.personTransaction.findFirst({
        where: { source: 'MENTORIA', sourceId: e.id },
      })
      if (existingTx) continue

      // Create DEBIT
      await this.prisma.personTransaction.create({
        data: {
          personId,
          type: 'DEBIT',
          source: 'MENTORIA',
          sourceId: e.id,
          description: e.description.replace(/Mentoria .+? — /, ''),
          value: Number(e.value),
          date: e.dueDate,
        },
      })
      syncedExpenses++

      // If expense has paidValue, create proportional CREDIT
      const paidValue = Number(e.paidValue ?? 0)
      if (paidValue > 0) {
        await this.prisma.personTransaction.create({
          data: {
            personId,
            type: 'CREDIT',
            source: 'MENTORIA',
            sourceId: e.id,
            description: `Pago ${e.description.replace(/Mentoria .+? — /, '')}`,
            value: paidValue,
            date: e.paidAt ?? e.dueDate,
          },
        })
      }
    }

    return { synced: { commissions: syncedCommissions, expenses: syncedExpenses } }
  }

  async getSummary() {
    const excluded = await this.carteiraMentorSourceIds()
    const persons = await this.prisma.person.findMany({
      where: { isActive: true },
      include: {
        transactions: { select: { type: true, value: true, sourceId: true } },
      },
    })

    let totalOwed = 0
    let totalPaid = 0
    const byType: Record<string, { owed: number; paid: number }> = {}

    for (const p of persons) {
      const txns = p.transactions.filter(t => !(t.sourceId && excluded.has(t.sourceId)))
      const debits = txns.filter(t => t.type === 'DEBIT').reduce((s, t) => s + Number(t.value), 0)
      const credits = txns.filter(t => t.type === 'CREDIT').reduce((s, t) => s + Number(t.value), 0)
      totalOwed += debits
      totalPaid += credits
      if (!byType[p.type]) byType[p.type] = { owed: 0, paid: 0 }
      byType[p.type].owed += debits
      byType[p.type].paid += credits
    }

    return { totalOwed, totalPaid, balance: totalOwed - totalPaid, byType, personCount: persons.length }
  }
}
