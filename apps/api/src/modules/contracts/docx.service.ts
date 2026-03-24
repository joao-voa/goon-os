import { Injectable } from '@nestjs/common'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  UnderlineType,
} from 'docx'

export interface ContractFields {
  // Client data
  nome: string
  nacionalidade: string
  profissao: string
  estadoCivil: string
  cpf: string
  rg: string
  endereco: string
  enderecoNumero: string
  cep: string
  cidade: string
  estado: string
  email: string
  empresa: string
  cnpj: string

  // Financial
  valorTotal: string
  valorExtenso: string
  formaPagamento: string

  // Contract
  programa: string
  duracaoMeses: string
  dataContrato: string
}

// ---- Helpers ----
function bold(text: string): TextRun {
  return new TextRun({ text, bold: true })
}

function normal(text: string): TextRun {
  return new TextRun({ text })
}

function para(children: TextRun[], alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.JUSTIFIED): Paragraph {
  return new Paragraph({
    children,
    alignment,
    spacing: { after: 120, line: 280 },
  })
}

function clauseHeader(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), bold: true })],
    heading: HeadingLevel.HEADING_3,
    alignment: AlignmentType.LEFT,
    spacing: { before: 240, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '1a1a1a' },
    },
  })
}

function bulletPara(text: string, isBullet = false): Paragraph {
  return new Paragraph({
    children: [normal(isBullet ? `• ${text}` : text)],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 80, line: 280 },
    indent: { left: isBullet ? 360 : 0 },
  })
}

function spacer(): Paragraph {
  return new Paragraph({ children: [], spacing: { after: 120 } })
}

function sectionTitle(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 24 })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 360, after: 240 },
  })
}

function sigLine(name: string, role: string, cpfOrCnpj = ''): Paragraph[] {
  return [
    new Paragraph({
      children: [normal('_______________________________________________')],
      alignment: AlignmentType.CENTER,
      spacing: { before: 480, after: 60 },
    }),
    new Paragraph({
      children: [bold(name)],
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [normal(role)],
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
    }),
    ...(cpfOrCnpj
      ? [
          new Paragraph({
            children: [normal(cpfOrCnpj)],
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
          }),
        ]
      : []),
  ]
}

