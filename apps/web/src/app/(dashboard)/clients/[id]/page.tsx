'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { PRODUCT_COLORS, STAGE_LABELS, STAGE_COLORS } from '@/lib/constants'

// ---- Helpers ----
const fmtBRL = (n?: number | null) =>
  n != null
    ? new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
      }).format(n)
    : '—'

// ---- Types ----
interface Product {
  id: string
  code: string
  name: string
  isActive?: boolean
}

interface PaymentStats {
  total: number
  paid: number
  overdue: number
  pending: number
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
  notes?: string | null
  product: Product
  paymentStats?: PaymentStats | null
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
  tradeName?: string
  cnpj?: string
  responsible: string
  phone?: string
  email?: string
  whatsapp?: string
  segment?: string
  address?: string
  addressNumber?: string
  neighborhood?: string
  city?: string
  state?: string
  zipCode?: string
  employeeCount?: string
  estimatedRevenue?: string
  mainPains?: string
  strategicGoals?: string
  maturity?: string
  goonFitScore?: number
  status: string
  plans: ClientPlan[]
  contracts: Contract[]
  onboarding?: Onboarding
  activityLogs: ActivityLog[]
  createdAt: string
  updatedAt: string
}

// ---- Helpers ----
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

function maturityLabel(v?: string) {
  const map: Record<string, string> = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta' }
  return v ? (map[v] ?? v) : '—'
}

// ---- Inline editable field ----
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
    if (draft === (value != null ? String(value) : '')) {
      setEditing(false)
      return
    }
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
            <textarea
              className="goon-textarea"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              autoFocus
              style={{ minHeight: 80 }}
            />
          ) : type === 'select' && options ? (
            <select
              className="goon-select"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={handleSave}
              autoFocus
            >
              <option value="">Selecionar...</option>
              {options.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <input
              className="goon-input"
              type={type}
              min={min}
              max={max}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              autoFocus
              disabled={saving}
            />
          )}
        </div>
      ) : (
        <div
          onClick={() => { setDraft(value != null ? String(value) : ''); setEditing(true) }}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            color: value != null && String(value) !== '' ? 'black' : '#aaa',
            cursor: 'pointer',
            padding: '6px 8px',
            border: '1px solid transparent',
            minHeight: 34,
            display: 'flex',
            alignItems: 'center',
            transition: 'border-color 0.1s, background 0.1s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLDivElement).style.borderColor = 'black'
            ;(e.currentTarget as HTMLDivElement).style.background = '#f5f5f5'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'
            ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
          }}
          title="Clique para editar"
        >
          {type === 'select' && options
            ? (options.find(o => o.value === displayValue)?.label ?? displayValue)
            : displayValue}
        </div>
      )}
    </div>
  )
}

