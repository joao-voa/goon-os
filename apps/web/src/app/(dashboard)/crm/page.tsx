'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useIsMobile } from '@/hooks/useMediaQuery'
import {
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  LEAD_STAGE_COLORS,
  LEAD_SOURCE_LABELS,
  PRODUCT_COLORS,
  PRODUCT_NAMES,
  INTERACTION_TYPES,
  INTERACTION_ICONS,
} from '@/lib/constants'
import dynamic from 'next/dynamic'

const CrmKanbanBoard = dynamic(() => import('@/components/CrmKanbanBoard'), { ssr: false })

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
  leadNotes: string | null
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
  }) => Promise<void>
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [saleValue, setSaleValue] = useState(lead.saleValue?.toString() ?? '')
  const [paymentMethod, setPaymentMethod] = useState(lead.paymentMethod ?? 'BOLETO')
  const [saleInstallments, setSaleInstallments] = useState(lead.saleInstallments?.toString() ?? '1')
  const [submitting, setSubmitting] = useState(false)

  const value = parseFloat(saleValue) || 0
  const installments = parseInt(saleInstallments) || 1
  const installmentVal = installments > 0 ? value / installments : 0

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
      })
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    border: '2px solid black',
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    background: 'white',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    display: 'block',
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'white', border: '2px solid black', boxShadow: '8px 8px 0px 0px #000',
          width: '100%', maxWidth: 420, position: 'relative',
        }}
      >
        <div style={{ background: '#22c55e', color: 'white', padding: '10px 16px', fontFamily: 'var(--font-pixel)', fontSize: 11 }}>
          FECHAR NEGÓCIO — {lead.companyName}
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Programa</label>
            <select value={productId} onChange={e => setProductId(e.target.value)} style={inputStyle}>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Valor Total (R$)</label>
            <input type="number" step="0.01" value={saleValue} onChange={e => setSaleValue(e.target.value)} style={inputStyle} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Forma de Pagamento</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={inputStyle}>
                <option value="BOLETO">Boleto</option>
                <option value="PIX">PIX</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Parcelas</label>
              <input type="number" min="1" value={saleInstallments} onChange={e => setSaleInstallments(e.target.value)} style={inputStyle} required />
            </div>
          </div>
          {installments > 0 && value > 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: '#f0f0f0', padding: '8px 12px', border: '1px solid #ccc' }}>
              {installments}x de R$ {installmentVal.toFixed(2)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '10px', border: '2px solid black', background: 'white',
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              CANCELAR
            </button>
            <button type="submit" disabled={submitting} style={{
              flex: 1, padding: '10px', border: '2px solid black', background: '#22c55e', color: 'white',
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: submitting ? 'wait' : 'pointer',
              boxShadow: '3px 3px 0px 0px #000',
            }}>
              {submitting ? 'FECHANDO...' : 'CONFIRMAR'}
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
    leadNotes?: string
  }) => Promise<void>
}) {
  const [companyName, setCompanyName] = useState('')
  const [responsible, setResponsible] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [leadSource, setLeadSource] = useState('')
  const [salesRep, setSalesRep] = useState('')
  const [leadNotes, setLeadNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!companyName.trim() || !responsible.trim()) {
      toast.error('Nome e responsável são obrigatórios')
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
        leadNotes: leadNotes.trim() || undefined,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', border: '2px solid black',
    fontFamily: 'var(--font-mono)', fontSize: 13, background: 'white',
  }
  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block',
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'white', border: '2px solid black', boxShadow: '8px 8px 0px 0px #000',
          width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ background: '#4A78FF', color: 'white', padding: '10px 16px', fontFamily: 'var(--font-pixel)', fontSize: 11 }}>
          NOVO LEAD
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
                <option value="instagram">Instagram</option>
                <option value="indicacao">Indicação</option>
                <option value="evento">Evento</option>
                <option value="site">Site</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Vendedor</label>
              <input value={salesRep} onChange={e => setSalesRep(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Observações</label>
            <textarea value={leadNotes} onChange={e => setLeadNotes(e.target.value)} rows={3}
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '10px', border: '2px solid black', background: 'white',
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              CANCELAR
            </button>
            <button type="submit" disabled={submitting} style={{
              flex: 1, padding: '10px', border: '2px solid black', background: '#4A78FF', color: 'white',
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: submitting ? 'wait' : 'pointer',
              boxShadow: '3px 3px 0px 0px #000',
            }}>
              {submitting ? 'SALVANDO...' : 'CRIAR LEAD'}
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
}

// ---- Lead Detail Modal with Timeline ----
function LeadDetailModal({
  lead,
  onClose,
  onCloseDeal,
}: {
  lead: LeadItem
  onClose: () => void
  onCloseDeal: () => void
}) {
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [newType, setNewType] = useState('NOTA')
  const [newDesc, setNewDesc] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadInteractions = useCallback(async () => {
    try {
      const data = await apiFetch<Interaction[]>(`/api/crm/${lead.id}/interactions`)
      setInteractions(data)
    } catch { /* ignore */ }
  }, [lead.id])

  useEffect(() => { loadInteractions() }, [loadInteractions])

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
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')
  const fmtTime = (d: string) => {
    const date = new Date(d)
    return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  }

  const daysInStage = lead.stageChangedAt
    ? Math.floor((Date.now() - new Date(lead.stageChangedAt).getTime()) / (1000 * 60 * 60 * 24))
    : Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24))

  const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'white', border: '2px solid black', boxShadow: '8px 8px 0 black', width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto' }}>
        {/* Header */}
        <div style={{ background: LEAD_STAGE_COLORS[lead.leadStage] ?? 'black', color: 'white', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 12 }}>{lead.companyName}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.8 }}>{LEAD_STAGE_LABELS[lead.leadStage] ?? lead.leadStage} | {daysInStage}d</span>
        </div>

        <div style={{ padding: 16 }}>
          {/* Info Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            <div><strong>Responsavel:</strong> {lead.responsible}</div>
            <div><strong>Vendedor:</strong> {lead.salesRep ?? '-'}</div>
            <div><strong>Telefone:</strong> {lead.phone ?? '-'}</div>
            <div><strong>WhatsApp:</strong> {lead.whatsapp ?? '-'}</div>
            <div><strong>Email:</strong> {lead.email ?? '-'}</div>
            <div><strong>Origem:</strong> {lead.leadSource ? (LEAD_SOURCE_LABELS[lead.leadSource] ?? lead.leadSource) : '-'}</div>
            {lead.saleValue && <div><strong>Valor:</strong> {fmt(lead.saleValue)}</div>}
            <div><strong>Criado:</strong> {fmtDate(lead.createdAt)}</div>
          </div>
          {lead.leadNotes && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: '#f5f5f5', padding: 10, border: '1px solid #ddd', marginBottom: 16 }}>
              <strong>Notas:</strong> {lead.leadNotes}
            </div>
          )}

          {/* WhatsApp link */}
          {lead.whatsapp && (
            <a href={`https://wa.me/55${lead.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-block', background: '#25d366', color: 'white', padding: '6px 14px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, textDecoration: 'none', marginBottom: 16 }}>
              ABRIR WHATSAPP
            </a>
          )}

          {/* Add Interaction */}
          <form onSubmit={handleAddInteraction} style={{ marginBottom: 16, borderTop: '2px solid black', paddingTop: 12 }}>
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 11, marginBottom: 8 }}>REGISTRAR INTERACAO</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={newType} onChange={e => setNewType(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
                {Object.entries(INTERACTION_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <input placeholder="Descreva..." value={newDesc} onChange={e => setNewDesc(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              <button type="submit" disabled={submitting} style={{ background: 'black', color: 'white', border: '2px solid black', padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>+</button>
            </div>
          </form>

          {/* Timeline */}
          <div style={{ borderTop: '2px solid black', paddingTop: 12 }}>
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 11, marginBottom: 8 }}>TIMELINE ({interactions.length})</div>
            {interactions.length === 0 ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#888', padding: 10 }}>Nenhuma interacao registrada</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {interactions.map(i => (
                  <div key={i.id} style={{ display: 'flex', gap: 8, padding: '8px 10px', background: '#fafafa', border: '1px solid #eee', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>{INTERACTION_ICONS[i.type] ?? '📝'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{INTERACTION_TYPES[i.type] ?? i.type}</strong>
                        <span style={{ fontSize: 9, color: '#888' }}>{fmtTime(i.createdAt)}</span>
                      </div>
                      <div style={{ marginTop: 2 }}>{i.description}</div>
                      {i.userName && <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>por {i.userName}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, borderTop: '2px solid black', paddingTop: 12 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '8px', border: '2px solid black', background: 'white', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>FECHAR</button>
            {lead.leadStage !== 'FECHADO' && lead.leadStage !== 'PERDIDO' && (
              <button onClick={onCloseDeal} style={{ flex: 1, padding: '8px', border: '2px solid black', background: '#22c55e', color: 'white', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, cursor: 'pointer', boxShadow: '3px 3px 0 black' }}>FECHAR NEGOCIO</button>
            )}
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
  const [metrics, setMetrics] = useState<CrmMetrics | null>(null)
  const isMobile = useIsMobile()

  const PIPELINE_STAGES = LEAD_STAGES.filter(s => s !== 'FECHADO' && s !== 'PERDIDO')

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
      const data = await apiFetch<CrmMetrics>('/api/crm/metrics')
      setMetrics(data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchLeads()
    fetchMetrics()
    apiFetch<Array<{ id: string; code: string; name: string }>>('/api/products')
      .then(setProducts)
      .catch(() => {})
  }, [fetchLeads, fetchMetrics])

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

  async function handleCreateLead(data: {
    companyName: string
    responsible: string
    phone?: string
    whatsapp?: string
    email?: string
    leadSource?: string
    salesRep?: string
    leadNotes?: string
  }) {
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

  const activeLeads = leads.filter(l => l.leadStage !== 'FECHADO' && l.leadStage !== 'PERDIDO')

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-pixel)', fontSize: 12 }}>
        CARREGANDO PIPELINE...
      </div>
    )
  }

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 12,
      }}>
        <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: isMobile ? 14 : 18, margin: 0 }}>
          CRM — PIPELINE
        </h1>
        <button
          onClick={() => setShowNewLead(true)}
          style={{
            padding: '8px 16px', border: '2px solid black', background: '#4A78FF', color: 'white',
            fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            boxShadow: '3px 3px 0px 0px #000',
          }}
        >
          + NOVO LEAD
        </button>
      </div>

      {/* KPI Strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)',
        gap: isMobile ? 8 : 12, marginBottom: 20,
      }}>
        {[
          { label: 'Leads Ativos', value: String(activeLeads.length), color: '#4A78FF' },
          { label: 'Novos (mes)', value: String(metrics?.newThisMonth ?? 0), color: '#06b6d4' },
          { label: 'Fechados (mes)', value: String(metrics?.closedThisMonth ?? 0), color: '#22c55e' },
          { label: 'Conversao', value: `${metrics?.conversionRate ?? 0}%`, color: '#f97316' },
          { label: 'Parados >7d', value: String(metrics?.staleLeads ?? 0), color: (metrics?.staleLeads ?? 0) > 0 ? '#cc0000' : '#888' },
        ].map(kpi => (
          <div key={kpi.label} style={{
            border: '2px solid black', boxShadow: '4px 4px 0px 0px #000',
            padding: isMobile ? '10px 8px' : '14px 16px', background: 'white',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, color: '#666' }}>
              {kpi.label}
            </div>
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: isMobile ? 16 : 22, color: kpi.color, marginTop: 4 }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Valor fechado + Performance vendedores */}
      {metrics && metrics.closedValueThisMonth > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ background: '#22c55e', color: 'white', padding: '8px 16px', border: '2px solid black', boxShadow: '4px 4px 0 black', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12 }}>
            Fechado no mes: {fmtBRL(metrics.closedValueThisMonth)}
          </div>
          {Object.entries(metrics.bySalesRep).filter(([, v]) => v.closed > 0).map(([rep, v]) => (
            <div key={rep} style={{ background: 'var(--retro-gray)', padding: '8px 16px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11 }}>
              {rep}: {v.closed} fechados ({fmtBRL(v.value)})
            </div>
          ))}
        </div>
      )}

      <CrmKanbanBoard
        items={activeLeads}
        stages={PIPELINE_STAGES}
        onStageChange={handleStageChange}
        onCardClick={(item) => {
          setDetailLead(item as unknown as LeadItem)
        }}
      />

      {detailLead && (
        <LeadDetailModal
          lead={detailLead}
          onClose={() => setDetailLead(null)}
          onCloseDeal={() => {
            setClosingLead(detailLead)
            setDetailLead(null)
          }}
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
        />
      )}
    </div>
  )
}
