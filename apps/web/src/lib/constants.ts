// Dono do sistema — acesso exclusivo (ex: Auditoria)
export const OWNER_EMAIL = 'joaovitorafonso@gmail.com'

export const ONBOARDING_STAGES = [
  'CLIENT_CLOSED', 'CONTRACT_SENT', 'BILLING_CREATED',
  'KICKOFF_SCHEDULED', 'ONBOARDING_DONE',
] as const

export const STAGE_LABELS: Record<string, string> = {
  CLIENT_CLOSED: 'Cliente Fechado',
  CONTRACT_SENT: 'Enviar Contrato',
  BILLING_CREATED: 'Geracao de Boletos',
  KICKOFF_SCHEDULED: 'Kickoff Agendado',
  ONBOARDING_DONE: 'Onboarding Finalizado',
}

export const STAGE_COLORS: Record<string, string> = {
  CLIENT_CLOSED: '#8b5cf6',
  CONTRACT_SENT: '#f59e0b',
  BILLING_CREATED: '#a855f7',
  KICKOFF_SCHEDULED: '#10b981',
  ONBOARDING_DONE: '#22c55e',
}

export const PRODUCT_COLORS: Record<string, string> = {
  GE: '#7B2FBE',
  GI: '#000080',
  GS: '#006600',
  AURA: '#D4A017',
  TTS: '#ff0050',
  TTSG: '#ff0050',
}

export const PRODUCT_NAMES: Record<string, string> = {
  GE: 'GOON ELITE',
  GI: 'GOON INFINITY',
  GS: 'GOON SCALE',
  AURA: 'AURA 360',
  TTS: 'TIK TOK SCALE',
  TTSG: 'TIKTOK SCALE GRUPO',
}

export const AURA_MODULES = [
  { code: 'BRANDING', label: 'Branding 360' },
  { code: 'DIRECAO_CRIATIVA', label: 'Direcao Criativa' },
  { code: 'PRODUCAO_OUTSOURCING', label: 'Producao Outsourcing' },
  { code: 'RETAIL_360', label: 'Retail 360' },
  { code: 'VENDAS_B2B', label: 'Implementacao Vendas B2B' },
  { code: 'VENDAS_B2C', label: 'Implementacao Vendas B2C' },
] as const

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  PAID: '#006600',
  PENDING: '#000080',
  OVERDUE: '#cc0000',
  SCHEDULED: '#c0c0c0',
  CANCELLED: '#c0c0c0',
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PAID: 'Pago',
  PENDING: 'Pendente',
  OVERDUE: 'Vencido',
  SCHEDULED: 'Agendado',
  CANCELLED: 'Cancelado',
}

export const PENDENCY_TYPE_COLORS: Record<string, string> = {
  CONTRACT_UNSIGNED: '#cc0000',
  PAYMENT_OVERDUE: '#cc0000',
  PAYMENT_DUE_SOON: '#ff6600',
  RENEWAL_PENDING: '#ff6600',
  DOCUMENT_MISSING: '#000080',
  CONTACT_NEEDED: '#000080',
  OTHER: '#c0c0c0',
}

export const PENDENCY_TYPE_LABELS: Record<string, string> = {
  CONTRACT_UNSIGNED: 'Contrato não assinado',
  PAYMENT_OVERDUE: 'Boleto vencido',
  PAYMENT_DUE_SOON: 'Boleto vence em breve',
  RENEWAL_PENDING: 'Renovação pendente',
  DOCUMENT_MISSING: 'Documento pendente',
  CONTACT_NEEDED: 'Contato necessário',
  OTHER: 'Outro',
}

export const PENDENCY_TYPE_ICONS: Record<string, string> = {
  CONTRACT_UNSIGNED: '✦',
  PAYMENT_OVERDUE: '◆',
  PAYMENT_DUE_SOON: '◆',
  RENEWAL_PENDING: '↺',
  DOCUMENT_MISSING: '◉',
  CONTACT_NEEDED: '▲',
  OTHER: '○',
}

