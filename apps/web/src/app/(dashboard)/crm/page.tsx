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
  AURA_MODULES,
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
  selectedModules: string | null
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
    paymentDay?: number
    wasAdvanced?: boolean
    advanceValue?: number
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
  const [submitting, setSubmitting] = useState(false)

  const value = parseFloat(saleValue) || 0
  const entry = parseFloat(entryValue) || 0
  const remaining = value - entry
  const installments = parseInt(saleInstallments) || 1
  const installmentVal = installments > 0 ? remaining / installments : 0

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
        paymentDay: parseInt(paymentDay) || undefined,
        wasAdvanced: wasAdvanced || undefined,
        advanceValue: wasAdvanced && parseFloat(advanceValue) > 0 ? parseFloat(advanceValue) : undefined,
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
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
            <div>
              <label style={labelStyle}>Dia Vencimento</label>
              <input type="number" min="1" max="31" value={paymentDay} onChange={e => setPaymentDay(e.target.value)} style={inputStyle} />
            </div>
          </div>
          {/* Adiantamento */}
          <div style={{ border: '1px solid #ddd', padding: 12, background: '#fafafa' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
              <input type="checkbox" checked={wasAdvanced} onChange={e => setWasAdvanced(e.target.checked)} style={{ accentColor: '#4A78FF' }} />
              Valor adiantado (app financeiro)
            </label>
            {wasAdvanced && (
              <div style={{ marginTop: 8 }}>
                <label style={labelStyle}>Valor Recebido no Adiantamento (R$)</label>
                <input type="number" step="0.01" placeholder="0.00" value={advanceValue} onChange={e => setAdvanceValue(e.target.value)} style={inputStyle} />
                {parseFloat(advanceValue) > 0 && value > 0 && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#cc0000', marginTop: 4 }}>
                    Taxa adiantamento: R$ {(value - parseFloat(advanceValue)).toFixed(2)} ({((1 - parseFloat(advanceValue) / value) * 100).toFixed(1)}%)
                  </div>
                )}
              </div>
            )}
          </div>
          {installments > 0 && value > 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: '#f0f0f0', padding: '8px 12px', border: '1px solid #ccc' }}>
              {entry > 0 && <div>Entrada: R$ {entry.toFixed(2)}</div>}
              {installments}x de R$ {installmentVal.toFixed(2)}
              <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>Vencimento todo dia {paymentDay}</div>
              {wasAdvanced && parseFloat(advanceValue) > 0 && (
                <div style={{ fontSize: 10, color: '#4A78FF', marginTop: 2 }}>Adiantado: R$ {parseFloat(advanceValue).toFixed(2)}</div>
              )}
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
  products,
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
    selectedModules?: string
    productInterest?: string
  }) => Promise<void>
  products: Array<{ id: string; code: string; name: string }>
}) {
  const [companyName, setCompanyName] = useState('')
  const [responsible, setResponsible] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [leadSource, setLeadSource] = useState('')
  const [salesRep, setSalesRep] = useState('')
  const [leadNotes, setLeadNotes] = useState('')
  const [productInterest, setProductInterest] = useState('')
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
        leadNotes: leadNotes.trim() || undefined,
        selectedModules: modules.length > 0 ? JSON.stringify(modules) : undefined,
        productInterest: productInterest || undefined,
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
                <option value="facebook">Facebook</option>
                <option value="indicacao">Indicacao</option>
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
                  <label key={m.code} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', padding: '4px 6px', background: modules.includes(m.code) ? '#D4A017' : '#f5f5f5', color: modules.includes(m.code) ? 'white' : 'black', border: '1px solid #ccc' }}>
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
  onDelete,
}: {
  lead: LeadItem
  onClose: () => void
  onCloseDeal: () => void
  onDelete: () => void
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
          {/* AURA Modules */}
          {lead.selectedModules && (() => {
            let mods: string[] = []
            try { mods = JSON.parse(lead.selectedModules) } catch { /* ignore */ }
            return mods.length > 0 ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Modulos AURA 360</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {mods.map(m => {
                    const mod = AURA_MODULES.find(a => a.code === m)
                    return <span key={m} style={{ background: '#D4A017', color: 'white', padding: '2px 8px', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{mod?.label ?? m}</span>
                  })}
                </div>
              </div>
            ) : null
          })()}
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
            <button onClick={onDelete} style={{ padding: '8px 12px', border: '2px solid black', background: '#cc0000', color: 'white', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>EXCLUIR</button>
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
    selectedModules?: string
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
              padding: '8px 16px', border: '2px solid black', background: syncing ? '#888' : '#22c55e', color: 'white',
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: syncing ? 'wait' : 'pointer',
              boxShadow: '3px 3px 0px 0px #000',
            }}
          >
            {syncing ? 'SINCRONIZANDO...' : 'SINCRONIZAR LEADS'}
          </button>
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
          onDelete={async () => {
            if (!confirm(`Excluir ${detailLead.companyName}? Isso cancela pagamentos e comissoes pendentes.`)) return
            try {
              await apiFetch(`/api/clients/${detailLead.id}/cancel`, { method: 'PATCH' })
              toast.success('Cliente excluido')
              setDetailLead(null)
              fetchLeads()
              fetchMetrics()
            } catch { toast.error('Erro ao excluir') }
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
          products={products}
        />
      )}
    </div>
  )
}
