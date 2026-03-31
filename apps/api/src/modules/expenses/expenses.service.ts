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
    const where: Record<string, unknown> = {}

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
      data: data.map(e => ({ ...e, value: Number(e.value) })),
      total,
      page,
      limit,
    }
  }

  async getSummary(params: { month?: number; year?: number }) {
    const { month, year } = params
    const where: Record<string, unknown> = {}

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

    return this.prisma.expense.update({
      where: { id },
      data: { status: 'PAGO', paidAt: new Date() },
    }).then(e => ({ ...e, value: Number(e.value) }))
  }

  async delete(id: string) {
    const existing = await this.prisma.expense.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Expense ${id} not found`)

    return this.prisma.expense.delete({ where: { id } })
  }
}
