'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useIsMobile } from '@/hooks/useMediaQuery'
import {
  PRODUCT_COLORS,
  PRODUCT_NAMES,
  STAGE_LABELS,
  STAGE_COLORS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  CONTRACT_STATUS_COLORS,
  PENDENCY_TYPE_COLORS,
  PENDENCY_TYPE_LABELS,
  PENDENCY_TYPE_ICONS,
  AURA_MODULES,
} from '@/lib/constants'

// ---- Types ----
interface Product {
  id: string
  code: string
  name: string
  isActive?: boolean
}

interface ClientPlan {
  id: string
  status: string
  value: number
  paymentType: string
  installments?: number | null
  installmentValue?: number | null
  cycleDuration?: number | null
  startDate: string
  endDate?: string | null
  paymentStartDate?: string | null
  paymentEndDate?: string | null
  paymentDay?: number | null
  notes?: string | null
  product: Product
  paymentStats?: {
    total: number
    paid: number
    overdue: number
    pending: number
  } | null
}

interface Contract {
  id: string
  templateType: string
  status: string
  version: number
  dynamicFields: Record<string, string>
  generatedPdfUrl?: string | null
  isSigned?: boolean
  signatureDate?: string | null
  signedAt?: string | null
  createdAt: string
  clientPlan?: {
    id: string
    value: number
    startDate?: string | null
    endDate?: string | null
    paymentStartDate?: string | null
    paymentEndDate?: string | null
    product: { id: string; code: string; name: string }
  } | null
}

interface Payment {
  id: string
  installment: number
  totalInstallments: number
  dueDate: string
  value: number
  status: string
  paidAt?: string | null
  observation?: string | null
  clientPlan?: { id: string; product: { code: string; name: string } } | null
}

interface Pendency {
  id: string
  type: string
  status: string
  description?: string | null
  createdAt: string
  resolvedAt?: string | null
}

interface Onboarding {
  id: string
  currentStage: string
  notes?: string
}

interface ActivityLog {
  id: string
  action: string
  description?: string
  fromValue?: string
  toValue?: string
  createdAt: string
}

interface ClientDetail {
  id: string
  companyName: string
  tradeName?: string | null
  cnpj?: string | null
  responsible: string
  phone?: string | null
  email?: string | null
  whatsapp?: string | null
  segment?: string | null
  address?: string | null
  addressNumber?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  employeeCount?: string | null
  estimatedRevenue?: string | null
  mainPains?: string | null
  strategicGoals?: string | null
  maturity?: string | null
  goonFitScore?: number | null
  selectedModules?: string | null
  status: string
  plans: ClientPlan[]
  contracts: Contract[]
  onboarding?: Onboarding
  activityLogs: ActivityLog[]
  createdAt: string
  updatedAt: string
}

// ---- Helpers ----
const fmtBRL = (n?: number | null) =>
  n != null
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)
    : '—'

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—')

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  if (diffSecs < 60) return 'agora'
  if (diffMins < 60) return `${diffMins}min`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays === 1) return '1d'
  if (diffDays < 30) return `${diffDays}d`
  return date.toLocaleDateString('pt-BR')
}

function statusLabel(status: string) {
  const map: Record<string, string> = { ACTIVE: 'Ativo', PROSPECT: 'Prospect', INACTIVE: 'Inativo', CANCELLED: 'Cancelado' }
  return map[status] ?? status
}

function statusClass(status: string) {
  const map: Record<string, string> = {
    ACTIVE: 'goon-badge goon-badge-active',
    PROSPECT: 'goon-badge goon-badge-pending',
    INACTIVE: 'goon-badge goon-badge-inactive',
    CANCELLED: 'goon-badge goon-badge-danger',
  }
  return map[status] ?? 'goon-badge goon-badge-inactive'
}

function paymentTypeLabel(pt: string) {
  const map: Record<string, string> = { CASH: 'À Vista', INSTALLMENT: 'Parcelado', RECURRING: 'Recorrente' }
  return map[pt] ?? pt
}

function planStatusLabel(s: string) {
  const map: Record<string, string> = { ACTIVE: 'Ativo', INACTIVE: 'Inativo', CANCELLED: 'Cancelado', PENDING: 'Pendente' }
  return map[s] ?? s
}

// ---- Tab Bar ----
interface TabBarProps {
  tabs: string[]
  active: number
  onChange: (i: number) => void
}

