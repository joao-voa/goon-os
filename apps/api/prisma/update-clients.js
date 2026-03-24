require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Data from spreadsheet — all have contracts
const CLIENTS_DATA = [
  { responsible: 'Andressa Polese', company: 'Andressa Marchiori', cnpj: '', cpf: '055.821.267-08', rg: '1.445.638', nacionalidade: 'Brasileira', estadoCivil: 'Solteira', profissao: 'Empresária', email: 'andressa.polese@gmail.com', endereco: 'Rua Rachel Vitalino de Britto, nº 110, Bloco 15, apto 501', bairro: 'Hélio Ferraz', cidade: 'Serra', estado: 'ES', cep: '29160-596', programa: 'GI', pagamento: 'PIX, boleto ou cartão de crédito', objeto: 'Mentoria GOON INFINITY' },
  { responsible: 'Bruna Auad Proença', company: 'Haya Shoes', cnpj: '37.655.752/0001-09', cpf: '368.636.698-00', rg: '43.708.250-7', nacionalidade: 'Brasileira', estadoCivil: 'Solteira', profissao: 'Administradora', email: 'brunaauad@gmail.com', endereco: 'Rua Oscar Freire, nº 715, Apto 73', bairro: '', cidade: 'São Paulo', estado: 'SP', cep: '', programa: 'GI', pagamento: 'PIX, boleto ou cartão de crédito', objeto: 'Mentoria GOON INFINITY' },
  { responsible: 'Everton Luis Schimure', company: 'MataNativa', cnpj: '53.255.847/0001-83', cpf: '009.553.739-21', rg: '8.564.896-9', nacionalidade: 'brasileiro', estadoCivil: 'casado', profissao: 'empresário', email: 'usematanativa@gmail.com', endereco: 'Rua Antonio Vieira dos Santos, nº 210', bairro: '', cidade: 'Morretes', estado: 'PR', cep: '83350-000', programa: 'GI', pagamento: 'Entrada de R$ 2.000,00 + 5x R$ 2.000,00 no boleto bancário', objeto: 'Mentoria GOON INFINITY' },
  { responsible: 'Felipe Rodrigues Pessoa', company: 'Ice Company', cnpj: '', cpf: '499.264.098-22', rg: '34.534.774-5', nacionalidade: 'brasileiro', estadoCivil: 'solteiro', profissao: 'empresário', email: 'iceco.store@gmail.com', endereco: 'Avenida Capitão Francisco Inácio, nº 127', bairro: '', cidade: '', estado: '', cep: '', programa: 'GI', pagamento: 'Entrada de R$ 500,00 + 11x R$ 500,00 em boleto/PIX', objeto: 'Mentoria GOON INFINITY' },
  { responsible: 'Fernanda Dall Mass Bernardi', company: 'Moss Home', cnpj: '41.968.654/0001-90', cpf: '827.246.010-68', rg: '', nacionalidade: '', estadoCivil: '', profissao: '', email: '', endereco: 'Rua Augusto Stelfeld, nº 1641, Sala 1', bairro: 'Batel', cidade: 'Curitiba', estado: 'PR', cep: '80730-150', programa: 'GE', pagamento: 'Entrada de R$ 5.000,00 + 10x R$ 1.000,00', objeto: 'Mentoria personalizada Método GOON' },
  { responsible: 'Flávia Thomaz Soccol', company: 'Soccol', cnpj: '34.650.445/0001-39', cpf: '064.123.709-00', rg: '9.923.213-7', nacionalidade: 'Brasileira', estadoCivil: 'Casada', profissao: 'Advogada', email: 'soccolflavia@gmail.com', endereco: 'Rua Pedro Demeterco, nº 1020', bairro: '', cidade: '', estado: '', cep: '81530-320', programa: 'GI', pagamento: 'PIX à vista R$ 20.000,00', objeto: 'Mentoria GOON INFINITY' },
  { responsible: 'Francisco Marcondes Sousa Pires', company: 'Cauant Jeans', cnpj: '28.481.288/0001-82', cpf: '061.451.533-50', rg: '20.080.091-3', nacionalidade: 'brasileiro', estadoCivil: 'casado', profissao: 'empresário', email: 'marcondescaunt@gmail.com', endereco: 'Rua Campos Filho, nº 601', bairro: '', cidade: '', estado: '', cep: '', programa: 'GE', pagamento: '1 entrada R$5.000 + 5x R$5.000', objeto: 'Mentoria Método GOON' },
  { responsible: 'Geicieli Pinheiro da Costa', company: 'Imersiva', cnpj: '56.729.179/0001-77', cpf: '040.051.131-25', rg: '20993099', nacionalidade: 'brasileira', estadoCivil: 'casada', profissao: 'empresária', email: 'imersivaloja@gmail.com', endereco: 'Av. Tancredo Neves, nº 1734', bairro: '', cidade: 'Cuiabá', estado: 'MT', cep: '78065-769', programa: 'GI', pagamento: 'Entrada R$ 1.000 + 11x R$ 1.000 boleto', objeto: 'Mentoria GOON INFINITY' },
  { responsible: 'Higor Evangelista Ribeiro', company: 'Lts Studio', cnpj: '28.008.783/0001-79', cpf: '343.223.848-70', rg: '528579939', nacionalidade: 'Brasileiro', estadoCivil: 'Solteiro', profissao: 'Empresário', email: 'higorevann@gmail.com', endereco: 'Rua Madre Paulina, nº 191, casa 2', bairro: '', cidade: 'São Paulo', estado: 'SP', cep: '05396-300', programa: 'GI', pagamento: 'Entrada R$ 5.000 + R$ 5.000 em boleto/PIX', objeto: 'Mentoria GOON INFINITY' },
  { responsible: 'Jonatan Guerra Holanda', company: 'Presence Jeans', cnpj: '43.551.566/0001-14', cpf: '467.060.138-54', rg: '39.309.807-2', nacionalidade: 'brasileiro', estadoCivil: 'solteiro', profissao: 'empresário', email: 'jonatan.ghs@gmail.com', endereco: '', bairro: '', cidade: 'São Paulo', estado: 'SP', cep: '03027-000', programa: 'GI', pagamento: 'Entrada R$ 1.000 + 11x R$ 1.000 boleto', objeto: 'Mentoria GOON INFINITY' },
  { responsible: 'Juliana Miranda Brigido Cardoso', company: 'SohoBeach', cnpj: '28.409.429/0001-56', cpf: '118.041.317-25', rg: '25.702.371-3', nacionalidade: 'Brasileira', estadoCivil: 'Solteira', profissao: 'Empresária', email: 'julianambcardoso@gmail.com', endereco: 'Avenida Lúcio Costa, nº 9500, cobertura 617', bairro: '', cidade: 'Rio de Janeiro', estado: 'RJ', cep: '22795-006', programa: 'GI', pagamento: 'Entrada R$ 2.000 + 5x R$ 5.000 boleto', objeto: 'Mentoria GOON INFINITY' },
  { responsible: 'Legri Filho Queiroz Assunção', company: 'Dabeg', cnpj: '48.853.304/0001-28', cpf: '700.611.002-70', rg: '5.574.818', nacionalidade: 'brasileiro', estadoCivil: 'solteiro', profissao: 'empresário', email: 'legriassuncao@hotmail.com', endereco: 'Praça Godofredo Leopoldino Azevedo, nº 31, Ed. Talismã, apto 202', bairro: '', cidade: 'Goiânia', estado: 'GO', cep: '74535-540', programa: 'GI', pagamento: 'Entrada R$ 1.000 + 11x R$ 1.000 boleto', objeto: 'Mentoria GOON INFINITY' },
  { responsible: 'Luís Henrique Gianesini', company: 'IZ Confecções', cnpj: '54.918.566/0001-26', cpf: '097.368.799-17', rg: '', nacionalidade: 'Brasileiro', estadoCivil: 'Solteiro', profissao: 'Designer', email: 'confeccoesizfitness@gmail.com', endereco: 'Travessa Lagoa Dourada, nº 571', bairro: '', cidade: '', estado: '', cep: '88359-040', programa: 'GE', pagamento: 'Entrada R$ 10.000 + 5x R$ 10.000 boleto dia 20', objeto: 'Mentoria GOON ELITE' },
  { responsible: 'Luiza Michelletti Pereira de Araujo', company: 'LM Fashion Lab', cnpj: '54.172.817/0001-76', cpf: '409.800.438-08', rg: '539476201', nacionalidade: 'brasileira', estadoCivil: 'solteira', profissao: 'empresária', email: 'luuiizamp@gmail.com', endereco: 'Rua Continental, nº 647', bairro: '', cidade: 'São Paulo', estado: 'SP', cep: '09726-410', programa: 'GI', pagamento: 'Entrada R$ 2.000 + 5x R$ 2.000 boleto/PIX', objeto: 'Mentoria GOON INFINITY' },
  { responsible: 'Moacir W. Ferreira', company: 'Zapone Camisaria', cnpj: '43.487.021/0001-96', cpf: '247.144.428-80', rg: '29.075.956-0', nacionalidade: 'Brasileiro', estadoCivil: 'Casado', profissao: 'Empresário', email: 'chefia@usezapone.com.br', endereco: 'Rua Eliseu Guilherme, nº 255', bairro: '', cidade: 'Ribeirão Preto', estado: 'SP', cep: '14025-020', programa: 'GI', pagamento: 'Entrada R$ 2.000 + 5x R$ 2.000 boleto', objeto: 'Mentoria GOON INFINITY' },
  { responsible: 'Rafael Oliveira de Deus', company: 'Lakre Fitness', cnpj: '44.875.002/0001-08', cpf: '842.494.715-00', rg: '0971486107', nacionalidade: 'brasileiro', estadoCivil: 'casado', profissao: 'arquiteto', email: 'contatolakre@gmail.com', endereco: 'Avenida Sossego, nº 950, Cond. América Houses, Casa 115', bairro: 'Registro', cidade: 'Feira de Santana', estado: 'BA', cep: '44073-450', programa: 'GI', pagamento: 'Entrada R$ 1.000 + 11x R$ 1.000 boleto/PIX', objeto: 'Mentoria GOON INFINITY' },
  { responsible: 'Tayomara Gomes', company: 'Tay Confecções', cnpj: '38.142.526/0001-89', cpf: '052.807.009-67', rg: '7.993.229-9', nacionalidade: 'brasileira', estadoCivil: 'divorciada', profissao: 'empresária', email: 'contato@taygomes.com.br', endereco: 'Rua Irmãs Paulinas, nº 5445', bairro: '', cidade: 'Curitiba', estado: 'PR', cep: '81020-230', programa: 'GI', pagamento: 'Entrada R$ 2.000 em 23/01/2026 + 5x R$ 2.000 boleto/PIX', objeto: 'Mentoria GOON INFINITY' },
  { responsible: 'Thaiz Ferraz', company: 'INÓBVIA', cnpj: '', cpf: '370.446.368-02', rg: '43.530.229-2', nacionalidade: 'Brasileira', estadoCivil: 'Solteira', profissao: 'Empresária', email: 'thaisingridferraz@gmail.com', endereco: 'Rua Moravia número 402', bairro: 'Vila de São Fernando', cidade: 'Cotia', estado: 'SP', cep: '06705-570', programa: 'GE', pagamento: '1 entrada R$5.000 + 3x R$1.000 + 3x com aumento gradativo', objeto: 'Mentoria Método GOON' },
  { responsible: 'Thiago Cesário Oliveira', company: 'SannaDecor', cnpj: '40.104.008/0001-12', cpf: '134.064.476-27', rg: 'MG-18.065.663', nacionalidade: 'Brasileiro', estadoCivil: 'Casado', profissao: 'Empresário', email: 'thiagocopycesario@gmail.com', endereco: 'Rua Oséias Maranhão, nº 603, apto 202', bairro: 'Oséias Maranhão', cidade: 'Juiz de Fora', estado: 'MG', cep: '36506-138', programa: 'GE', pagamento: '1 entrada R$ 5.000 + 15x R$ 2.000', objeto: 'Mentoria Método GOON', dataInicio: '2025-11-06' },
  { responsible: 'Bruna', company: 'Brukki', cnpj: '45.188.428/0001-48', cpf: '', rg: '', nacionalidade: '', estadoCivil: '', profissao: '', email: '', endereco: 'Rua Alexandrino Pedroso, nº 247, Loja 11', bairro: 'Brás', cidade: 'São Paulo', estado: 'SP', cep: '03031-900', programa: 'GE', pagamento: 'R$ 5.000 entrada + 6x R$ 5.000', objeto: 'Mentoria Método GOON ELITE' },
]

