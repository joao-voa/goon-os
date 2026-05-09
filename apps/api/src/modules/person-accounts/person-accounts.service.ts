import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class PersonAccountsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
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
      const debits = p.transactions.filter(t => t.type === 'DEBIT')
      const credits = p.transactions.filter(t => t.type === 'CREDIT')
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

    const transactions = await this.prisma.personTransaction.findMany({
      where,
      orderBy: { date: 'asc' },
    })

    const allTx = await this.prisma.personTransaction.findMany({
      where: { personId },
      select: { type: true, value: true },
    })
    const totalDebits = allTx.filter(t => t.type === 'DEBIT').reduce((s, t) => s + Number(t.value), 0)
    const totalCredits = allTx.filter(t => t.type === 'CREDIT').reduce((s, t) => s + Number(t.value), 0)

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

    return { ...tx, value: Number(tx.value) }
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

    for (const e of expenses) {
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
    const persons = await this.prisma.person.findMany({
      where: { isActive: true },
      include: {
        transactions: { select: { type: true, value: true } },
      },
    })

    let totalOwed = 0
    let totalPaid = 0
    const byType: Record<string, { owed: number; paid: number }> = {}

    for (const p of persons) {
      const debits = p.transactions.filter(t => t.type === 'DEBIT').reduce((s, t) => s + Number(t.value), 0)
      const credits = p.transactions.filter(t => t.type === 'CREDIT').reduce((s, t) => s + Number(t.value), 0)
      totalOwed += debits
      totalPaid += credits
      if (!byType[p.type]) byType[p.type] = { owed: 0, paid: 0 }
      byType[p.type].owed += debits
      byType[p.type].paid += credits
    }

    return { totalOwed, totalPaid, balance: totalOwed - totalPaid, byType, personCount: persons.length }
  }
}
