import JSZip from 'jszip'

// Preenchimento dos modelos de contrato (.docx com campos {{CAMPO}}).
// Os campos e o formato seguem CAMPOS_MODELOS_GOON.csv (modelos padrão Elite e Infinity).

export const CONTRACT_FIELDS: Array<{ key: string; label: string; long?: boolean }> = [
  { key: 'RAZAO_SOCIAL', label: 'Razão social' },
  { key: 'NOME_FANTASIA', label: 'Nome fantasia' },
  { key: 'CNPJ', label: 'CNPJ' },
  { key: 'ENDERECO', label: 'Endereço completo (com cidade/UF e CEP)' },
  { key: 'REPRESENTANTE', label: 'Representante legal' },
  { key: 'CPF', label: 'CPF do representante' },
  { key: 'EMAIL', label: 'E-mail para assinatura' },
  { key: 'TELEFONE', label: 'Telefone' },
  { key: 'CICLO', label: 'Duração por extenso' },
  { key: 'CICLO_CURTO', label: 'Duração no cabeçalho' },
  { key: 'DATA_INICIO', label: 'Data de início' },
  { key: 'VALOR_TOTAL', label: 'Investimento total' },
  { key: 'RESUMO_PAGAMENTO', label: 'Resumo do pagamento (Quadro Resumo)', long: true },
  { key: 'CONDICAO_PAGAMENTO', label: 'Condição de pagamento (cláusula 2.2: minúscula no início, ponto no fim)', long: true },
  { key: 'DATA_ASSINATURA', label: 'Data de assinatura' },
]

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

/** Número inteiro por extenso (até milhões). */
export function extenso(n: number): string {
  n = Math.floor(n)
  if (n === 0) return 'zero'
  const mi = Math.floor(n / 1e6), mil = Math.floor((n % 1e6) / 1000), resto = n % 1000
  const parts: string[] = []
  if (mi) parts.push(mi === 1 ? 'um milhão' : `${ate999(mi)} milhões`)
  if (mil) parts.push(mil === 1 ? 'mil' : `${ate999(mil)} mil`)
  if (resto) parts.push(ate999(resto))
  // "e" antes do último grupo quando ele é < 100 ou centena redonda (ex.: mil e quinhentos)
  if (parts.length > 1 && resto && (resto < 100 || resto % 100 === 0)) return parts.slice(0, -1).join(', ') + ' e ' + parts[parts.length - 1]
  return parts.join(' ')
}

/** Por extenso no feminino (ex.: "duas parcelas", "uma parcela", "duzentas"). */
export const extensoF = (n: number) =>
  extenso(n).replace(/\bum\b/g, 'uma').replace(/\bdois\b/g, 'duas').replace(/entos\b/g, 'entas')

export function reaisPorExtenso(v: number) {
  const inteiro = Math.floor(v), cent = Math.round((v - inteiro) * 100)
  const brl = v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  let txt = inteiro ? `${extenso(inteiro)} ${inteiro === 1 ? 'real' : 'reais'}` : ''
  if (inteiro >= 1e6 && inteiro % 1e6 === 0) txt = `${extenso(inteiro)} de reais`
  if (cent) txt += `${txt ? ' e ' : ''}${extenso(cent)} ${cent === 1 ? 'centavo' : 'centavos'}`
  return `${brl.replace(/ /g, ' ')} (${txt})`
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const dataLonga = (d: Date) => `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Troca {{CAMPO}} no corpo, cabeçalhos e rodapés. Devolve o .docx e os campos que ficaram sem valor. */
export async function fillDocx(templateBase64: string, values: Record<string, string>) {
  const zip = await JSZip.loadAsync(Buffer.from(templateBase64, 'base64'))
  const missing = new Set<string>()
  const parts = Object.keys(zip.files).filter(n => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n))
  for (const name of parts) {
    const xml = await zip.file(name)!.async('string')
    const out = xml.replace(/\{\{([A-Z_]+)\}\}/g, (_m, key: string) => {
      const v = values[key]?.trim()
      if (!v) { missing.add(key); return `{{${key}}}` }
      return esc(v)
    })
    zip.file(name, out)
  }
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  return { buffer, missing: [...missing] }
}
