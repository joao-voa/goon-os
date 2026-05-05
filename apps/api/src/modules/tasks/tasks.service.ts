import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: { stage?: string; assignee?: string }) {
    const { stage, assignee } = params
    const where: Record<string, unknown> = {}
    if (stage) where.stage = stage
    if (assignee) where.assignee = assignee

    return this.prisma.task.findMany({
      where,
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    })
  }

  async create(dto: {
    title: string
    description?: string
    stage?: string
    priority?: string
    assignee?: string
    dueDate?: string
    tags?: string[]
  }) {
    return this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        stage: dto.stage ?? 'TODO',
        priority: dto.priority ?? 'MEDIUM',
        assignee: dto.assignee,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        tags: dto.tags ? JSON.stringify(dto.tags) : null,
      },
    })
  }

  async update(id: string, dto: {
    title?: string
    description?: string
    stage?: string
    priority?: string
    assignee?: string
    dueDate?: string | null
    tags?: string[]
    order?: number
  }) {
    const existing = await this.prisma.task.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Task not found')

    const data: Record<string, unknown> = {}
    if (dto.title !== undefined) data.title = dto.title
    if (dto.description !== undefined) data.description = dto.description
    if (dto.priority !== undefined) data.priority = dto.priority
    if (dto.assignee !== undefined) data.assignee = dto.assignee
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null
    if (dto.tags !== undefined) data.tags = JSON.stringify(dto.tags)
    if (dto.order !== undefined) data.order = dto.order
    if (dto.stage !== undefined) {
      data.stage = dto.stage
      if (dto.stage === 'DONE' && existing.stage !== 'DONE') data.completedAt = new Date()
      if (dto.stage !== 'DONE' && existing.stage === 'DONE') data.completedAt = null
    }

    return this.prisma.task.update({ where: { id }, data })
  }

  async changeStage(id: string, stage: string) {
    return this.update(id, { stage })
  }

  async remove(id: string) {
    await this.prisma.task.delete({ where: { id } })
    return { deleted: true }
  }

  async getTags() {
    const tasks = await this.prisma.task.findMany({
      where: { tags: { not: null } },
      select: { tags: true },
    })
    const allTags = new Set<string>()
    tasks.forEach(t => {
      try {
        const parsed = JSON.parse(t.tags!)
        parsed.forEach((tag: string) => allTags.add(tag))
      } catch { /* ignore */ }
    })
    return [...allTags].sort()
  }

  async getAssignees() {
    const tasks = await this.prisma.task.findMany({
      where: { assignee: { not: null } },
      select: { assignee: true },
      distinct: ['assignee'],
    })
    return tasks.map(t => t.assignee).filter(Boolean)
  }
}
