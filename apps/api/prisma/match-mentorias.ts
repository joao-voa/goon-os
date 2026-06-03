import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const SCHEDULE = [
  { name: 'Be You',      date: '2026-06-01T08:00:00-03:00' },
  { name: 'Lakre',       date: '2026-06-05T14:00:00-03:00', note: 'Horário a confirmar' },
  { name: 'Moss Home',   date: '2026-06-11T14:00:00-03:00' },
  { name: 'Sanna',       date: '2026-06-02T10:00:00-03:00' },
  { name: 'TrezeCore',   date: '2026-06-03T13:00:00-03:00' },
  { name: 'Soccol',      date: '2026-06-10T14:00:00-03:00' },
  { name: 'Ice Company', date: '2026-06-08T10:00:00-03:00' },
  { name: 'LM Fashion',  date: '2026-06-03T11:00:00-03:00' },
  { name: 'Presence',    date: '2026-06-10T16:00:00-03:00' },
  { name: 'Lady',        date: '2026-06-09T17:00:00-03:00' },
]

async function main() {
  for (const item of SCHEDULE) {
    const matches = await prisma.client.findMany({
      where: {
        OR: [
          { companyName: { contains: item.name, mode: 'insensitive' } },
          { tradeName:   { contains: item.name, mode: 'insensitive' } },
        ],
      },
      select: { id: true, companyName: true, tradeName: true, responsible: true },
    })
    const tag = matches.length === 1 ? '✓' : matches.length === 0 ? '✗' : '⚠'
    console.log(`${tag} [${item.name}] -> ${matches.length}`)
    matches.forEach((m) => console.log(`     ${m.companyName}${m.tradeName ? ' ('+m.tradeName+')' : ''} | ${m.responsible}`))
  }
}
main().finally(() => prisma.$disconnect())