function TabBar({ tabs, active, onChange }: TabBarProps) {
  return (
    <div style={{
      display: 'flex',
      gap: 0,
      borderBottom: '2px solid black',
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
      scrollbarWidth: 'none' as React.CSSProperties['scrollbarWidth'],
    }}>
      {tabs.map((tab, i) => (
        <button
          key={tab}
          onClick={() => onChange(i)}
          style={{
            padding: '10px 14px',
            background: i === active ? 'black' : '#c0c0c0',
            color: i === active ? 'white' : 'black',
            border: '2px solid black',
            fontFamily: 'var(--font-pixel)',
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            cursor: 'pointer',
            marginBottom: i === active ? -2 : 0,
            zIndex: i === active ? 1 : 0,
            position: 'relative',
            whiteSpace: 'nowrap',
            minWidth: 'fit-content',
            minHeight: 44,
            flexShrink: 0,
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

// ---- Inline Field ----
interface InlineFieldProps {
  label: string
  value?: string | number | null
  field: string
  type?: 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select'
  options?: { value: string; label: string }[]
  onSave: (field: string, value: string) => Promise<void>
  min?: number
  max?: number
}

function InlineField({ label, value, field, type = 'text', options, onSave, min, max }: InlineFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value != null ? String(value) : '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (draft === (value != null ? String(value) : '')) { setEditing(false); return }
    setSaving(true)
    try {
      await onSave(field, draft)
      setEditing(false)
    } catch {
      setDraft(value != null ? String(value) : '')
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') handleSave()
    if (e.key === 'Escape') { setDraft(value != null ? String(value) : ''); setEditing(false) }
  }

  const displayValue = value != null && String(value) !== '' ? String(value) : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label className="goon-label">{label}</label>
      {editing ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          {type === 'textarea' ? (
            <textarea className="goon-textarea" value={draft} onChange={e => setDraft(e.target.value)} onBlur={handleSave} onKeyDown={handleKeyDown} autoFocus style={{ minHeight: 80 }} />
          ) : type === 'select' && options ? (
            <select className="goon-select" value={draft} onChange={e => setDraft(e.target.value)} onBlur={handleSave} autoFocus>
              <option value="">Selecionar...</option>
              {options.map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          ) : (
            <input className="goon-input" type={type} min={min} max={max} value={draft} onChange={e => setDraft(e.target.value)} onBlur={handleSave} onKeyDown={handleKeyDown} autoFocus disabled={saving} />
          )}
        </div>
      ) : (
        <div
          onClick={() => { setDraft(value != null ? String(value) : ''); setEditing(true) }}
          style={{
            fontFamily: 'var(--font-mono)', fontSize: 13,
            color: value != null && String(value) !== '' ? 'black' : '#aaa',
            cursor: 'pointer', padding: '6px 8px', border: '1px solid transparent',
            minHeight: 34, display: 'flex', alignItems: 'center',
            transition: 'border-color 0.1s, background 0.1s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'black'; (e.currentTarget as HTMLDivElement).style.background = '#f5f5f5' }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'; (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
          title="Clique para editar"
        >
          {type === 'select' && options ? (options.find(o => o.value === displayValue)?.label ?? displayValue) : displayValue}
        </div>
      )}
    </div>
  )
}

// ---- Contract Actions ----
const CONTRACT_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function openContractTab(path: string, method: 'GET' | 'POST' = 'GET') {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  fetch(`${CONTRACT_API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
    .then(r => r.text())
    .then(html => {
      const blob = new Blob([html], { type: 'text/html' })
      window.open(URL.createObjectURL(blob), '_blank')
    })
    .catch(() => toast.error('[ERRO] Erro ao abrir contrato'))
}

function ContractActions({ contract, onRefresh }: { contract: Contract; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false)

  const handleStatus = async (newStatus: string) => {
    setBusy(true)
    try {
      await apiFetch(`/api/contracts/${contract.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) })
      const labels: Record<string, string> = { SENT: 'Enviado', SIGNED: 'Assinado', CANCELLED: 'Cancelado' }
      toast.success(`[OK] Status → ${labels[newStatus] ?? newStatus}`)
      onRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao alterar status')
    } finally {
      setBusy(false)
    }
  }

  const handleMarkSigned = async () => {
    setBusy(true)
    try {
      await apiFetch(`/api/contracts/${contract.id}`, { method: 'PUT', body: JSON.stringify({ isSigned: true, signatureDate: new Date().toISOString() }) })
      toast.success('[OK] Contrato marcado como assinado')
      onRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao marcar assinatura')
    } finally {
      setBusy(false)
    }
  }

  const btnS: React.CSSProperties = {
    padding: '4px 10px', border: '2px solid black', background: 'var(--retro-gray)',
    color: 'black', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11,
    fontWeight: 700, textTransform: 'uppercase' as const, boxShadow: '2px 2px 0 black',
    transition: 'transform 0.1s, box-shadow 0.1s',
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <button style={btnS} disabled={busy} onClick={() => openContractTab(`/api/contracts/${contract.id}/generate-pdf`, 'POST')}>Gerar PDF</button>
      {contract.generatedPdfUrl && (
        <button style={btnS} disabled={busy} onClick={() => openContractTab(`/api/contracts/${contract.id}/download`)}>Baixar</button>
      )}
      {!contract.isSigned && contract.status !== 'CANCELLED' && (
        <button style={{ ...btnS, background: 'var(--success)', color: 'white', boxShadow: '2px 2px 0 black' }} disabled={busy} onClick={handleMarkSigned}>✓ Assinar</button>
      )}
      {contract.status === 'DRAFT' && <button style={btnS} disabled={busy} onClick={() => handleStatus('SENT')}>Enviado</button>}
      {contract.status === 'SENT' && <button style={btnS} disabled={busy} onClick={() => handleStatus('SIGNED')}>Assinado</button>}
      {(contract.status === 'DRAFT' || contract.status === 'SENT') && (
        <button style={{ ...btnS, background: 'var(--danger)', color: 'white', boxShadow: '2px 2px 0 black' }} disabled={busy} onClick={() => handleStatus('CANCELLED')}>Cancelar</button>
      )}
    </div>
  )
}

// ---- Add Plan Modal ----
interface AddPlanModalProps {
  clientId: string
  onClose: () => void
  onCreated: (plan: ClientPlan) => void
}

function AddPlanModal({ clientId, onClose, onCreated }: AddPlanModalProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [productId, setProductId] = useState('')
  const [value, setValue] = useState('')
  const [paymentType, setPaymentType] = useState('CASH')
  const [installments, setInstallments] = useState('')
  const [installmentValue, setInstallmentValue] = useState('')
  const [cycleDuration, setCycleDuration] = useState('')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiFetch<Product[]>('/api/products')
      .then(data => setProducts(data.filter(p => p.isActive)))
      .catch(() => toast.error('[ERRO] Erro ao carregar produtos'))
      .finally(() => setLoadingProducts(false))
  }, [])

  useEffect(() => {
    if (paymentType === 'INSTALLMENT' && value && installments && Number(installments) > 0) {
      setInstallmentValue(String(Math.round(Number(value) / Number(installments))))
    }
  }, [value, installments, paymentType])

  const endDate =
    startDate && cycleDuration && Number(cycleDuration) > 0
      ? (() => { const d = new Date(startDate); d.setMonth(d.getMonth() + Number(cycleDuration)); return d.toISOString().slice(0, 10) })()
      : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!productId) { toast.error('[ERRO] Selecione um produto'); return }
    setSaving(true)
    try {
      const body: Record<string, unknown> = { productId, value: Number(value), paymentType, startDate }
      if (paymentType === 'INSTALLMENT') {
        if (installments) body.installments = Number(installments)
        if (installmentValue) body.installmentValue = Number(installmentValue)
      }
      if (cycleDuration) body.cycleDuration = Number(cycleDuration)
      if (notes) body.notes = notes
      const created = await apiFetch<ClientPlan>(`/api/clients/${clientId}/plans`, { method: 'POST', body: JSON.stringify(body) })
      onCreated(created)
      toast.success('[OK] Plano adicionado')
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao criar plano')
    } finally {
      setSaving(false)
    }
  }

  const modalStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16, overflowY: 'auto',
  }
  const innerStyle: React.CSSProperties = {
    width: '100%', maxWidth: 480, background: 'white',
    border: '2px solid black', boxShadow: '8px 8px 0px 0px #000', margin: 'auto',
  }
  const headerStyle: React.CSSProperties = {
    background: 'black', color: 'white', fontFamily: 'var(--font-pixel)', fontSize: 10,
    textTransform: 'uppercase', padding: '12px 16px', display: 'flex',
    justifyContent: 'space-between', alignItems: 'center', letterSpacing: 1,
    backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '16px 16px',
  }
  const accentBtnStyle: React.CSSProperties = {
    background: '#ccff00', color: 'black', border: '2px solid black', boxShadow: '4px 4px 0px black',
    fontFamily: 'var(--font-pixel)', fontSize: 10, textTransform: 'uppercase',
    padding: '10px 20px', cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.1s',
    borderRadius: 0, letterSpacing: 0.5, display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', gap: 8, textDecoration: 'none', fontWeight: 700,
  }

  return (
    <div style={modalStyle} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={innerStyle}>
        <div style={headerStyle}>
          <span>Adicionar Plano</span>
          <button onClick={onClose} style={{ background: 'var(--danger)', border: '1px solid white', color: 'white', cursor: 'pointer', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700 }}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="goon-label">Produto *</label>
            {loadingProducts ? (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555' }}>Carregando...</p>
            ) : (
              <select className="goon-select" value={productId} onChange={e => setProductId(e.target.value)} required style={{ width: '100%' }}>
                <option value="">Selecionar produto...</option>
                {products.map(p => (<option key={p.id} value={p.id}>{p.code} — {p.name}</option>))}
              </select>
            )}
          </div>
          <div>
            <label className="goon-label">Valor (R$) *</label>
            <input className="goon-input" type="number" min={0} step={1} value={value} onChange={e => setValue(e.target.value)} required placeholder="0" />
          </div>
          <div>
            <label className="goon-label">Forma de Pagamento *</label>
            <select className="goon-select" value={paymentType} onChange={e => setPaymentType(e.target.value)} style={{ width: '100%' }}>
              <option value="CASH">À Vista</option>
              <option value="INSTALLMENT">Parcelado</option>
              <option value="RECURRING">Recorrente</option>
            </select>
          </div>
          {paymentType === 'INSTALLMENT' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="goon-label">Nº Parcelas</label>
                <input className="goon-input" type="number" min={1} value={installments} onChange={e => setInstallments(e.target.value)} placeholder="12" />
              </div>
              <div>
                <label className="goon-label">Valor da Parcela (R$)</label>
                <input className="goon-input" type="number" min={0} step={1} value={installmentValue} onChange={e => setInstallmentValue(e.target.value)} placeholder="Auto" />
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="goon-label">Duração (meses)</label>
              <input className="goon-input" type="number" min={1} value={cycleDuration} onChange={e => setCycleDuration(e.target.value)} placeholder="12" />
            </div>
            <div>
              <label className="goon-label">Data de Início *</label>
              <input className="goon-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            </div>
          </div>
          {endDate && (
            <div>
              <label className="goon-label">Término (calculado)</label>
              <input className="goon-input" type="date" value={endDate} readOnly style={{ opacity: 0.7, cursor: 'not-allowed' }} />
            </div>
          )}
          <div>
            <label className="goon-label">Observações</label>
            <textarea className="goon-textarea" value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Opcional..." />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '2px solid black', paddingTop: 16 }}>
            <button type="button" className="goon-btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" disabled={saving || loadingProducts} style={accentBtnStyle}>{saving ? 'Salvando...' : 'Adicionar Plano'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---- Create Contract Modal ----
interface CreateContractModalProps {
  clientId: string
  plans: ClientPlan[]
  onClose: () => void
  onCreated: () => void
}

function CreateContractModal({ clientId, plans, onClose, onCreated }: CreateContractModalProps) {
  const [selectedPlanId, setSelectedPlanId] = useState(plans.length > 0 ? plans[0].id : '')
  const [templateType, setTemplateType] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedPlan = plans.find(p => p.id === selectedPlanId)

  useEffect(() => {
    if (selectedPlan?.product) setTemplateType(selectedPlan.product.code.toLowerCase())
  }, [selectedPlan])

  const previewFields = selectedPlan
    ? {
        Produto: selectedPlan.product.name,
        Valor: fmtBRL(selectedPlan.value),
        Início: new Date(selectedPlan.startDate).toLocaleDateString('pt-BR'),
        Duração: selectedPlan.cycleDuration ? `${selectedPlan.cycleDuration} meses` : '—',
      }
    : {}

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!templateType) { toast.error('[ERRO] Template não detectado'); return }
    setSaving(true)
    try {
      await apiFetch('/api/contracts', { method: 'POST', body: JSON.stringify({ clientId, clientPlanId: selectedPlanId || undefined, templateType }) })
      toast.success('[OK] Contrato criado')
      onCreated()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao criar contrato')
    } finally {
      setSaving(false)
    }
  }

  const accentBtnStyle: React.CSSProperties = {
    background: '#ccff00', color: 'black', border: '2px solid black', boxShadow: '4px 4px 0px black',
    fontFamily: 'var(--font-pixel)', fontSize: 10, textTransform: 'uppercase',
    padding: '10px 20px', cursor: 'pointer', borderRadius: 0, letterSpacing: 0.5,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700,
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16, overflowY: 'auto' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '100%', maxWidth: 480, background: 'white', border: '2px solid black', boxShadow: '8px 8px 0px 0px #000', margin: 'auto' }}>
        <div style={{ background: 'black', color: 'white', fontFamily: 'var(--font-pixel)', fontSize: 10, textTransform: 'uppercase', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', letterSpacing: 1, backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
          <span>Gerar Contrato</span>
          <button onClick={onClose} style={{ background: 'var(--danger)', border: '1px solid white', color: 'white', cursor: 'pointer', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700 }}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="goon-label">Plano</label>
            {plans.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555' }}>Nenhum plano disponível.</p>
            ) : (
              <select className="goon-select" value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)} style={{ width: '100%' }}>
                <option value="">Sem plano vinculado</option>
                {plans.map(p => (<option key={p.id} value={p.id}>{p.product?.code ?? '?'} — {p.product?.name ?? '?'}</option>))}
              </select>
            )}
          </div>
          <div>
            <label className="goon-label">Template</label>
            <select className="goon-select" value={templateType} onChange={e => setTemplateType(e.target.value)} required style={{ width: '100%' }}>
              <option value="">Selecionar...</option>
              <option value="ge">GE — Gestão Estratégica</option>
              <option value="gi">GI — Gestão Integrada</option>
              <option value="gs">GS — Gestão Simplificada</option>
            </select>
          </div>
          {Object.keys(previewFields).length > 0 && (
            <div style={{ background: 'var(--retro-gray)', border: '2px solid black', padding: 14 }}>
              <p style={{ fontFamily: 'var(--font-pixel)', fontSize: 9, color: 'black', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Pré-visualização</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                {Object.entries(previewFields).map(([label, val]) => (
                  <div key={label}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555', display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>{label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'black' }}>{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '2px solid black', paddingTop: 16 }}>
            <button type="button" className="goon-btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" disabled={saving || !templateType} style={accentBtnStyle}>{saving ? 'Criando...' : 'Criar Contrato'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---- Nova Pendência Modal ----
interface NewPendencyModalProps {
  clientId: string
  onClose: () => void
  onCreated: () => void
}

function NewPendencyModal({ clientId, onClose, onCreated }: NewPendencyModalProps) {
  const [type, setType] = useState('OTHER')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await apiFetch('/api/pendencies', { method: 'POST', body: JSON.stringify({ clientId, type, description: description || undefined }) })
      toast.success('[OK] Pendência criada')
      onCreated()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao criar pendência')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'white', border: '2px solid black', boxShadow: '8px 8px 0px 0px #000' }}>
        <div style={{ background: 'black', color: 'white', fontFamily: 'var(--font-pixel)', fontSize: 10, textTransform: 'uppercase', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', letterSpacing: 1, backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
          <span>Nova Pendência</span>
          <button onClick={onClose} style={{ background: 'var(--danger)', border: '1px solid white', color: 'white', cursor: 'pointer', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700 }}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="goon-label">Tipo</label>
            <select className="goon-select" value={type} onChange={e => setType(e.target.value)} style={{ width: '100%' }}>
              {Object.entries(PENDENCY_TYPE_LABELS).map(([val, label]) => (<option key={val} value={val}>{label}</option>))}
            </select>
          </div>
          <div>
            <label className="goon-label">Descrição</label>
            <textarea className="goon-textarea" value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Opcional..." />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '2px solid black', paddingTop: 16 }}>
            <button type="button" className="goon-btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="goon-btn-primary" disabled={saving}>{saving ? 'Criando...' : 'Criar Pendência'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---- Contract Status Badge ----
function ContractStatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = { DRAFT: 'Rascunho', SENT: 'Enviado', SIGNED: 'Assinado', CANCELLED: 'Cancelado' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px',
      background: CONTRACT_STATUS_COLORS[status] ?? '#c0c0c0',
      color: (status === 'DRAFT' || status === 'CANCELLED') ? '#333' : 'white',
      border: '1px solid black', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
      textTransform: 'uppercase',
    }}>
      {labels[status] ?? status}
    </span>
  )
}

function ContractSignatureBadge({ isSigned, signatureDate }: { isSigned?: boolean; signatureDate?: string | null }) {
  if (isSigned) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', background: 'var(--success)', color: 'white', border: '1px solid black', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
        &#10003; ASSINADO{signatureDate ? ` ${fmtDate(signatureDate)}` : ''}
      </span>
    )
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', background: 'var(--danger)', color: 'white', border: '1px solid black', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700 }}>
      &#10007; PENDENTE
    </span>
  )
}

// ---- Main Page ----
export default function ClientDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const isMobile = useIsMobile()

  const [client, setClient] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [changingStatus, setChangingStatus] = useState(false)
  const [activeTab, setActiveTab] = useState(0)

  // Plans & Contracts
  const [plans, setPlans] = useState<ClientPlan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loadingContracts, setLoadingContracts] = useState(false)
  const [showAddPlan, setShowAddPlan] = useState(false)
  const [showCreateContract, setShowCreateContract] = useState(false)

  // Mentors
  const [mentors, setMentors] = useState<Record<string, Array<{ id: string; mentorName: string; value: number; notes: string | null }>>>({})
  const [addingMentor, setAddingMentor] = useState<string | null>(null)
  const [newMentorName, setNewMentorName] = useState('')
  const [newMentorValue, setNewMentorValue] = useState('')
  const [newMentorNotes, setNewMentorNotes] = useState('')
  const [savingMentor, setSavingMentor] = useState(false)
  const [mentorSuggestions, setMentorSuggestions] = useState<string[]>([])

  // Payments
  const [payments, setPayments] = useState<Payment[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [markingPaid, setMarkingPaid] = useState<string | null>(null)

  // Pendencies
  const [pendencies, setPendencies] = useState<Pendency[]>([])
  const [loadingPendencies, setLoadingPendencies] = useState(false)
  const [showResolved, setShowResolved] = useState(false)
  const [showNewPendency, setShowNewPendency] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const fetchClient = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<ClientDetail>(`/api/clients/${id}`)
      setClient(data)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao carregar cliente')
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchPlans = useCallback(async () => {
    setLoadingPlans(true)
    try {
      const data = await apiFetch<ClientPlan[]>(`/api/clients/${id}/plans`)
      setPlans(data)
    } catch { /* silent */ } finally { setLoadingPlans(false) }
  }, [id])

  const fetchContracts = useCallback(async () => {
    setLoadingContracts(true)
    try {
      const result = await apiFetch<{ data: Contract[]; total: number }>(`/api/contracts?clientId=${id}&limit=50`)
      setContracts(result.data)
    } catch { /* silent */ } finally { setLoadingContracts(false) }
  }, [id])

  const fetchPayments = useCallback(async () => {
    setLoadingPayments(true)
    try {
      const data = await apiFetch<Payment[]>(`/api/clients/${id}/payments`)
      setPayments(data)
    } catch { /* silent */ } finally { setLoadingPayments(false) }
  }, [id])

  const fetchPendencies = useCallback(async () => {
    setLoadingPendencies(true)
    try {
      const data = await apiFetch<Pendency[]>(`/api/pendencies?clientId=${id}`)
      setPendencies(Array.isArray(data) ? data : [])
    } catch { /* silent */ } finally { setLoadingPendencies(false) }
  }, [id])

  const loadMentors = useCallback(async (planId: string) => {
    try {
      const data = await apiFetch<Array<{ id: string; mentorName: string; value: number; notes: string | null }>>(`/api/plans/${planId}/mentors`)
      setMentors(prev => ({ ...prev, [planId]: data }))
    } catch { /* silent */ }
  }, [])

  useEffect(() => { plans.forEach(p => loadMentors(p.id)) }, [plans, loadMentors])

  useEffect(() => {
    apiFetch<{ salesReps: string[]; mentors: string[] }>('/api/crm/suggestions')
      .then(data => setMentorSuggestions(data.mentors ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchClient()
    fetchPlans()
    fetchContracts()
    fetchPayments()
    fetchPendencies()
  }, [fetchClient, fetchPlans, fetchContracts, fetchPayments, fetchPendencies])

  // Check URL hash for tab param
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash
      if (hash === '#contrato') setActiveTab(1)
      else if (hash === '#financeiro') setActiveTab(2)
      else if (hash === '#pendencias') setActiveTab(3)
    }
  }, [])

  const handleSaveField = async (field: string, value: string) => {
    try {
      const payload: Record<string, unknown> = {}
      if (field === 'goonFitScore') {
        payload[field] = value === '' ? null : parseInt(value, 10)
      } else {
        payload[field] = value === '' ? null : value
      }
      const updated = await apiFetch<ClientDetail>(`/api/clients/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
      setClient(updated)
      toast.success('[OK] Campo atualizado')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao salvar')
      throw err
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!client || newStatus === client.status) return
    setChangingStatus(true)
    try {
      const updated = await apiFetch<ClientDetail>(`/api/clients/${id}`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) })
      setClient(updated)
      toast.success(`[OK] Status → ${statusLabel(newStatus)}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao alterar status')
    } finally {
      setChangingStatus(false)
    }
  }

  const handleMarkPaid = async (paymentId: string) => {
    setMarkingPaid(paymentId)
    try {
      await apiFetch(`/api/payments/${paymentId}/pay`, { method: 'PATCH', body: JSON.stringify({}) })
      toast.success('[OK] Parcela marcada como paga')
      fetchPayments()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao marcar pagamento')
    } finally {
      setMarkingPaid(null)
    }
  }

  const handleResolvePendency = async (pendencyId: string) => {
    setResolvingId(pendencyId)
    try {
      await apiFetch(`/api/pendencies/${pendencyId}/resolve`, { method: 'PATCH' })
      toast.success('[OK] Pendência resolvida')
      fetchPendencies()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao resolver pendência')
    } finally {
      setResolvingId(null)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, gap: 12 }}>
        <div style={{ width: 32, height: 32, border: '3px solid black', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!client) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 13 }}>Cliente não encontrado.</p>
        <button className="goon-btn-secondary" onClick={() => router.push('/clients')} style={{ marginTop: 16 }}>← Voltar</button>
      </div>
    )
  }

  // Active plan and product
  const activePlan = client.plans.find(p => p.status === 'ACTIVE') ?? client.plans[0]
  const productCode = activePlan?.product?.code
  const productColor = productCode ? (PRODUCT_COLORS[productCode] ?? 'black') : 'black'

  // Payments summary
  const totalPaid = payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.value, 0)
  const totalPending = payments.filter(p => p.status === 'PENDING').reduce((s, p) => s + p.value, 0)
  const totalOverdue = payments.filter(p => p.status === 'OVERDUE').reduce((s, p) => s + p.value, 0)

  const fieldGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: isMobile ? 12 : 20,
  }

  const TABS = ['CADENCIA', 'DADOS', 'CONTRATO', 'FINANCEIRO', 'PENDÊNCIAS']

  // Meetings / Cadence
  const [clientMeetings, setClientMeetings] = useState<Array<{ id: string; title: string; type: string; date: string; duration: number; mentorName: string | null; notes: string | null; status: string }>>([])
  const [cadence, setCadence] = useState<{ lastMeeting: { date: string; type: string; title: string } | null; nextMeeting: { date: string; type: string; title: string } | null; daysSinceLastMeeting: number | null; totalDone: number; totalScheduled: number; totalNoShow: number; health: string } | null>(null)

  useEffect(() => {
    if (!id) return
    apiFetch<typeof clientMeetings>(`/api/meetings/client/${id}`)
      .then(setClientMeetings).catch(() => {})
    apiFetch<typeof cadence>(`/api/meetings/client/${id}/cadence`)
      .then(setCadence).catch(() => {})
  }, [id])

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button className="goon-btn-ghost" onClick={() => router.push('/clients')} style={{ marginBottom: 16, fontSize: 11 }}>
          ← Clientes
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: isMobile ? 12 : 16, fontWeight: 800, color: 'black', margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: 1 }}>
              {client.companyName}
            </h1>
            {client.tradeName && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555', margin: 0 }}>{client.tradeName}</p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="goon-select" value={client.status} onChange={e => handleStatusChange(e.target.value)} disabled={changingStatus} style={{ width: 'auto', cursor: 'pointer' }}>
              <option value="ACTIVE">Ativo</option>
              <option value="PROSPECT">Prospect</option>
              <option value="INACTIVE">Inativo</option>
            </select>
            <button
              onClick={() => setShowCreateContract(true)}
              style={{
                background: '#c0c0c0', color: 'black', border: '2px solid black',
                boxShadow: '3px 3px 0 black', fontFamily: 'var(--font-pixel)', fontSize: 9,
                textTransform: 'uppercase', padding: '8px 14px', cursor: 'pointer', letterSpacing: 0.5,
              }}
            >
              Gerar Contrato
            </button>
            {client.status !== 'INACTIVE' ? (
              <button
                onClick={async () => {
                  if (!confirm(`Cancelar ${client.companyName}? Pagamentos e comissoes pendentes serao cancelados.`)) return
                  try {
                    await apiFetch(`/api/clients/${client.id}/cancel`, { method: 'PATCH' })
                    toast.success('Cliente cancelado')
                    router.push('/clients')
                  } catch { toast.error('Erro ao cancelar') }
                }}
                style={{
                  background: '#cc0000', color: 'white', border: '2px solid black',
                  boxShadow: '3px 3px 0 black', fontFamily: 'var(--font-pixel)', fontSize: 9,
                  textTransform: 'uppercase', padding: '8px 14px', cursor: 'pointer', letterSpacing: 0.5,
                }}
              >
                Cancelar Cliente
              </button>
            ) : (
              <button
                onClick={async () => {
                  if (!confirm(`Excluir ${client.companyName} permanentemente? Essa acao nao pode ser desfeita.`)) return
                  try {
                    await apiFetch(`/api/clients/${client.id}`, { method: 'DELETE' })
                    toast.success('Cliente excluido')
                    router.push('/clients')
                  } catch { toast.error('Erro ao excluir') }
                }}
                style={{
                  background: '#cc0000', color: 'white', border: '2px solid black',
                  boxShadow: '3px 3px 0 black', fontFamily: 'var(--font-pixel)', fontSize: 9,
                  textTransform: 'uppercase', padding: '8px 14px', cursor: 'pointer', letterSpacing: 0.5,
                }}
              >
                Excluir Cliente
              </button>
            )}
            <a
              href="/contracts/generate"
              style={{
                background: 'black', color: 'white', border: '2px solid black',
                boxShadow: '3px 3px 0 #555', fontFamily: 'var(--font-pixel)', fontSize: 9,
                textTransform: 'uppercase', padding: '8px 14px', cursor: 'pointer', letterSpacing: 0.5,
                textDecoration: 'none', display: 'inline-block',
              }}
            >
              Gerar .docx
            </a>
            {(client.whatsapp ?? client.phone) && (
              <a href={`https://wa.me/${(client.whatsapp ?? client.phone ?? '').replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="goon-btn-secondary" style={{ textDecoration: 'none', background: 'var(--success)', color: 'white', border: '2px solid black' }}>
                WhatsApp
              </a>
            )}
          </div>
        </div>

        {/* Badges row */}
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className={statusClass(client.status)}>{statusLabel(client.status)}</span>
          {productCode && (
            <span
              onClick={() => router.push(`/products/${activePlan?.product?.id ?? ''}`)}
              style={{
                display: 'inline-flex', alignItems: 'center', padding: '2px 10px',
                background: productColor, color: 'white', border: '1px solid black',
                fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                cursor: 'pointer', textTransform: 'uppercase',
              }}
              title={`Ver programa ${productCode}`}
            >
              {productCode} — {PRODUCT_NAMES[productCode] ?? productCode}
            </span>
          )}
          {client.contracts.length > 0 && (
            <ContractSignatureBadge isSigned={client.contracts[0]?.isSigned} signatureDate={client.contracts[0]?.signatureDate} />
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ border: '2px solid black', boxShadow: '4px 4px 0 black', overflow: 'hidden' }}>
        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

        <div style={{ background: 'white', padding: 28 }}>

          {/* ---- TAB 0: CADENCIA ---- */}
          {activeTab === 0 && (
            <div>
              {/* Health + Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
                <div style={{ border: '2px solid black', boxShadow: '3px 3px 0 black', padding: '14px 16px', background: cadence?.health === 'green' ? '#f0fdf4' : cadence?.health === 'yellow' ? '#fffbeb' : '#fef2f2' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: '#666', marginBottom: 4 }}>Saude</div>
                  <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 18, color: cadence?.health === 'green' ? '#006600' : cadence?.health === 'yellow' ? '#e6a800' : '#cc0000' }}>
                    {cadence?.health === 'green' ? 'BOA' : cadence?.health === 'yellow' ? 'ATENCAO' : 'CRITICA'}
                  </div>
                </div>
                <div style={{ border: '2px solid black', boxShadow: '3px 3px 0 black', padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: '#666', marginBottom: 4 }}>Ultima Reuniao</div>
                  <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 14 }}>
                    {cadence?.daysSinceLastMeeting !== null ? `${cadence?.daysSinceLastMeeting}d atras` : 'Nenhuma'}
                  </div>
                  {cadence?.lastMeeting && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#888', marginTop: 2 }}>{new Date(cadence.lastMeeting.date).toLocaleDateString('pt-BR')}</div>}
                </div>
                <div style={{ border: '2px solid black', boxShadow: '3px 3px 0 black', padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: '#666', marginBottom: 4 }}>Proxima Reuniao</div>
                  <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 14 }}>
                    {cadence?.nextMeeting ? new Date(cadence.nextMeeting.date).toLocaleDateString('pt-BR') : 'Nao agendada'}
                  </div>
                  {cadence?.nextMeeting && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#888', marginTop: 2 }}>{cadence.nextMeeting.title}</div>}
                </div>
                <div style={{ border: '2px solid black', boxShadow: '3px 3px 0 black', padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: '#666', marginBottom: 4 }}>Reunioes</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    <span style={{ color: '#006600', fontWeight: 700 }}>{cadence?.totalDone ?? 0}</span> feitas
                    {' '}<span style={{ color: '#4A78FF', fontWeight: 700 }}>{cadence?.totalScheduled ?? 0}</span> agendadas
                    {(cadence?.totalNoShow ?? 0) > 0 && <>{' '}<span style={{ color: '#cc0000', fontWeight: 700 }}>{cadence?.totalNoShow}</span> faltas</>}
                  </div>
                </div>
                {/* Contract info */}
                {plans.length > 0 && plans[0].endDate && (
                  <div style={{ border: '2px solid black', boxShadow: '3px 3px 0 black', padding: '14px 16px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: '#666', marginBottom: 4 }}>Contrato</div>
                    {(() => {
                      const end = new Date(plans[0].endDate!)
                      const days = Math.ceil((end.getTime() - Date.now()) / (1000*60*60*24))
                      return (
                        <>
                          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 14, color: days < 0 ? '#cc0000' : days <= 30 ? '#e6a800' : '#006600' }}>
                            {days < 0 ? 'VENCIDO' : `${days}d restantes`}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#888', marginTop: 2 }}>Ate {end.toLocaleDateString('pt-BR')}</div>
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 12, marginBottom: 12 }}>HISTORICO DE REUNIOES</div>
              {clientMeetings.length === 0 ? (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#888', padding: 20, textAlign: 'center', border: '1px dashed #ccc' }}>
                  Nenhuma reuniao registrada. Agende a primeira na tela de Agenda.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {clientMeetings.map((m, i) => {
                    const d = new Date(m.date)
                    const isPast = d < new Date()
                    const typeColors: Record<string, string> = { INDIVIDUAL: '#4A78FF', GRUPO: '#7c3aed', DIAGNOSTICO: '#059669', PLANO_VOO: '#d97706', KICKOFF: '#dc2626', FOLLOW_UP: '#06b6d4', RG: '#000080', COMERCIAL: '#22c55e' }
                    const typeLabels: Record<string, string> = { INDIVIDUAL: 'Individual', GRUPO: 'Grupo', DIAGNOSTICO: 'Diagnostico', PLANO_VOO: 'Plano de Voo', KICKOFF: 'Kickoff', FOLLOW_UP: 'Follow Up' }
                    const statusLabels: Record<string, string> = { SCHEDULED: 'Agendada', DONE: 'Realizada', CANCELLED: 'Cancelada', NO_SHOW: 'Faltou' }
                    const statusColors: Record<string, string> = { SCHEDULED: '#4A78FF', DONE: '#006600', CANCELLED: '#888', NO_SHOW: '#cc0000' }

                    return (
                      <div key={m.id} style={{ display: 'flex', gap: 12, paddingBottom: 16, position: 'relative' }}>
                        {/* Timeline line */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                          <div style={{ width: 12, height: 12, borderRadius: '50%', background: statusColors[m.status] ?? '#888', border: '2px solid black', flexShrink: 0, zIndex: 1 }} />
                          {i < clientMeetings.length - 1 && <div style={{ width: 2, flex: 1, background: '#ddd' }} />}
                        </div>
                        {/* Content */}
                        <div style={{ flex: 1, paddingBottom: 8, borderBottom: i < clientMeetings.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <div>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                                <span style={{ background: typeColors[m.type] ?? '#888', color: 'white', padding: '1px 6px', fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{typeLabels[m.type] ?? m.type}</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>{m.title}</span>
                              </div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555' }}>
                                {d.toLocaleDateString('pt-BR')} {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • {m.duration}min
                                {m.mentorName && <> • {m.mentorName}</>}
                              </div>
                              {m.notes && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#888', marginTop: 4 }}>{m.notes}</div>}
                            </div>
                            <span style={{ background: statusColors[m.status] ?? '#888', color: 'white', padding: '2px 8px', fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                              {statusLabels[m.status] ?? m.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Quick add meeting button */}
              <div style={{ marginTop: 16 }}>
                <a href="/agenda" style={{ display: 'inline-block', padding: '8px 16px', border: '2px solid black', background: '#4A78FF', color: 'white', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, textDecoration: 'none', boxShadow: '3px 3px 0 black' }}>
                  AGENDAR REUNIAO
                </a>
              </div>
            </div>
          )}

          {/* ---- TAB 1: DADOS ---- */}
          {activeTab === 1 && (
            <div>
              {/* General Info */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid #ddd' }}>
                  Informações Gerais
                </div>
                <div style={fieldGrid}>
                  <InlineField label="Empresa" value={client.companyName} field="companyName" onSave={handleSaveField} />
                  <InlineField label="Nome Fantasia" value={client.tradeName} field="tradeName" onSave={handleSaveField} />
                  <InlineField label="CNPJ" value={client.cnpj} field="cnpj" onSave={handleSaveField} />
                  <InlineField label="Responsável" value={client.responsible} field="responsible" onSave={handleSaveField} />
                  <InlineField label="Telefone" value={client.phone} field="phone" type="tel" onSave={handleSaveField} />
                  <InlineField label="E-mail" value={client.email} field="email" type="email" onSave={handleSaveField} />
                  <InlineField label="WhatsApp" value={client.whatsapp} field="whatsapp" type="tel" onSave={handleSaveField} />
                  <InlineField label="Segmento" value={client.segment} field="segment" onSave={handleSaveField} />
                  <InlineField label="Nº de Funcionários" value={client.employeeCount} field="employeeCount" onSave={handleSaveField} />
                  <InlineField label="Faturamento Estimado" value={client.estimatedRevenue} field="estimatedRevenue" onSave={handleSaveField} />
                </div>
              </div>

              {/* AURA 360 Modules — only show if client has active AURA plan */}
              {plans.some(pl => pl.status === 'ACTIVE' && pl.product?.code === 'AURA') && <div style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 9, color: '#D4A017', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16, paddingBottom: 8, borderBottom: '2px solid #D4A017' }}>
                  Modulos AURA 360
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 8 }}>
                  {AURA_MODULES.map(m => {
                    const currentMods: string[] = (() => { try { return JSON.parse(client.selectedModules ?? '[]') } catch { return [] } })()
                    const isSelected = currentMods.includes(m.code)
                    return (
                      <label key={m.code} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', padding: '8px 10px', background: isSelected ? '#D4A017' : '#f5f5f5', color: isSelected ? 'white' : 'black', border: '2px solid ' + (isSelected ? '#D4A017' : '#ddd'), fontWeight: isSelected ? 700 : 400 }}>
                        <input type="checkbox" checked={isSelected} onChange={async () => {
                          const newMods = isSelected ? currentMods.filter(c => c !== m.code) : [...currentMods, m.code]
                          try {
                            await handleSaveField('selectedModules', JSON.stringify(newMods))
                          } catch { /* ignore */ }
                        }} style={{ accentColor: '#D4A017', width: 16, height: 16 }} />
                        {m.label}
                      </label>
                    )
                  })}
                </div>
              </div>}

              {/* Address */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid #ddd' }}>
                  Endereço
                </div>
                <div style={fieldGrid}>
                  <InlineField label="Logradouro" value={client.address} field="address" onSave={handleSaveField} />
                  <InlineField label="Número" value={client.addressNumber} field="addressNumber" onSave={handleSaveField} />
                  <InlineField label="Bairro" value={client.neighborhood} field="neighborhood" onSave={handleSaveField} />
                  <InlineField label="Cidade" value={client.city} field="city" onSave={handleSaveField} />
                  <InlineField label="Estado" value={client.state} field="state" onSave={handleSaveField} />
                  <InlineField label="CEP" value={client.zipCode} field="zipCode" onSave={handleSaveField} />
                </div>
              </div>

              {/* Strategic */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid #ddd' }}>
                  Dados Estratégicos
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <InlineField label="Principais Dores" value={client.mainPains} field="mainPains" type="textarea" onSave={handleSaveField} />
                  <InlineField label="Objetivos Estratégicos" value={client.strategicGoals} field="strategicGoals" type="textarea" onSave={handleSaveField} />
                  <div style={fieldGrid}>
                    <InlineField label="Maturidade" value={client.maturity} field="maturity" type="select" options={[{ value: 'LOW', label: 'Baixa' }, { value: 'MEDIUM', label: 'Média' }, { value: 'HIGH', label: 'Alta' }]} onSave={handleSaveField} />
                    <InlineField label="Goon Fit Score (1-10)" value={client.goonFitScore} field="goonFitScore" type="number" min={1} max={10} onSave={handleSaveField} />
                  </div>
                </div>
              </div>

              {/* Onboarding */}
              {client.onboarding && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid #ddd' }}>
                    Onboarding
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px',
                      background: STAGE_COLORS[client.onboarding.currentStage] ?? '#888',
                      color: client.onboarding.currentStage === 'ONBOARDING_DONE' ? 'black' : 'white',
                      border: '1px solid black', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                    }}>
                      {STAGE_LABELS[client.onboarding.currentStage] ?? client.onboarding.currentStage}
                    </span>
                    <a href="/onboarding" className="goon-btn-secondary" style={{ textDecoration: 'none' }}>Ver no Kanban →</a>
                  </div>
                </div>
              )}

              {/* Activity Log */}
              <div>
                <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid #ddd' }}>
                  Histórico de Atividades
                </div>
                {client.activityLogs.length === 0 ? (
                  <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 13 }}>Nenhuma atividade registrada.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {client.activityLogs.map((log, idx) => (
                      <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: idx < client.activityLogs.length - 1 ? '1px solid #eee' : 'none' }}>
                        <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'black', fontWeight: 700, flexShrink: 0, marginTop: 2 }}>{'>'}</span>
                          <div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'black' }}>{log.description ?? log.action}</div>
                            {log.fromValue && log.toValue && (
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555', marginTop: 3 }}>{log.fromValue} → {log.toValue}</div>
                            )}
                          </div>
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555', whiteSpace: 'nowrap', flexShrink: 0 }}>[{relativeTime(log.createdAt)}]</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---- TAB 2: CONTRATO ---- */}
          {activeTab === 2 && (
            <div>
              {/* Plans */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>Planos</div>
                  <button className="goon-btn-ghost" onClick={() => setShowAddPlan(true)} style={{ fontSize: 11 }}>+ Adicionar Plano</button>
                </div>

                {loadingPlans ? (
                  <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 13 }}>Carregando planos...</p>
                ) : plans.length === 0 ? (
                  <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 13 }}>Nenhum plano vinculado ainda.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {plans.map(plan => {
                      const color = PRODUCT_COLORS[plan.product?.code ?? ''] ?? 'black'
                      const now = new Date()
                      const endDate = plan.endDate ? new Date(plan.endDate) : null
                      const daysToEnd = endDate ? (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) : null
                      const isRenewing = daysToEnd !== null && daysToEnd >= 0 && daysToEnd <= 90
                      const payPeriodDiffers = plan.paymentStartDate && plan.paymentStartDate !== plan.startDate

                      return (
                        <div key={plan.id} style={{ background: 'var(--retro-gray)', border: '2px solid black', overflow: 'hidden' }}>
                          <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, background: color, color: 'white', border: '2px solid black', fontFamily: 'var(--font-pixel)', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                                {plan.product?.code ?? '?'}
                              </span>
                              <div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'black', fontSize: 13, textTransform: 'uppercase' }}>
                                  {plan.product.name}
                                </div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                  <span>{paymentTypeLabel(plan.paymentType)}</span>
                                  {plan.installments && <span>{plan.installments}x {fmtBRL(plan.installmentValue ?? undefined)}</span>}
                                  {plan.paymentDay && <span>Dia {plan.paymentDay}</span>}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                              {isRenewing && (
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#ff6600', fontWeight: 700, border: '1px solid #ff6600', padding: '2px 8px' }}>
                                  ↺ RENOVAÇÃO {Math.round(daysToEnd!)}d
                                </span>
                              )}
                              <span style={{ fontFamily: 'var(--font-pixel)', fontWeight: 700, color: 'black', fontSize: 12 }}>{fmtBRL(plan.value)}</span>
                              <span className={statusClass(plan.status)}>{planStatusLabel(plan.status)}</span>
                            </div>
                          </div>

                          {/* Period info */}
                          <div style={{ padding: '10px 16px', borderTop: '1px solid black', background: 'white', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                            <span style={{ color: '#555', fontWeight: 700, textTransform: 'uppercase', fontSize: 10 }}>Vigência</span>
                            <span style={{ color: 'black' }}>{fmtDate(plan.startDate)} → {fmtDate(plan.endDate)}</span>
                            {payPeriodDiffers && (
                              <>
                                <span style={{ color: '#ff6600', fontWeight: 700, textTransform: 'uppercase', fontSize: 10 }}>Prazo Financeiro</span>
                                <span style={{ color: '#ff6600', fontWeight: 700 }}>
                                  {fmtDate(plan.paymentStartDate)} → {fmtDate(plan.paymentEndDate)}
                                  <span style={{ fontSize: 10, marginLeft: 8 }}>(diferente da vigência)</span>
                                </span>
                              </>
                            )}
                          </div>

                          {plan.paymentStats && (
                            <div style={{ padding: '6px 14px', borderTop: '1px solid #ddd', background: 'white', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#333', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                              <span>Parcelas:</span>
                              <span style={{ color: '#006600', fontWeight: 700 }}>{plan.paymentStats.paid}/{plan.paymentStats.total} pagas</span>
                              {plan.paymentStats.overdue > 0 && (
                                <span style={{ color: '#cc0000', fontWeight: 700 }}>· {plan.paymentStats.overdue} vencida{plan.paymentStats.overdue > 1 ? 's' : ''}</span>
                              )}
                              {plan.paymentStats.pending > 0 && (
                                <span style={{ color: '#555' }}>· {plan.paymentStats.pending} pendente{plan.paymentStats.pending > 1 ? 's' : ''}</span>
                              )}
                            </div>
                          )}

                          {/* Mentors */}
                          {(() => {
                            const planMentors = mentors[plan.id] ?? []
                            const totalMentors = planMentors.reduce((s, m) => s + m.value, 0)
                            return (
                              <div style={{ padding: '8px 14px', borderTop: '1px solid #ddd', background: 'white' }}>
                                {planMentors.length > 0 && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                                    {planMentors.map(m => (
                                      <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                                        <span>{m.mentorName}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                          <span style={{ fontWeight: 700 }}>{fmtBRL(m.value)}</span>
                                          <button onClick={async () => {
                                            if (!confirm(`Remover ${m.mentorName}?`)) return
                                            try {
                                              await apiFetch(`/api/mentors/${m.id}`, { method: 'DELETE' })
                                              toast.success(`${m.mentorName} removido`)
                                              loadMentors(plan.id)
                                            } catch { toast.error('Erro ao remover mentor') }
                                          }} style={{ background: '#cc0000', color: 'white', border: 'none', padding: '1px 6px', fontSize: 9, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>X</button>
                                        </div>
                                      </div>
                                    ))}
                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#666', textAlign: 'right', marginTop: 2 }}>
                                      Total mentoria: {fmtBRL(totalMentors)} | Saldo: {fmtBRL(plan.value - totalMentors)}
                                    </div>
                                  </div>
                                )}
                                {addingMentor === plan.id ? (
                                  <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                    <input list="mentor-list-client" placeholder="Nome" value={newMentorName} onChange={e => setNewMentorName(e.target.value)} style={{ flex: '1 1 100px', padding: '4px 6px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 10 }} />
                                    <datalist id="mentor-list-client">
                                      {mentorSuggestions.map(s => <option key={s} value={s} />)}
                                    </datalist>
                                    <input type="number" placeholder="Valor" step="0.01" value={newMentorValue} onChange={e => setNewMentorValue(e.target.value)} style={{ width: 80, padding: '4px 6px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 10 }} />
                                    <button disabled={savingMentor} onClick={async () => {
                                      if (!newMentorName.trim() || !parseFloat(newMentorValue)) return
                                      setSavingMentor(true)
                                      try {
                                        await apiFetch(`/api/plans/${plan.id}/mentors`, {
                                          method: 'POST',
                                          body: JSON.stringify({ mentorName: newMentorName.trim(), value: parseFloat(newMentorValue), notes: newMentorNotes.trim() || undefined }),
                                        })
                                        toast.success(`${newMentorName} atribuido!`)
                                        setAddingMentor(null)
                                        setNewMentorName('')
                                        setNewMentorValue('')
                                        setNewMentorNotes('')
                                        loadMentors(plan.id)
                                      } catch { toast.error('Erro ao atribuir mentor') }
                                      setSavingMentor(false)
                                    }} style={{ background: '#006600', color: 'white', border: '2px solid black', padding: '4px 8px', fontSize: 9, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>OK</button>
                                    <button onClick={() => setAddingMentor(null)} style={{ background: 'white', border: '2px solid black', padding: '4px 8px', fontSize: 9, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>X</button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <button onClick={() => setAddingMentor(plan.id)} style={{ background: 'white', border: '1px dashed #888', padding: '3px 8px', fontSize: 9, cursor: 'pointer', fontFamily: 'var(--font-mono)', color: '#666', flex: 1 }}>+ ATRIBUIR MENTOR</button>
                                    {plan.value - totalMentors > 0 && (
                                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4A78FF', marginLeft: 6 }}>Disponivel: {fmtBRL(plan.value - totalMentors)}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Contracts */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>Contratos</div>
                  <button className="goon-btn-ghost" onClick={() => setShowCreateContract(true)} style={{ fontSize: 11 }}>+ Gerar Contrato</button>
                </div>

                {loadingContracts ? (
                  <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 13 }}>Carregando contratos...</p>
                ) : contracts.length === 0 ? (
                  <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 13 }}>Nenhum contrato gerado ainda.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {contracts.map(contract => {
                      const productCode2 = contract.templateType.toUpperCase()
                      const color = PRODUCT_COLORS[productCode2] ?? 'black'
                      const productName = contract.clientPlan?.product?.name ?? contract.templateType
                      return (
                        <div key={contract.id} style={{ padding: '14px 16px', background: 'var(--retro-gray)', border: '2px solid black', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: color, color: 'white', border: '2px solid black', fontFamily: 'var(--font-pixel)', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>
                              {productCode2}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'black', fontSize: 13, textTransform: 'uppercase' }}>{productName}</span>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <span>v{contract.version}</span>
                                <span>{fmtDate(contract.createdAt)}</span>
                                {(contract.clientPlan?.startDate || contract.dynamicFields?.vigenciaInicio) && (
                                  <span>
                                    Vigência: {contract.dynamicFields?.vigenciaInicio || fmtDate(contract.clientPlan!.startDate)}
                                    {' → '}
                                    {contract.dynamicFields?.vigenciaFim || fmtDate(contract.clientPlan?.endDate)}
                                  </span>
                                )}
                                {contract.clientPlan?.paymentStartDate && contract.clientPlan.paymentStartDate !== contract.clientPlan.startDate && (
                                  <span style={{ color: '#ff6600' }}>
                                    Fin: {fmtDate(contract.clientPlan.paymentStartDate)} → {fmtDate(contract.clientPlan.paymentEndDate)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <ContractStatusBadge status={contract.status} />
                            <ContractSignatureBadge isSigned={contract.isSigned} signatureDate={contract.signatureDate} />
                            <ContractActions contract={contract} onRefresh={fetchContracts} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---- TAB 3: FINANCEIRO ---- */}
          {activeTab === 3 && (
            <div>
              {/* Period card if plans exist */}
              {plans.length > 0 && activePlan && (
                <div style={{ marginBottom: 20, padding: '14px 20px', background: 'var(--retro-gray)', border: '2px solid black', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 20px', fontFamily: 'var(--font-mono)' }}>
                  <span style={{ fontSize: 10, color: '#555', fontWeight: 700, textTransform: 'uppercase', alignSelf: 'center' }}>Vigência do Contrato</span>
                  <span style={{ fontSize: 12, color: 'black', fontWeight: 700 }}>
                    {fmtDate(activePlan.startDate)} → {fmtDate(activePlan.endDate)}
                  </span>
                  {activePlan.paymentStartDate && activePlan.paymentStartDate !== activePlan.startDate && (
                    <>
                      <span style={{ fontSize: 10, color: '#ff6600', fontWeight: 700, textTransform: 'uppercase', alignSelf: 'center' }}>Prazo Financeiro</span>
                      <span style={{ fontSize: 12, color: '#ff6600', fontWeight: 700 }}>
                        {fmtDate(activePlan.paymentStartDate)} → {fmtDate(activePlan.paymentEndDate)}
                        <span style={{ fontSize: 10, marginLeft: 8, color: '#555' }}>(diferente da vigência)</span>
                      </span>
                    </>
                  )}
                </div>
              )}

              {loadingPayments ? (
                <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 13 }}>Carregando pagamentos...</p>
              ) : payments.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 13 }}>Nenhum pagamento registrado.</p>
              ) : (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="goon-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Parcela</th>
                          <th>Vencimento</th>
                          <th>Valor</th>
                          <th>Status</th>
                          <th>Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map(payment => {
                          const isOverdue = payment.status === 'OVERDUE'
                          const now = new Date()
                          const due = new Date(payment.dueDate)
                          const daysUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                          const isDueSoon = payment.status === 'PENDING' && daysUntilDue >= 0 && daysUntilDue <= 5
                          const rowBg = isOverdue ? '#fff0f0' : isDueSoon ? '#fff8ee' : 'transparent'
                          return (
                            <tr key={payment.id} style={{ background: rowBg }}>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>
                                {payment.installment}/{payment.totalInstallments}
                              </td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{fmtDate(payment.dueDate)}</td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>{fmtBRL(payment.value)}</td>
                              <td>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
                                  background: PAYMENT_STATUS_COLORS[payment.status] ?? '#c0c0c0',
                                  color: (payment.status === 'SCHEDULED' || payment.status === 'CANCELLED') ? '#333' : 'white',
                                  border: '1px solid black', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                }}>
                                  {PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}
                                </span>
                              </td>
                              <td>
                                {(payment.status === 'PENDING' || payment.status === 'OVERDUE') && (
                                  <button
                                    disabled={markingPaid === payment.id}
                                    onClick={() => handleMarkPaid(payment.id)}
                                    style={{
                                      background: 'var(--success)', color: 'white', border: '2px solid black',
                                      boxShadow: '2px 2px 0 black', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                                      padding: '4px 10px', cursor: 'pointer', textTransform: 'uppercase',
                                    }}
                                  >
                                    {markingPaid === payment.id ? '...' : '✓ Pago'}
                                  </button>
                                )}
                                {payment.status === 'PAID' && payment.paidAt && (
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#006600' }}>
                                    {fmtDate(payment.paidAt)}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary */}
                  <div style={{ marginTop: 20, padding: '14px 20px', background: 'var(--retro-gray)', border: '2px solid black', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    <div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555', textTransform: 'uppercase', display: 'block', fontWeight: 700, marginBottom: 4 }}>Total Pago</span>
                      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 13, color: '#006600', fontWeight: 800 }}>{fmtBRL(totalPaid)}</span>
                    </div>
                    <div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555', textTransform: 'uppercase', display: 'block', fontWeight: 700, marginBottom: 4 }}>Total Pendente</span>
                      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 13, color: '#000080', fontWeight: 800 }}>{fmtBRL(totalPending)}</span>
                    </div>
                    <div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555', textTransform: 'uppercase', display: 'block', fontWeight: 700, marginBottom: 4 }}>Total Vencido</span>
                      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 13, color: '#cc0000', fontWeight: 800 }}>{fmtBRL(totalOverdue)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ---- TAB 4: PENDÊNCIAS ---- */}
          {activeTab === 4 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setShowResolved(!showResolved)}
                    style={{
                      background: showResolved ? '#333' : 'var(--retro-gray)', color: showResolved ? 'white' : 'black',
                      border: '2px solid black', boxShadow: '2px 2px 0 black', fontFamily: 'var(--font-mono)',
                      fontSize: 11, fontWeight: 700, padding: '6px 12px', cursor: 'pointer', textTransform: 'uppercase',
                    }}
                  >
                    {showResolved ? 'Ocultar Resolvidas' : 'Ver Resolvidas'}
                  </button>
                </div>
                <button
                  onClick={() => setShowNewPendency(true)}
                  className="goon-btn-primary"
                >
                  + Nova Pendência
                </button>
              </div>

              {loadingPendencies ? (
                <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 13 }}>Carregando pendências...</p>
              ) : (
                <>
                  {(() => {
                    const filtered = showResolved
                      ? pendencies
                      : pendencies.filter(p => p.status !== 'RESOLVED')
                    if (filtered.length === 0) {
                      return <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 13 }}>Nenhuma pendência{!showResolved ? ' em aberto' : ''}.</p>
                    }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {filtered.map(pendency => {
                          const typeColor = PENDENCY_TYPE_COLORS[pendency.type] ?? '#c0c0c0'
                          const typeLabel = PENDENCY_TYPE_LABELS[pendency.type] ?? pendency.type
                          const typeIcon = PENDENCY_TYPE_ICONS[pendency.type] ?? '○'
                          const isResolved = pendency.status === 'RESOLVED'
                          return (
                            <div
                              key={pendency.id}
                              style={{
                                padding: '14px 16px',
                                background: isResolved ? '#f9f9f9' : 'white',
                                border: '2px solid black',
                                borderLeft: `4px solid ${typeColor}`,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                gap: 12,
                                flexWrap: 'wrap',
                                opacity: isResolved ? 0.7 : 1,
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: typeColor }}>{typeIcon}</span>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: typeColor, textTransform: 'uppercase' }}>{typeLabel}</span>
                                  {isResolved && (
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#006600', fontWeight: 700, border: '1px solid #006600', padding: '1px 6px' }}>✓ RESOLVIDA</span>
                                  )}
                                </div>
                                {pendency.description && (
                                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#333', margin: '4px 0 0 0', lineHeight: 1.5 }}>{pendency.description}</p>
                                )}
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#888', marginTop: 6 }}>
                                  {fmtDate(pendency.createdAt)}
                                  {pendency.resolvedAt && ` → resolvida em ${fmtDate(pendency.resolvedAt)}`}
                                </div>
                              </div>
                              {!isResolved && (
                                <button
                                  disabled={resolvingId === pendency.id}
                                  onClick={() => handleResolvePendency(pendency.id)}
                                  style={{
                                    background: 'var(--success)', color: 'white', border: '2px solid black',
                                    boxShadow: '2px 2px 0 black', fontFamily: 'var(--font-mono)', fontSize: 11,
                                    fontWeight: 700, padding: '6px 12px', cursor: 'pointer', textTransform: 'uppercase',
                                    flexShrink: 0,
                                  }}
                                >
                                  {resolvingId === pendency.id ? '...' : 'Resolver'}
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddPlan && (
        <AddPlanModal
          clientId={id}
          onClose={() => setShowAddPlan(false)}
          onCreated={plan => { setPlans(prev => [plan, ...prev]); fetchClient() }}
        />
      )}

      {showCreateContract && (
        <CreateContractModal
          clientId={id}
          plans={plans}
          onClose={() => setShowCreateContract(false)}
          onCreated={() => { fetchContracts(); setShowCreateContract(false) }}
        />
      )}

      {showNewPendency && (
        <NewPendencyModal
          clientId={id}
          onClose={() => setShowNewPendency(false)}
          onCreated={fetchPendencies}
        />
      )}
    </div>
  )
}
