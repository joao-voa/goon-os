require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const XLSX = require('xlsx')

const prisma = new PrismaClient()

const FIN = [
  { name: 'Tiago', product: 'GI', status: 'CANCELADO', m: 2000, t: 12000, d: 1 },
  { name: 'Andressa Marchiori', product: 'GI', status: 'RENOVAR', m: 12000, t: 12000, d: 5 },
  { name: 'Camila', product: 'GI', status: 'VERIFICAR', m: 500, t: 12000, d: 5 },
  { name: 'Joel', product: 'GI', status: 'CANCELADO', m: 2500, t: 0, d: 4 },
  { name: 'Dayane', product: 'GE', status: 'RENOVAR', m: 5000, t: 30000, d: 4 },
  { name: 'Julia', product: 'GI', status: 'CANCELADO', m: 1000, t: 12000, d: 5 },
  { name: 'Marcos Pio', product: 'GI', status: 'VERIFICAR', m: 500, t: 12000, d: 8 },
  { name: 'Bruna', product: 'GI', status: 'VERIFICAR', m: 1500, t: 12000, d: 9 },
  { name: 'Thomaz', product: 'GE', status: 'VERIFICAR', m: 4166, t: 29996, d: 10 },
  { name: 'Joice', product: 'GI', status: 'CANCELADO', m: 2000, t: 12000, d: 10 },
  { name: 'Juliana Caffona', product: 'GE', status: 'VERIFICAR', m: 1000, t: 35000, d: 10 },
  { name: 'Rafael', product: 'GE', status: 'VERIFICAR', m: 1000, t: 12000, d: 10 },
  { name: 'Thiago Sanna', product: 'GE', status: 'VERIFICAR', m: 2000, t: 30000, d: 10 },
  { name: 'Allan', product: 'GE', status: 'RENEGOCIAR', m: 5000, t: 30000, d: 10 },
  { name: 'Leonardo Tee', product: 'GE', status: 'ENVIAR CONTRATO', m: 3200, t: 19200, d: 10 },
  { name: 'Hector', product: 'GS', status: 'CONGELADO', m: 2500, t: 30000, d: 11 },
  { name: 'Michel', product: 'GI', status: 'CANCELADO', m: 2300, t: 12000, d: 11 },
  { name: 'Viviane', product: 'GI', status: 'VERIFICAR', m: 800, t: 12000, d: 12 },
  { name: 'Ihally', product: 'GE', status: 'RENEGOCIAR', m: 5000, t: 30000, d: 15 },
  { name: 'Juliana Soho', product: 'GI', status: 'PAGO', m: 2000, t: 12000, d: 15 },
  { name: 'Marcondes', product: 'GE', status: 'CANCELADO', m: 5000, t: 35000, d: 15 },
  { name: 'Nicolas', product: 'GE', status: 'VERIFICAR', m: 2000, t: 30000, d: 16 },
  { name: 'Luiza', product: 'GI', status: 'VERIFICAR', m: 2000, t: 12000, d: 16 },
  { name: 'Higor', product: 'GI', status: 'PAGO', m: 5000, t: 10000, d: 18 },
  { name: 'Guilherme', product: 'GI', status: 'VERIFICAR', m: 2000, t: 12000, d: 20 },
  { name: 'Geici', product: 'GI', status: 'VERIFICAR', m: 1000, t: 12000, d: 20 },
  { name: 'Victor', product: 'GI', status: 'CANCELADO', m: 0, t: 0, d: 20 },
  { name: 'Pedro', product: 'GE', status: 'PAGO', m: 10000, t: 30000, d: 20 },
  { name: 'Ronaldo', product: 'GE', status: 'VERIFICAR', m: 5000, t: 30000, d: 20 },
  { name: 'Fernanda', product: 'GE', status: 'VERIFICAR', m: 1000, t: 12000, d: 20 },
  { name: 'Luis', product: 'GI', status: 'VERIFICAR', m: 10000, t: 60000, d: 20 },
  { name: 'Taina', product: 'GI', status: 'VERIFICAR', m: 1000, t: 12000, d: 20 },
  { name: 'Johnny', product: 'GI', status: 'VERIFICAR', m: 500, t: 12000, d: 20 },
  { name: 'Legri', product: 'GI', status: 'VERIFICAR', m: 1000, t: 12000, d: 20 },
  { name: 'Everton', product: 'GI', status: 'VERIFICAR', m: 1000, t: 12000, d: 20 },
  { name: 'Carla', product: 'GE', status: 'VERIFICAR', m: 5000, t: 30000, d: 20 },
  { name: 'Tay', product: 'GI', status: 'PERMUTA', m: 2000, t: 12000, d: 23 },
  { name: 'Andressa Gregio', product: 'GI', status: 'REMOVER', m: 1150, t: 12000, d: 25 },
  { name: 'Diego', product: 'GE', status: 'VERIFICAR', m: 5000, t: 35000, d: 25 },
  { name: 'Denis', product: 'GE', status: 'VERIFICAR', m: 5000, t: 32000, d: 28 },
  { name: 'Thaiz', product: 'GE', status: 'VERIFICAR', m: 2076, t: 35000, d: 28 },
  { name: 'Felipe Pessoa', product: 'GI', status: 'VERIFICAR', m: 500, t: 12000, d: 30 },
  { name: 'Flavia', product: 'GI', status: 'VALIDAR', m: 20000, t: 0, d: 30 },
  { name: 'Marina', product: 'GE', status: 'RENEGOCIAR', m: 2500, t: 25000, d: 30 },
  { name: 'Vitor Magnum', product: 'GI', status: 'CANCELADO', m: 1500, t: 12000, d: 30 },
  { name: 'Aureliano', product: 'GE', status: 'RENOVADO', m: 2000, t: 20000, d: 20 },
  { name: 'Jessica', product: 'GE', status: 'RENOVADO', m: 5000, t: 24000, d: 25 },
  { name: 'Henderson', product: 'GE', status: 'ATRASADO', m: 3000, t: 9000, d: 20 },
  { name: 'Mauricio', product: 'GE', status: 'ATIVO', m: 2500, t: 0, d: 25 },
  { name: 'Filipe', product: 'GE', status: 'ATIVO', m: 4000, t: 33000, d: 20 },
  { name: 'Caio', product: 'GE', status: 'ATIVO', m: 1875, t: 5625, d: 18 },
  { name: 'Dri', product: 'GE', status: 'ATIVO', m: 5000, t: 30000, d: 15 },
  { name: 'Matheus', product: 'GE', status: 'ATRASADO', m: 10000, t: 0, d: 20 },
  { name: 'David', product: 'GI', status: 'VERIFICAR', m: 0, t: 0, d: 10 },
  { name: 'Eduardo Brunx', product: 'GI', status: 'VERIFICAR', m: 0, t: 0, d: 10 },
]

