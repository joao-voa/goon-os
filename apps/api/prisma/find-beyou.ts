import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const r = await prisma.client.findMany({
    where: {
      OR: [
        { companyName: { contains: 'be', mode: 'insensitive' } },
        { tradeName: { contains: 'be', mode: 'insensitive' } },
        { responsible: { contains: 'sto', mode: 'insensitive' } },
      ],
    },
    select: { id: true, companyName: true, tradeName: true, responsible: true },
  })
  r.forEach((m) => console.log(`  ${m.companyName}${m.tradeName ? ' ('+m.tradeName+')' : ''} | ${m.responsible}`))
}
main().finally(() => prisma.$disconnect())
