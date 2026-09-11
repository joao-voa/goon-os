'use client'

import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useIsMobile } from '@/hooks/useMediaQuery'
import {
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  LEAD_STAGE_COLORS,
  LEAD_SOURCE_LABELS,
  LEAD_SOURCE_OPTIONS,
  FATURAMENTO_FILTERS,
  FATURAMENTO_BAND_LABELS,
  PRODUCT_COLORS,
  PRODUCT_NAMES,
  INTERACTION_TYPES,
  INTERACTION_ICONS,
  AURA_MODULES,
} from '@/lib/constants'
import dynamic from 'next/dynamic'
import { X, Trash2 } from 'lucide-react'

const CrmKanbanBoard = dynamic(() => import('@/components/CrmKanbanBoard'), { ssr: false })
const ClientsPage = dynamic(() => import('../clients/page'), { ssr: false })

// ---- Design tokens (tema claro + neon) ----
const C = {
  ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0', bg: '#f8fafc',
  neon: '#C7F900', green: '#16a34a', greenDk: '#15803d', red: '#dc2626', amber: '#f59e0b', slate: '#475569',
}
const num: CSSProperties = { fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }
const card: CSSProperties = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }

// ---- Types ----
interface LeadItem {
  id: string
  companyName: string
  responsible: string
  phone: string | null
  whatsapp: string | null
  email: string | null
  leadStage: string
  leadSource: string | null
  salesRep: string | null
  saleValue: number | null
  paymentMethod: string | null
  saleInstallments: number | null
  installmentValue: number | null
  entryValue: number | null
  leadNotes: string | null
  selectedModules: string | null
  estimatedRevenue: string | null
  faturamentoBand: string | null
  isICP: boolean
  segment: string | null
  suggestedProduct: string | null
  cardResponsible: string | null
  productCode: string | null
  stageChangedAt: string | null
  createdAt: string
  closedAt: string | null
}

