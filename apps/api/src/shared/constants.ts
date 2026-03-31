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
