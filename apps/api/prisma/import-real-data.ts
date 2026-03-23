import * as dotenv from 'dotenv'
dotenv.config()
import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import { join } from 'path'

const prisma = new PrismaClient()

// ============================================================
// IMPORT SCRIPT — Real data from GOON spreadsheets
// ============================================================

// Financial data from "Projeção de recebíveis 2526" sheet
// Format: [day, cycle, product, name, jun, jul, aug, sep, oct, nov, contract_dates, status, notes, dec, jan, feb, mar, apr, may, jun2, jul2, aug2, sep2, oct2, nov2, dec2]
const FINANCIAL_DATA: {
  name: string
  product: string
  cycle: string
  status: string
  notes: string
  monthlyValue: number | null
  totalValue: number | null
  paymentDay: number | null
}[] = [
  { name: 'Tiago - Todo Santo Dia', product: 'GI', cycle: 'ciclo 1', status: 'CANCELADO', notes: 'Cobrar multa', monthlyValue: 2000, totalValue: 12000, paymentDay: 1 },
  { name: 'Andressa Marchiori', product: 'GI', cycle: 'ciclo 1', status: 'RENOVAR', notes: '', monthlyValue: 12000, totalValue: 12000, paymentDay: 5 },
  { name: 'Camila - A Firma', product: 'GI', cycle: 'ciclo 1', status: 'VERIFICAR', notes: 'Preciso dos dados', monthlyValue: 500, totalValue: 12000, paymentDay: 5 },
  { name: 'Joel - Skylife Jeans', product: 'GI', cycle: 'renovar infinity', status: 'CANCELADO', notes: 'Proposta de renovação', monthlyValue: 2500, totalValue: null, paymentDay: 4 },
  { name: 'Dayane - Dayane Calçados', product: 'GE', cycle: 'renovar infinity', status: 'RENOVAR', notes: 'Proposta de renovação GI', monthlyValue: 5000, totalValue: 30000, paymentDay: 4 },
  { name: 'Julia - The Salt Side', product: 'GI', cycle: 'renovar infinity', status: 'CANCELADO', notes: 'Cobrar multa', monthlyValue: 1000, totalValue: 12000, paymentDay: 5 },
  { name: 'Marcos Pio - Eden Brandt', product: 'GI', cycle: 'ciclo 1', status: 'VERIFICAR', notes: 'Boleto lançado', monthlyValue: 500, totalValue: 12000, paymentDay: 8 },
  { name: 'Bruna e Mari - Haya Shoes', product: 'GI', cycle: 'ciclo 1', status: 'VERIFICAR + RENOVAÇÃO', notes: 'Preciso dos dados', monthlyValue: 1500, totalValue: 12000, paymentDay: 9 },
  { name: 'Thomaz Cirone - Santavest', product: 'GE', cycle: 'ciclo 1', status: 'VERIFICAR + RENOVAÇÃO', notes: 'Conferir mês março', monthlyValue: 4166, totalValue: 29996, paymentDay: 10 },
  { name: 'Joice - AMMU', product: 'GI', cycle: 'ciclo 1', status: 'CANCELADO', notes: 'Cobrar multa', monthlyValue: 2000, totalValue: 12000, paymentDay: 10 },
  { name: 'Juliana - Caffona', product: 'GE', cycle: 'ciclo 1', status: 'VERIFICAR', notes: 'Preciso dos dados. Condições especiais.', monthlyValue: 1000, totalValue: 35000, paymentDay: 10 },
  { name: 'Rafael e Malu - Lakre Fitness', product: 'GE', cycle: 'ciclo 1', status: 'VERIFICAR', notes: 'Preciso dos dados', monthlyValue: 1000, totalValue: 12000, paymentDay: 10 },
  { name: 'Thiago - SannaDecor', product: 'GE', cycle: 'ciclo 1', status: 'VERIFICAR', notes: 'Boleto lançado', monthlyValue: 2000, totalValue: 30000, paymentDay: 10 },
  { name: 'Allan e Armani - Vangolden', product: 'GE', cycle: 'renovado GE', status: 'RENEGOCIAR', notes: 'Renovação', monthlyValue: 5000, totalValue: null, paymentDay: 10 },
  { name: 'Leonardo - Tee Fashion', product: 'GE', cycle: 'renovar GE', status: 'ENVIAR CONTRATO', notes: 'João cadastrar', monthlyValue: 3200, totalValue: 19200, paymentDay: 10 },
  { name: 'Hector Leonardo - Warmyt Co.', product: 'GS', cycle: 'ciclo 1', status: 'CONGELADO', notes: 'Renegociar produto menor', monthlyValue: 2500, totalValue: 30000, paymentDay: 11 },
  { name: 'Michel - Use Wuste', product: 'GI', cycle: 'ciclo 1', status: 'CANCELADO', notes: 'Remover - contatar futuro', monthlyValue: 2300, totalValue: 12000, paymentDay: 11 },
  { name: 'Viviane - Be Queen', product: 'GI', cycle: 'ciclo 1', status: 'VERIFICAR + RENOVAÇÃO', notes: 'Preciso dos dados', monthlyValue: 800, totalValue: 12000, paymentDay: 12 },
  { name: 'Ihally - Bem Querida', product: 'GE', cycle: 'ciclo 1', status: 'RENEGOCIAR', notes: 'Renovação produto menor', monthlyValue: 5000, totalValue: 30000, paymentDay: 15 },
  { name: 'Juliana - SohoBeach', product: 'GI', cycle: 'ciclo 1', status: 'PAGO', notes: 'Pago 100% à vista + renovação', monthlyValue: 2000, totalValue: 12000, paymentDay: 15 },
  { name: 'Marcondes - Cauant Jeans', product: 'GE', cycle: 'ciclo 1', status: 'CANCELADO', notes: 'Cobrar multa', monthlyValue: 5000, totalValue: 35000, paymentDay: 15 },
  { name: 'Nicolas e Talita - DelizandaBrand', product: 'GE', cycle: 'ciclo 1', status: 'VERIFICAR + RENOVAÇÃO', notes: '', monthlyValue: 2000, totalValue: 30000, paymentDay: 16 },
  { name: 'Luiza e Murilo - LM Fashion Lab', product: 'GI', cycle: 'ciclo 1', status: 'VERIFICAR + RENOVAÇÃO', notes: '', monthlyValue: 2000, totalValue: 12000, paymentDay: 16 },
  { name: 'Higor Evangelista - Lts Studio', product: 'GI', cycle: 'ciclo 1', status: 'PAGO', notes: 'Pago 100% à vista - verificar renovação', monthlyValue: 5000, totalValue: 10000, paymentDay: 18 },
  { name: 'Guilherme e Camila - Valentiere', product: 'GI', cycle: 'ciclo 1', status: 'VERIFICAR + RENOVAÇÃO', notes: '', monthlyValue: 2000, totalValue: null, paymentDay: 20 },
  { name: 'Geici - Imersiva', product: 'GI', cycle: 'ciclo 1', status: 'VERIFICAR + RENOVAÇÃO', notes: '', monthlyValue: 1000, totalValue: 12000, paymentDay: 20 },
  { name: 'Victor - Bosy Coys', product: 'GI', cycle: 'ciclo 1', status: 'CANCELADO', notes: 'Remover - contatar futuro', monthlyValue: null, totalValue: null, paymentDay: 20 },
  { name: 'Pedro Kan House', product: 'GE', cycle: 'renovado GE', status: 'PAGO', notes: 'Pago à vista + renovação', monthlyValue: 10000, totalValue: 30000, paymentDay: 20 },
  { name: 'Ronaldo - Shui', product: 'GE', cycle: 'renovado GE', status: 'VERIFICAR', notes: 'Verificar boleto abril + renovação', monthlyValue: 5000, totalValue: 30000, paymentDay: 20 },
  { name: 'Fernanda - Moss Home', product: 'GE', cycle: 'renovado GE', status: 'VERIFICAR + RENOVAÇÃO', notes: 'Boletos lançados. Renovou dez: entrada 5k + 10x 1k', monthlyValue: 1000, totalValue: 12000, paymentDay: 20 },
  { name: 'Luis e Iza - IZ Confecções', product: 'GI', cycle: 'ciclo 1', status: 'VERIFICAR', notes: 'Levantar dores', monthlyValue: 10000, totalValue: 60000, paymentDay: 20 },
  { name: 'Taina - Antonita', product: 'GI', cycle: 'ciclo 1', status: 'VERIFICAR', notes: 'Boletos lançados', monthlyValue: 1000, totalValue: 12000, paymentDay: 20 },
  { name: 'Johnny - Kilombo93', product: 'GI', cycle: 'ciclo 1', status: 'VERIFICAR', notes: 'Boletos lançados', monthlyValue: 500, totalValue: 12000, paymentDay: 20 },
  { name: 'Legri - Dabeg', product: 'GI', cycle: 'ciclo 1', status: 'VERIFICAR CONTRATO', notes: 'Lançado boletos', monthlyValue: 1000, totalValue: 12000, paymentDay: 20 },
  { name: 'Everton - MataNativa', product: 'GI', cycle: 'ciclo 1', status: 'VERIFICAR', notes: 'Preciso dos dados', monthlyValue: 1000, totalValue: 12000, paymentDay: 20 },
  { name: 'Carla Milani - OMNE', product: 'GE', cycle: 'renovado GE', status: 'VERIFICAR', notes: 'Boletos lançados', monthlyValue: 5000, totalValue: 30000, paymentDay: 20 },
  { name: 'Tay Gomes - Tay Confecções', product: 'GI', cycle: 'ciclo 1', status: 'PERMUTA', notes: 'Modelo de permuta - conteúdo', monthlyValue: 2000, totalValue: 12000, paymentDay: 23 },
  { name: 'Andressa Grégio - Use Rhino', product: 'GI', cycle: 'ciclo 1', status: 'REMOVER BOLETOS', notes: 'Renovação produto menor', monthlyValue: 1150, totalValue: 12000, paymentDay: 25 },
  { name: 'Diego - TrezeCore', product: 'GE', cycle: 'renovado GE', status: 'VERIFICAR', notes: 'Verificar boleto abril + renovação', monthlyValue: 5000, totalValue: 35000, paymentDay: 25 },
  { name: 'Denis - Pangeia', product: 'GE', cycle: 'renovar GE', status: 'VERIFICAR CONTRATO', notes: 'Manter como parceiro - modelar', monthlyValue: 5000, totalValue: 32000, paymentDay: 28 },
  { name: 'Thaiz Ferraz - INÓBVIA', product: 'GE', cycle: 'ciclo 1', status: 'VERIFICAR', notes: 'Preciso dos dados. 3 primeiras parcelas 1k depois 2076', monthlyValue: 2076, totalValue: 35000, paymentDay: 28 },
  { name: 'Felipe Pessoa - Ice Company', product: 'GI', cycle: 'ciclo 1', status: 'VERIFICAR', notes: 'Preciso dos dados', monthlyValue: 500, totalValue: 12000, paymentDay: 30 },
  { name: 'Flávia - Soccol', product: 'GI', cycle: 'ciclo 1', status: 'VALIDAR CONTRATO', notes: '', monthlyValue: 20000, totalValue: null, paymentDay: 30 },
  { name: 'Marina e Larissa - Revival', product: 'GE', cycle: 'renovar GE', status: 'RENEGOCIAR', notes: 'Renovação produto menor', monthlyValue: 2500, totalValue: 25000, paymentDay: 30 },
  { name: 'Vitor MagnumWear', product: 'GI', cycle: 'ciclo 1', status: 'CANCELADO', notes: 'Remover dos recebíveis', monthlyValue: 1500, totalValue: 12000, paymentDay: 30 },
]

