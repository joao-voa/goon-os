// Condições do contrato (prazo, forma de pagamento, parcelas) -> textos dos campos do modelo.
// Mesmo formato do servidor (apps/api/src/modules/onboarding): CONDICAO_PAGAMENTO completa
// "O investimento é de {{VALOR_TOTAL}}, " (minúscula no início, ponto no fim).

export type ContractInstallment = { dueDate: string; value: number; entry: boolean }
export type ContractTerms = {
  months: number
  startDate: string // aaaa-mm-dd
  paymentType: 'BOLETO' | 'PIX' | 'CARTAO'
  paidUpfront: boolean
  cardInstallments: number
  installments: ContractInstallment[]
}

const UNI = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CEN = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

function ate999(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  const c = Math.floor(n / 100), r = n % 100, parts: string[] = []
  if (c) parts.push(CEN[c])
  if (r) parts.push(r < 20 ? UNI[r] : DEZ[Math.floor(r / 10)] + (r % 10 ? ` e ${UNI[r % 10]}` : ''))
  return parts.join(' e ')
}

export function extenso(n: number): string {
  n = Math.floor(n)
  if (n === 0) return 'zero'
  const mi = Math.floor(n / 1e6), mil = Math.floor((n % 1e6) / 1000), resto = n % 1000
  const parts: string[] = []
  if (mi) parts.push(mi === 1 ? 'um milhão' : `${ate999(mi)} milhões`)
  if (mil) parts.push(mil === 1 ? 'mil' : `${ate999(mil)} mil`)
  if (resto) parts.push(ate999(resto))
  if (parts.length > 1 && resto && (resto < 100 || resto % 100 === 0)) return parts.slice(0, -1).join(', ') + ' e ' + parts[parts.length - 1]
  return parts.join(' ')
}

/** No feminino: "duas parcelas", "vinte e uma". */
export const extensoF = (n: number) => extenso(n).replace(/\bum\b/g, 'uma').replace(/\bdois\b/g, 'duas').replace(/entos\b/g, 'entas')

export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ')

export function reaisPorExtenso(v: number) {
  const inteiro = Math.floor(v), cent = Math.round((v - inteiro) * 100)
  let txt = inteiro ? `${extenso(inteiro)} ${inteiro === 1 ? 'real' : 'reais'}` : ''
  if (inteiro >= 1e6 && inteiro % 1e6 === 0) txt = `${extenso(inteiro)} de reais`
  if (cent) txt += `${txt ? ' e ' : ''}${extenso(cent)} ${cent === 1 ? 'centavo' : 'centavos'}`
  return `${brl(v)} (${txt})`
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const parts = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d } }
export const dataLonga = (iso: string) => { const { y, m, d } = parts(iso); return `${d} de ${MESES[m - 1]} de ${y}` }
export const dmy = (iso: string) => { const { y, m, d } = parts(iso); return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}` }

/** Soma meses a uma data aaaa-mm-dd mantendo o dia (limitado ao fim do mês). */
export function addMonths(iso: string, n: number) {
  const { y, m, d } = parts(iso)
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate()
  const dt = new Date(Date.UTC(y, m - 1 + n, Math.min(d, last)))
  return dt.toISOString().slice(0, 10)
}

export const termsTotal = (t: ContractTerms) => t.installments.reduce((a, i) => a + (Number(i.value) || 0), 0)

/** Os 6 campos do modelo que saem das condições. */
export function termsToFields(t: ContractTerms): Record<string, string> {
  const total = termsTotal(t)
  const forma = t.paymentType === 'CARTAO' ? 'cartão de crédito' : t.paymentType === 'PIX' ? 'PIX' : 'boleto bancário'
  const Forma = forma.charAt(0).toUpperCase() + forma.slice(1)
  const list = [...t.installments].filter(i => i.dueDate && Number(i.value) > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  let resumo = '', condicao = ''

  if (t.paymentType === 'CARTAO') {
    const n = Math.max(1, t.cardInstallments || 1)
    const vezes = n === 1 ? 'à vista' : `em até ${n}x`
    resumo = `Cartão de crédito ${vezes}${t.paidUpfront ? ', integralmente pago nesta data' : ''}`
    condicao = `pago por cartão de crédito, ${n === 1 ? 'à vista' : `em até ${n} (${extensoF(n)}) parcelas`}${t.paidUpfront ? ', já integralmente quitado nesta data' : ''}.`
  } else if (list.length === 1) {
    const p = list[0]
    resumo = `${Forma}, pagamento à vista${t.paidUpfront ? ', integralmente pago nesta data' : ` em ${dmy(p.dueDate)}`}`
    condicao = `pago por ${forma}, à vista${t.paidUpfront ? ', já integralmente quitado nesta data' : `, com vencimento em ${dmy(p.dueDate)}`}.`
  } else if (list.length > 1) {
    const entry = list.find(i => i.entry) ?? null
    const rest = list.filter(i => i !== entry)
    const n = rest.length
    const same = n > 0 && rest.every(i => Number(i.value) === Number(rest[0].value))
    const days = new Set(rest.map(i => parts(i.dueDate).d))
    const dia = days.size === 1 ? [...days][0] : null
    const entTxt = entry ? `entrada de ${brl(Number(entry.value))} em ${dmy(entry.dueDate)} e ` : ''
    if (same) {
      resumo = `${Forma}, ${entTxt}${n} parcelas de ${brl(Number(rest[0].value))}${dia ? ` todo dia ${dia}` : ''}`
      condicao = `pago por ${forma}, ${entry ? `com ${entTxt}` : 'em '}${n} (${extensoF(n)}) parcelas mensais de ${brl(Number(rest[0].value))}, a primeira em ${dmy(rest[0].dueDate)}${dia ? `, com vencimento todo dia ${dia}` : ''}.`
    } else {
      resumo = `${Forma}, ${entTxt}${n} parcelas de valores variados, de ${dmy(rest[0].dueDate)} a ${dmy(rest[n - 1].dueDate)}`
      condicao = `pago por ${forma}, ${entry ? `com ${entTxt}` : 'em '}${n} (${extensoF(n)}) parcelas, nos seguintes valores e vencimentos: ${rest.map(i => `${brl(Number(i.value))} em ${dmy(i.dueDate)}`).join('; ')}.`
    }
  }

  const m = Math.max(1, t.months || 1)
  return {
    CICLO: `${m} (${extenso(m)}) ${m === 1 ? 'mês' : 'meses'}`,
    CICLO_CURTO: `${m} ${m === 1 ? 'MÊS' : 'MESES'}`,
    DATA_INICIO: t.startDate ? dataLonga(t.startDate) : '',
    VALOR_TOTAL: total ? reaisPorExtenso(total) : '',
    RESUMO_PAGAMENTO: resumo,
    CONDICAO_PAGAMENTO: condicao,
  }
}
