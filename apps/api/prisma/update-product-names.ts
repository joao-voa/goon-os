import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.product.update({
    where: { code: 'GE' },
    data: { name: 'GOON Experience', description: 'Programa de entrada — fundamentos e posicionamento' },
  })
  console.log('✓ GE → GOON Experience')

  await prisma.product.update({
    where: { code: 'GI' },
    data: { name: 'GOON Intensive', description: 'Programa intermediário — aquisição e vendas' },
  })
  console.log('✓ GI → GOON Intensive')

  await prisma.product.update({
    where: { code: 'GS' },
    data: { name: 'GOON Scale', description: 'Programa avançado — escala e operação' },
  })
  console.log('✓ GS → GOON Scale')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