// ---- Close Deal Modal ----
function CloseDealModal({
  lead,
  products,
  onClose,
  onConfirm,
}: {
  lead: LeadItem
  products: Array<{ id: string; code: string; name: string }>
  onClose: () => void
  onConfirm: (data: {
    saleValue: number
    paymentMethod: string
    saleInstallments: number
    installmentValue: number
    productId: string
    entryValue?: number
    firstInstallmentDate?: string
    wasAdvanced?: boolean
    advanceValue?: number
    closedAt?: string
    commissionPercentage?: number
  }) => Promise<void>
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [saleValue, setSaleValue] = useState(lead.saleValue?.toString() ?? '')
  const [paymentMethod, setPaymentMethod] = useState(lead.paymentMethod ?? 'BOLETO')
  const [saleInstallments, setSaleInstallments] = useState(lead.saleInstallments?.toString() ?? '1')
  const [entryValue, setEntryValue] = useState('')
  const [paymentDay, setPaymentDay] = useState(String(new Date().getDate()))
  const [wasAdvanced, setWasAdvanced] = useState(false)
  const [advanceValue, setAdvanceValue] = useState('')
  const [closedAt, setClosedAt] = useState(new Date().toISOString().split('T')[0])
  const [commissionPercentage, setCommissionPercentage] = useState('10')
  const defaultFirstInstallment = new Date()
  defaultFirstInstallment.setDate(defaultFirstInstallment.getDate() + 30)
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(defaultFirstInstallment.toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)

  const value = parseFloat(saleValue) || 0
  const entry = parseFloat(entryValue) || 0
  const remaining = value - entry
  const installments = parseInt(saleInstallments) || 1
  // Quando há entrada, ela conta como 1 das parcelas: 12x com entrada = entrada + 11 regulares
  const regularCount = entry > 0 ? Math.max(installments - 1, 1) : installments
  const installmentVal = regularCount > 0 ? remaining / regularCount : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId || value <= 0 || installments < 1) {
      toast.error('Preencha todos os campos')
      return
    }
    setSubmitting(true)
    try {
      await onConfirm({
        saleValue: value,
        paymentMethod,
        saleInstallments: installments,
        installmentValue: Math.round(installmentVal * 100) / 100,
        productId,
        entryValue: entry > 0 ? entry : undefined,
        firstInstallmentDate: firstInstallmentDate || undefined,
        wasAdvanced: wasAdvanced || undefined,
        advanceValue: wasAdvanced && parseFloat(advanceValue) > 0 ? parseFloat(advanceValue) : undefined,
        closedAt: closedAt || undefined,
        commissionPercentage: parseFloat(commissionPercentage) || 10,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    border: `1px solid ${C.line}`,
    borderRadius: 6,
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    background: 'white',
  }

  const labelStyle: CSSProperties = {
    fontFamily: 'var(--font-sans)',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: C.mid,
    marginBottom: 4,
    display: 'block',
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={e => {
        if (e.target !== e.currentTarget) return
        if (!confirm('Tem certeza que deseja sair? Os dados serao perdidos.')) return
        onClose()
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'white', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
          width: '100%', maxWidth: 420, position: 'relative', overflow: 'hidden',
        }}
      >
        <div style={{ background: C.green, color: 'white', padding: '12px 16px', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600 }}>
          Fechar negócio — {lead.companyName}
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Programa</label>
            <select value={productId} onChange={e => setProductId(e.target.value)} style={inputStyle}>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Valor Total (R$)</label>
              <input type="number" step="0.01" value={saleValue} onChange={e => setSaleValue(e.target.value)} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Valor Entrada (R$)</label>
              <input type="number" step="0.01" placeholder="0" value={entryValue} onChange={e => setEntryValue(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Data de Fechamento</label>
            <input type="date" value={closedAt} onChange={e => setClosedAt(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Forma Pagamento</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={inputStyle}>
                <option value="BOLETO">Boleto</option>
                <option value="PIX">PIX</option>
                <option value="CARTAO">Cartao</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Parcelas</label>
              <input type="number" min="1" value={saleInstallments} onChange={e => setSaleInstallments(e.target.value)} style={inputStyle} required />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Data 1a Parcela</label>
              <input type="date" value={firstInstallmentDate} onChange={e => setFirstInstallmentDate(e.target.value)} style={inputStyle} />
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.dim, marginTop: 3 }}>
                Padrao: D+30. Demais parcelas seguem mensalmente.
              </div>
            </div>
            <div>
              <label style={labelStyle}>% Comissao</label>
              <input type="number" step="0.5" min="0" value={commissionPercentage} onChange={e => setCommissionPercentage(e.target.value)} style={inputStyle} />
            </div>
          </div>
          {/* Adiantamento */}
          {paymentMethod === 'CARTAO' && (
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: 12, background: C.bg }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: C.ink }}>
                <input type="checkbox" checked={wasAdvanced} onChange={e => setWasAdvanced(e.target.checked)} style={{ accentColor: C.slate }} />
                Valor adiantado (app financeiro)
              </label>
              {wasAdvanced && (
                <div style={{ marginTop: 8 }}>
                  <label style={labelStyle}>Valor Recebido no Adiantamento (R$)</label>
                  <input type="number" step="0.01" placeholder="0.00" value={advanceValue} onChange={e => setAdvanceValue(e.target.value)} style={inputStyle} />
                  {parseFloat(advanceValue) > 0 && value > 0 && (
                    <>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.red, marginTop: 4 }}>
                        Taxa adiantamento: R$ {(value - parseFloat(advanceValue)).toFixed(2)} ({((1 - parseFloat(advanceValue) / value) * 100).toFixed(1)}%)
                      </div>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.amber, marginTop: 2 }}>
                        Comissao: {commissionPercentage}% sobre adiantado = R$ {(parseFloat(advanceValue) * parseFloat(commissionPercentage) / 100).toFixed(2)} (parcela unica)
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          {installments > 0 && value > 0 && (
            <div style={{ ...num, fontSize: 12, background: C.bg, padding: '10px 12px', border: `1px solid ${C.line}`, borderRadius: 8 }}>
              {entry > 0 && <div>Entrada: R$ {entry.toFixed(2)} <span style={{ color: C.mid }}>(1/{installments})</span></div>}
              {entry > 0 ? '+ ' : ''}{regularCount}x de R$ {installmentVal.toFixed(2)}
              <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>Total: {installments}x &middot; 1a parcela regular: {new Date(firstInstallmentDate + 'T12:00:00').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</div>
              {wasAdvanced && parseFloat(advanceValue) > 0 && (
                <div style={{ fontSize: 11, color: C.slate, marginTop: 2 }}>Adiantado: R$ {parseFloat(advanceValue).toFixed(2)}</div>
              )}
              {parseFloat(commissionPercentage) > 0 && !wasAdvanced && (
                <div style={{ fontSize: 11, color: C.amber, marginTop: 2 }}>Comissao: {commissionPercentage}% = R$ {(installmentVal * parseFloat(commissionPercentage) / 100).toFixed(2)}/parcela</div>
              )}
              {wasAdvanced && parseFloat(advanceValue) > 0 && parseFloat(commissionPercentage) > 0 && (
                <div style={{ fontSize: 11, color: C.amber, marginTop: 2 }}>Comissao: {commissionPercentage}% sobre adiantado = R$ {(parseFloat(advanceValue) * parseFloat(commissionPercentage) / 100).toFixed(2)} (parcela unica)</div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '10px', border: `1px solid ${C.line}`, borderRadius: 6, background: 'white', color: C.ink,
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              Cancelar
            </button>
            <button type="submit" disabled={submitting} style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: 6, background: C.green, color: 'white',
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: submitting ? 'wait' : 'pointer',
            }}>
              {submitting ? 'Fechando…' : 'Confirmar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

// ---- New Lead Modal ----
function NewLeadModal({
  onClose,
  onConfirm,
  products,
  salesRepSuggestions,
}: {
  onClose: () => void
  onConfirm: (data: {
    companyName: string
    responsible: string
    phone?: string
    whatsapp?: string
    email?: string
    leadSource?: string
    salesRep?: string
    estimatedRevenue?: string
    leadNotes?: string
    selectedModules?: string
    productInterest?: string
    cardResponsible?: string
  }) => Promise<void>
  products: Array<{ id: string; code: string; name: string }>
  salesRepSuggestions?: string[]
}) {
  const [companyName, setCompanyName] = useState('')
  const [responsible, setResponsible] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [leadSource, setLeadSource] = useState('')
  const [salesRep, setSalesRep] = useState('')
  const [estimatedRevenue, setEstimatedRevenue] = useState('')
  const [leadNotes, setLeadNotes] = useState('')
  const [productInterest, setProductInterest] = useState('')
  const [cardResponsible, setCardResponsible] = useState('')
  const [modules, setModules] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const isAura = products.find(p => p.id === productInterest)?.code === 'AURA'

  function toggleModule(code: string) {
    setModules(prev => prev.includes(code) ? prev.filter(m => m !== code) : [...prev, code])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!companyName.trim() || !responsible.trim()) {
      toast.error('Nome e responsavel sao obrigatorios')
      return
    }
    setSubmitting(true)
    try {
      await onConfirm({
        companyName: companyName.trim(),
        responsible: responsible.trim(),
        phone: phone.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        email: email.trim() || undefined,
        leadSource: leadSource || undefined,
        salesRep: salesRep.trim() || undefined,
        estimatedRevenue: estimatedRevenue.trim() || undefined,
        leadNotes: leadNotes.trim() || undefined,
        selectedModules: modules.length > 0 ? JSON.stringify(modules) : undefined,
        productInterest: productInterest || undefined,
        cardResponsible: cardResponsible || undefined,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: CSSProperties = {
    width: '100%', padding: '8px 10px', border: `1px solid ${C.line}`, borderRadius: 6,
    fontFamily: 'var(--font-sans)', fontSize: 13, background: 'white',
  }
  const labelStyle: CSSProperties = {
    fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: C.mid,
    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4, display: 'block',
  }

  const hasData = companyName.trim() || responsible.trim() || phone.trim() || email.trim()

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target !== e.currentTarget) return
    if (hasData) {
      if (!confirm('Tem certeza que deseja sair? Os dados preenchidos serao perdidos.')) return
    }
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={handleBackdropClick}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'white', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
          width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ background: C.ink, color: 'white', padding: '12px 16px', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600 }}>
          Novo lead
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Empresa / Nome *</label>
            <input value={companyName} onChange={e => setCompanyName(e.target.value)} style={inputStyle} required />
          </div>
          <div>
            <label style={labelStyle}>Responsável *</label>
            <input value={responsible} onChange={e => setResponsible(e.target.value)} style={inputStyle} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Telefone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>WhatsApp</label>
              <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Origem</label>
              <select value={leadSource} onChange={e => setLeadSource(e.target.value)} style={inputStyle}>
                <option value="">Selecione...</option>
                {LEAD_SOURCE_OPTIONS.map(src => (
                  <option key={src} value={src}>{LEAD_SOURCE_LABELS[src]}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Vendedor</label>
              <input list="salesrep-list" value={salesRep} onChange={e => setSalesRep(e.target.value)} style={inputStyle} />
              <datalist id="salesrep-list">
                {(salesRepSuggestions ?? []).map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Responsavel</label>
            <select value={cardResponsible} onChange={e => setCardResponsible(e.target.value)} style={inputStyle}>
              <option value="">Selecione...</option>
              <option value="JOAO">João</option>
              <option value="SOCIAL_SELLING">Social Selling</option>
              <option value="CLOSER">Closer</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Faturamento</label>
            <input value={estimatedRevenue} onChange={e => setEstimatedRevenue(e.target.value)} placeholder="Ex: R$500k, 2 milhoes..." style={inputStyle} />
          </div>
          {/* Programa de interesse */}
          <div>
            <label style={labelStyle}>Programa Negociado</label>
            <select value={productInterest} onChange={e => { setProductInterest(e.target.value); if (products.find(p => p.id === e.target.value)?.code !== 'AURA') setModules([]) }} style={inputStyle}>
              <option value="">Selecione...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
            </select>
          </div>
          {/* AURA 360 Modules - só aparece quando AURA selecionado */}
          {isAura && (
            <div>
              <label style={labelStyle}>Modulos AURA 360</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {AURA_MODULES.map(m => (
                  <label key={m.code} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)', fontSize: 12, cursor: 'pointer', padding: '6px 8px', borderRadius: 6, background: modules.includes(m.code) ? '#D4A017' : C.bg, color: modules.includes(m.code) ? 'white' : C.ink, border: `1px solid ${modules.includes(m.code) ? '#D4A017' : C.line}` }}>
                    <input type="checkbox" checked={modules.includes(m.code)} onChange={() => toggleModule(m.code)} style={{ accentColor: '#D4A017' }} />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label style={labelStyle}>Observacoes</label>
            <textarea value={leadNotes} onChange={e => setLeadNotes(e.target.value)} rows={3}
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '10px', border: `1px solid ${C.line}`, borderRadius: 6, background: 'white', color: C.ink,
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              Cancelar
            </button>
            <button type="submit" disabled={submitting} style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: 6, background: C.ink, color: 'white',
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: submitting ? 'wait' : 'pointer',
            }}>
              {submitting ? 'Salvando…' : 'Criar lead'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

// ---- Interaction / Timeline Types ----
interface Interaction {
  id: string
  type: string
  description: string
  userName: string | null
  scheduledAt: string | null
  createdAt: string
}

interface CrmMetrics {
  byStage: Record<string, number>
  newThisMonth: number
  closedThisMonth: number
  closedValueThisMonth: number
  lostThisMonth: number
  conversionRate: number
  avgDaysInStage: number
  staleLeads: number
  pendingFollowUps: number
  bySalesRep: Record<string, { total: number; closed: number; lost: number; value: number }>
  // structured blocks
  cards: {
    leadsAtivos: number
    novosNoPeriodo: number
    qualificados: number
    reunioesAgendadas: number
    propostasEnviadas: number
    emNegociacao: number
    fechadosGanho: number
    fechadosPerdido: number
    valorTotalFechado: number
    ticketMedio: number
  }
  funnel: Array<{ stage: string; count: number; conversionFromPrev: number | null }>
  bottleneck: string | null
  meetings: {
    agendadas: number
    feitas: number
    canceladas: number
    reagendadas: number
    noShow: number
    scheduled: number
    showRate: number
    feitasPct: number
    canceladasPct: number
    reagendadasPct: number
  }
  bySource: Array<{ source: string; leads: number; qualified: number; closed: number; conversion: number }>
  icp: { dentro: number; fora: number; naoInformado: number; byBand: Record<string, number> }
  filterApplied: string
}

interface CommissionItem {
  id: string
  salesRep: string
  percentage: number
  baseValue: number
  value: number
  installment: number
  totalInstallments: number
  status: string
}

// ---- Lead Detail Modal with Timeline ----
function LeadDetailModal({
  lead,
  onClose,
  onCloseDeal,
  onDelete,
  onUpdated,
  suggestions,
}: {
  lead: LeadItem
  onClose: () => void
  onCloseDeal: () => void
  onDelete: () => void
  onUpdated: () => void
  suggestions?: { salesReps: string[]; mentors: string[] }
}) {
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [commissions, setCommissions] = useState<CommissionItem[]>([])
  const [stage, setStage] = useState(lead.leadStage)
  const [movingStage, setMovingStage] = useState(false)
  const [showMovePicker, setShowMovePicker] = useState(false)

  // mover de etapa sem arrastar / sem fechar o card
  async function changeStage(toStage: string) {
    if (toStage === stage || movingStage) return
    if (toStage === 'FECHADO') { onCloseDeal(); return } // usa o fluxo de fechar venda
    setMovingStage(true)
    try {
      await apiFetch(`/api/crm/${lead.id}/stage`, { method: 'PATCH', body: JSON.stringify({ toStage }) })
      setStage(toStage)
      toast.success(`Movido para ${LEAD_STAGE_LABELS[toStage] ?? toStage}`)
      onUpdated()
    } catch { toast.error('Erro ao mover etapa') } finally { setMovingStage(false) }
  }
  const [newType, setNewType] = useState('NOTA')
  const [newDesc, setNewDesc] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Quick schedule meeting
  const [showSchedule, setShowSchedule] = useState(false)
  const [schedDate, setSchedDate] = useState(new Date().toISOString().split('T')[0])
  const [schedTime, setSchedTime] = useState('10:00')
  const [schedTitle, setSchedTitle] = useState('Reuniao Comercial')
  const [schedNotes, setSchedNotes] = useState('')
  const [scheduling, setScheduling] = useState(false)

  async function handleScheduleMeeting(e: React.FormEvent) {
    e.preventDefault()
    if (!schedDate || !schedTitle) return
    setScheduling(true)
    try {
      await apiFetch('/api/meetings', {
        method: 'POST',
        body: JSON.stringify({
          clientId: lead.id,
          title: schedTitle,
          type: 'COMERCIAL',
          date: new Date(schedDate + 'T' + schedTime + ':00').toISOString(),
          duration: 30,
          notes: schedNotes || undefined,
        }),
      })
      toast.success('Reuniao agendada com ' + lead.companyName)
      setShowSchedule(false)
      setSchedNotes('')
    } catch { toast.error('Erro ao agendar') }
    setScheduling(false)
  }

  // Editable fields
  const [editing, setEditing] = useState(false)
  const [editCompanyName, setEditCompanyName] = useState(lead.companyName)
  const [editResponsible, setEditResponsible] = useState(lead.responsible)
  const [editPhone, setEditPhone] = useState(lead.phone ?? '')
  const [editWhatsapp, setEditWhatsapp] = useState(lead.whatsapp ?? '')
  const [editEmail, setEditEmail] = useState(lead.email ?? '')
  const [editSaleValue, setEditSaleValue] = useState(lead.saleValue?.toString() ?? '')
  const [editInstallments, setEditInstallments] = useState(lead.saleInstallments?.toString() ?? '')
  const [editInstallmentValue, setEditInstallmentValue] = useState(lead.installmentValue?.toString() ?? '')
  const [editEntryValue, setEditEntryValue] = useState(lead.entryValue?.toString() ?? '')
  const [editPaymentMethod, setEditPaymentMethod] = useState(lead.paymentMethod ?? '')
  const [editSalesRep, setEditSalesRep] = useState(lead.salesRep ?? '')
  const [editSuggestedProduct, setEditSuggestedProduct] = useState(lead.suggestedProduct ?? '')
  const [editCardResponsible, setEditCardResponsible] = useState(lead.cardResponsible ?? '')
  const [editEstimatedRevenue, setEditEstimatedRevenue] = useState(lead.estimatedRevenue ?? '')
  const [editLeadNotes, setEditLeadNotes] = useState(lead.leadNotes ?? '')
  const [saving, setSaving] = useState(false)

  const loadInteractions = useCallback(async () => {
    try {
      const data = await apiFetch<Interaction[]>(`/api/crm/${lead.id}/interactions`)
      setInteractions(data)
    } catch { /* ignore */ }
  }, [lead.id])

  const [plans, setPlans] = useState<Array<{ id: string; value: number; installments: number; status: string; startDate: string; product: { code: string; name: string } }>>([])
  const [mentors, setMentors] = useState<Record<string, Array<{ id: string; mentorName: string; value: number; notes: string | null }>>>({})
  const [addingMentor, setAddingMentor] = useState<string | null>(null)
  const [newMentorName, setNewMentorName] = useState('')
  const [newMentorValue, setNewMentorValue] = useState('')
  const [newMentorNotes, setNewMentorNotes] = useState('')
  const [savingMentor, setSavingMentor] = useState(false)

  const loadCommissions = useCallback(async () => {
    if (lead.leadStage !== 'FECHADO') return
    try {
      const data = await apiFetch<{ data: CommissionItem[] }>(`/api/commissions?clientId=${lead.id}&limit=50`)
      setCommissions(data.data ?? [])
    } catch { /* ignore */ }
  }, [lead.id, lead.leadStage])

  const loadPlans = useCallback(async () => {
    try {
      const data = await apiFetch<Array<{ id: string; value: number; installments: number; status: string; startDate: string; product: { code: string; name: string } }>>(`/api/clients/${lead.id}/plans`)
      setPlans(data ?? [])
    } catch { /* ignore */ }
  }, [lead.id])

  const loadMentors = useCallback(async (planId: string) => {
    try {
      const data = await apiFetch<Array<{ id: string; mentorName: string; value: number; notes: string | null }>>(`/api/plans/${planId}/mentors`)
      setMentors(prev => ({ ...prev, [planId]: data }))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadInteractions() }, [loadInteractions])
  useEffect(() => { loadCommissions() }, [loadCommissions])
  useEffect(() => { loadPlans() }, [loadPlans])
  useEffect(() => { plans.forEach(p => loadMentors(p.id)) }, [plans, loadMentors])

  async function handleAddInteraction(e: React.FormEvent) {
    e.preventDefault()
    if (!newDesc.trim()) return
    setSubmitting(true)
    try {
      await apiFetch(`/api/crm/${lead.id}/interactions`, {
        method: 'POST',
        body: JSON.stringify({ type: newType, description: newDesc }),
      })
      setNewDesc('')
      loadInteractions()
    } catch { /* ignore */ }
    setSubmitting(false)
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  const fmtTime = (d: string) => {
    const date = new Date(d)
    return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  }

  const daysInStage = lead.stageChangedAt
    ? Math.floor((Date.now() - new Date(lead.stageChangedAt).getTime()) / (1000 * 60 * 60 * 24))
    : Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24))

  const inputStyle: CSSProperties = { width: '100%', padding: '6px 10px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: 'var(--font-sans)', fontSize: 12 }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'white', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)', width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto' }}>
        {/* Header */}
        <div style={{ background: LEAD_STAGE_COLORS[stage] ?? C.ink, color: 'white', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, flex: 1 }}>{lead.companyName}</span>
          <span style={{ ...num, fontSize: 11, opacity: 0.85 }}>{LEAD_STAGE_LABELS[stage] ?? stage} · {daysInStage}d</span>
          <button onClick={onClose} title="Fechar" style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><X size={15} strokeWidth={3} /></button>
        </div>

        <div style={{ padding: 16 }}>
          {/* Info Grid - with edit button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.mid }}>Dados</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {!editing && (
                <button onClick={() => setEditing(true)} style={{ background: C.ink, color: 'white', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600 }}>Editar</button>
              )}
              <button onClick={onDelete} title="Excluir lead" style={{ background: 'white', color: C.red, border: '1px solid #fecaca', padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: 6 }}><Trash2 size={13} /></button>
            </div>
          </div>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 3 }}>EMPRESA</label>
                  <input value={editCompanyName} onChange={e => setEditCompanyName(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 3 }}>RESPONSAVEL</label>
                  <input value={editResponsible} onChange={e => setEditResponsible(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 3 }}>TELEFONE</label>
                  <input value={editPhone} onChange={e => setEditPhone(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 3 }}>WHATSAPP</label>
                  <input value={editWhatsapp} onChange={e => setEditWhatsapp(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 3 }}>EMAIL</label>
                <input value={editEmail} onChange={e => setEditEmail(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 3 }}>VENDEDOR</label>
                  <input list="edit-salesrep-list" value={editSalesRep} onChange={e => setEditSalesRep(e.target.value)} style={inputStyle} />
                  <datalist id="edit-salesrep-list">
                    {(suggestions?.salesReps ?? []).map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 3 }}>PROGRAMA SUGERIDO</label>
                  <select value={editSuggestedProduct} onChange={e => setEditSuggestedProduct(e.target.value)} style={inputStyle}>
                    <option value="">Selecione...</option>
                    <option value="GE">GE - GOON ELITE</option>
                    <option value="GI">GI - GOON INFINITY</option>
                    <option value="TTS">TTS - TIKTOK SCALE</option>
                    <option value="AURA">AURA 360</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 3 }}>RESPONSAVEL</label>
                  <select value={editCardResponsible} onChange={e => setEditCardResponsible(e.target.value)} style={inputStyle}>
                    <option value="">Selecione...</option>
                    <option value="JOAO">João</option>
                    <option value="SOCIAL_SELLING">Social Selling</option>
                    <option value="CLOSER">Closer</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 3 }}>FATURAMENTO</label>
                  <input value={editEstimatedRevenue} onChange={e => setEditEstimatedRevenue(e.target.value)} placeholder="Ex: R$500k" style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 3 }}>PAGAMENTO</label>
                  <select value={editPaymentMethod} onChange={e => setEditPaymentMethod(e.target.value)} style={inputStyle}>
                    <option value="">-</option>
                    <option value="BOLETO">Boleto</option>
                    <option value="PIX">PIX</option>
                    <option value="CARTAO">Cartao</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                <div>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 3 }}>VALOR (R$)</label>
                  <input type="number" step="0.01" value={editSaleValue} onChange={e => setEditSaleValue(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 3 }}>ENTRADA</label>
                  <input type="number" step="0.01" placeholder="0" value={editEntryValue} onChange={e => setEditEntryValue(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 3 }}>PARCELAS (total)</label>
                  <input type="number" min="1" value={editInstallments} onChange={e => setEditInstallments(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 3 }}>VLR PARCELA</label>
                  <input type="number" step="0.01" value={editInstallmentValue} onChange={e => setEditInstallmentValue(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 3 }}>OBSERVACOES</label>
                <textarea value={editLeadNotes} onChange={e => setEditLeadNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setEditing(false)} style={{ flex: 1, padding: '8px', border: `1px solid ${C.line}`, borderRadius: 6, background: 'white', color: C.ink, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                <button disabled={saving} onClick={async () => {
                  setSaving(true)
                  try {
                    await apiFetch(`/api/clients/${lead.id}`, {
                      method: 'PUT',
                      body: JSON.stringify({
                        companyName: editCompanyName.trim() || undefined,
                        responsible: editResponsible.trim() || undefined,
                        phone: editPhone.trim() || null,
                        whatsapp: editWhatsapp.trim() || null,
                        email: editEmail.trim() || null,
                        salesRep: editSalesRep.trim() || null,
                        suggestedProduct: editSuggestedProduct || null,
                        cardResponsible: editCardResponsible || null,
                        estimatedRevenue: editEstimatedRevenue.trim() || null,
                        paymentMethod: editPaymentMethod || null,
                        saleValue: parseFloat(editSaleValue) || null,
                        saleInstallments: parseInt(editInstallments) || null,
                        installmentValue: parseFloat(editInstallmentValue) || null,
                        entryValue: parseFloat(editEntryValue) || null,
                        leadNotes: editLeadNotes.trim() || null,
                      }),
                    })
                    toast.success('Dados atualizados')
                    setEditing(false)
                    onUpdated()
                  } catch { toast.error('Erro ao salvar') }
                  setSaving(false)
                }} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 6, background: C.green, color: 'white', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, fontFamily: 'var(--font-sans)', fontSize: 12, color: C.ink }}>
              <div><strong>Responsavel:</strong> {lead.responsible}</div>
              <div><strong>Vendedor:</strong> {lead.salesRep ?? '-'}</div>
              <div><strong>Telefone:</strong> {lead.phone ?? '-'}</div>
              <div><strong>WhatsApp:</strong> {lead.whatsapp ?? '-'}</div>
              <div><strong>Email:</strong> {lead.email ?? '-'}</div>
              <div><strong>Origem:</strong> {lead.leadSource ? (LEAD_SOURCE_LABELS[lead.leadSource] ?? lead.leadSource) : '-'}</div>
              <div><strong>Programa:</strong> {lead.suggestedProduct ?? lead.productCode ?? '-'}</div>
              {lead.estimatedRevenue && <div><strong>Faturamento:</strong> {lead.estimatedRevenue}</div>}
              {lead.saleValue && <div><strong>Valor:</strong> {fmt(lead.saleValue)}</div>}
              {lead.saleInstallments && (
                lead.entryValue && lead.entryValue > 0 ? (
                  <div><strong>Parcelas:</strong> {lead.saleInstallments}x (entrada {fmt(lead.entryValue)} + {lead.saleInstallments - 1}x {lead.installmentValue ? fmt(lead.installmentValue) : ''})</div>
                ) : (
                  <div><strong>Parcelas:</strong> {lead.saleInstallments}x {lead.installmentValue ? fmt(lead.installmentValue) : ''}</div>
                )
              )}
              {lead.paymentMethod && <div><strong>Pagamento:</strong> {lead.paymentMethod}</div>}
              <div><strong>Criado:</strong> {fmtTime(lead.createdAt)}</div>
              {lead.closedAt && <div><strong>Fechado:</strong> {fmtTime(lead.closedAt)}</div>}
            </div>
          )}
          {/* AURA Modules */}
          {lead.selectedModules && (() => {
            let mods: string[] = []
            try { mods = JSON.parse(lead.selectedModules) } catch { /* ignore */ }
            return mods.length > 0 ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.mid, marginBottom: 6 }}>Modulos AURA 360</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {mods.map(m => {
                    const mod = AURA_MODULES.find(a => a.code === m)
                    return <span key={m} style={{ background: '#D4A017', color: 'white', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>{mod?.label ?? m}</span>
                  })}
                </div>
              </div>
            ) : null
          })()}
          {lead.leadNotes && (
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.ink, background: C.bg, padding: 12, border: `1px solid ${C.line}`, borderRadius: 8, marginBottom: 16 }}>
              <strong>Notas:</strong> {lead.leadNotes}
            </div>
          )}

          {/* WhatsApp link */}
          {lead.whatsapp && (
            <a href={`https://wa.me/55${lead.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-block', background: '#25d366', color: 'white', padding: '7px 14px', border: 'none', borderRadius: 6, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, textDecoration: 'none', marginBottom: 16 }}>
              Abrir WhatsApp
            </a>
          )}

          {/* Add Interaction */}
          {/* Quick Schedule Meeting */}
          <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12, marginBottom: 12 }}>
            {!showSchedule ? (
              <button onClick={() => setShowSchedule(true)} style={{
                width: '100%', padding: '10px', border: 'none', borderRadius: 6, background: C.green, color: 'white',
                fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>Agendar reunião comercial</button>
            ) : (
              <form onSubmit={handleScheduleMeeting} style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: 12 }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.mid, marginBottom: 8 }}>Agendar reunião</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input value={schedTitle} onChange={e => setSchedTitle(e.target.value)} placeholder="Titulo" style={{ ...inputStyle, flex: 1, fontSize: 11, padding: '5px 8px' }} />
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} style={{ ...inputStyle, fontSize: 11, padding: '5px 8px' }} />
                  <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} style={{ ...inputStyle, width: 90, fontSize: 11, padding: '5px 8px' }} />
                </div>
                <input value={schedNotes} onChange={e => setSchedNotes(e.target.value)} placeholder="Observacoes..." style={{ ...inputStyle, fontSize: 11, padding: '5px 8px', marginBottom: 6, width: '100%' }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => setShowSchedule(false)} style={{ flex: 1, padding: '7px', border: `1px solid ${C.line}`, borderRadius: 6, background: 'white', color: C.ink, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                  <button type="submit" disabled={scheduling} style={{ flex: 1, padding: '7px', border: 'none', borderRadius: 6, background: C.green, color: 'white', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700, cursor: scheduling ? 'wait' : 'pointer' }}>
                    {scheduling ? 'Agendando…' : 'Confirmar'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <form onSubmit={handleAddInteraction} style={{ marginBottom: 16, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.mid, marginBottom: 8 }}>Registrar interação</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={newType} onChange={e => setNewType(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
                {Object.entries(INTERACTION_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <input placeholder="Descreva..." value={newDesc} onChange={e => setNewDesc(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              <button type="submit" disabled={submitting} style={{ background: C.ink, color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>+</button>
            </div>
          </form>

          {/* Timeline */}
          <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.mid, marginBottom: 8 }}>Timeline ({interactions.length})</div>
            {interactions.length === 0 ? (
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.dim, padding: 10 }}>Nenhuma interacao registrada</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {interactions.map(i => (
                  <div key={i.id} style={{ display: 'flex', gap: 8, padding: '9px 10px', background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, fontFamily: 'var(--font-sans)', fontSize: 12, color: C.ink }}>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>{INTERACTION_ICONS[i.type] ?? '📝'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{INTERACTION_TYPES[i.type] ?? i.type}</strong>
                        <span style={{ fontSize: 10, color: C.dim }}>{fmtTime(i.createdAt)}</span>
                      </div>
                      <div style={{ marginTop: 2 }}>{i.description}</div>
                      {i.userName && <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>por {i.userName}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Plans + Mentors */}
          {plans.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12, marginTop: 8 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.mid, marginBottom: 8 }}>Planos ({plans.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {plans.map(p => {
                  const planMentors = mentors[p.id] ?? []
                  const totalMentors = planMentors.reduce((s, m) => s + m.value, 0)
                  return (
                    <div key={p.id} style={{ border: `1px solid ${C.line}`, borderRadius: 8, background: C.bg, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 10px', fontFamily: 'var(--font-sans)', fontSize: 12, color: C.ink }}>
                        <span style={{ fontWeight: 700 }}>{p.product.code} — {p.product.name}</span>
                        <span style={num}>{fmt(p.value)} · {p.installments ?? 1}x</span>
                        <span style={{ background: p.status === 'ACTIVE' ? C.green : p.status === 'CANCELLED' ? C.red : C.dim, color: 'white', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600 }}>
                          {p.status === 'ACTIVE' ? 'ATIVO' : p.status === 'CANCELLED' ? 'CANCELADO' : p.status}
                        </span>
                      </div>
                      {/* Mentors */}
                      <div style={{ padding: '6px 10px 8px', borderTop: `1px solid ${C.line}` }}>
                        {planMentors.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
                            {planMentors.map(m => (
                              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontFamily: 'var(--font-sans)', fontSize: 11, color: C.ink }}>
                                <span>{m.mentorName}</span>
                                <span style={{ ...num, fontWeight: 700 }}>{fmt(m.value)}</span>
                                <button onClick={async () => {
                                  if (!confirm(`Remover ${m.mentorName}?`)) return
                                  await apiFetch(`/api/mentors/${m.id}`, { method: 'DELETE' })
                                  loadMentors(p.id)
                                }} style={{ background: C.red, color: 'white', border: 'none', borderRadius: 4, padding: '1px 7px', fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>X</button>
                              </div>
                            ))}
                            <div style={{ ...num, fontSize: 10, color: C.mid, textAlign: 'right' }}>
                              Total mentoria: {fmt(totalMentors)} | Saldo: {fmt(p.value - totalMentors)}
                            </div>
                          </div>
                        )}
                        {addingMentor === p.id ? (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <input list="mentor-list" placeholder="Nome" value={newMentorName} onChange={e => setNewMentorName(e.target.value)} style={{ ...inputStyle, flex: '1 1 100px', fontSize: 11, padding: '5px 7px' }} />
                            <datalist id="mentor-list">
                              {(suggestions?.mentors ?? []).map(s => <option key={s} value={s} />)}
                            </datalist>
                            <input type="number" placeholder="Valor" step="0.01" value={newMentorValue} onChange={e => setNewMentorValue(e.target.value)} style={{ ...inputStyle, width: 80, fontSize: 11, padding: '5px 7px' }} />
                            <button disabled={savingMentor} onClick={async () => {
                              if (!newMentorName.trim() || !parseFloat(newMentorValue)) return
                              setSavingMentor(true)
                              try {
                                await apiFetch(`/api/plans/${p.id}/mentors`, {
                                  method: 'POST',
                                  body: JSON.stringify({ mentorName: newMentorName.trim(), value: parseFloat(newMentorValue), notes: newMentorNotes.trim() || undefined }),
                                })
                                toast.success(`${newMentorName} atribuido!`)
                                setAddingMentor(null)
                                setNewMentorName('')
                                setNewMentorValue('')
                                setNewMentorNotes('')
                                loadMentors(p.id)
                                onUpdated()
                              } catch { toast.error('Erro ao atribuir mentor') }
                              setSavingMentor(false)
                            }} style={{ background: C.green, color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 700 }}>OK</button>
                            <button onClick={() => setAddingMentor(null)} style={{ background: 'white', border: `1px solid ${C.line}`, borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: C.ink }}>X</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <button onClick={() => setAddingMentor(p.id)} style={{ background: 'white', border: `1px dashed ${C.dim}`, borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: C.mid, flex: 1 }}>+ Atribuir mentor</button>
                            {p.value - totalMentors > 0 && (
                              <span style={{ ...num, fontSize: 10, color: C.slate, marginLeft: 6 }}>Disponivel: {fmt(p.value - totalMentors)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Closed Deal Data is now in the unified edit above */}

          {/* Commissions for closed deals */}
          {lead.leadStage === 'FECHADO' && commissions.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12, marginTop: 8 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.mid, marginBottom: 8 }}>Comissões ({commissions.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {commissions.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 10px', background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, fontFamily: 'var(--font-sans)', fontSize: 12, color: C.ink }}>
                    <span>{c.salesRep} — {c.installment}/{c.totalInstallments}</span>
                    <span style={{ ...num, fontWeight: 700 }}>{fmt(c.value)}</span>
                    <span style={{ background: c.status === 'PAID' ? C.green : c.status === 'PENDING' ? C.amber : C.red, color: 'white', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600 }}>{c.status === 'PAID' ? 'PAGO' : c.status === 'PENDING' ? 'PENDENTE' : 'CANCELADO'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ marginTop: 16, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
            {showMovePicker && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, padding: 10, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8 }}>
                {LEAD_STAGES.filter(s => s !== stage && s !== 'FECHADO').map(s => (
                  <button key={s} onClick={() => { changeStage(s); setShowMovePicker(false) }} disabled={movingStage}
                    style={{ padding: '6px 12px', border: `1px solid ${LEAD_STAGE_COLORS[s] ?? C.line}`, background: 'white', color: LEAD_STAGE_COLORS[s] ?? C.ink, fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, cursor: 'pointer', borderRadius: 6 }}>
                    {LEAD_STAGE_LABELS[s] ?? s}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowMovePicker(v => !v)} style={{ flex: 1, padding: '10px', border: `1px solid ${C.ink}`, borderRadius: 6, background: showMovePicker ? C.ink : 'white', color: showMovePicker ? 'white' : C.ink, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Mover</button>
              {stage !== 'FECHADO' && stage !== 'PERDIDO' && (
                <button onClick={onCloseDeal} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 6, background: C.green, color: 'white', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Fechar negócio</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Main Page ----
export default function CrmPage() {
  const [leads, setLeads] = useState<LeadItem[]>([])
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Array<{ id: string; code: string; name: string }>>([])
  const [closingLead, setClosingLead] = useState<LeadItem | null>(null)
  const [detailLead, setDetailLead] = useState<LeadItem | null>(null)
  const [showNewLead, setShowNewLead] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [metrics, setMetrics] = useState<CrmMetrics | null>(null)
  const [suggestions, setSuggestions] = useState<{ salesReps: string[]; mentors: string[] }>({ salesReps: [], mentors: [] })
  const [crmTab, setCrmTab] = useState<'pipeline' | 'agenda' | 'dashboard'>('pipeline')
  const [dashPeriod, setDashPeriod] = useState<'dia' | 'semana' | 'mes' | 'ano'>('mes')
  const [commercialMeetings, setCommercialMeetings] = useState<Array<{ id: string; title: string; type: string; category?: string; date: string; duration: number; mentorName: string | null; notes: string | null; status: string; client?: { id: string; companyName: string } | null }>>([])
  const [comMonth, setComMonth] = useState(new Date().getMonth())
  const [comYear, setComYear] = useState(new Date().getFullYear())
  const [comSelectedDate, setComSelectedDate] = useState<string | null>(null)

  const loadCommercialMeetings = useCallback(async () => {
    if (crmTab !== 'agenda') return
    try {
      const data = await apiFetch<Array<typeof commercialMeetings[0]>>(`/api/meetings?year=${comYear}&month=${comMonth + 1}`)
      setCommercialMeetings(data.filter(m => m.type === 'COMERCIAL' || m.category === 'COMERCIAL'))
    } catch { /* ignore */ }
  }, [crmTab, comMonth, comYear])

  useEffect(() => { loadCommercialMeetings() }, [loadCommercialMeetings])
  const [searchQuery, setSearchQuery] = useState('')
  const [faturamentoFilter, setFaturamentoFilter] = useState('ALL')
  const [crmView, setCrmView] = useState<'kanban' | 'dashboard'>('kanban')
  const isMobile = useIsMobile()

  const PIPELINE_STAGES = LEAD_STAGES

  const fetchLeads = useCallback(async () => {
    try {
      const data = await apiFetch<LeadItem[]>('/api/crm/pipeline')
      setLeads(data)
    } catch {
      toast.error('Erro ao carregar pipeline')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchMetrics = useCallback(async () => {
    try {
      const qs = faturamentoFilter && faturamentoFilter !== 'ALL' ? `?faturamento=${faturamentoFilter}` : ''
      const data = await apiFetch<CrmMetrics>(`/api/crm/metrics${qs}`)
      setMetrics(data)
    } catch { /* ignore */ }
  }, [faturamentoFilter])

  useEffect(() => {
    fetchLeads()
    apiFetch<Array<{ id: string; code: string; name: string }>>('/api/products')
      .then(setProducts)
      .catch(() => {})
    apiFetch<{ salesReps: string[]; mentors: string[] }>('/api/crm/suggestions')
      .then(setSuggestions)
      .catch(() => {})
  }, [fetchLeads])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  async function handleStageChange(id: string, toStage: string) {
    const lead = leads.find(l => l.id === id)
    if (toStage === 'FECHADO' && lead) {
      setClosingLead(lead)
      return
    }
    try {
      await apiFetch(`/api/crm/${id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ toStage }),
      })
      toast.success(`Lead movido para ${LEAD_STAGE_LABELS[toStage] ?? toStage}`)
      fetchLeads()
    } catch {
      toast.error('Erro ao mover lead')
    }
  }

  // Persiste a nova ordem/coluna após arrastar um card no kanban.
  // O board já é otimista; só sincronizamos o backend e recarregamos.
  async function handleReorder(id: string, toStage: string, orderedIds: string[]) {
    try {
      await apiFetch('/api/crm/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ id, toStage, orderedIds }),
      })
      fetchLeads()
    } catch {
      toast.error('Erro ao reordenar')
      fetchLeads()
    }
  }

  async function handleCloseDeal(data: {
    saleValue: number
    paymentMethod: string
    saleInstallments: number
    installmentValue: number
    productId: string
  }) {
    if (!closingLead) return
    try {
      await apiFetch(`/api/crm/${closingLead.id}/close`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      toast.success(`${closingLead.companyName} fechado com sucesso!`)
      setClosingLead(null)
      fetchLeads()
    } catch {
      toast.error('Erro ao fechar negócio')
    }
  }

  async function handleCreateLead(data: Record<string, unknown>) {
    try {
      await apiFetch('/api/crm/leads', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      toast.success('Lead criado!')
      setShowNewLead(false)
      fetchLeads()
    } catch {
      toast.error('Erro ao criar lead')
    }
  }

  const activeLeads = leads.filter(l => {
    if (faturamentoFilter && faturamentoFilter !== 'ALL') {
      if (faturamentoFilter === 'ICP') { if (!l.isICP) return false }
      else if (faturamentoFilter === 'FORA') { if (l.isICP || l.faturamentoBand === 'NAO_INFORMADO') return false }
      else if (faturamentoFilter === 'NAO_INFORMADO') { if (l.faturamentoBand !== 'NAO_INFORMADO') return false }
      else if (l.faturamentoBand !== faturamentoFilter) return false
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!l.companyName.toLowerCase().includes(q) && !l.responsible.toLowerCase().includes(q) && !(l.email?.toLowerCase().includes(q)) && !(l.phone?.includes(q))) return false
    }
    return true
  })

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid }}>
        Carregando pipeline…
      </div>
    )
  }

  return (
    <div>
      {/* CRM Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: `1px solid ${C.line}`, overflowX: 'auto' }}>
        {(['dashboard', 'pipeline', 'agenda'] as const).map(tab => (
          <button key={tab} onClick={() => setCrmTab(tab)} style={{
            padding: '9px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: crmTab === tab ? 700 : 500,
            color: crmTab === tab ? C.ink : C.dim,
            borderBottom: crmTab === tab ? `2px solid ${C.neon}` : '2px solid transparent', marginBottom: -1,
          }}>
            {tab === 'pipeline' ? 'Pipeline' : tab === 'agenda' ? 'Agenda' : 'Dashboard'}
          </button>
        ))}
      </div>

      {/* CRM DASHBOARD */}
      {crmTab === 'dashboard' && (() => {
        const now = new Date()
        const periodStart = (() => {
          const d = new Date(now)
          if (dashPeriod === 'dia') { d.setHours(0,0,0,0); return d }
          if (dashPeriod === 'semana') { d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d }
          if (dashPeriod === 'mes') { return new Date(d.getFullYear(), d.getMonth(), 1) }
          return new Date(d.getFullYear(), 0, 1)
        })()
        const periodLabels: Record<string, string> = { dia: 'HOJE', semana: 'ESTA SEMANA', mes: 'ESTE MES', ano: 'ESTE ANO' }

        const totalLeads = leads.length
        const newLeadsPeriod = leads.filter(l => new Date(l.createdAt) >= periodStart).length
        const inNovo = leads.filter(l => l.leadStage === 'NOVO').length
        const inFollowUp = leads.filter(l => l.leadStage === 'FOLLOW_UP').length
        const inNegociacao = leads.filter(l => l.leadStage === 'EM_NEGOCIACAO').length
        const fechados = leads.filter(l => l.leadStage === 'FECHADO').length
        const fechadosPeriod = leads.filter(l => l.leadStage === 'FECHADO' && l.closedAt && new Date(l.closedAt) >= periodStart).length
        const valorFechadoPeriod = leads.filter(l => l.leadStage === 'FECHADO' && l.closedAt && new Date(l.closedAt) >= periodStart).reduce((s, l) => s + (l.saleValue ?? 0), 0)

        const comMeetingsRealizadas = commercialMeetings.filter(m => m.status === 'DONE' && new Date(m.date) >= periodStart).length
        const comMeetingsAgendadas = commercialMeetings.filter(m => m.status === 'SCHEDULED').length

        const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: C.ink, margin: 0 }}>Dashboard comercial</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${C.line}`, borderRadius: 100, padding: 4 }}>
                {(['dia', 'semana', 'mes', 'ano'] as const).map(p => (
                  <button key={p} onClick={() => setDashPeriod(p)} style={{
                    padding: '5px 12px', border: 'none', borderRadius: 100, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: dashPeriod === p ? C.ink : 'transparent', color: dashPeriod === p ? '#fff' : C.mid,
                  }}>{p === 'dia' ? 'Dia' : p === 'semana' ? 'Semana' : p === 'mes' ? 'Mês' : 'Ano'}</button>
                ))}
              </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Leads Ativos', value: String(totalLeads), color: C.ink },
                { label: 'Novos', value: String(newLeadsPeriod), color: C.slate },
                { label: 'Em Novo', value: String(inNovo), color: C.slate },
                { label: 'Follow Up', value: String(inFollowUp), color: C.slate },
                { label: 'Negociacao', value: String(inNegociacao), color: C.amber },
                { label: 'Fechados', value: String(fechadosPeriod), color: C.green },
                { label: 'Valor Fechado', value: fmtBRL(valorFechadoPeriod), color: C.greenDk },
                { label: 'Reunioes Feitas', value: String(comMeetingsRealizadas), color: C.greenDk },
                { label: 'Reunioes Agendadas', value: String(comMeetingsAgendadas), color: C.slate },
              ].map(kpi => (
                <div key={kpi.label} style={{ ...card, padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.mid }}>{kpi.label}</div>
                  <div style={{ ...num, fontSize: 22, fontWeight: 700, color: kpi.color, marginTop: 6 }}>{kpi.value}</div>
                </div>
              ))}
            </div>

            {/* Pipeline summary */}
            <div style={{ ...card, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: C.ink }}>Funil de vendas</div>
              <div style={{ padding: 16 }}>
                {[
                  { label: 'Novo', count: inNovo, color: C.slate, pct: totalLeads > 0 ? Math.round(inNovo / totalLeads * 100) : 0 },
                  { label: 'Follow Up', count: inFollowUp, color: C.slate, pct: totalLeads > 0 ? Math.round(inFollowUp / totalLeads * 100) : 0 },
                  { label: 'Em Negociacao', count: inNegociacao, color: C.amber, pct: totalLeads > 0 ? Math.round(inNegociacao / totalLeads * 100) : 0 },
                  { label: 'Fechado', count: fechados, color: C.green, pct: totalLeads > 0 ? Math.round(fechados / totalLeads * 100) : 0 },
                ].map(stage => (
                  <div key={stage.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: C.ink, width: 110 }}>{stage.label}</span>
                    <div style={{ flex: 1, height: 20, background: '#f1f5f9', borderRadius: 6, position: 'relative', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: stage.pct + '%', background: stage.color, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ ...num, fontSize: 12, fontWeight: 700, color: C.ink, width: 60, textAlign: 'right' }}>{stage.count} ({stage.pct}%)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Leads by seller */}
            {(() => {
              const bySeller: Record<string, number> = {}
              leads.forEach(l => { const rep = l.salesRep ?? 'Sem vendedor'; bySeller[rep] = (bySeller[rep] ?? 0) + 1 })
              return (
                <div style={{ ...card, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: C.ink }}>Leads por vendedor</div>
                  <div style={{ padding: '8px 16px' }}>
                    {Object.entries(bySeller).sort((a, b) => b[1] - a[1]).map(([rep, count]) => (
                      <div key={rep} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${C.bg}`, fontFamily: 'var(--font-sans)', fontSize: 12, color: C.ink }}>
                        <span style={{ fontWeight: 600 }}>{rep}</span>
                        <span style={{ ...num, color: C.mid }}>{count} leads</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

          </div>
        )
      })()}

      {/* AGENDA COMERCIAL */}
      {crmTab === 'agenda' && (() => {
        const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
        const daysInMonth = new Date(comYear, comMonth + 1, 0).getDate()
        const firstDay = new Date(comYear, comMonth, 1).getDay()
        const todayDay = new Date().getMonth() === comMonth && new Date().getFullYear() === comYear ? new Date().getDate() : -1
        const meetingsByDay: Record<number, typeof commercialMeetings> = {}
        commercialMeetings.forEach(m => {
          const d = new Date(m.date).getDate()
          if (!meetingsByDay[d]) meetingsByDay[d] = []
          meetingsByDay[d].push(m)
        })

        return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: C.ink, margin: 0 }}>Agenda comercial</h2>
            <a href="/agenda" style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: C.green, color: 'white', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
              + Agendar reunião
            </a>
          </div>

          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 12 }}>
            <button onClick={() => { if (comMonth === 0) { setComMonth(11); setComYear(y => y - 1) } else setComMonth(m => m - 1) }} style={{ padding: '4px 12px', border: 'none', background: 'transparent', color: C.mid, fontSize: 16, cursor: 'pointer' }}>‹</button>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: C.ink, minWidth: 150, textAlign: 'center' }}>{MONTH_NAMES[comMonth]} {comYear}</span>
            <button onClick={() => { if (comMonth === 11) { setComMonth(0); setComYear(y => y + 1) } else setComMonth(m => m + 1) }} style={{ padding: '4px 12px', border: 'none', background: 'transparent', color: C.mid, fontSize: 16, cursor: 'pointer' }}>›</button>
          </div>

          {/* Calendar */}
          <div style={{ ...card, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: C.bg, borderBottom: `1px solid ${C.line}` }}>
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(d => (
                <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.mid }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {Array.from({ length: firstDay }, (_, i) => <div key={'e' + i} style={{ minHeight: 60, borderRight: `1px solid ${C.bg}`, borderBottom: `1px solid ${C.bg}`, background: C.bg }} />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1
                const isToday = day === todayDay
                const dayMeetings = meetingsByDay[day] ?? []
                const dateStr = `${comYear}-${String(comMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                return (
                  <div key={day} onClick={() => setComSelectedDate(comSelectedDate === dateStr ? null : dateStr)} style={{
                    minHeight: 60, padding: 4, borderRight: `1px solid ${C.bg}`, borderBottom: `1px solid ${C.bg}`,
                    cursor: 'pointer', background: isToday ? 'rgba(199,249,0,0.10)' : comSelectedDate === dateStr ? '#f0fdf4' : 'white',
                  }}>
                    <div style={{ ...num, fontSize: 11, fontWeight: isToday ? 800 : 500, color: isToday ? C.greenDk : C.ink, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{day}</span>
                      {dayMeetings.length > 0 && <span style={{ background: C.green, color: 'white', borderRadius: '50%', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>{dayMeetings.length}</span>}
                    </div>
                    {dayMeetings.slice(0, 2).map(m => {
                      const mStyle: React.CSSProperties = { display: 'block', fontFamily: 'var(--font-sans)', fontSize: 8, padding: '1px 3px', marginTop: 2, background: C.green, color: 'white', borderRadius: 3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', opacity: m.status === 'DONE' ? 0.6 : 1, textDecoration: 'none', cursor: 'pointer' }
                      const mLabel = `${new Date(m.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ${m.client?.companyName ?? m.title}`
                      return m.client?.id ? (
                        <a key={m.id} href="#"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); const lead = leads.find(l => l.id === m.client!.id); if (lead) setDetailLead(lead) }}
                          title={`Abrir ${m.client.companyName}`} style={mStyle}>{mLabel}</a>
                      ) : (
                        <div key={m.id} style={mStyle}>{mLabel}</div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Selected day detail */}
          {comSelectedDate && (() => {
            const dayNum = parseInt(comSelectedDate.split('-')[2])
            const dayMeetings = meetingsByDay[dayNum] ?? []
            return (
              <div style={{ ...card, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ background: C.green, color: 'white', padding: '10px 16px', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>
                  {new Date(comSelectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <div style={{ padding: '4px 16px' }}>
                  {dayMeetings.length === 0 ? (
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.dim, textAlign: 'center', padding: 16 }}>Sem reunioes comerciais</div>
                  ) : dayMeetings.map(m => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.bg}`, gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        {m.client?.id ? (
                          <a href="#"
                            onClick={(e) => { e.preventDefault(); const lead = leads.find(l => l.id === m.client!.id); if (lead) setDetailLead(lead) }}
                            style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: C.ink, textDecoration: 'underline', cursor: 'pointer' }}
                          >{m.client.companyName}</a>
                        ) : (
                          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: C.ink }}>{m.title}</div>
                        )}
                        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.mid }}>
                          {new Date(m.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • {m.duration}min{m.mentorName && <> • {m.mentorName}</>}
                        </div>
                        {m.notes && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.dim, marginTop: 2 }}>{m.notes}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {m.status === 'SCHEDULED' && (
                          <>
                            <button onClick={async () => {
                              try { await apiFetch(`/api/meetings/${m.id}`, { method: 'PUT', body: JSON.stringify({ status: 'DONE' }) }); toast.success('Marcada como feita'); loadCommercialMeetings() } catch { toast.error('Erro') }
                            }} style={{ background: C.green, color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Feita</button>
                            <button onClick={async () => {
                              try { await apiFetch(`/api/meetings/${m.id}`, { method: 'PUT', body: JSON.stringify({ status: 'NO_SHOW' }) }); toast.success('Marcada como no-show'); loadCommercialMeetings() } catch { toast.error('Erro') }
                            }} style={{ background: C.amber, color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Faltou</button>
                            <button onClick={() => {
                              const newDate = prompt('Nova data (DD/MM/AAAA):', new Date(m.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }))
                              if (!newDate) return
                              const parts = newDate.split('/')
                              if (parts.length !== 3) { toast.error('Data invalida'); return }
                              const newTime = prompt('Horario (HH:MM):', new Date(m.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
                              if (!newTime) return
                              const dt = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10), parseInt(newTime.split(':')[0], 10), parseInt(newTime.split(':')[1], 10))
                              apiFetch(`/api/meetings/${m.id}`, { method: 'PUT', body: JSON.stringify({ date: dt.toISOString() }) })
                                .then(() => { toast.success('Reagendada para ' + newDate + ' ' + newTime); loadCommercialMeetings() })
                                .catch(() => toast.error('Erro ao reagendar'))
                            }} style={{ background: C.ink, color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Reagendar</button>
                            <button onClick={async () => {
                              if (!confirm('Cancelar esta reuniao?')) return
                              try { await apiFetch(`/api/meetings/${m.id}`, { method: 'PUT', body: JSON.stringify({ status: 'CANCELLED' }) }); toast.success('Reuniao cancelada'); loadCommercialMeetings() } catch { toast.error('Erro') }
                            }} style={{ background: C.red, color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Cancelar</button>
                          </>
                        )}
                        {m.status === 'DONE' && <span style={{ background: C.green, color: 'white', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>Feita</span>}
                        {m.status === 'NO_SHOW' && <span style={{ background: C.red, color: 'white', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>Faltou</span>}
                        {m.status === 'CANCELLED' && <span style={{ background: C.dim, color: 'white', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>Cancelada</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
        )
      })()}

      {/* PIPELINE */}
      {crmTab === 'pipeline' && <>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 18 : 22, fontWeight: 700, letterSpacing: '-0.02em', color: C.ink, margin: 0 }}>
            Pipeline
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid, margin: '2px 0 0' }}>Funil de vendas · arraste os cards entre as etapas</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={async () => {
              setSyncing(true)
              try {
                const res = await apiFetch<{ imported: number; skipped: number; errors: string[] }>('/api/crm/sync-sheets', { method: 'POST' })
                if (res.imported > 0) {
                  toast.success(`${res.imported} novos leads importados!`)
                  fetchLeads()
                  fetchMetrics()
                } else {
                  toast.info('Nenhum lead novo encontrado')
                }
                if (res.errors.length > 0) {
                  toast.error(res.errors.join(', '))
                }
              } catch {
                toast.error('Erro ao sincronizar')
              } finally {
                setSyncing(false)
              }
            }}
            disabled={syncing}
            style={{
              padding: '8px 16px', border: `1px solid ${C.line}`, borderRadius: 6, background: syncing ? C.dim : '#fff', color: syncing ? '#fff' : C.ink,
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, cursor: syncing ? 'wait' : 'pointer',
            }}
          >
            {syncing ? 'Sincronizando…' : 'Sincronizar leads'}
          </button>
          <button
            onClick={() => setShowNewLead(true)}
            style={{
              padding: '8px 16px', border: 'none', borderRadius: 6, background: C.neon, color: C.ink,
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            + Novo lead
          </button>
        </div>
      </div>

      {/* Busca */}
      <div style={{ marginBottom: 12 }}>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar lead por nome, responsavel, email ou telefone..."
          style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.line}`, borderRadius: 8, fontFamily: 'var(--font-sans)', fontSize: 13, background: '#fff' }}
        />
      </div>

      {/* Filter Chips */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        {/* Faturamento — por faixa (recorte) */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.mid }}>Faturamento:</span>
          {([
            ['ALL', 'TODOS'],
            ['ATE_50K', 'ATÉ 50K'],
            ['50_100K', '50–100K'],
            ['100_500K', '100–500K'],
            ['500K_1M', '500K–1M'],
            ['ACIMA_1M', '+1M'],
            ['NAO_INFORMADO', 'S/ INFO'],
          ] as const).map(([val, label]) => {
            const on = faturamentoFilter === val
            // faixas dentro do ICP (>=100k) destacam em verde quando ativas
            const icpBand = ['100_500K', '500K_1M', 'ACIMA_1M'].includes(val)
            const bg = on ? (icpBand ? C.green : C.ink) : '#fff'
            return (
              <button key={val} onClick={() => setFaturamentoFilter(val)} style={{
                padding: '5px 12px', border: `1px solid ${on ? 'transparent' : C.line}`, borderRadius: 100, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: bg, color: on ? 'white' : C.slate,
              }}>{label}</button>
            )
          })}
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.mid, marginLeft: 4 }}>
            {activeLeads.length} leads · {activeLeads.filter(l => l.isICP).length} no ICP
          </span>
        </div>
      </div>

      {/* View toggle: Kanban / Dashboard */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16, border: `1px solid ${C.line}`, borderRadius: 100, padding: 4, width: 'fit-content' }}>
        {(['kanban', 'dashboard'] as const).map(v => (
          <button key={v} onClick={() => setCrmView(v)} style={{
            padding: '6px 18px', border: 'none', borderRadius: 100, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: crmView === v ? C.ink : 'transparent', color: crmView === v ? '#fff' : C.mid,
          }}>{v === 'kanban' ? '▦ Kanban' : '▤ Dashboard'}</button>
        ))}
      </div>

      {crmView === 'dashboard' ? (
        <CrmDashboard
          metrics={metrics}
          faturamentoFilter={faturamentoFilter}
          setFaturamentoFilter={setFaturamentoFilter}
          isMobile={isMobile}
        />
      ) : (
      <>
      {/* KPI Strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)',
        gap: isMobile ? 8 : 12, marginBottom: 20,
      }}>
        {[
          { label: 'Leads Ativos', value: String(activeLeads.length), color: C.ink },
          { label: 'Novos (mes)', value: String(metrics?.newThisMonth ?? 0), color: C.slate },
          { label: 'Fechados (mes)', value: String(metrics?.closedThisMonth ?? 0), color: C.green },
          { label: 'Conversao', value: `${metrics?.conversionRate ?? 0}%`, color: C.amber },
          { label: 'Parados >7d', value: String(metrics?.staleLeads ?? 0), color: (metrics?.staleLeads ?? 0) > 0 ? C.red : C.dim },
        ].map(kpi => (
          <div key={kpi.label} style={{
            ...card, padding: isMobile ? '10px 8px' : '14px 16px',
          }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.mid }}>
              {kpi.label}
            </div>
            <div style={{ ...num, fontSize: isMobile ? 18 : 22, fontWeight: 700, color: kpi.color, marginTop: 6 }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Valor fechado + Performance vendedores */}
      {metrics && metrics.closedValueThisMonth > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ background: C.green, color: 'white', padding: '8px 16px', borderRadius: 8, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 12 }}>
            Fechado no mes: {fmtBRL(metrics.closedValueThisMonth)}
          </div>
          {Object.entries(metrics.bySalesRep).filter(([, v]) => v.closed > 0).map(([rep, v]) => (
            <div key={rep} style={{ background: C.bg, color: C.ink, padding: '8px 16px', border: `1px solid ${C.line}`, borderRadius: 8, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 12 }}>
              {rep}: {v.closed} fechados ({fmtBRL(v.value)})
            </div>
          ))}
        </div>
      )}

      <CrmKanbanBoard
        items={activeLeads}
        stages={PIPELINE_STAGES}
        onStageChange={handleStageChange}
        onReorder={handleReorder}
        onCardClick={(item) => {
          setDetailLead(item as unknown as LeadItem)
        }}
      />
      </>
      )}
      </>}

      {detailLead && (
        <LeadDetailModal
          lead={detailLead}
          onClose={() => setDetailLead(null)}
          onCloseDeal={() => {
            setClosingLead(detailLead)
            setDetailLead(null)
          }}
          onDelete={async () => {
            if (!confirm(`Excluir ${detailLead.companyName}? Isso remove o lead permanentemente.`)) return
            try {
              await apiFetch(`/api/clients/${detailLead.id}`, { method: 'DELETE' })
              toast.success('Cliente excluido')
              setDetailLead(null)
              fetchLeads()
              fetchMetrics()
            } catch { toast.error('Erro ao excluir') }
          }}
          onUpdated={() => {
            fetchLeads()
            fetchMetrics()
          }}
          suggestions={suggestions}
        />
      )}
      {closingLead && (
        <CloseDealModal
          lead={closingLead}
          products={products}
          onClose={() => setClosingLead(null)}
          onConfirm={handleCloseDeal}
        />
      )}
      {showNewLead && (
        <NewLeadModal
          onClose={() => setShowNewLead(false)}
          onConfirm={handleCreateLead}
          products={products}
          salesRepSuggestions={suggestions.salesReps}
        />
      )}
    </div>
  )
}

// ============== CRM DASHBOARD (4 blocos) ==============
function CrmDashboard({ metrics, faturamentoFilter, setFaturamentoFilter, isMobile }: {
  metrics: CrmMetrics | null
  faturamentoFilter: string
  setFaturamentoFilter: (v: string) => void
  isMobile: boolean
}) {
  if (!metrics) {
    return <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid, padding: 24 }}>Carregando metricas...</div>
  }
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
  const { cards, funnel, bottleneck, meetings, bySource, icp } = metrics
  const maxFunnel = Math.max(1, ...funnel.map(f => f.count))

  const titleStyle: CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: C.ink, margin: '24px 0 12px', display: 'flex', alignItems: 'center', gap: 10 }
  const box: CSSProperties = { ...card, padding: isMobile ? '10px 8px' : '14px 16px' }

  const card1 = [
    { label: 'Leads Ativos', value: String(cards.leadsAtivos), color: C.ink },
    { label: 'Novos (mes)', value: String(cards.novosNoPeriodo), color: C.slate },
    { label: 'Qualificados', value: String(cards.qualificados), color: C.slate },
    { label: 'Reunioes Agend.', value: String(cards.reunioesAgendadas), color: C.slate },
    { label: 'Proposta / Negoc.', value: String(cards.emNegociacao), color: C.amber },
    { label: 'Fechados Ganho', value: String(cards.fechadosGanho), color: C.green },
    { label: 'Fechados Perdido', value: String(cards.fechadosPerdido), color: C.red },
    { label: 'Valor Fechado', value: fmt(cards.valorTotalFechado), color: C.greenDk },
    { label: 'Ticket Medio', value: fmt(cards.ticketMedio), color: C.greenDk },
  ]

  const mtgCards = [
    { label: 'Agendadas', value: String(meetings.agendadas), sub: '', color: C.slate },
    { label: 'Feitas', value: String(meetings.feitas), sub: `${meetings.feitasPct}%`, color: C.green },
    { label: 'Canceladas', value: String(meetings.canceladas), sub: `${meetings.canceladasPct}%`, color: C.red },
    { label: 'Reagendadas', value: String(meetings.reagendadas), sub: `${meetings.reagendadasPct}%`, color: C.amber },
    { label: 'No-show', value: String(meetings.noShow), sub: '', color: C.amber },
    { label: 'Taxa de Show', value: `${meetings.showRate}%`, sub: 'feitas/agendadas', color: meetings.showRate >= 70 ? C.green : meetings.showRate >= 50 ? C.amber : C.red },
  ]

  return (
    <div>
      {/* Filtro de faturamento / ICP */}
      <div style={{ ...box, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.mid }}>Faturamento / ICP:</span>
        <select value={faturamentoFilter} onChange={e => setFaturamentoFilter(e.target.value)} style={{ padding: '7px 10px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, background: '#fff' }}>
          {FATURAMENTO_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 12, fontFamily: 'var(--font-sans)', fontSize: 12, flexWrap: 'wrap' }}>
          <span style={{ color: C.green, fontWeight: 700 }}>Dentro ICP: {icp.dentro}</span>
          <span style={{ color: C.red, fontWeight: 700 }}>Fora: {icp.fora}</span>
          <span style={{ color: C.mid }}>Sem info: {icp.naoInformado}</span>
        </div>
        {faturamentoFilter !== 'ALL' && (
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.slate, fontWeight: 600 }}>● filtro ativo — todos os blocos abaixo respeitam a faixa</span>
        )}
      </div>

      {/* ===== BLOCO 1 — Numeros do topo ===== */}
      <div style={titleStyle}>Números do topo</div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: isMobile ? 8 : 12 }}>
        {card1.map(k => (
          <div key={k.label} style={box}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.mid }}>{k.label}</div>
            <div style={{ ...num, fontSize: isMobile ? 16 : 20, fontWeight: 700, color: k.color, marginTop: 6 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ===== BLOCO 2 — Funil de vendas ===== */}
      <div style={titleStyle}>
        Funil de vendas
        {bottleneck && (
          <span style={{ background: C.red, color: 'white', fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6 }}>
            Gargalo: {LEAD_STAGE_LABELS[bottleneck] ?? bottleneck}
          </span>
        )}
      </div>
      <div style={{ ...box, padding: isMobile ? 12 : 18 }}>
        {funnel.map(f => {
          const isBottleneck = f.stage === bottleneck
          const color = LEAD_STAGE_COLORS[f.stage] ?? C.slate
          return (
            <div key={f.stage} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-sans)', fontSize: 12, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: C.ink }}>{LEAD_STAGE_LABELS[f.stage] ?? f.stage}</span>
                <span style={num}>
                  <strong>{f.count}</strong>
                  {f.conversionFromPrev !== null && (
                    <span style={{ marginLeft: 8, color: isBottleneck ? C.red : C.mid, fontWeight: isBottleneck ? 700 : 400 }}>
                      {f.conversionFromPrev}% {isBottleneck ? '◄ gargalo' : ''}
                    </span>
                  )}
                </span>
              </div>
              <div style={{ background: '#f1f5f9', height: 18, borderRadius: 6, border: isBottleneck ? `2px solid ${C.red}` : `1px solid ${C.line}`, position: 'relative', overflow: 'hidden' }}>
                <div style={{ background: color, height: '100%', width: `${(f.count / maxFunnel) * 100}%`, transition: 'width .3s' }} />
              </div>
            </div>
          )
        })}
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.dim, marginTop: 6 }}>
          Funil cumulativo: cada etapa conta quem ja passou por ela (fechados contam como tendo passado por todas). Perdidos ({cards.fechadosPerdido}) fora do funil.
        </div>
      </div>

      {/* ===== BLOCO 3 — Reunioes ===== */}
      <div style={titleStyle}>Reuniões (mês atual)</div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)', gap: isMobile ? 8 : 12 }}>
        {mtgCards.map(k => (
          <div key={k.label} style={box}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.mid }}>{k.label}</div>
            <div style={{ ...num, fontSize: isMobile ? 16 : 20, fontWeight: 700, color: k.color, marginTop: 6 }}>{k.value}</div>
            {k.sub && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.dim, marginTop: 2 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* ===== BLOCO 4 — Origem dos leads ===== */}
      <div style={titleStyle}>Origem dos leads (volume x qualidade)</div>
      <div style={{ ...box, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.bg }}>
              {['Origem', 'Leads', 'Qualificados', 'Fechados', '% Conversao'].map((h, i) => (
                <th key={h} style={{ padding: '10px 14px', textAlign: i === 0 ? 'left' : 'right', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, color: C.mid, borderBottom: `1px solid ${C.line}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bySource.map(s => {
              const convColor = s.conversion >= 30 ? C.green : s.conversion >= 10 ? C.amber : C.red
              return (
                <tr key={s.source} style={{ borderBottom: `1px solid ${C.bg}` }}>
                  <td style={{ padding: '9px 14px', fontWeight: 600, color: C.ink }}>{LEAD_SOURCE_LABELS[s.source] ?? s.source}</td>
                  <td style={{ ...num, padding: '9px 14px', textAlign: 'right', color: C.ink }}>{s.leads}</td>
                  <td style={{ ...num, padding: '9px 14px', textAlign: 'right', color: C.slate }}>{s.qualified}</td>
                  <td style={{ ...num, padding: '9px 14px', textAlign: 'right', color: C.green, fontWeight: 700 }}>{s.closed}</td>
                  <td style={{ ...num, padding: '9px 14px', textAlign: 'right' }}>
                    <span style={{ color: convColor, fontWeight: 700 }}>{s.conversion}%</span>
                  </td>
                </tr>
              )
            })}
            {bySource.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: C.dim }}>Sem leads no filtro selecionado</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.dim, margin: '6px 0 4px' }}>
        Distribuicao por faixa de faturamento: {Object.entries(icp.byBand).map(([b, n]) => `${FATURAMENTO_BAND_LABELS[b] ?? b}: ${n}`).join('  ·  ')}
      </div>
    </div>
  )
}
