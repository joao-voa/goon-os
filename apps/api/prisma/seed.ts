import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create admin user
  const hashedPassword = await bcrypt.hash('goon2026', 10)
  await prisma.user.upsert({
    where: { email: 'admin@goon.com.br' },
    update: {},
    create: {
      name: 'Admin GOON',
      email: 'admin@goon.com.br',
      password: hashedPassword,
    },
  })
  console.log('✓ Admin user created: admin@goon.com.br / goon2026')

  // Create test user
  const testPassword = await bcrypt.hash('teste123', 10)
  await prisma.user.upsert({
    where: { email: 'teste@teste.com' },
    update: {},
    create: {
      name: 'Teste',
      email: 'teste@teste.com',
      password: testPassword,
    },
  })
  console.log('✓ Test user created: teste@teste.com / teste123')

  // Create products
  const products = [
    { code: 'GE', name: 'GOON ELITE', description: 'Plano básico de consultoria de gestão' },
    { code: 'GI', name: 'GOON INFINITY', description: 'Plano intermediário com acompanhamento expandido' },
    { code: 'GS', name: 'GOON SCALE', description: 'Plano premium com consultoria completa e escalabilidade' },
  ]

  for (const product of products) {
    await prisma.product.upsert({
      where: { code: product.code },
      update: {},
      create: product,
    })
  }
  console.log('✓ Products created: GE, GI, GS')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