async function run() {
  console.log('Starting import...')
  const wb = XLSX.readFile('C:/Users/joao.vitor/Downloads/GOON/Goon Mentor Ship Integrantes.xlsx')
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
  const products = await prisma.product.findMany()
  const pMap = {}
  products.forEach(p => { pMap[p.code] = p.id })
  let created = 0, skipped = 0

  for (const row of rows) {
    const company = (row.Empresa || '').trim()
    const name = (row.Mentorado || '').trim()
    if (!company || !name) { skipped++; continue }

    const exists = await prisma.client.findFirst({ where: { companyName: company } })
    if (exists) { console.log('  skip:', company); skipped++; continue }

    const firstName = name.split('/')[0].trim().split(' ')[0].toLowerCase()
    const fin = FIN.find(f => f.name.toLowerCase().startsWith(firstName))

    let status = 'ACTIVE'
    if (fin && (fin.status.includes('CANCELADO') || fin.status.includes('CONGELADO') || fin.status.includes('REMOVER'))) {
      status = 'INACTIVE'
    }

    const phone = (row.Telefone || '').split('\n')[0].trim()
    const email = (row.Email || '').split('\n')[0].trim() || null
    const pc = fin ? fin.product.toUpperCase() : null

    const client = await prisma.client.create({
      data: {
        companyName: company,
        responsible: name,
        phone: phone || null,
        email: email,
        whatsapp: phone || null,
        segment: (row.Nicho || '').trim() || null,
        status: status,
        mainPains: (row['Tipo '] || '').trim() || null,
      },
    })

    if (fin && pc && pMap[pc] && fin.t > 0) {
      const inst = fin.m && fin.t ? Math.round(fin.t / fin.m) : 12
      await prisma.clientPlan.create({
        data: {
          clientId: client.id,
          productId: pMap[pc],
          value: fin.t,
          paymentType: inst <= 1 ? 'CASH' : 'INSTALLMENT',
          installments: inst,
          installmentValue: fin.m || fin.t,
          cycleDuration: inst > 12 ? 12 : inst,
          startDate: new Date('2025-06-01'),
          endDate: new Date('2026-06-01'),
          paymentDay: fin.d || 10,
          status: status === 'INACTIVE' ? 'CANCELLED' : 'ACTIVE',
          notes: fin.status,
        },
      })

      await prisma.onboarding.create({
        data: {
          clientId: client.id,
          currentStage: status === 'INACTIVE' ? 'ONBOARDING_DONE' : 'BILLING_CREATED',
          notes: fin.status,
        },
      })

      console.log('  +', company, '|', pc, '|', status, '| R$', fin.t)
    } else {
      console.log('  +', company, '| sem dados fin |', status)
    }

    await prisma.activityLog.create({
      data: {
        clientId: client.id,
        entityType: 'CLIENT',
        entityId: client.id,
        action: 'CREATED',
        description: 'Importado da planilha',
      },
    })
    created++
  }
  console.log('\nDone:', created, 'created,', skipped, 'skipped')
}

run().catch(console.error).finally(() => prisma.$disconnect())