// ---- Payment type label ----
function paymentTypeLabel(pt: string) {
  const map: Record<string, string> = {
    CASH: 'À Vista',
    INSTALLMENT: 'Parcelado',
    RECURRING: 'Recorrente',
  }
  return map[pt] ?? pt
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
      ? (() => {
          const d = new Date(startDate)
          d.setMonth(d.getMonth() + Number(cycleDuration))
          return d.toISOString().slice(0, 10)
        })()
      : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!productId) { toast.error('[ERRO] Selecione um produto'); return }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        productId,
        value: Number(value),
        paymentType,
        startDate,
      }
      if (paymentType === 'INSTALLMENT') {
        if (installments) body.installments = Number(installments)
        if (installmentValue) body.installmentValue = Number(installmentValue)
      }
      if (cycleDuration) body.cycleDuration = Number(cycleDuration)
      if (notes) body.notes = notes

      const created = await apiFetch<ClientPlan>(`/api/clients/${clientId}/plans`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      onCreated(created)
      toast.success('[OK] Plano adicionado')
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao criar plano')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
        overflowY: 'auto',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'white',
          border: '2px solid black',
          boxShadow: '8px 8px 0px 0px #000',
          margin: 'auto',
        }}
      >
        <div style={{
          background: 'black',
          color: 'white',
          fontFamily: 'var(--font-pixel)',
          fontSize: 10,
          textTransform: 'uppercase',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          letterSpacing: 1,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}>
          <span>Adicionar Plano</span>
          <button onClick={onClose} style={{ background: 'var(--danger)', border: '1px solid white', color: 'white', cursor: 'pointer', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700 }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Product */}
          <div>
            <label className="goon-label">Produto *</label>
            {loadingProducts ? (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555' }}>Carregando produtos...</p>
            ) : (
              <select className="goon-select" value={productId} onChange={e => setProductId(e.target.value)} required style={{ width: '100%' }}>
                <option value="">Selecionar produto...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
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
            <button
              type="submit"
              disabled={saving || loadingProducts}
              style={{
                background: '#ccff00',
                color: 'black',
                border: '2px solid black',
                boxShadow: '4px 4px 0px black',
                fontFamily: 'var(--font-pixel)',
                fontSize: 10,
                textTransform: 'uppercase',
                padding: '10px 20px',
                cursor: 'pointer',
                transition: 'transform 0.1s, box-shadow 0.1s',
                borderRadius: 0,
                letterSpacing: 0.5,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                textDecoration: 'none',
                fontWeight: 700,
              }}
            >
              {saving ? 'Salvando...' : 'Adicionar Plano'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---- Contract Status Badge ----
function ContractStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: 'goon-badge goon-badge-draft',
    SENT: 'goon-badge goon-badge-sent',
    SIGNED: 'goon-badge goon-badge-signed',
    CANCELLED: 'goon-badge goon-badge-danger',
  }
  const labels: Record<string, string> = {
    DRAFT: 'Rascunho',
    SENT: 'Enviado',
    SIGNED: 'Assinado',
    CANCELLED: 'Cancelado',
  }
  return <span className={map[status] ?? 'goon-badge goon-badge-inactive'}>{labels[status] ?? status}</span>
}

// ---- Contract Signature Badge ----
function ContractSignatureBadge({ isSigned, signatureDate }: { isSigned?: boolean; signatureDate?: string | null }) {
  const fmtD = (d?: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : ''
  if (isSigned) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '2px 7px',
        background: 'var(--success)',
        color: 'white',
        border: '1px solid black',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}>
        &#10003; ASSINADO{signatureDate ? ` ${fmtD(signatureDate)}` : ''}
      </span>
    )
  }
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      padding: '2px 7px',
      background: 'var(--danger)',
      color: 'white',
      border: '1px solid black',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      fontWeight: 700,
    }}>
      &#10007; PENDENTE
    </span>
  )
}

