require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// ═══════════════════════════════════════════════════════════════
// DADOS REAIS DOS MENTORADOS ATIVOS
// ═══════════════════════════════════════════════════════════════
const MENTORADOS = [
  { day: 1, cycle: 'ciclo 1', prod: 'GI', name: 'Tiago', company: 'Todo Santo Dia', status: 'CANCELADO', notes: 'Cobrar multa', jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0 },
  { day: 5, cycle: 'ciclo 1', prod: 'GI', name: 'Andressa Marchiori', company: 'Andressa Marchiori', status: 'RENOVAR', notes: '', jun: 0, jul: 0, aug: 12000, sep: 0, oct: 0, nov: 0 },
  { day: 5, cycle: 'ciclo 1', prod: 'GI', name: 'Camila', company: 'A Firma', status: 'VERIFICAR', notes: 'Preciso dos dados', jun: 0, jul: 0, aug: 0, sep: 500, oct: 0, nov: 0 },
  { day: 4, cycle: 'renovar infinity', prod: 'GI', name: 'Joel', company: 'Skylife Jeans', status: 'PROPOSTA RENOVAÇÃO', notes: '', jun: 2500, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0 },
  { day: 4, cycle: 'renovar infinity', prod: 'GE', name: 'Dayane', company: 'Dayane Calçados', status: 'PROPOSTA RENOVAÇÃO GI', notes: '', jun: 0, jul: 5000, aug: 5000, sep: 5000, oct: 5000, nov: 5000 },
  { day: 5, cycle: 'renovar infinity', prod: 'GI', name: 'Julia', company: 'The Salt Side', status: 'CANCELADO', notes: 'Cobrar multa', jun: 1000, jul: 1000, aug: 1000, sep: 1000, oct: 1000, nov: 1000 },
  { day: 8, cycle: 'ciclo 1', prod: 'GI', name: 'Marcos Pio', company: 'Eden Brandt', status: 'VERIFICAR', notes: 'Boleto lançado', jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0 },
  { day: 9, cycle: 'ciclo 1', prod: 'GI', name: 'Bruna e Mari', company: 'Haya Shoes', status: 'VERIFICAR + RENOVAÇÃO', notes: 'Preciso dos dados', jun: 0, jul: 0, aug: 1500, sep: 1500, oct: 1500, nov: 0 },
  { day: 10, cycle: 'ciclo 1', prod: 'GE', name: 'Thomaz Cirone', company: 'Santavest', status: 'VERIFICAR + RENOVAÇÃO', notes: 'Conferir mês março', jun: 0, jul: 0, aug: 5000, sep: 4166, oct: 4166, nov: 0 },
  { day: 10, cycle: 'ciclo 1', prod: 'GI', name: 'Joice', company: 'AMMU', status: 'CANCELADO', notes: 'Cobrar multa', jun: 0, jul: 0, aug: 0, sep: 2000, oct: 0, nov: 0 },
  { day: 10, cycle: 'ciclo 1', prod: 'GE', name: 'Juliana', company: 'Caffona', status: 'VERIFICAR', notes: 'Preciso dos dados', jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0 },
  { day: 10, cycle: 'ciclo 1', prod: 'GE', name: 'Rafael e Malu', company: 'Lakre Fitness', status: 'VERIFICAR', notes: 'Preciso dos dados', jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0 },
  { day: 10, cycle: 'ciclo 1', prod: 'GE', name: 'Thiago', company: 'SannaDecor', status: 'VERIFICAR', notes: 'Boleto lançado', jun: 0, jul: 0, aug: 0, sep: 5000, oct: 0, nov: 0 },
  { day: 10, cycle: 'renovado GE', prod: 'GE', name: 'Allan e Armani', company: 'Vangolden', status: 'RENEGOCIAR RENOVAÇÃO', notes: 'Boleto lançado', jun: 5000, jul: 5000, aug: 5000, sep: 5000, oct: 5000, nov: 5000 },
  { day: 10, cycle: 'renovar GE', prod: 'GE', name: 'Leonardo', company: 'Tee Fashion', status: 'ENVIAR CONTRATO', notes: 'João cadastrar', jun: 0, jul: 3200, aug: 3200, sep: 3200, oct: 3200, nov: 3200 },
  { day: 11, cycle: 'ciclo 1', prod: 'GS', name: 'Hector Leonardo', company: 'Warmyt Co.', status: 'RENEGOCIAR RENOVAÇÃO MENOR', notes: '', jun: 0, jul: 0, aug: 5000, sep: 2500, oct: 2500, nov: 0 },
  { day: 11, cycle: 'ciclo 1', prod: 'GI', name: 'Michel', company: 'Use Wuste', status: 'CANCELADO', notes: 'Remover - contatar futuro', jun: 0, jul: 0, aug: 0, sep: 500, oct: 2300, nov: 0 },
  { day: 12, cycle: 'ciclo 1', prod: 'GI', name: 'Viviane', company: 'Be Queen', status: 'VERIFICAR + RENOVAÇÃO', notes: 'Preciso dos dados', jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0 },
  { day: 15, cycle: 'ciclo 1', prod: 'GE', name: 'Ihally', company: 'Bem Querida', status: 'RENEGOCIAR RENOVAÇÃO MENOR', notes: '', jun: 0, jul: 5000, aug: 5000, sep: 5000, oct: 5000, nov: 5000 },
  { day: 15, cycle: 'ciclo 1', prod: 'GI', name: 'Juliana', company: 'SohoBeach', status: 'PAGO 100% + RENOVAÇÃO', notes: '', jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0 },
  { day: 15, cycle: 'ciclo 1', prod: 'GE', name: 'Marcondes', company: 'Cauant Jeans', status: 'CANCELADO', notes: 'Cobrar multa', jun: 0, jul: 0, aug: 0, sep: 5000, oct: 5000, nov: 0 },
  { day: 16, cycle: 'ciclo 1', prod: 'GE', name: 'Nicolas e Talita', company: 'DelizandaBrand', status: 'VERIFICAR + RENOVAÇÃO', notes: '', jun: 0, jul: 0, aug: 0, sep: 2000, oct: 2000, nov: 0 },
  { day: 16, cycle: 'ciclo 1', prod: 'GI', name: 'Luiza e Murilo', company: 'LM Fashion Lab', status: 'VERIFICAR + RENOVAÇÃO', notes: '', jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0 },
  { day: 18, cycle: 'ciclo 1', prod: 'GI', name: 'Higor Evangelista', company: 'Lts Studio', status: 'PAGO 100% + VERIFICAR RENOVAÇÃO', notes: '', jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0 },
  { day: 20, cycle: 'ciclo 1', prod: 'GI', name: 'Guilherme e Camila', company: 'Valentiere', status: 'VERIFICAR + RENOVAÇÃO', notes: '', jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0 },
  { day: 20, cycle: 'ciclo 1', prod: 'GI', name: 'Geici', company: 'Imersiva', status: 'VERIFICAR + RENOVAÇÃO', notes: '', jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0 },
  { day: 20, cycle: 'ciclo 1', prod: 'GI', name: 'Victor', company: 'Bosy Coys', status: 'CANCELADO', notes: 'Remover - contatar futuro', jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0 },
  { day: 20, cycle: 'renovado GE', prod: 'GE', name: 'Pedro', company: 'Kan House', status: 'PAGO + RENOVAÇÃO', notes: '', jun: 0, jul: 0, aug: 0, sep: 10000, oct: 0, nov: 0 },
  { day: 20, cycle: 'renovado GE', prod: 'GE', name: 'Ronaldo', company: 'Shui', status: 'VERIFICAR + RENOVAÇÃO', notes: '', jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0 },
  { day: 20, cycle: 'renovado GE', prod: 'GE', name: 'Fernanda', company: 'Moss Home', status: 'VERIFICAR + RENOVAÇÃO', notes: 'Boletos lançados. Renovou dez: entrada 5k + 10x 1k', jun: 0, jul: 2000, aug: 2000, sep: 2000, oct: 2000, nov: 2000 },
  { day: 20, cycle: 'ciclo 1', prod: 'GI', name: 'Luis e Iza', company: 'IZ Confecções', status: 'VERIFICAR', notes: 'Levantar dores - aguardando', jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0 },
  { day: 20, cycle: 'ciclo 1', prod: 'GI', name: 'Taina', company: 'Antonita', status: 'VERIFICAR + RENOVAÇÃO', notes: 'Boletos lançados', jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0 },
  { day: 20, cycle: 'ciclo 1', prod: 'GI', name: 'Johnny', company: 'Kilombo93', status: 'VERIFICAR + RENOVAÇÃO', notes: 'Boletos lançados', jun: 0, jul: 0, aug: 0, sep: 500, oct: 0, nov: 0 },
  { day: 20, cycle: 'renovar infinity', prod: 'GI', name: 'Janice', company: 'Galeria Josenias', status: 'CANCELADO', notes: 'Remover', jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0 },
  { day: 20, cycle: 'ciclo 1', prod: 'GI', name: 'Legri', company: 'Dabeg', status: 'VERIFICAR CONTRATO', notes: 'Lançado boletos', jun: 0, jul: 0, aug: 0, sep: 1000, oct: 1000, nov: 0 },
  { day: 20, cycle: 'ciclo 1', prod: 'GI', name: 'Everton', company: 'MataNativa', status: 'VERIFICAR + RENOVAÇÃO', notes: 'Preciso dos dados', jun: 0, jul: 0, aug: 0, sep: 2000, oct: 0, nov: 0 },
  { day: 20, cycle: 'renovado GE', prod: 'GE', name: 'Carla Milani', company: 'OMNE', status: 'VERIFICAR + RENOVAÇÃO', notes: 'Boletos lançados', jun: 0, jul: 0, aug: 5000, sep: 5000, oct: 5000, nov: 5000 },
  { day: 23, cycle: 'ciclo 1', prod: 'GI', name: 'Tay Gomes', company: 'Tay Confecções', status: 'PERMUTA', notes: 'Modelo de permuta - conteúdo', jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0 },
  { day: 25, cycle: 'ciclo 1', prod: 'GI', name: 'Andressa Grégio', company: 'Use Rhino', status: 'REMOVER BOLETOS', notes: 'Renovação produto menor', jun: 0, jul: 0, aug: 0, sep: 500, oct: 1150, nov: 0 },
  { day: 25, cycle: 'renovado GE', prod: 'GE', name: 'Diego', company: 'TrezeCore', status: 'VERIFICAR + RENOVAÇÃO', notes: '', jun: 5000, jul: 5000, aug: 5000, sep: 5000, oct: 5000, nov: 0 },
  { day: 28, cycle: 'renovar GE', prod: 'GE', name: 'Denis', company: 'Pangeia', status: 'VERIFICAR CONTRATO', notes: 'Manter como parceiro - modelar', jun: 8000, jul: 8000, aug: 8000, sep: 8000, oct: 0, nov: 0 },
  { day: 28, cycle: 'ciclo 1', prod: 'GE', name: 'Thaiz Ferraz', company: 'INÓBVIA', status: 'VERIFICAR + RENOVAÇÃO', notes: 'Preciso dos dados. 3 primeiras 1k depois 2076', jun: 0, jul: 0, aug: 5000, sep: 1000, oct: 1000, nov: 0 },
  { day: 30, cycle: 'ciclo 1', prod: 'GI', name: 'Felipe Pessoa', company: 'Ice Company', status: 'VERIFICAR + RENOVAÇÃO', notes: 'Preciso dos dados', jun: 0, jul: 0, aug: 500, sep: 500, oct: 500, nov: 0 },
  { day: 30, cycle: 'ciclo 1', prod: 'GI', name: 'Flávia', company: 'Soccol', status: 'VALIDAR CONTRATO', notes: '', jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0 },
  { day: 30, cycle: 'renovar GE', prod: 'GE', name: 'Marina e Larissa', company: 'Revival', status: 'RENEGOCIAR RENOVAÇÃO MENOR', notes: '', jun: 2500, jul: 2500, aug: 2500, sep: 2500, oct: 2500, nov: 2500 },
  { day: 30, cycle: 'ciclo 1', prod: 'GI', name: 'Vitor', company: 'MagnumWear', status: 'CANCELADO', notes: 'Remover dos recebíveis', jun: 0, jul: 5000, aug: 0, sep: 1500, oct: 0, nov: 0 },
]

