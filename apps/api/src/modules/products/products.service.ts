import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const products = await this.prisma.product.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            plans: { where: { status: 'ACTIVE' } },
          },
        },
      },
    })
    return products
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            plans: { where: { status: 'ACTIVE' } },
          },
        },
      },
    })
    if (!product) {
      throw new NotFoundException(`Produto com ID ${id} não encontrado`)
    }
    return product
  }

  async create(dto: { code: string; name: string; description?: string }) {
    return this.prisma.product.create({ data: dto })
  }

  async update(id: string, dto: { name?: string; description?: string; isActive?: boolean }) {
    const existing = await this.prisma.product.findUnique({ where: { id } })
    if (!existing) {
      throw new NotFoundException(`Produto com ID ${id} não encontrado`)
    }
    return this.prisma.product.update({ where: { id }, data: dto })
  }
}