// ---- Contract Actions ----
const CONTRACT_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function openContractTab(path: string, method: 'GET' | 'POST' = 'GET') {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  fetch(`${CONTRACT_API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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
      await apiFetch(`/api/contracts/${contract.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
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
      await apiFetch(`/api/contracts/${contract.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isSigned: true, signatureDate: new Date().toISOString() }),
      })
      toast.success('[OK] Contrato marcado como assinado')
      onRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao marcar assinatura')
    } finally {
      setBusy(false)
    }
  }

  const btnStyle: React.CSSProperties = {
    padding: '4px 10px',
    border: '2px solid black',
    background: 'var(--retro-gray)',
    color: 'black',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    boxShadow: '2px 2px 0 black',
    transition: 'transform 0.1s, box-shadow 0.1s',
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <button style={btnStyle} disabled={busy} onClick={() => openContractTab(`/api/contracts/${contract.id}/generate-pdf`, 'POST')}>
        Gerar PDF
      </button>
      {contract.generatedPdfUrl && (
        <button style={btnStyle} disabled={busy} onClick={() => openContractTab(`/api/contracts/${contract.id}/download`)}>
          Baixar
        </button>
      )}
      {!contract.isSigned && contract.status !== 'CANCELLED' && (
        <button
          style={{ ...btnStyle, background: 'var(--success)', color: 'white', boxShadow: '2px 2px 0 black' }}
          disabled={busy}
          onClick={handleMarkSigned}
        >
          ✓ Assinar
        </button>
      )}
      {contract.status === 'DRAFT' && (
        <button style={btnStyle} disabled={busy} onClick={() => handleStatus('SENT')}>Enviado</button>
      )}
      {contract.status === 'SENT' && (
        <button style={btnStyle} disabled={busy} onClick={() => handleStatus('SIGNED')}>Assinado</button>
      )}
      {(contract.status === 'DRAFT' || contract.status === 'SENT') && (
        <button style={{ ...btnStyle, background: 'var(--danger)', color: 'white', boxShadow: '2px 2px 0 black' }} disabled={busy} onClick={() => handleStatus('CANCELLED')}>
          Cancelar
        </button>
      )}
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
    if (selectedPlan) {
      setTemplateType(selectedPlan.product.code.toLowerCase())
    }
  }, [selectedPlan])

  const previewFields = selectedPlan
    ? {
        Produto: selectedPlan.product.name,
        Valor: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(selectedPlan.value),
        Início: new Date(selectedPlan.startDate).toLocaleDateString('pt-BR'),
        Duração: selectedPlan.cycleDuration ? `${selectedPlan.cycleDuration} meses` : '—',
      }
    : {}

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!templateType) { toast.error('[ERRO] Template não detectado'); return }
    setSaving(true)
    try {
      await apiFetch('/api/contracts', {
        method: 'POST',
        body: JSON.stringify({
          clientId,
          clientPlanId: selectedPlanId || undefined,
          templateType,
        }),
      })
      toast.success('[OK] Contrato criado')
      onCreated()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao criar contrato')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16, overflowY: 'auto' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
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
                {plans.map(p => (
                  <option key={p.id} value={p.id}>{p.product.code} — {p.product.name}</option>
                ))}
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
                {Object.entries(previewFields).map(([label, value]) => (
                  <div key={label}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555', display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>{label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'black' }}>{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '2px solid black', paddingTop: 16 }}>
            <button type="button" className="goon-btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button
              type="submit"
              disabled={saving || !templateType}
              style={{
                background: '#ccff00',
                color: 'black',
                border: '2px solid black',
                boxShadow: '4px 4px 0px black',
                fontFamily: 'var(--font-pixel)',
                fontSize: 10,
                textTransform: 'uppercase',
                padding: '10px 20px',
                cursor: 'pointer',
                transition: 'transform 0.1s, box-shadow 0.1s',
                borderRadius: 0,
                letterSpacing: 0.5,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                textDecoration: 'none',
                fontWeight: 700,
              }}
            >
              {saving ? 'Criando...' : 'Criar Contrato'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---- Section wrapper ----
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'white',
      border: '2px solid black',
      boxShadow: '4px 4px 0px 0px #000',
      marginBottom: 20,
      overflow: 'hidden',
    }}>
      <div style={{
        background: 'black',
        color: 'white',
        fontFamily: 'var(--font-pixel)',
        fontSize: 9,
        textTransform: 'uppercase',
        padding: '8px 16px',
        letterSpacing: 1,
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
        backgroundSize: '16px 16px',
      }}>
        {title}
      </div>
      <div style={{ padding: 24 }}>
        {children}
      </div>
    </div>
  )
}

// ---- Main Page ----
export default function ClientDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [client, setClient] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [changingStatus, setChangingStatus] = useState(false)
  const [showAddPlan, setShowAddPlan] = useState(false)
  const [plans, setPlans] = useState<ClientPlan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loadingContracts, setLoadingContracts] = useState(false)
  const [showCreateContract, setShowCreateContract] = useState(false)

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
    } catch {
      // silent
    } finally {
      setLoadingPlans(false)
    }
  }, [id])

  const fetchContracts = useCallback(async () => {
    setLoadingContracts(true)
    try {
      const result = await apiFetch<{ data: Contract[]; total: number }>(`/api/contracts?clientId=${id}&limit=50`)
      setContracts(result.data)
    } catch {
      // silent
    } finally {
      setLoadingContracts(false)
    }
  }, [id])

  useEffect(() => {
    fetchClient()
    fetchPlans()
    fetchContracts()
  }, [fetchClient, fetchPlans, fetchContracts])

  const handleSaveField = async (field: string, value: string) => {
    try {
      const payload: Record<string, unknown> = {}
      if (field === 'goonFitScore') {
        payload[field] = value === '' ? null : parseInt(value, 10)
      } else {
        payload[field] = value === '' ? null : value
      }
      const updated = await apiFetch<ClientDetail>(`/api/clients/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
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
      const updated = await apiFetch<ClientDetail>(`/api/clients/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      })
      setClient(updated)
      toast.success(`[OK] Status → ${statusLabel(newStatus)}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao alterar status')
    } finally {
      setChangingStatus(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, gap: 12 }}>
        <div style={{
          width: 32,
          height: 32,
          border: '3px solid black',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!client) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 13 }}>Cliente não encontrado.</p>
        <button className="goon-btn-secondary" onClick={() => router.push('/clients')} style={{ marginTop: 16 }}>
          ← Voltar
        </button>
      </div>
    )
  }

  const fieldGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 20,
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          className="goon-btn-ghost"
          onClick={() => router.push('/clients')}
          style={{ marginBottom: 16, fontSize: 11 }}
        >
          ← Clientes
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: 16, fontWeight: 800, color: 'black', margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: 1 }}>
              {client.companyName}
            </h1>
            {client.tradeName && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555', margin: 0 }}>{client.tradeName}</p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="goon-select"
              value={client.status}
              onChange={e => handleStatusChange(e.target.value)}
              disabled={changingStatus}
              style={{ width: 'auto', cursor: 'pointer' }}
            >
              <option value="ACTIVE">Ativo</option>
              <option value="PROSPECT">Prospect</option>
              <option value="INACTIVE">Inativo</option>
            </select>

            {(client.whatsapp ?? client.phone) && (
              <a
                href={`https://wa.me/${(client.whatsapp ?? client.phone ?? '').replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="goon-btn-secondary"
                style={{ textDecoration: 'none', background: 'var(--success)', color: 'white', border: '2px solid black' }}
              >
                WhatsApp
              </a>
            )}

            {client.email && (
              <a
                href={`mailto:${client.email}`}
                className="goon-btn-secondary"
                style={{ textDecoration: 'none' }}
              >
                E-mail
              </a>
            )}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <span className={statusClass(client.status)}>{statusLabel(client.status)}</span>
        </div>
      </div>

      {/* Info Section */}
      <Section title="Informações Gerais">
        <div style={fieldGrid}>
          <InlineField label="Empresa" value={client.companyName} field="companyName" onSave={handleSaveField} />
          <InlineField label="Nome Fantasia" value={client.tradeName} field="tradeName" onSave={handleSaveField} />
          <InlineField label="CNPJ" value={client.cnpj} field="cnpj" onSave={handleSaveField} />
          <InlineField label="Responsável" value={client.responsible} field="responsible" onSave={handleSaveField} />
          <InlineField label="Telefone" value={client.phone} field="phone" type="tel" onSave={handleSaveField} />
          <InlineField label="E-mail" value={client.email} field="email" type="email" onSave={handleSaveField} />
          <InlineField label="WhatsApp" value={client.whatsapp} field="whatsapp" type="tel" onSave={handleSaveField} />
          <InlineField label="Segmento" value={client.segment} field="segment" onSave={handleSaveField} />
        </div>

        <hr className="goon-divider" style={{ margin: '20px 0' }} />
        <p className="goon-label" style={{ marginBottom: 16 }}>Endereço</p>
        <div style={fieldGrid}>
          <InlineField label="Logradouro" value={client.address} field="address" onSave={handleSaveField} />
          <InlineField label="Número" value={client.addressNumber} field="addressNumber" onSave={handleSaveField} />
          <InlineField label="Bairro" value={client.neighborhood} field="neighborhood" onSave={handleSaveField} />
          <InlineField label="Cidade" value={client.city} field="city" onSave={handleSaveField} />
          <InlineField label="Estado" value={client.state} field="state" onSave={handleSaveField} />
          <InlineField label="CEP" value={client.zipCode} field="zipCode" onSave={handleSaveField} />
        </div>

        <hr className="goon-divider" style={{ margin: '20px 0' }} />
        <p className="goon-label" style={{ marginBottom: 16 }}>Dados Comerciais</p>
        <div style={fieldGrid}>
          <InlineField label="Nº de Funcionários" value={client.employeeCount} field="employeeCount" onSave={handleSaveField} />
          <InlineField label="Faturamento Estimado" value={client.estimatedRevenue} field="estimatedRevenue" onSave={handleSaveField} />
        </div>
      </Section>

      {/* Strategic Section */}
      <Section title="Dados Estratégicos">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <InlineField label="Principais Dores" value={client.mainPains} field="mainPains" type="textarea" onSave={handleSaveField} />
          <InlineField label="Objetivos Estratégicos" value={client.strategicGoals} field="strategicGoals" type="textarea" onSave={handleSaveField} />
          <div style={fieldGrid}>
            <InlineField
              label="Maturidade"
              value={client.maturity}
              field="maturity"
              type="select"
              options={[
                { value: 'LOW', label: 'Baixa' },
                { value: 'MEDIUM', label: 'Média' },
                { value: 'HIGH', label: 'Alta' },
              ]}
              onSave={handleSaveField}
            />
            <InlineField
              label="Goon Fit Score (1-10)"
              value={client.goonFitScore}
              field="goonFitScore"
              type="number"
              min={1}
              max={10}
              onSave={handleSaveField}
            />
          </div>
        </div>
      </Section>

      {/* Plans Section */}
      <Section title="Planos">
        {loadingPlans ? (
          <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 13 }}>Carregando planos...</p>
        ) : plans.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 13 }}>Nenhum plano vinculado ainda.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {plans.map(plan => {
              const codeColors: Record<string, string> = { GE: 'var(--retro-blue)', GI: 'var(--success)', GS: 'var(--warning)' }
              const color = codeColors[plan.product.code] ?? 'black'
              return (
                <div
                  key={plan.id}
                  style={{
                    background: 'var(--retro-gray)',
                    border: '2px solid black',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0,
                  }}
                >
                  <div style={{
                    padding: '14px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 40,
                          height: 40,
                          background: color,
                          color: 'white',
                          border: '2px solid black',
                          fontFamily: 'var(--font-pixel)',
                          fontSize: 10,
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        {plan.product.code}
                      </span>
                      <div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'black', fontSize: 13, textTransform: 'uppercase' }}>
                          {plan.product.name}
                        </span>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <span>{paymentTypeLabel(plan.paymentType)}</span>
                          {plan.installments && <span>{plan.installments}x {fmtBRL(plan.installmentValue ?? undefined)}</span>}
                          <span>Início: {new Date(plan.startDate).toLocaleDateString('pt-BR')}</span>
                          {plan.endDate && <span>Término: {new Date(plan.endDate).toLocaleDateString('pt-BR')}</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-pixel)', fontWeight: 700, color: 'black', fontSize: 12 }}>
                        {fmtBRL(plan.value)}
                      </span>
                      <span className={statusClass(plan.status)}>{statusLabel(plan.status)}</span>
                    </div>
                  </div>
                  {plan.paymentStats && (
                    <div style={{
                      padding: '6px 14px',
                      borderTop: '1px solid black',
                      background: 'white',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: '#333',
                      display: 'flex',
                      gap: 10,
                      flexWrap: 'wrap',
                      alignItems: 'center',
                    }}>
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
                </div>
              )
            })}
          </div>
        )}
        <button className="goon-btn-ghost" onClick={() => setShowAddPlan(true)} style={{ marginTop: 16 }}>
          + Adicionar Plano
        </button>
      </Section>

      {showAddPlan && (
        <AddPlanModal
          clientId={id}
          onClose={() => setShowAddPlan(false)}
          onCreated={plan => {
            setPlans(prev => [plan, ...prev])
            fetchClient()
          }}
        />
      )}

      {/* Contracts Section */}
      <Section title="Contratos">
        {loadingContracts ? (
          <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 13 }}>Carregando contratos...</p>
        ) : contracts.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 13 }}>Nenhum contrato gerado ainda.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {contracts.map(contract => {
              const productCode = contract.templateType.toUpperCase()
              const codeColors: Record<string, string> = { GE: 'var(--retro-blue)', GI: 'var(--success)', GS: 'var(--warning)' }
              const color = codeColors[productCode] ?? 'black'
              const productName = contract.clientPlan?.product?.name ?? contract.templateType

              return (
                <div
                  key={contract.id}
                  style={{
                    padding: '14px 16px',
                    background: 'var(--retro-gray)',
                    border: '2px solid black',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 36, height: 36, background: color,
                        color: 'white', border: '2px solid black',
                        fontFamily: 'var(--font-pixel)', fontSize: 9, fontWeight: 800, flexShrink: 0,
                      }}
                    >
                      {productCode}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'black', fontSize: 13, textTransform: 'uppercase' }}>{productName}</span>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span>v{contract.version}</span>
                        <span>{new Date(contract.createdAt).toLocaleDateString('pt-BR')}</span>
                        {/* Vigência */}
                        {(contract.clientPlan?.startDate || contract.dynamicFields?.vigenciaInicio) && (
                          <span>
                            Vigência: {contract.dynamicFields?.vigenciaInicio || new Date(contract.clientPlan!.startDate!).toLocaleDateString('pt-BR')}
                            {' '}→{' '}
                            {contract.dynamicFields?.vigenciaFim || (contract.clientPlan?.endDate ? new Date(contract.clientPlan.endDate).toLocaleDateString('pt-BR') : '—')}
                          </span>
                        )}
                        {/* Prazo financeiro (if different from vigência) */}
                        {contract.clientPlan?.paymentStartDate && contract.clientPlan.paymentStartDate !== contract.clientPlan.startDate && (
                          <span style={{ color: '#888' }}>
                            Fin: {new Date(contract.clientPlan.paymentStartDate).toLocaleDateString('pt-BR')}
                            {' '}→{' '}
                            {contract.clientPlan?.paymentEndDate ? new Date(contract.clientPlan.paymentEndDate).toLocaleDateString('pt-BR') : '—'}
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
        <button className="goon-btn-ghost" onClick={() => setShowCreateContract(true)} style={{ marginTop: 16 }}>
          + Gerar Contrato
        </button>
      </Section>

      {showCreateContract && (
        <CreateContractModal
          clientId={id}
          plans={plans}
          onClose={() => setShowCreateContract(false)}
          onCreated={() => {
            fetchContracts()
            setShowCreateContract(false)
          }}
        />
      )}

      {/* Onboarding Section */}
      <Section title="Onboarding">
        {client.onboarding ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <label className="goon-label" style={{ marginBottom: 8 }}>Etapa atual</label>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 10px',
                  background: STAGE_COLORS[client.onboarding.currentStage] ?? '#888',
                  color: client.onboarding.currentStage === 'ONBOARDING_DONE' ? 'black' : 'white',
                  border: '1px solid black',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {STAGE_LABELS[client.onboarding.currentStage] ?? client.onboarding.currentStage}
              </span>
            </div>
            <a href="/onboarding" className="goon-btn-secondary" style={{ textDecoration: 'none' }}>
              Ver no Kanban →
            </a>
          </div>
        ) : (
          <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 13 }}>Sem onboarding registrado.</p>
        )}
      </Section>

      {/* Activity Log */}
      <Section title="Histórico de Atividades">
        {client.activityLogs.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 13 }}>Nenhuma atividade registrada.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {client.activityLogs.map((log, idx) => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '10px 0',
                  borderBottom: idx < client.activityLogs.length - 1 ? '1px solid black' : 'none',
                }}
              >
                <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'black', fontWeight: 700, flexShrink: 0, marginTop: 2 }}>{'>'}</span>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'black' }}>
                      {log.description ?? log.action}
                    </div>
                    {log.fromValue && log.toValue && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555', marginTop: 3 }}>
                        {log.fromValue} → {log.toValue}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  [{relativeTime(log.createdAt)}]
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
