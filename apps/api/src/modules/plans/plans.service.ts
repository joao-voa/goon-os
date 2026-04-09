import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ActivityLogService } from '../activity-log/activity-log.service'
import { ExpensesService } from '../expenses/expenses.service'
import { CreatePlanDto } from './dto/create-plan.dto'

@Injectable()
export class PlansService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
    private expensesService: ExpensesService,
  ) {}

  async findByClient(clientId: string) {
    const plans = await this.prisma.clientPlan.findMany({
      where: { clientId },
      include: {
        product: { select: { id: true, code: true, name: true, description: true } },
        payments: { select: { status: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return plans.map(plan => {
      const payments = plan.payments
      const paid = payments.filter(p => p.status === 'PAID').length
      const overdue = payments.filter(p => p.status === 'OVERDUE').length
      const pending = payments.filter(p => p.status === 'PENDING' || p.status === 'SCHEDULED').length

      const { payments: _payments, ...planData } = plan

      return {
        ...planData,
        value: plan.value.toNumber(),
        installmentValue: plan.installmentValue ? plan.installmentValue.toNumber() : null,
        _count: { payments: payments.length },
        paymentStats: payments.length > 0 ? { total: payments.length, paid, overdue, pending } : null,
      }
    })
  }

  async create(clientId: string, dto: CreatePlanDto) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } })
    if (!client) {
      throw new NotFoundException(`Cliente com ID ${clientId} não encontrado`)
    }

    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } })
    if (!product) {
      throw new NotFoundException(`Produto com ID ${dto.productId} não encontrado`)
    }

    const startDate = new Date(dto.startDate)
    let endDate: Date | undefined
    if (dto.cycleDuration) {
      endDate = new Date(startDate)
      endDate.setMonth(endDate.getMonth() + dto.cycleDuration)
    }

    const plan = await this.prisma.clientPlan.create({
      data: {
        clientId,
        productId: dto.productId,
        value: dto.value,
        paymentType: dto.paymentType,
        installments: dto.installments,
        installmentValue: dto.installmentValue,
        cycleDuration: dto.cycleDuration,
        startDate,
        endDate,
        notes: dto.notes,
      },
      include: {
        product: { select: { id: true, code: true, name: true } },
      },
    })

    // Auto-create Onboarding if client doesn't have one
    const existingOnboarding = await this.prisma.onboarding.findUnique({ where: { clientId } })
    if (!existingOnboarding) {
      await this.prisma.onboarding.create({
        data: {
          clientId,
          currentStage: 'CLIENT_CLOSED',
        },
      })
    }

    // Log activity
    await this.activityLog.log({
      clientId,
      entityType: 'PLAN',
      entityId: plan.id,
      action: 'CREATED',
      description: `Plano ${product.name} adicionado para ${client.companyName}`,
    })

    return {
      ...plan,
      value: plan.value.toNumber(),
      installmentValue: plan.installmentValue ? plan.installmentValue.toNumber() : null,
    }
  }

  async update(
    id: string,
    dto: {
      value?: number
      paymentType?: string
      installments?: number
      installmentValue?: number
      cycleDuration?: number
      startDate?: string
      endDate?: string
      notes?: string
      status?: string
    },
  ) {
    const existing = await this.prisma.clientPlan.findUnique({
      where: { id },
      include: { client: { select: { companyName: true } } },
    })
    if (!existing) {
      throw new NotFoundException(`Plano com ID ${id} não encontrado`)
    }

    const updateData: Record<string, unknown> = { ...dto }
    if (dto.startDate) updateData.startDate = new Date(dto.startDate)
    if (dto.endDate) updateData.endDate = new Date(dto.endDate)

    const plan = await this.prisma.clientPlan.update({
      where: { id },
      data: updateData,
      include: {
        product: { select: { id: true, code: true, name: true } },
      },
    })

    await this.activityLog.log({
      clientId: plan.clientId,
      entityType: 'PLAN',
      entityId: plan.id,
      action: 'UPDATED',
      description: `Plano ${plan.product.name} atualizado para ${existing.client.companyName}`,
    })

    return {
      ...plan,
      value: plan.value.toNumber(),
      installmentValue: plan.installmentValue ? plan.installmentValue.toNumber() : null,
    }
  }

  async cancel(id: string) {
    const existing = await this.prisma.clientPlan.findUnique({
      where: { id },
      include: { product: true, client: { select: { companyName: true } } },
    })
    if (!existing) {
      throw new NotFoundException(`Plano com ID ${id} não encontrado`)
    }

    const plan = await this.prisma.clientPlan.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        product: { select: { id: true, code: true, name: true } },
      },
    })

    await this.activityLog.log({
      clientId: plan.clientId,
      entityType: 'PLAN',
      entityId: plan.id,
      action: 'CANCELLED',
      fromValue: existing.status,
      toValue: 'CANCELLED',
      description: `Plano ${existing.product.name} cancelado para ${existing.client.companyName}`,
    })

    return {
      ...plan,
      value: plan.value.toNumber(),
      installmentValue: plan.installmentValue ? plan.installmentValue.toNumber() : null,
    }
  }

  // ---- Mentors ----

  async getAllMentors() {
    const mentors = await this.prisma.planMentor.findMany({
      include: {
        plan: {
          include: {
            client: { select: { id: true, companyName: true } },
            product: { select: { code: true, name: true } },
            payments: { orderBy: { dueDate: 'asc' }, select: { dueDate: true, value: true, status: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return mentors.map(m => {
      const planValue = Number(m.plan.value)
      const totalPayments = m.plan.payments.reduce((s, p) => s + Number(p.value), 0)
      const mentorValue = Number(m.value)

      // Calculate monthly breakdown based on payment schedule
      const monthlyBreakdown: Record<string, number> = {}
      for (const pay of m.plan.payments) {
        const proportion = totalPayments > 0 ? Number(pay.value) / totalPayments : 0
        const mentorInstallment = Math.round(mentorValue * proportion * 100) / 100
        const monthKey = `${pay.dueDate.getFullYear()}-${String(pay.dueDate.getMonth() + 1).padStart(2, '0')}`
        monthlyBreakdown[monthKey] = (monthlyBreakdown[monthKey] ?? 0) + mentorInstallment
      }

      return {
        id: m.id,
        mentorName: m.mentorName,
        value: mentorValue,
        notes: m.notes,
        createdAt: m.createdAt,
        client: m.plan.client.companyName,
        clientId: m.plan.client.id,
        product: m.plan.product.code,
        productName: m.plan.product.name,
        planValue,
        monthlyBreakdown,
      }
    })
  }

  async getMentors(planId: string) {
    return this.prisma.planMentor.findMany({
      where: { planId },
      orderBy: { createdAt: 'asc' },
    }).then(mentors => mentors.map(m => ({
      ...m,
      value: Number(m.value),
    })))
  }

  async addMentor(planId: string, dto: { mentorName: string; value: number; notes?: string }) {
    const plan = await this.prisma.clientPlan.findUnique({
      where: { id: planId },
      include: { client: { select: { id: true, companyName: true } }, product: { select: { name: true } } },
    })
    if (!plan) throw new NotFoundException(`Plano ${planId} nao encontrado`)

    // Validate: total mentors cannot exceed plan value
    const existingMentors = await this.prisma.planMentor.findMany({ where: { planId } })
    const currentTotal = existingMentors.reduce((s, m) => s + Number(m.value), 0)
    const available = Number(plan.value) - currentTotal

    if (dto.value > available) {
      throw new BadRequestException(
        `Valor excede o saldo disponivel. Plano: R$${Number(plan.value)} | Ja atribuido: R$${currentTotal} | Disponivel: R$${available}`,
      )
    }

    const mentor = await this.prisma.planMentor.create({
      data: { planId, mentorName: dto.mentorName, value: dto.value, notes: dto.notes },
    })

    // Get all payments for this plan to distribute mentor value proportionally
    const payments = await this.prisma.payment.findMany({
      where: { clientPlanId: planId },
      orderBy: { installment: 'asc' },
    })

    if (payments.length > 0) {
      const totalPayments = payments.reduce((s, p) => s + Number(p.value), 0)

      for (const payment of payments) {
        const proportion = Number(payment.value) / totalPayments
        const mentorInstallmentValue = Math.round(dto.value * proportion * 100) / 100

        await this.expensesService.create({
          description: `Mentoria ${dto.mentorName} — ${plan.client.companyName} (${plan.product.name}) parcela ${payment.installment}`,
          category: 'PESSOAS',
          value: mentorInstallmentValue,
          recurrence: 'UNICA',
          dueDate: payment.dueDate,
          notes: `${dto.mentorName} | Parcela ${payment.installment}/${payments.length} | Proporcional ao pagamento`,
        })
      }
    } else {
      // Fallback: single expense if no payments exist
      await this.expensesService.create({
        description: `Mentoria ${dto.mentorName} — ${plan.client.companyName} (${plan.product.name})`,
        category: 'PESSOAS',
        value: dto.value,
        recurrence: 'UNICA',
        dueDate: new Date(),
        notes: dto.notes || `Mentoria atribuida ao plano ${plan.product.name}`,
      })
    }

    await this.activityLog.log({
      clientId: plan.client.id,
      entityType: 'PLAN',
      entityId: planId,
      action: 'MENTOR_ASSIGNED',
      description: `Mentor ${dto.mentorName} atribuido — R$${dto.value} em ${payments.length} parcelas (${plan.product.name})`,
    })

    return { ...mentor, value: Number(mentor.value) }
  }

  async updateMentor(mentorId: string, dto: { mentorName?: string; value?: number; notes?: string }) {
    const existing = await this.prisma.planMentor.findUnique({ where: { id: mentorId } })
    if (!existing) throw new NotFoundException(`Mentor ${mentorId} nao encontrado`)

    // Validate value if changing
    if (dto.value !== undefined) {
      const plan = await this.prisma.clientPlan.findUnique({ where: { id: existing.planId } })
      const otherMentors = await this.prisma.planMentor.findMany({
        where: { planId: existing.planId, id: { not: mentorId } },
      })
      const othersTotal = otherMentors.reduce((s, m) => s + Number(m.value), 0)
      const available = Number(plan!.value) - othersTotal

      if (dto.value > available) {
        throw new BadRequestException(
          `Valor excede o saldo disponivel. Disponivel: R$${available}`,
        )
      }
    }

    const data: Record<string, unknown> = {}
    if (dto.mentorName !== undefined) data.mentorName = dto.mentorName
    if (dto.value !== undefined) data.value = dto.value
    if (dto.notes !== undefined) data.notes = dto.notes

    const updated = await this.prisma.planMentor.update({ where: { id: mentorId }, data })
    return { ...updated, value: Number(updated.value) }
  }

  async removeMentor(mentorId: string) {
    const existing = await this.prisma.planMentor.findUnique({ where: { id: mentorId } })
    if (!existing) throw new NotFoundException(`Mentor ${mentorId} nao encontrado`)

    await this.prisma.planMentor.delete({ where: { id: mentorId } })
    return { deleted: true }
  }
}
