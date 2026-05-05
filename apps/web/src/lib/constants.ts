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
  'FOLLOW_UP',
  'EM_NEGOCIACAO',
  'FECHADO',
  'PERDIDO',
] as const

export const LEAD_STAGE_LABELS: Record<string, string> = {
  NOVO: 'Novo',
  FOLLOW_UP: 'Follow Up',
  EM_NEGOCIACAO: 'Em Negociacao',
  FECHADO: 'Fechado',
  PERDIDO: 'Perdido',
}

export const LEAD_STAGE_COLORS: Record<string, string> = {
  NOVO: '#4A78FF',
  FOLLOW_UP: '#06b6d4',
  EM_NEGOCIACAO: '#f97316',
  FECHADO: '#22c55e',
  PERDIDO: '#cc0000',
}

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  indicacao: 'Indicacao',
  evento: 'Evento',
  site: 'Site',
  facebook: 'Facebook',
  base_clientes: 'Base de Clientes',
  outro: 'Outro',
}

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
