import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import * as bcrypt from 'bcryptjs'

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async findAllUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        allowedModules: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return users
  }

  async findUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        allowedModules: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    if (!user) throw new NotFoundException(`User ${id} not found`)
    return user
  }

  async createUser(dto: {
    name: string
    email: string
    password: string
    role: string
    allowedModules?: string
  }) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) throw new BadRequestException('Email ja cadastrado')

    const hashed = await bcrypt.hash(dto.password, 10)

    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashed,
        role: dto.role,
        allowedModules: dto.allowedModules,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        allowedModules: true,
        isActive: true,
        createdAt: true,
      },
    })
  }

  async updateUser(id: string, dto: {
    name?: string
    email?: string
    password?: string
    role?: string
    allowedModules?: string
    isActive?: boolean
  }) {
    const existing = await this.prisma.user.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`User ${id} not found`)

    const data: Record<string, unknown> = {}
    if (dto.name !== undefined) data.name = dto.name
    if (dto.email !== undefined) data.email = dto.email
    if (dto.role !== undefined) data.role = dto.role
    if (dto.allowedModules !== undefined) data.allowedModules = dto.allowedModules
    if (dto.isActive !== undefined) data.isActive = dto.isActive
    if (dto.password) data.password = await bcrypt.hash(dto.password, 10)

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        allowedModules: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async deleteUser(id: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`User ${id} not found`)
    await this.prisma.user.delete({ where: { id } })
    return { deleted: true }
  }
}