async function run() {
  console.log('══════════════════════════════════════════')
  console.log('  ATUALIZAÇÃO DE DADOS DOS CLIENTES')
  console.log('══════════════════════════════════════════\n')

  let updated = 0, created = 0, notFound = 0

  for (const c of CLIENTS_DATA) {
    // Try to find existing client by company name (fuzzy match)
    const companyLower = c.company.toLowerCase()
    const allClients = await prisma.client.findMany()
    let existing = allClients.find(cl =>
      cl.companyName.toLowerCase() === companyLower ||
      cl.companyName.toLowerCase().includes(companyLower) ||
      companyLower.includes(cl.companyName.toLowerCase())
    )

    // Also try by responsible name
    if (!existing) {
      const firstName = c.responsible.split(' ')[0].toLowerCase()
      existing = allClients.find(cl =>
        cl.responsible.toLowerCase().startsWith(firstName)
      )
    }

    const updateData = {
      responsible: c.responsible || undefined,
      cnpj: c.cnpj || undefined,
      email: c.email || undefined,
      address: c.endereco || undefined,
      neighborhood: c.bairro || undefined,
      city: c.cidade || undefined,
      state: c.estado || undefined,
      zipCode: c.cep || undefined,
      // Store contract-specific data in strategic fields temporarily
      mainPains: [
        c.cpf ? `CPF: ${c.cpf}` : null,
        c.rg ? `RG: ${c.rg}` : null,
        c.nacionalidade ? `Nacionalidade: ${c.nacionalidade}` : null,
        c.estadoCivil ? `Estado Civil: ${c.estadoCivil}` : null,
        c.profissao ? `Profissão: ${c.profissao}` : null,
        c.pagamento ? `Pagamento: ${c.pagamento}` : null,
        c.objeto ? `Objeto: ${c.objeto}` : null,
      ].filter(Boolean).join('\n'),
    }

    // Remove undefined fields
    Object.keys(updateData).forEach(k => {
      if (updateData[k] === undefined) delete updateData[k]
    })

    if (existing) {
      await prisma.client.update({
        where: { id: existing.id },
        data: updateData,
      })

      // Mark contract as signed
      const contracts = await prisma.contract.findMany({ where: { clientId: existing.id } })
      for (const contract of contracts) {
        if (!contract.isSigned) {
          await prisma.contract.update({
            where: { id: contract.id },
            data: { isSigned: true, signatureDate: new Date(), status: 'SIGNED' },
          })
        }
      }

      console.log(`  ✓ ATUALIZADO: ${existing.companyName} ← ${c.responsible}`)
      updated++
    } else {
      // Create new client
      const products = await prisma.product.findMany()
      const pMap = {}
      products.forEach(p => { pMap[p.code] = p.id })

      const productCode = c.programa.toUpperCase().includes('ELITE') ? 'GE' :
                          c.programa.toUpperCase().includes('SCALE') ? 'GS' : 'GI'

      const client = await prisma.client.create({
        data: {
          companyName: c.company,
          ...updateData,
          status: 'ACTIVE',
          segment: 'Moda',
        },
      })

      // Create plan
      if (pMap[productCode]) {
        await prisma.clientPlan.create({
          data: {
            clientId: client.id,
            productId: pMap[productCode],
            value: 12000,
            paymentType: 'INSTALLMENT',
            installments: 12,
            installmentValue: 1000,
            cycleDuration: 6,
            startDate: c.dataInicio ? new Date(c.dataInicio) : new Date('2025-06-01'),
            endDate: new Date('2026-06-01'),
            paymentDay: 10,
            status: 'ACTIVE',
            notes: c.pagamento,
          },
        })

        await prisma.onboarding.create({
          data: {
            clientId: client.id,
            currentStage: 'ONBOARDING_DONE',
            notes: 'Contrato assinado',
          },
        })
      }

      await prisma.activityLog.create({
        data: {
          clientId: client.id,
          entityType: 'CLIENT',
          entityId: client.id,
          action: 'CREATED',
          description: `${c.company} — dados contratuais importados`,
        },
      })

      console.log(`  + CRIADO: ${c.company} — ${c.responsible}`)
      created++
    }
  }

  console.log('\n══════════════════════════════════════════')
  console.log(`  RESULTADO: ${updated} atualizados, ${created} criados`)
  console.log('══════════════════════════════════════════')
}

run().catch(console.error).finally(() => prisma.$disconnect())