// ---- Common header / parties block ----
function buildHeaderParagraphs(f: ContractFields, programa: string): Paragraph[] {
  const programaLabel = programa === 'GOON INFINITY' ? 'GOON INFINITY' : 'GOON ELITE'
  const accentColor = programa === 'GOON INFINITY' ? '000080' : '6C3FFF'

  return [
    // Title
    new Paragraph({
      children: [
        new TextRun({
          text: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE MENTORIA',
          bold: true,
          size: 28,
          color: '1a1a1a',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `PROGRAMA ${programaLabel}`,
          bold: true,
          size: 22,
          color: accentColor,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Instrumento Particular', italics: true, size: 20 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
    }),
    // CONTRATANTE paragraph
    para([
      bold('CONTRATANTE: '),
      normal(`${f.nome}, ${f.nacionalidade}, ${f.profissao}, ${f.estadoCivil}, portador(a) do CPF nº ${f.cpf} e do RG nº ${f.rg}, residente na ${f.endereco}, nº ${f.enderecoNumero}, CEP ${f.cep}, na cidade de ${f.cidade} – ${f.estado}, e-mail ${f.email}, doravante denominado(a) simplesmente "CONTRATANTE", titular da empresa ${f.empresa}, inscrita no CNPJ nº ${f.cnpj}.`),
    ]),
    spacer(),
    para([
      bold('CONTRATADA: '),
      normal(
        'AURA SERVICOS DE MARKETING LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 63.509.354/0001-86, com sede na cidade de São Paulo-SP, Estado de São Paulo, na Rua Alberto de Oliveira, 79, bairro Bela Vista, CEP: 01333-040, telefone: (11) 94388-7147, neste ato representada nos termos de seu contrato social, e-mail: agencyaura360@gmail.com, doravante denominada "AURA 360".',
      ),
    ]),
    spacer(),
    para([normal('E, ainda, como parte integrante da presente relação:')]),
    spacer(),
    para([
      bold('MENTOR: '),
      normal(
        'GIULLIANO PUGA DA CRUZ, brasileiro, solteiro, empresário, portador da identidade 4252101 e inscrito no CPF(MF) 047.611.729-16, residente e domiciliado no Município de São Paulo-SP, bairro de Pinheiros, na Rua Teodoro Sampaio, 632, Ap. 11, CEP: 05406-000 e e-mail: pugagiulliano@gmail.com, doravante denominado "MENTOR";',
      ),
    ]),
    spacer(),
  ]
}

// ---- CONSIDERAÇÕES INICIAIS (shared) ----
function buildConsideracoes(programaLabel: string, cidadeForo = 'São Paulo/SP'): Paragraph[] {
  return [
    new Paragraph({
      children: [bold('CONSIDERAÇÕES INICIAIS')],
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 160 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: '1a1a1a' },
      },
    }),
    para([
      normal(
        'As partes acima qualificadas, doravante denominadas simplesmente CONTRATANTE e CONTRATADA, têm entre si justo e contratado o presente instrumento particular de prestação de serviços de mentoria, que se regerá pelas cláusulas e condições seguintes.',
      ),
    ]),
    para([
      normal(
        'A CONTRATADA é empresa especializada em serviços de mentoria empresarial, marketing e consultoria estratégica, com expertise comprovada no desenvolvimento de negócios e capacitação de líderes empresariais.',
      ),
    ]),
    para([
      normal(
        `O CONTRATANTE reconhece a expertise da CONTRATADA e manifesta interesse em contratar os serviços de mentoria no escopo do programa ${programaLabel}, ciente de que o resultado final depende de sua dedicação, aplicação dos conteúdos e participação ativa nas atividades propostas.`,
      ),
    ]),
    para([
      normal(
        'As partes declaram que este contrato é celebrado de forma livre, voluntária e consciente, tendo plena ciência de todas as cláusulas e condições aqui estabelecidas, em conformidade com o Código Civil Brasileiro (Lei nº 10.406/2002) e demais legislações aplicáveis.',
      ),
    ]),
    para([
      normal(
        'A prestação de serviços objeto deste contrato consiste em mentoria empresarial e não configura relação de emprego, sociedade, parceria ou qualquer outro vínculo além do ora estabelecido.',
      ),
    ]),
    para([
      normal(
        `As partes elegem o foro da Comarca de ${cidadeForo} para dirimir quaisquer controvérsias decorrentes deste instrumento, renunciando expressamente a qualquer outro, por mais privilegiado que seja.`,
      ),
    ]),
  ]
}

// ---- Shared clauses ----
function clauseConfidentialidade(): Paragraph[] {
  return [
    clauseHeader('Cláusula 4 – Confidencialidade e Propriedade Intelectual'),
    para([
      normal(
        'Todo o conteúdo disponibilizado no programa, incluindo mas não se limitando a videoaulas, materiais didáticos, ferramentas, templates, metodologias e estratégias, são de propriedade exclusiva da CONTRATADA e protegidos pela Lei de Direitos Autorais (Lei nº 9.610/1998) e demais legislações de propriedade intelectual aplicáveis.',
      ),
    ]),
    para([
      bold('§ 1º '),
      normal(
        '— O CONTRATANTE recebe apenas licença de uso pessoal e não exclusiva dos conteúdos, pelo período de vigência deste contrato, sendo vedada qualquer forma de reprodução, distribuição ou exploração comercial.',
      ),
    ]),
    para([
      bold('§ 2º '),
      normal(
        '— As informações compartilhadas nos encontros ao vivo, sessões individuais e grupos de comunicação são de caráter confidencial, obrigando-se as partes a não divulgá-las a terceiros sem o consentimento mútuo, ressalvadas as hipóteses legais.',
      ),
    ]),
    para([
      bold('§ 3º '),
      normal('— A obrigação de confidencialidade perdura por 2 (dois) anos após o término deste contrato.'),
    ]),
  ]
}

function clauseDisposicoes(): Paragraph[] {
  return [
    clauseHeader('Cláusula 8 – Disposições Finais'),
    para([
      bold('Assinatura Digital: '),
      normal(
        'Este contrato poderá ser assinado digitalmente, tendo a assinatura eletrônica plena validade jurídica nos termos do Decreto nº 10.278/2020 e da ICP-Brasil.',
      ),
    ]),
    para([
      bold('Integridade: '),
      normal(
        'Este instrumento representa a totalidade do acordo entre as partes relativamente ao seu objeto, substituindo quaisquer negociações, propostas ou acordos anteriores, escritos ou verbais.',
      ),
    ]),
    para([
      bold('Alterações: '),
      normal(
        'Qualquer modificação a este contrato somente terá validade se realizada por escrito e assinada por ambas as partes.',
      ),
    ]),
    para([
      bold('Legislação Aplicável: '),
      normal(
        'Este contrato é regido pelas leis da República Federativa do Brasil, notadamente o Código Civil (Lei nº 10.406/2002) e o Código de Defesa do Consumidor (Lei nº 8.078/1990).',
      ),
    ]),
    para([
      bold('Foro: '),
      normal(
        'Para dirimir quaisquer controvérsias oriundas deste contrato, as partes elegem o foro da Comarca de São Paulo/SP, renunciando a qualquer outro, por mais privilegiado que seja.',
      ),
    ]),
    para([
      normal(
        'E por estarem assim justas e contratadas, as partes assinam o presente instrumento em 2 (duas) vias de igual teor e forma, na presença das testemunhas abaixo identificadas.',
      ),
    ]),
  ]
}

@Injectable()
export class DocxService {
  // ----------------------------------------------------------------
  // GOON INFINITY
  // ----------------------------------------------------------------
  async generateInfinity(f: ContractFields): Promise<Buffer> {
    const duracaoLabel =
      f.duracaoMeses === '1'
        ? '1 (um) mês'
        : `${f.duracaoMeses} (${this.numExtenso(f.duracaoMeses)}) meses`

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1134, right: 850, bottom: 1134, left: 850 },
            },
          },
          children: [
            // Header + parties
            ...buildHeaderParagraphs(f, 'GOON INFINITY'),
            ...buildConsideracoes('GOON INFINITY'),

            // Cl 1 – DO OBJETO
            clauseHeader('Cláusula 1 – Do Objeto'),
            para([
              normal(
                'O presente contrato tem por objeto a prestação de serviços de mentoria em grupo ',
              ),
              bold('"GOON INFINITY"'),
              normal(', compreendendo as seguintes entregas:'),
            ]),
            bulletPara('2 (dois) encontros mensais ao vivo por videoconferência, com duração de até 2 (duas) horas cada, conduzidos pelo Mentor Giulliano Puga;', true),
            bulletPara('Participação em grupo Mastermind exclusivo no WhatsApp, com acesso a interações, insights e networking entre os membros do programa;', true),
            bulletPara('Acompanhamento quinzenal individual por videochamada de até 30 minutos, para revisão de metas e orientação personalizada;', true),
            bulletPara(`Acesso à Área de Membros por 12 (doze) meses, contendo videoaulas, materiais de apoio, ferramentas e conteúdos exclusivos do programa GOON INFINITY;`, true),
            bulletPara('Suporte por canal digital durante o período de vigência do contrato.', true),
            para([
              bold('§ 1º '),
              normal('— Os encontros ao vivo serão agendados com antecedência mínima de 72 horas, com calendário divulgado mensalmente pela CONTRATADA.'),
            ]),
            para([
              bold('§ 2º '),
              normal('— O acompanhamento quinzenal deverá ser agendado pelo CONTRATANTE com antecedência mínima de 48 horas, por meio dos canais indicados pela CONTRATADA.'),
            ]),
            para([
              bold('§ 3º '),
              normal('— O conteúdo da Área de Membros é de caráter educacional e informativo, sendo atualizado periodicamente a critério exclusivo da CONTRATADA.'),
            ]),

            // Cl 2 – DO VALOR
            clauseHeader('Cláusula 2 – Do Valor e Condições de Pagamento'),
            para([
              normal('O valor total do investimento na mentoria é de '),
              bold(`R$ ${f.valorTotal} (${f.valorExtenso})`),
              normal('. O pagamento será realizado por meio de '),
              bold(f.formaPagamento),
              normal('.'),
            ]),
            para([
              bold('§ 1º '),
              normal('— Os valores são fixos e não reajustáveis durante o período de vigência contratual, salvo acordo expresso entre as partes.'),
            ]),
            para([
              bold('§ 2º '),
              normal('— Os pagamentos deverão ser realizados nas datas acordadas, sendo de responsabilidade exclusiva do CONTRATANTE garantir o crédito em favor da CONTRATADA.'),
            ]),

            // Cl 3 – ACESSO E CONDUTA
            clauseHeader('Cláusula 3 – Do Acesso e Conduta'),
            para([normal('O acesso às plataformas, Área de Membros e grupos de comunicação é estritamente pessoal e intransferível, sendo expressamente proibido:')]),
            bulletPara('Compartilhar credenciais de acesso com terceiros;', true),
            bulletPara('Gravar, reproduzir, distribuir ou comercializar, total ou parcialmente, qualquer conteúdo do programa sem autorização prévia e por escrito da CONTRATADA;', true),
            bulletPara('Utilizar o nome, marca, logotipo ou quaisquer materiais da CONTRATADA sem autorização expressa;', true),
            bulletPara('Publicar, transmitir ou distribuir conteúdos ofensivos, discriminatórios ou que violem direitos de terceiros nos canais do programa;', true),
            bulletPara('Realizar atividades de spam, publicidade não autorizada ou captação de clientes nos grupos e canais do programa.', true),
            para([
              bold('§ 1º '),
              normal('— O descumprimento das proibições previstas nesta cláusula ensejará o cancelamento imediato do acesso e do contrato, sem direito a reembolso, além de responsabilização civil e criminal cabível.'),
            ]),

            // Cl 4 – CONFIDENCIALIDADE
            ...clauseConfidentialidade(),

            // Cl 5 – VIGÊNCIA
            clauseHeader('Cláusula 5 – Da Vigência'),
            para([
              normal('O presente contrato terá vigência de '),
              bold(duracaoLabel),
              normal(', podendo ser renovado mediante novo instrumento contratual e acordo entre as partes.'),
            ]),
            para([
              bold('§ 1º '),
              normal('— O acesso à Área de Membros será mantido por 12 (doze) meses a partir da data de início, independentemente da vigência do restante do contrato.'),
            ]),
            para([
              bold('§ 2º '),
              normal('— O encerramento do contrato não implica a eliminação das obrigações de confidencialidade e propriedade intelectual previstas na Cláusula 4.'),
            ]),

            // Cl 6 – INADIMPLEMENTO
            clauseHeader('Cláusula 6 – Do Inadimplemento'),
            para([normal('O não pagamento de qualquer parcela nas datas acordadas sujeitará o CONTRATANTE às seguintes consequências:')]),
            bulletPara('Multa moratória de 2% (dois por cento) sobre o valor em atraso;', true),
            bulletPara('Correção monetária pelo índice IGP-M (ou IPCA em caso de extinção do IGP-M), calculada pro rata die;', true),
            bulletPara('Juros de mora de 1% (um por cento) ao mês, calculados sobre o valor atualizado;', true),
            bulletPara('Inclusão do nome do CONTRATANTE nos órgãos de proteção ao crédito (SPC/Serasa) após 30 (trinta) dias de inadimplência;', true),
            bulletPara('Bloqueio imediato do acesso a todas as plataformas, grupos e conteúdos do programa, sem necessidade de notificação prévia.', true),

            // Cl 6-A – CANCELAMENTO
            clauseHeader('Cláusula 6-A – Cancelamento e Direito de Arrependimento'),
            para([
              bold('Direito de Arrependimento: '),
              normal('Nos termos do art. 49 do Código de Defesa do Consumidor (Lei nº 8.078/1990), o CONTRATANTE poderá exercer o direito de arrependimento em até 7 (sete) dias corridos a partir da assinatura deste contrato, com direito a reembolso integral dos valores pagos.'),
            ]),
            para([
              bold('Após o Início dos Serviços: '),
              normal('Decorrido o prazo de arrependimento ou após o início efetivo da prestação dos serviços, não haverá reembolso dos valores pagos, independentemente do motivo do cancelamento pelo CONTRATANTE.'),
            ]),

            // Cl 7 – LGPD
            clauseHeader('Cláusula 7 – Proteção de Dados (LGPD)'),
            para([
              normal('Em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD), as partes comprometem-se a utilizar os dados pessoais fornecidos exclusivamente para os fins previstos neste contrato, adotando medidas técnicas e organizacionais adequadas para sua proteção.'),
            ]),
            para([
              bold('§ 1º '),
              normal('— O CONTRATANTE consente expressamente com o tratamento de seus dados pessoais para a execução deste contrato e para o envio de comunicações relacionadas aos serviços contratados.'),
            ]),

            // Cl 8 – DISPOSIÇÕES FINAIS
            ...clauseDisposicoes(),

            // Date + signatures
            spacer(),
            spacer(),
            new Paragraph({
              children: [bold(`São Paulo/SP, ${f.dataContrato}`)],
              alignment: AlignmentType.CENTER,
              spacing: { before: 360, after: 480 },
            }),

            // Signatures
            ...sigLine(f.nome, 'CONTRATANTE', `CPF: ${f.cpf}`),
            ...sigLine('AURA SERVIÇOS DE MARKETING LTDA', 'CONTRATADA', 'CNPJ: 63.509.354/0001-86'),
            ...sigLine('GIULLIANO PUGA DA CRUZ', 'MENTOR — GOON INFINITY', 'CPF: 047.611.729-16'),

            spacer(),
            spacer(),
            new Paragraph({
              children: [bold('TESTEMUNHAS:')],
              alignment: AlignmentType.LEFT,
              spacing: { after: 60 },
            }),
            ...sigLine('Testemunha 1', 'Nome: _______________________________', 'CPF: _______________________________'),
            ...sigLine('Testemunha 2', 'Nome: _______________________________', 'CPF: _______________________________'),
          ],
        },
      ],
    })

    return Buffer.from(await Packer.toBuffer(doc))
  }

  // ----------------------------------------------------------------
  // GOON ELITE (also used for SCALE and INDIVIDUAL)
  // ----------------------------------------------------------------
  async generateElite(f: ContractFields): Promise<Buffer> {
    const duracaoLabel =
      f.duracaoMeses === '1'
        ? '1 (um) mês'
        : `${f.duracaoMeses} (${this.numExtenso(f.duracaoMeses)}) meses`

    const programaLabel =
      f.programa === 'GOON SCALE' ? 'GOON SCALE' : f.programa === 'GOON INDIVIDUAL' ? 'GOON INDIVIDUAL' : 'GOON ELITE'

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1134, right: 850, bottom: 1134, left: 850 },
            },
          },
          children: [
            ...buildHeaderParagraphs(f, 'GOON ELITE'),
            ...buildConsideracoes(programaLabel),

            // Cl 1 – DO OBJETO
            clauseHeader('Cláusula 1 – Do Objeto'),
            para([
              normal(`O presente contrato tem por objeto a prestação de serviços de mentoria individual no programa `),
              bold(programaLabel),
              normal(', compreendendo as seguintes entregas:'),
            ]),
            bulletPara('E-book exclusivo de metodologia e estratégia empresarial;', true),
            bulletPara('6 (seis) sessões individuais de até 2 (duas) horas com o Mentor Giulliano Puga, realizadas por videoconferência;', true),
            bulletPara('Participação em grupo Mastermind exclusivo no WhatsApp, com acesso a interações, insights e networking entre os membros do programa;', true),
            bulletPara('Suporte por canal digital durante o período de vigência do contrato.', true),
            para([
              bold('§ 1º '),
              normal('— As sessões individuais deverão ser agendadas pelo CONTRATANTE com antecedência mínima de 48 horas, por meio dos canais indicados pela CONTRATADA.'),
            ]),
            para([
              bold('§ 2º '),
              normal('— O cronograma das sessões será acordado entre as partes, respeitando a disponibilidade do MENTOR.'),
            ]),

            // Cl 2 – EXECUÇÃO E PRAZOS
            clauseHeader('Cláusula 2 – Execução e Prazos'),
            para([
              normal('Os serviços serão prestados ao longo de '),
              bold(duracaoLabel),
              normal(' a partir da data de assinatura deste contrato, período durante o qual o CONTRATANTE terá acesso a todos os benefícios descritos na Cláusula 1.'),
            ]),
            para([
              bold('§ 1º '),
              normal('— O prazo poderá ser prorrogado, a critério exclusivo da CONTRATADA, em casos de força maior ou caso fortuito.'),
            ]),
            para([
              bold('§ 2º '),
              normal('— Sessões não utilizadas dentro do prazo contratual não geram direito a reembolso ou extensão do prazo.'),
            ]),

            // Cl 3 – PREÇO E PAGAMENTO
            clauseHeader('Cláusula 3 – Preço e Condições de Pagamento'),
            para([
              normal('O valor total do investimento na mentoria é de '),
              bold(`R$ ${f.valorTotal} (${f.valorExtenso})`),
              normal('. O pagamento será realizado por meio de '),
              bold(f.formaPagamento),
              normal('.'),
            ]),
            para([
              bold('§ 1º '),
              normal('— Os valores são fixos e não reajustáveis durante o período de vigência contratual, salvo acordo expresso entre as partes.'),
            ]),
            para([
              bold('§ 2º '),
              normal('— Os pagamentos deverão ser realizados nas datas acordadas, sendo de responsabilidade exclusiva do CONTRATANTE garantir o crédito em favor da CONTRATADA.'),
            ]),

            // Cl 4 – CONFIDENCIALIDADE
            ...clauseConfidentialidade(),

            // Cl 5 – PENALIDADES
            clauseHeader('Cláusula 5 – Penalidades e Cancelamento'),
            para([
              normal('Em caso de descumprimento das obrigações financeiras pelo CONTRATANTE, incidirão as seguintes penalidades:'),
            ]),
            bulletPara('Multa de 10% (dez por cento) sobre o valor total do contrato;', true),
            bulletPara('Em caso de desistência até 30 dias do início: multa de 20% (vinte por cento) sobre o valor pago;', true),
            bulletPara('Em caso de desistência após 30 dias do início: multa de 50% (cinquenta por cento) sobre o valor total do contrato;', true),
            bulletPara('Correção monetária pelo índice IGP-M e juros de mora de 1% (um por cento) ao mês;', true),
            bulletPara('Inclusão do nome do CONTRATANTE nos órgãos de proteção ao crédito (SPC/Serasa) após 30 (trinta) dias de inadimplência.', true),
            para([
              bold('§ 1º '),
              normal('— O direito de arrependimento previsto no art. 49 do CDC poderá ser exercido em até 7 (sete) dias corridos da assinatura, com direito a reembolso integral.'),
            ]),

            // Cl 6 – USO DE WHATSAPP
            clauseHeader('Cláusula 6 – Uso do WhatsApp e Canais Digitais'),
            para([
              normal('A comunicação entre as partes será realizada preferencialmente via WhatsApp e e-mail. O CONTRATANTE compromete-se a:'),
            ]),
            bulletPara('Manter postura profissional em todos os canais de comunicação do programa;', true),
            bulletPara('Não divulgar conteúdos das sessões e do grupo Mastermind para terceiros;', true),
            bulletPara('Não utilizar os canais para fins comerciais, publicidade ou captação de clientes;', true),
            bulletPara('Respeitar os demais membros e o Mentor nos grupos e canais do programa.', true),
            para([
              bold('§ 1º '),
              normal('— O descumprimento das normas de conduta poderá resultar no cancelamento imediato do contrato, sem direito a reembolso.'),
            ]),

            // Cl 7 – LEGISLAÇÃO E FORO
            clauseHeader('Cláusula 7 – Legislação Aplicável e Foro'),
            para([
              normal(
                'Este contrato é regido pelas leis da República Federativa do Brasil, notadamente o Código Civil (Lei nº 10.406/2002) e o Código de Defesa do Consumidor (Lei nº 8.078/1990).',
              ),
            ]),
            para([
              normal(
                'Para dirimir quaisquer controvérsias oriundas deste contrato, as partes elegem o foro da Comarca de São Paulo/SP, renunciando a qualquer outro, por mais privilegiado que seja.',
              ),
            ]),

            // Cl 8 – DISPOSIÇÕES FINAIS
            ...clauseDisposicoes(),

            // Date + signatures
            spacer(),
            spacer(),
            new Paragraph({
              children: [bold(`São Paulo/SP, ${f.dataContrato}`)],
              alignment: AlignmentType.CENTER,
              spacing: { before: 360, after: 480 },
            }),

            ...sigLine(f.nome, 'CONTRATANTE', `CPF: ${f.cpf}`),
            ...sigLine('AURA SERVIÇOS DE MARKETING LTDA', 'CONTRATADA', 'CNPJ: 63.509.354/0001-86'),
            ...sigLine('GIULLIANO PUGA DA CRUZ', `MENTOR — ${programaLabel}`, 'CPF: 047.611.729-16'),

            spacer(),
            spacer(),
            new Paragraph({
              children: [bold('TESTEMUNHAS:')],
              alignment: AlignmentType.LEFT,
              spacing: { after: 60 },
            }),
            ...sigLine('Testemunha 1', 'Nome: _______________________________', 'CPF: _______________________________'),
            ...sigLine('Testemunha 2', 'Nome: _______________________________', 'CPF: _______________________________'),
          ],
        },
      ],
    })

    return Buffer.from(await Packer.toBuffer(doc))
  }

  // ----------------------------------------------------------------
  // Entry point — dispatch by programa
  // ----------------------------------------------------------------
  async generate(f: ContractFields): Promise<Buffer> {
    const p = (f.programa ?? '').toUpperCase()
    if (p.includes('INFINITY') || p === 'GI') {
      return this.generateInfinity(f)
    }
    // GE, GS, INDIVIDUAL, SCALE all use Elite template
    return this.generateElite(f)
  }

  // ---- helpers ----
  private numExtenso(n: string): string {
    const map: Record<string, string> = {
      '1': 'um',
      '2': 'dois',
      '3': 'três',
      '4': 'quatro',
      '5': 'cinco',
      '6': 'seis',
      '7': 'sete',
      '8': 'oito',
      '9': 'nove',
      '10': 'dez',
      '11': 'onze',
      '12': 'doze',
      '18': 'dezoito',
      '24': 'vinte e quatro',
    }
    return map[n] ?? n
  }
}
