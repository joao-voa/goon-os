// Commission closing rule
export const COMMISSION_CUTOFF_DAY = 2
export const COMMISSION_PAYMENT_DAY = 10

// Tax rate on revenue
export const TAX_RATE = 0.06 // 6%

export function getNextCommissionPaymentDate(now: Date): Date {
  const day = now.getDate()
  const month = now.getMonth()
  const year = now.getFullYear()

  if (day <= COMMISSION_CUTOFF_DAY) {
    return new Date(year, month, COMMISSION_PAYMENT_DAY)
  }
  return new Date(year, month + 1, COMMISSION_PAYMENT_DAY)
}

export function getNextClosingCutoff(now: Date): Date {
  const day = now.getDate()
  const month = now.getMonth()
  const year = now.getFullYear()

  if (day <= COMMISSION_CUTOFF_DAY) {
    return new Date(year, month, COMMISSION_CUTOFF_DAY, 23, 59, 59)
  }
  return new Date(year, month + 1, COMMISSION_CUTOFF_DAY, 23, 59, 59)
}

/**
 * Cliente em carteira de cobrança / recuperação de crédito:
 * leadStage RECUPERAR, ou tem alguma parcela marcada na carteira (inCarteira).
 * Parcelas FUTURAS (PENDING) desses clientes não entram no fluxo nem nos
 * indicadores de "a receber" — receita incerta. Fragmento de where Prisma
 * que EXCLUI esses clientes (usar em agregações de PENDING).
 */
export const NOT_CARTEIRA_CLIENT_FILTER = {
  client: {
    leadStage: { notIn: ['RECUPERAR', 'PERDIDO'] as string[] },
    payments: { none: { inCarteira: true } },
  },
}
