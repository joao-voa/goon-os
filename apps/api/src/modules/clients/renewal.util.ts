export function isInRenewalPeriod(contractEndDate: Date): boolean {
  const now = new Date()
  const trigger = new Date(contractEndDate)
  trigger.setMonth(trigger.getMonth() - 3) // 90 days before end
  return now >= trigger && now <= contractEndDate
}

export function daysUntil(date: Date): number {
  const now = new Date()
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}