// Map company names from Integrantes to financial data names
const NAME_MAP: Record<string, string> = {
  'Useinverso': 'Filipe - Use inverso',
  'The Salt Side': 'Julia - The Salt Side',
  'Brunx': '',
  'Maso Artwear': 'Mauricio - Maso artwear',
  'Brukki': 'Bruna - Brukki',
  'Colzani': '',
  'Moss Home': 'Fernanda - Moss Home',
  'Contry Shop': 'João Coutry Shop',
  'Citrine': 'Aureliano - Citrine',
  'Dmuniz': '',
  'Pangeia': 'Denis - Pangeia',
  'Tee Fashion': 'Leonardo - Tee Fashion',
  'Revival': 'Marina e Larissa - Revival',
  'Benit': '',
  'TrezeCore': 'Diego - TrezeCore',
  'OLS': 'Dri /Poly - OLS',
  'Vangolden': 'Allan e Armani - Vangolden',
  'Dayane Calçados': 'Dayane - Dayane Calçados',
  'Bem Querida': 'Ihally - Bem Querida',
  'Heiko': 'Matheus e Felipe - Heiko',
  'Salto Triplo': 'Jessica e Ticiano - Salto Triplo',
  'Teaser': '',
  'Kan': 'Pedro Kan House',
  'Fashion Closet': 'Caio - Fashion Closet',
  'Galeria Josenias Freire': 'Janyce - Galeria Josenias',
  'Audaz': 'Henderson - Audaz',
  'Farco': '',
  'Shui': 'Ronaldo - Shui',
  'Aramodu': '',
  'Menegotti': '',
  'Kekau Contry': '',
  'Levick': '',
  'Tualma': '',
  'Salma': '',
}