export const CONTRACT_STATUS_COLORS: Record<string, string> = {
  DRAFT: '#c0c0c0',
  SENT: '#000080',
  SIGNED: '#006600',
  CANCELLED: '#cc0000',
  RENEWAL: '#ff6600',
}

export const LEAD_STAGES = [
  'NOVO',
  'RECUPERAR',
  'FUP',
  'QUALIFICADO',
  'REUNIAO_AGENDADA',
  'PROPOSTA_ENVIADA',
  'EM_NEGOCIACAO',
  'FECHADO',
  'PERDIDO',
] as const

export const LEAD_STAGE_LABELS: Record<string, string> = {
  NOVO: 'Novo',
  RECUPERAR: 'Recuperar',
  FUP: 'Conexao',
  QUALIFICADO: 'Qualificado',
  REUNIAO_AGENDADA: 'Reuniao Agendada',
  PROPOSTA_ENVIADA: 'Proposta Enviada',
  EM_NEGOCIACAO: 'Em Negociacao',
  FECHADO: 'Fechado Ganho',
  PERDIDO: 'Fechado Perdido',
  FOLLOW_UP: 'Conexao',
}

export const LEAD_STAGE_COLORS: Record<string, string> = {
  NOVO: '#4A78FF',
  RECUPERAR: '#ec4899',
  FUP: '#06b6d4',
  QUALIFICADO: '#8b5cf6',
  REUNIAO_AGENDADA: '#0ea5e9',
  EM_NEGOCIACAO: '#f97316',
  PROPOSTA_ENVIADA: '#e6a800',
  FECHADO: '#22c55e',
  PERDIDO: '#cc0000',
  FOLLOW_UP: '#06b6d4',
}

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  indicacao: 'Indicacao',
  evento: 'Evento',
  site: 'Site',
  facebook: 'Facebook',
  base_clientes: 'Base de Clientes',
  outro: 'Outro',
  nao_informado: 'Nao informado',
}

// Source options offered when creating a lead (no "outro" — avoids untagged leads)
export const LEAD_SOURCE_OPTIONS = [
  'instagram',
  'facebook',
  'indicacao',
  'evento',
  'site',
  'base_clientes',
] as const

// Faturamento mensal bands (ICP filter). ICP threshold = R$100k/mês.
export const FATURAMENTO_BANDS = [
  'ATE_50K',
  '50_100K',
  '100_500K',
  '500K_1M',
  'ACIMA_1M',
  'NAO_INFORMADO',
] as const

export const FATURAMENTO_BAND_LABELS: Record<string, string> = {
  ATE_50K: 'Até R$50k/mês',
  '50_100K': 'R$50k–100k/mês',
  '100_500K': 'R$100k–500k/mês',
  '500K_1M': 'R$500k–1M/mês',
  ACIMA_1M: 'Acima de R$1M/mês',
  NAO_INFORMADO: 'Não informado',
}

// Filter options for the dashboard faturamento selector
export const FATURAMENTO_FILTERS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'ICP', label: 'Dentro do ICP (≥R$100k/mês)' },
  { value: 'FORA', label: 'Fora do ICP (<R$100k/mês)' },
  { value: 'ATE_50K', label: 'Até R$50k/mês' },
  { value: '50_100K', label: 'R$50k–100k/mês' },
  { value: '100_500K', label: 'R$100k–500k/mês' },
  { value: '500K_1M', label: 'R$500k–1M/mês' },
  { value: 'ACIMA_1M', label: 'Acima de R$1M/mês' },
  { value: 'NAO_INFORMADO', label: 'Não informado' },
] as const

export const INTERACTION_TYPES: Record<string, string> = {
  LIGACAO: 'Ligacao',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-mail',
  REUNIAO: 'Reuniao',
  NOTA: 'Nota',
  PROPOSTA: 'Proposta',
  FOLLOW_UP: 'Follow Up',
}

export const INTERACTION_ICONS: Record<string, string> = {
  LIGACAO: '📞',
  WHATSAPP: '💬',
  EMAIL: '📧',
  REUNIAO: '🤝',
  NOTA: '📝',
  PROPOSTA: '📄',
  FOLLOW_UP: '🔄',
}
