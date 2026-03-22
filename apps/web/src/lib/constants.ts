export const ONBOARDING_STAGES = [
  'CLIENT_CLOSED', 'SYSTEM_REGISTERED', 'INFO_COLLECTED', 'CONTRACT_DRAFTED',
  'CONTRACT_SENT', 'CONTRACT_SIGNED', 'INITIAL_PAYMENT', 'BILLING_CREATED',
  'KICKOFF_SCHEDULED', 'ONBOARDING_DONE',
] as const

export const STAGE_LABELS: Record<string, string> = {
  CLIENT_CLOSED: 'Cliente Fechado',
  SYSTEM_REGISTERED: 'Cadastro no Sistema',
  INFO_COLLECTED: 'Coleta de Informações',
  CONTRACT_DRAFTED: 'Elaboração do Contrato',
  CONTRACT_SENT: 'Envio do Contrato',
  CONTRACT_SIGNED: 'Assinatura',
  INITIAL_PAYMENT: 'Pagamento Inicial',
  BILLING_CREATED: 'Geração de Boletos',
  KICKOFF_SCHEDULED: 'Kickoff Agendado',
  ONBOARDING_DONE: 'Onboarding Finalizado',
}

export const STAGE_COLORS: Record<string, string> = {
  CLIENT_CLOSED: '#8b5cf6',
  SYSTEM_REGISTERED: '#4A78FF',
  INFO_COLLECTED: '#06b6d4',
  CONTRACT_DRAFTED: '#0891b2',
  CONTRACT_SENT: '#f59e0b',
  CONTRACT_SIGNED: '#f97316',
  INITIAL_PAYMENT: '#eab308',
  BILLING_CREATED: '#a855f7',
  KICKOFF_SCHEDULED: '#10b981',
  ONBOARDING_DONE: '#22c55e',
}

export const PRODUCT_COLORS: Record<string, string> = {
  GE: '#8b5cf6',
  GI: '#3B82F6',
  GS: '#22c55e',
}