// ============================================================

async function main() {
  console.log('🚀 Starting real data import...\n')

  // Read integrantes spreadsheet
  const wb = XLSX.readFile('C:/Users/joao.vitor/Downloads/GOON/Goon Mentor Ship Integrantes.xlsx')
  const ws = wb.Sheets[wb.SheetNames[0]]
  const integrantes = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[]

  // Get products
  const products = await prisma.product.findMany()
  const productMap = Object.fromEntries(products.map(p => [p.code, p.id]))

  let created = 0
  let skipped = 0

  for (const row of integrantes) {
    const companyName = (row.Empresa || '').trim()
    const responsible = (row.Mentorado || '').trim()
    if (!companyName || !responsible) { skipped++; continue }

    // Check if already exists
    const existing = await prisma.client.findFirst({ where: { companyName } })
    if (existing) {
      console.log(`  ⏭  ${companyName} — já existe`)
      skipped++
      continue
    }

    // Find financial data
    const financialKey = NAME_MAP[companyName]
    const financial = financialKey
      ? FINANCIAL_DATA.find(f => f.name.includes(financialKey.split(' - ')[0]) || financialKey.includes(f.name.split(' - ')[0]))
      : FINANCIAL_DATA.find(f => {
          const parts = responsible.split('/')[0].trim().toLowerCase()
          return f.name.toLowerCase().includes(parts) || f.name.toLowerCase().includes(companyName.toLowerCase())
        })

    // Determine status
    let status = 'ACTIVE'
    if (financial) {
      if (financial.status.includes('CANCELADO')) status = 'INACTIVE'
      else if (financial.status.includes('CONGELADO')) status = 'INACTIVE'
      else if (financial.status.includes('REMOVER')) status = 'INACTIVE'
    }

    // Determine product
    let productCode = financial?.product?.toUpperCase() || null
    if (productCode === 'G1') productCode = 'GI'
    if (productCode === 'GJ') productCode = 'GE'

    // Clean phone
    const phone = (row.Telefone || '').split('\n')[0].trim()
    const email = (row.Email || '').split('\n')[0].trim() || null

    // Create client
    const client = await prisma.client.create({
      data: {
        companyName,
        responsible,
        phone: phone || null,
        email,
        whatsapp: phone || null,
        segment: (row.Nicho || '').trim() || null,
        status,
        // Website and Instagram in strategic fields for now
        strategicGoals: [
          row.Site ? `Site: ${row.Site}` : null,
          row['IG Marca'] ? `IG Marca: ${row['IG Marca']}` : null,
          row['IG Mentorado'] ? `IG Pessoal: ${row['IG Mentorado']}` : null,
        ].filter(Boolean).join('\n') || null,
        mainPains: (row['Tipo '] || '').trim() || null,
      },
    })

    // Create plan if we have financial data
    if (financial && productCode && productMap[productCode]) {
      const value = financial.totalValue || (financial.monthlyValue ? financial.monthlyValue * 12 : 12000)
      const installments = financial.monthlyValue && financial.totalValue
        ? Math.round(financial.totalValue / financial.monthlyValue)
        : 12

      const plan = await prisma.clientPlan.create({
        data: {
          clientId: client.id,
          productId: productMap[productCode],
          value,
          paymentType: installments <= 1 ? 'CASH' : 'INSTALLMENT',
          installments,
          installmentValue: financial.monthlyValue || value,
          cycleDuration: installments,
          startDate: new Date('2025-06-01'),
          endDate: new Date('2026-06-01'),
          paymentDay: financial.paymentDay || 10,
          status: status === 'INACTIVE' ? 'CANCELLED' : 'ACTIVE',
          notes: [financial.cycle, financial.notes].filter(Boolean).join(' — '),
        },
      })

      // Create onboarding
      let onboardingStage = 'ONBOARDING_DONE'
      if (financial.status.includes('ENVIAR CONTRATO')) onboardingStage = 'CONTRACT_DRAFTED'
      else if (financial.status.includes('VALIDAR CONTRATO') || financial.status.includes('VERIFICAR CONTRATO')) onboardingStage = 'CONTRACT_SENT'
      else if (financial.status.includes('CANCELADO') || financial.status.includes('REMOVER')) onboardingStage = 'ONBOARDING_DONE'
      else if (financial.status.includes('VERIFICAR')) onboardingStage = 'BILLING_CREATED'
      else if (financial.status.includes('RENOVAR') || financial.status.includes('RENEGOCIAR')) onboardingStage = 'ONBOARDING_DONE'

      await prisma.onboarding.create({
        data: {
          clientId: client.id,
          currentStage: onboardingStage,
          notes: financial.status,
        },
      })

      // Log activity
      await prisma.activityLog.create({
        data: {
          clientId: client.id,
          entityType: 'CLIENT',
          entityId: client.id,
          action: 'CREATED',
          description: `Cliente ${companyName} importado — ${productCode} ${financial.cycle} — ${financial.status}`,
        },
      })

      console.log(`  ✅ ${companyName} — ${productCode} — ${status} — R$ ${value}`)
    } else {
      console.log(`  ✅ ${companyName} — sem dados financeiros — ${status}`)

      // Log activity
      await prisma.activityLog.create({
        data: {
          clientId: client.id,
          entityType: 'CLIENT',
          entityId: client.id,
          action: 'CREATED',
          description: `Cliente ${companyName} importado (sem dados financeiros)`,
        },
      })
    }

    created++
  }

  console.log(`\n📊 Resultado: ${created} clientes criados, ${skipped} pulados`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
