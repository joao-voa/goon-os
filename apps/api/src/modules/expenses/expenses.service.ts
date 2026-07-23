import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    category?: string
    status?: string
    recurrence?: string
    month?: number
    year?: number
    page?: number
    limit?: number
  }) {
    const { category, status, recurrence, month, year, page = 1, limit = 20 } = params
    const giuFilter = { NOT: { AND: [{ category: 'MENTORIA' }, { description: { contains: 'Giulliano' } }] } }
    const where: Record<string, unknown> = { ...giuFilter }

    if (category) where.category = category
    if (status) where.status = status
    if (recurrence) where.recurrence = recurrence

    if (month && year) {
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 1)
      where.dueDate = { gte: start, lt: end }
    } else if (year) {
      const start = new Date(year, 0, 1)
      const end = new Date(year + 1, 0, 1)
      where.dueDate = { gte: start, lt: end }
    }

    const skip = (page - 1) * limit

    const [data, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.expense.count({ where }),
    ])

    return {
      data: data.map(e => ({ ...e, value: Number(e.value), paidValue: Number(e.paidValue ?? 0) })),
      total,
      page,
      limit,
    }
  }

  async getSummary(params: { month?: number; year?: number }) {
    const { month, year } = params
    const giuFilter = { NOT: { AND: [{ category: 'MENTORIA' }, { description: { contains: 'Giulliano' } }] } }
    const where: Record<string, unknown> = { ...giuFilter }

    if (month && year) {
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 1)
      where.dueDate = { gte: start, lt: end }
    }

    const [previstoAgg, pagoAgg] = await this.prisma.$transaction([
      this.prisma.expense.aggregate({
        where: { ...where, status: 'PREVISTO' },
        _sum: { value: true },
        _count: true,
      }),
      this.prisma.expense.aggregate({
        where: { ...where, status: 'PAGO' },
        _sum: { value: true },
        _count: true,
      }),
    ])

    const byCategory = await this.prisma.expense.groupBy({
      by: ['category'],
      where,
      _sum: { value: true },
    })

    return {
      totalPrevisto: Number(previstoAgg._sum.value ?? 0),
      totalPago: Number(pagoAgg._sum.value ?? 0),
      byCategory: byCategory.map(c => ({ category: c.category, total: Number(c._sum.value ?? 0) })),
    }
  }

  async create(dto: {
    description: string
    category: string
    value: number
    recurrence: string
    dueDate: Date | string
    status?: string
    notes?: string
  }) {
    return this.prisma.expense.create({
      data: {
        description: dto.description,
        category: dto.category,
        value: dto.value,
        recurrence: dto.recurrence,
        dueDate: new Date(dto.dueDate),
        status: dto.status ?? 'PREVISTO',
        notes: dto.notes,
      },
    }).then(e => ({ ...e, value: Number(e.value) }))
  }

  async update(id: string, dto: {
    description?: string
    category?: string
    value?: number
    recurrence?: string
    dueDate?: Date | string
    status?: string
    paidAt?: Date | string
    notes?: string
  }) {
    const existing = await this.prisma.expense.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Expense ${id} not found`)

    return this.prisma.expense.update({
      where: { id },
      data: {
        description: dto.description,
        category: dto.category,
        value: dto.value,
        recurrence: dto.recurrence,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: dto.status,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
        notes: dto.notes,
      },
    }).then(e => ({ ...e, value: Number(e.value) }))
  }

  async markAsPaid(id: string) {
    const existing = await this.prisma.expense.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Expense ${id} not found`)

    const updated = await this.prisma.expense.update({
      where: { id },
      data: { status: 'PAGO', paidValue: existing.value, paidAt: new Date() },
    })
    await this.syncMentoriaToPerson(updated, true)
    return { ...updated, value: Number(updated.value), paidValue: Number(updated.paidValue) }
  }

  async partialPay(id: string, amount: number) {
    const existing = await this.prisma.expense.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Expense ${id} not found`)

    const currentPaid = Number(existing.paidValue ?? 0)
    const total = Number(existing.value)
    const newPaid = Math.min(currentPaid + amount, total)
    const isFullyPaid = newPaid >= total

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        paidValue: newPaid,
        status: isFullyPaid ? 'PAGO' : 'PARCIAL',
        paidAt: isFullyPaid ? new Date() : existing.paidAt,
      },
    })
    // Cruza com Conta Pessoas só quando quita a parcela inteira
    await this.syncMentoriaToPerson(updated, isFullyPaid)
    return { ...updated, value: Number(updated.value), paidValue: Number(updated.paidValue) }
  }

  async revertPayment(id: string) {
    const existing = await this.prisma.expense.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Expense ${id} not found`)

    const updated = await this.prisma.expense.update({
      where: { id },
      data: { paidValue: 0, status: 'PREVISTO', paidAt: null },
    })
    await this.syncMentoriaToPerson(updated, false)
    return { ...updated, value: Number(updated.value), paidValue: Number(updated.paidValue) }
  }

  /**
   * Cruza o pagamento de uma despesa de MENTORIA com a Conta Pessoas do mentor:
   * ao quitar, cria o crédito correspondente; ao estornar, remove. Assim não
   * precisa dar "pago" em dois lugares. Giulliano (casa) fica de fora.
   */
  private async syncMentoriaToPerson(
    expense: { id: string; description: string; value: unknown; category: string },
    paid: boolean,
  ) {
    if (expense.category !== 'MENTORIA') return
    const m = expense.description.match(/Mentoria\s+(.+?)\s+—/)
    if (!m) return
    const mentorName = m[1].toLowerCase()
    if (mentorName.includes('giulliano')) return

    const persons = await this.prisma.person.findMany()
    let personId: string | undefined
    for (const p of persons) {
      const names = [p.name]
      if (p.aliases) { try { names.push(...(JSON.parse(p.aliases) as string[])) } catch { /* ignore */ } }
      if (names.some(n => n.toLowerCase() === mentorName)) { personId = p.id; break }
    }
    if (!personId) return

    const debitDesc = expense.description.replace(/Mentoria .+? — /, '')
    const existingCredit = await this.prisma.personTransaction.findFirst({
      where: { personId, type: 'CREDIT', notes: debitDesc },
    })
    if (paid && !existingCredit) {
      await this.prisma.personTransaction.create({
        data: {
          personId, type: 'CREDIT', source: 'MENTORIA', sourceId: expense.id,
          description: 'Pagamento mentoria', value: Number(expense.value),
          date: new Date(), notes: debitDesc,
        },
      })
    } else if (!paid && existingCredit) {
      await this.prisma.personTransaction.delete({ where: { id: existingCredit.id } })
    }
  }

  async delete(id: string, scope: 'one' | 'future' = 'one') {
    const existing = await this.prisma.expense.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Expense ${id} not found`)

    // "future": apaga esta + todas as próximas ocorrências da mesma despesa
    // recorrente (mesma descrição/categoria, recorrência != UNICA, vencimento >=).
    // Preserva as passadas (histórico).
    if (scope === 'future' && existing.recurrence !== 'UNICA') {
      const res = await this.prisma.expense.deleteMany({
        where: {
          description: existing.description,
          category: existing.category,
          recurrence: existing.recurrence,
          dueDate: { gte: existing.dueDate },
        },
      })
      return { deleted: res.count, scope: 'future' }
    }

    await this.prisma.expense.delete({ where: { id } })
    return { deleted: 1, scope: 'one' }
  }
}