async function run() {
  console.log('══════════════════════════════════════════')
  console.log('  REIMPORTAÇÃO — MENTORADOS ATIVOS')
  console.log('══════════════════════════════════════════\n')

  // Step 1: Delete all existing data (in correct order due to foreign keys)
  console.log('1. Limpando banco...')
  await prisma.activityLog.deleteMany()
  await prisma.pendency.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.contract.deleteMany()
  await prisma.onboarding.deleteMany()
  await prisma.clientPlan.deleteMany()
  await prisma.client.deleteMany()
  console.log('   ✓ Banco limpo\n')

  // Step 2: Get products
  const products = await prisma.product.findMany()
  const pMap = {}
  products.forEach(p => { pMap[p.code] = p.id })
  console.log('2. Produtos:', Object.keys(pMap).join(', '), '\n')

  // Step 3: Import each mentorado
  console.log('3. Importando mentorados...\n')
  let created = 0

  for (const m of MENTORADOS) {
    // Determine client status
    let clientStatus = 'ACTIVE'
    const st = m.status.toUpperCase()
    if (st.includes('CANCELADO') || st.includes('REMOVER')) {
      clientStatus = 'INACTIVE'
    }

    // Fix product code
    let productCode = m.prod.toUpperCase()
    if (productCode === 'G1') productCode = 'GI'
    if (productCode === 'GJ') productCode = 'GE'

    // Calculate total value from monthly payments
    const months = [m.jun, m.jul, m.aug, m.sep, m.oct, m.nov]
    const totalFromMonths = months.reduce((sum, v) => sum + (v || 0), 0)
    const monthlyValue = months.find(v => v > 0) || 0

    // Create client
    const client = await prisma.client.create({
      data: {
        companyName: m.company,
        responsible: m.name,
        status: clientStatus,
        segment: 'Moda',
      },
    })

    // Create plan
    if (pMap[productCode]) {
      const totalValue = totalFromMonths > 0 ? totalFromMonths : 12000
      const installments = monthlyValue > 0 ? Math.round(totalValue / monthlyValue) : 12

      await prisma.clientPlan.create({
        data: {
          clientId: client.id,
          productId: pMap[productCode],
          value: totalValue,
          paymentType: installments <= 1 ? 'CASH' : 'INSTALLMENT',
          installments: installments,
          installmentValue: monthlyValue || totalValue,
          cycleDuration: 12,
          startDate: new Date('2025-06-01'),
          endDate: new Date('2026-06-01'),
          paymentDay: m.day,
          status: clientStatus === 'INACTIVE' ? 'CANCELLED' : 'ACTIVE',
          notes: [m.cycle, m.status, m.notes].filter(Boolean).join(' — '),
        },
      })

      // Create payments for months with values
      const monthNames = ['jun', 'jul', 'aug', 'sep', 'oct', 'nov']
      const monthDates = ['2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11']
      let parcela = 0

      for (let i = 0; i < months.length; i++) {
        if (months[i] > 0) {
          parcela++
          const dueDate = new Date(`${monthDates[i]}-${String(m.day).padStart(2, '0')}`)

          await prisma.payment.create({
            data: {
              clientId: client.id,
              clientPlanId: undefined, // will link later if needed
              installment: parcela,
              totalInstallments: installments,
              dueDate: dueDate,
              value: months[i],
              status: st.includes('PAGO') ? 'PAID' : (dueDate < new Date() ? 'OVERDUE' : 'PENDING'),
            },
          })
        }
      }

      // Create onboarding
      let stage = 'BILLING_CREATED'
      if (st.includes('CANCELADO') || st.includes('REMOVER')) stage = 'ONBOARDING_DONE'
      else if (st.includes('ENVIAR CONTRATO')) stage = 'CONTRACT_DRAFTED'
      else if (st.includes('VALIDAR CONTRATO') || st.includes('VERIFICAR CONTRATO')) stage = 'CONTRACT_SENT'
      else if (st.includes('PAGO')) stage = 'ONBOARDING_DONE'
      else if (st.includes('RENOVAR') || st.includes('RENEGOCIAR') || st.includes('PROPOSTA')) stage = 'ONBOARDING_DONE'

      await prisma.onboarding.create({
        data: {
          clientId: client.id,
          currentStage: stage,
          notes: m.status,
        },
      })
    }

    // Activity log
    await prisma.activityLog.create({
      data: {
        clientId: client.id,
        entityType: 'CLIENT',
        entityId: client.id,
        action: 'CREATED',
        description: `${m.company} — ${productCode} ${m.cycle} — ${m.status}`,
      },
    })

    const emoji = clientStatus === 'INACTIVE' ? '✗' : '✓'
    console.log(`   ${emoji} ${m.company} | ${productCode} | ${clientStatus} | ${m.status}`)
    created++
  }

  // Final counts
  const totalClients = await prisma.client.count()
  const activeClients = await prisma.client.count({ where: { status: 'ACTIVE' } })
  const inactiveClients = await prisma.client.count({ where: { status: 'INACTIVE' } })
  const totalPlans = await prisma.clientPlan.count()
  const totalPayments = await prisma.payment.count()
  const totalOnboardings = await prisma.onboarding.count()

  console.log('\n══════════════════════════════════════════')
  console.log(`  RESULTADO`)
  console.log(`  Clientes: ${totalClients} (${activeClients} ativos, ${inactiveClients} inativos)`)
  console.log(`  Planos: ${totalPlans}`)
  console.log(`  Pagamentos: ${totalPayments}`)
  console.log(`  Onboardings: ${totalOnboardings}`)
  console.log('══════════════════════════════════════════')
}

run().catch(console.error).finally(() => prisma.$disconnect())
