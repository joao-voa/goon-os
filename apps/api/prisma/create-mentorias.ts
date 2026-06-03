import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const SCHEDULE: { searchName: string; date: string; note?: string }[] = [
  { searchName: 'Beyousto',     date: '2026-06-01T08:00:00-03:00' },
  { searchName: 'Lakre',        date: '2026-06-05T14:00:00-03:00', note: 'Horário a confirmar' },
  { searchName: 'Moss Home',    date: '2026-06-11T14:00:00-03:00' },
  { searchName: 'SannaDecor',   date: '2026-06-02T10:00:00-03:00' },
  { searchName: 'TrezeCore',    date: '2026-06-03T13:00:00-03:00' },
  { searchName: 'Soccol',       date: '2026-06-10T14:00:00-03:00' },
  { searchName: 'Ice Company',  date: '2026-06-08T10:00:00-03:00' },
  { searchName: 'LM Fashion',   date: '2026-06-03T11:00:00-03:00' },
  { searchName: 'Presence',     date: '2026-06-10T16:00:00-03:00' },
  { searchName: 'LADY MODAS',   date: '2026-06-09T17:00:00-03:00' },
]

async function main() {
  let ok = 0
  let fail = 0
  for (const item of SCHEDULE) {
    const client = await prisma.client.findFirst({
      where: {
        OR: [
          { companyName: { contains: item.searchName, mode: 'insensitive' } },
          { tradeName:   { contains: item.searchName, mode: 'insensitive' } },
        ],
      },
      select: { id: true, companyName: true, responsible: true },
    })
    if (!client) {
      console.log(`✗ ${item.searchName} — cliente não encontrado`)
      fail++
      continue
    }
    const meeting = await prisma.meeting.create({
      data: {
        clientId: client.id,
        title: `Mentoria — ${client.companyName}`,
        type: 'INDIVIDUAL',
        category: 'MENTORIA',
        date: new Date(item.date),
        duration: 60,
        mentorName: 'Giulliano',
        status: 'SCHEDULED',
        notes: item.note || null,
      },
    })
    console.log(`✓ ${client.companyName} — ${new Date(item.date).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (id ${meeting.id})`)
    ok++
  }
  console.log(`\nTotal: ${ok} criadas, ${fail} falhas`)
}
main().finally(() => prisma.$disconnect())
