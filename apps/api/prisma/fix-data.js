require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function run() {
  console.log('══════════════════════════════════════════')
  console.log('  CORREÇÃO DE DADOS')
  console.log('══════════════════════════════════════════\n')

  // 1. Fix Haya Shoes — was overwritten with Brukki data
  const haya = await prisma.client.findFirst({ where: { companyName: 'Haya Shoes' } })
  if (haya) {
    await prisma.client.update({
      where: { id: haya.id },
      data: {
        responsible: 'Bruna Auad Proença',
        cnpj: '37.655.752/0001-09',
        email: 'brunaauad@gmail.com',
        address: 'Rua Oscar Freire, nº 715, Apto 73',
        neighborhood: '',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '',
        mainPains: 'CPF: 368.636.698-00\nRG: 43.708.250-7\nNacionalidade: Brasileira\nEstado Civil: Solteira\nProfissão: Administradora\nPagamento: PIX, boleto ou cartão de crédito\nObjeto: Mentoria GOON INFINITY',
      },
    })
    console.log('✓ Haya Shoes CORRIGIDO — Bruna Auad Proença, CNPJ 37.655.752/0001-09')
  }

  // 2. Create Brukki as separate client (it exists already from reimport, just needs data update)
  const brukki = await prisma.client.findFirst({ where: { companyName: { contains: 'Brukki', mode: 'insensitive' } } })
  if (!brukki) {
    // Need to check if it was imported under different name
    const brukki2 = await prisma.client.findFirst({ where: { responsible: { contains: 'Bruna', mode: 'insensitive' }, companyName: { not: 'Haya Shoes' } } })
    if (brukki2) {
      console.log('  Found Brukki candidate:', brukki2.companyName, '—', brukki2.responsible)
    }
  }

  // The Brukki from reimport should exist — let's check
  const allClients = await prisma.client.findMany({ orderBy: { companyName: 'asc' } })
  const bruk = allClients.find(c => c.companyName.toLowerCase().includes('brukki'))

  if (!bruk) {
    // Create Brukki
    const products = await prisma.product.findMany()
    const geId = products.find(p => p.code === 'GE')?.id

    const newBrukki = await prisma.client.create({
      data: {
        companyName: 'Brukki',
        responsible: 'Bruna',
        cnpj: '45.188.428/0001-48',
        address: 'Rua Alexandrino Pedroso, nº 247, Loja 11',
        neighborhood: 'Brás',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '03031-900',
        status: 'ACTIVE',
        segment: 'Moda',
        mainPains: 'Pagamento: R$ 5.000 entrada + 6x R$ 5.000\nObjeto: Mentoria Método GOON ELITE',
      },
    })

    if (geId) {
      await prisma.clientPlan.create({
        data: {
          clientId: newBrukki.id,
          productId: geId,
          value: 35000,
          paymentType: 'INSTALLMENT',
          installments: 7,
          installmentValue: 5000,
          cycleDuration: 6,
          startDate: new Date('2025-12-01'),
          endDate: new Date('2026-06-01'),
          paymentDay: 10,
          status: 'ACTIVE',
          notes: 'R$ 5.000 entrada + 6x R$ 5.000',
        },
      })
      await prisma.onboarding.create({
        data: { clientId: newBrukki.id, currentStage: 'ONBOARDING_DONE', notes: 'Contrato assinado' },
      })
    }
    console.log('✓ Brukki CRIADO — CNPJ 45.188.428/0001-48')
  } else {
    // Update existing Brukki with correct data
    await prisma.client.update({
      where: { id: bruk.id },
      data: {
        cnpj: '45.188.428/0001-48',
        address: 'Rua Alexandrino Pedroso, nº 247, Loja 11',
        neighborhood: 'Brás',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '03031-900',
        mainPains: 'Pagamento: R$ 5.000 entrada + 6x R$ 5.000\nObjeto: Mentoria Método GOON ELITE',
      },
    })
    console.log('✓ Brukki ATUALIZADO — CNPJ 45.188.428/0001-48')
  }

  // 3. Fix IZ Confecções — should be GE not GI
  const iz = await prisma.client.findFirst({ where: { companyName: { contains: 'IZ Conf', mode: 'insensitive' } } })
  if (iz) {
    const geProd = await prisma.product.findFirst({ where: { code: 'GE' } })
    const izPlan = await prisma.clientPlan.findFirst({ where: { clientId: iz.id } })
    if (izPlan && geProd && izPlan.productId !== geProd.id) {
      await prisma.clientPlan.update({
        where: { id: izPlan.id },
        data: { productId: geProd.id, value: 60000, installmentValue: 10000, installments: 6, notes: 'Entrada R$ 10.000 + 5x R$ 10.000 boleto dia 20' },
      })
      console.log('✓ IZ Confecções — produto corrigido para GE, valor R$ 60.000')
    }
  }

  // 4. Fix Lakre Fitness — should be GI (not GE, was imported wrong)
  const lakre = await prisma.client.findFirst({ where: { companyName: { contains: 'Lakre', mode: 'insensitive' } } })
  if (lakre) {
    const giProd = await prisma.product.findFirst({ where: { code: 'GI' } })
    const lakrePlan = await prisma.clientPlan.findFirst({ where: { clientId: lakre.id } })
    if (lakrePlan && giProd) {
      await prisma.clientPlan.update({
        where: { id: lakrePlan.id },
        data: { productId: giProd.id, value: 12000, installmentValue: 1000, installments: 12, notes: 'Entrada R$ 1.000 + 11x R$ 1.000 boleto/PIX' },
      })
      console.log('✓ Lakre Fitness — produto corrigido para GI, valor R$ 12.000')
    }
  }

  // 5. Verify Presence Jeans has address
  const presence = await prisma.client.findFirst({ where: { companyName: { contains: 'Presence', mode: 'insensitive' } } })
  if (presence && !presence.address) {
    await prisma.client.update({
      where: { id: presence.id },
      data: { city: 'São Paulo', state: 'SP', zipCode: '03027-000' },
    })
    console.log('✓ Presence Jeans — cidade/estado adicionados')
  }

  // Final count
  const total = await prisma.client.count()
  const active = await prisma.client.count({ where: { status: 'ACTIVE' } })
  const withEmail = await prisma.client.count({ where: { email: { not: null } } })
  const withCNPJ = await prisma.client.count({ where: { cnpj: { not: null } } })

  console.log('\n══════════════════════════════════════════')
  console.log('  RESUMO FINAL')
  console.log('  Total: ' + total + ' | Ativos: ' + active)
  console.log('  Com email: ' + withEmail + ' | Com CNPJ: ' + withCNPJ)
  console.log('══════════════════════════════════════════')
}

run().catch(console.error).finally(() => prisma.$disconnect())
