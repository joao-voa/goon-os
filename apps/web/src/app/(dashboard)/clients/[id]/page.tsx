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
}

interface Contract {
  id: string
  templateType: string
  status: string
  version: number
  dynamicFields: Record<string, string>
  generatedPdfUrl?: string | null
  createdAt: string
  clientPlan?: {
    id: string
    value: number
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

  if (diffSecs < 60) return 'agora mesmo'
  if (diffMins < 60) return `há ${diffMins}min`
  if (diffHours < 24) return `há ${diffHours}h`
  if (diffDays === 1) return 'há 1 dia'
  if (diffDays < 30) return `há ${diffDays} dias`
  return date.toLocaleDateString('pt-BR')
}

function statusLabel(status: string) {
  const map: Record<string, string> = { ACTIVE: 'Ativo', PROSPECT: 'Prospect', INACTIVE: 'Inativo', CANCELLED: 'Cancelado' }
  return map[status] ?? status
}

function statusClass(status: string) {
  const map: Record<string, string> = {
    ACTIVE: 'goon-badge goon-badge-success',
    PROSPECT: 'goon-badge goon-badge-primary',
    INACTIVE: 'goon-badge goon-badge-muted',
    CANCELLED: 'goon-badge goon-badge-danger',
  }
  return map[status] ?? 'goon-badge goon-badge-muted'
}

function maturityLabel(v?: string) {
  const map: Record<string, string> = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta' }
  return v ? (map[v] ?? v) : '—'
}

function onboardingStageLabel(stage: string) {
  const map: Record<string, string> = {
    CLIENT_CLOSED: 'Cliente Fechado',
    ONBOARDING_STARTED: 'Onboarding Iniciado',
    DOCS_SENT: 'Docs Enviados',
    SETUP_DONE: 'Setup Concluído',
    LIVE: 'Em Produção',
  }
  return map[stage] ?? stage
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
            fontSize: 14,
            color: value != null && String(value) !== '' ? 'var(--goon-text-secondary)' : 'var(--goon-text-muted)',
            cursor: 'pointer',
            padding: '6px 8px',
            borderRadius: 6,
            border: '1px solid transparent',
            minHeight: 34,
            display: 'flex',
            alignItems: 'center',
            transition: 'border-color 0.15s ease, background 0.15s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--goon-border)'
            ;(e.currentTarget as HTMLDivElement).style.background = 'var(--goon-input-bg)'
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
      .catch(() => toast.error('Erro ao carregar produtos'))
      .finally(() => setLoadingProducts(false))
  }, [])

  // Auto-calculate installment value
  useEffect(() => {
    if (paymentType === 'INSTALLMENT' && value && installments && Number(installments) > 0) {
      setInstallmentValue(String(Math.round(Number(value) / Number(installments))))
    }
  }, [value, installments, paymentType])

  // Auto-calculate end date from startDate + cycleDuration
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
    if (!productId) { toast.error('Selecione um produto'); return }
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
      toast.success('Plano adicionado')
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar plano')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box' }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
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
        className="goon-card"
        style={{ width: '100%', maxWidth: 480, padding: 28, margin: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--goon-text-primary)', margin: 0 }}>
            Adicionar Plano
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--goon-text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Product */}
          <div>
            <label className="goon-label" style={{ display: 'block', marginBottom: 6 }}>Produto *</label>
            {loadingProducts ? (
              <p style={{ fontSize: 13, color: 'var(--goon-text-muted)' }}>Carregando produtos...</p>
            ) : (
              <select
                className="goon-select"
                value={productId}
                onChange={e => setProductId(e.target.value)}
                required
                style={inputStyle}
              >
                <option value="">Selecionar produto...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Value */}
          <div>
            <label className="goon-label" style={{ display: 'block', marginBottom: 6 }}>Valor (R$) *</label>
            <input
              className="goon-input"
              type="number"
              min={0}
              step={1}
              value={value}
              onChange={e => setValue(e.target.value)}
              required
              placeholder="0"
              style={inputStyle}
            />
          </div>

          {/* Payment type */}
          <div>
            <label className="goon-label" style={{ display: 'block', marginBottom: 6 }}>Forma de Pagamento *</label>
            <select
              className="goon-select"
              value={paymentType}
              onChange={e => setPaymentType(e.target.value)}
              style={inputStyle}
            >
              <option value="CASH">À Vista</option>
              <option value="INSTALLMENT">Parcelado</option>
              <option value="RECURRING">Recorrente</option>
            </select>
          </div>

          {/* Installments (only for INSTALLMENT) */}
          {paymentType === 'INSTALLMENT' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="goon-label" style={{ display: 'block', marginBottom: 6 }}>Nº Parcelas</label>
                <input
                  className="goon-input"
                  type="number"
                  min={1}
                  value={installments}
                  onChange={e => setInstallments(e.target.value)}
                  placeholder="12"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="goon-label" style={{ display: 'block', marginBottom: 6 }}>Valor da Parcela (R$)</label>
                <input
                  className="goon-input"
                  type="number"
                  min={0}
                  step={1}
                  value={installmentValue}
                  onChange={e => setInstallmentValue(e.target.value)}
                  placeholder="Auto"
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          {/* Cycle & dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="goon-label" style={{ display: 'block', marginBottom: 6 }}>Duração (meses)</label>
              <input
                className="goon-input"
                type="number"
                min={1}
                value={cycleDuration}
                onChange={e => setCycleDuration(e.target.value)}
                placeholder="12"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="goon-label" style={{ display: 'block', marginBottom: 6 }}>Data de Início *</label>
              <input
                className="goon-input"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                required
                style={inputStyle}
              />
            </div>
          </div>

          {/* End date (read-only, auto-calculated) */}
          {endDate && (
            <div>
              <label className="goon-label" style={{ display: 'block', marginBottom: 6 }}>Data de Término (calculada)</label>
              <input
                className="goon-input"
                type="date"
                value={endDate}
                readOnly
                style={{ ...inputStyle, opacity: 0.7, cursor: 'not-allowed' }}
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="goon-label" style={{ display: 'block', marginBottom: 6 }}>Observações</label>
            <textarea
              className="goon-textarea"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Opcional..."
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="goon-btn-ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="goon-btn-primary" disabled={saving || loadingProducts}>
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
    DRAFT: 'goon-badge goon-badge-muted',
    SENT: 'goon-badge goon-badge-warning',
    SIGNED: 'goon-badge goon-badge-success',
    CANCELLED: 'goon-badge goon-badge-danger',
  }
  const labels: Record<string, string> = {
    DRAFT: 'Rascunho',
    SENT: 'Enviado',
    SIGNED: 'Assinado',
    CANCELLED: 'Cancelado',
  }
  return <span className={map[status] ?? 'goon-badge goon-badge-muted'}>{labels[status] ?? status}</span>
}

// ---- Contract Actions (inline) ----
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
    .catch(() => toast.error('Erro ao abrir contrato'))
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
      toast.success(`Status: ${labels[newStatus] ?? newStatus}`)
      onRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao alterar status')
    } finally {
      setBusy(false)
    }
  }

  const btnStyle: React.CSSProperties = {
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid var(--goon-border)',
    background: 'transparent',
    color: 'var(--goon-text-secondary)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <button
        style={btnStyle}
        disabled={busy}
        onClick={() => openContractTab(`/api/contracts/${contract.id}/generate-pdf`, 'POST')}
      >
        Gerar PDF
      </button>
      {contract.generatedPdfUrl && (
        <button
          style={btnStyle}
          disabled={busy}
          onClick={() => openContractTab(`/api/contracts/${contract.id}/download`)}
        >
          Baixar
        </button>
      )}
      {contract.status === 'DRAFT' && (
        <button style={btnStyle} disabled={busy} onClick={() => handleStatus('SENT')}>Enviado</button>
      )}
      {contract.status === 'SENT' && (
        <button style={btnStyle} disabled={busy} onClick={() => handleStatus('SIGNED')}>Assinado</button>
      )}
      {(contract.status === 'DRAFT' || contract.status === 'SENT') && (
        <button style={{ ...btnStyle, color: '#ef4444', borderColor: '#ef444440' }} disabled={busy} onClick={() => handleStatus('CANCELLED')}>
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

  // Auto-derive template from product code
  useEffect(() => {
    if (selectedPlan) {
      setTemplateType(selectedPlan.product.code.toLowerCase())
    }
  }, [selectedPlan])

  // Preview fields
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
    if (!templateType) { toast.error('Template não detectado'); return }
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
      toast.success('Contrato criado com sucesso')
      onCreated()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar contrato')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16, overflowY: 'auto',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="goon-card" style={{ width: '100%', maxWidth: 480, padding: 28, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--goon-text-primary)', margin: 0 }}>
            Gerar Contrato
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--goon-text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Plan selector */}
          <div>
            <label className="goon-label" style={{ display: 'block', marginBottom: 6 }}>Plano</label>
            {plans.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--goon-text-muted)' }}>
                Nenhum plano disponível. Adicione um plano primeiro.
              </p>
            ) : (
              <select
                className="goon-select"
                value={selectedPlanId}
                onChange={e => setSelectedPlanId(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">Sem plano vinculado</option>
                {plans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.product.code} — {p.product.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Template type */}
          <div>
            <label className="goon-label" style={{ display: 'block', marginBottom: 6 }}>Template</label>
            <select
              className="goon-select"
              value={templateType}
              onChange={e => setTemplateType(e.target.value)}
              required
              style={{ width: '100%' }}
            >
              <option value="">Selecionar...</option>
              <option value="ge">GE — Gestão Estratégica</option>
              <option value="gi">GI — Gestão Integrada</option>
              <option value="gs">GS — Gestão Simplificada</option>
            </select>
          </div>

          {/* Preview */}
          {Object.keys(previewFields).length > 0 && (
            <div
              style={{
                background: 'var(--goon-input-bg)',
                borderRadius: 8,
                border: '1px solid var(--goon-border-subtle)',
                padding: 14,
              }}
            >
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--goon-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                Pré-visualização dos campos
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                {Object.entries(previewFields).map(([label, value]) => (
                  <div key={label}>
                    <span style={{ fontSize: 11, color: 'var(--goon-text-muted)', display: 'block' }}>{label}</span>
                    <span style={{ fontSize: 13, color: 'var(--goon-text-secondary)' }}>{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="goon-btn-ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="goon-btn-primary" disabled={saving || !templateType}>
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
    <div className="goon-card" style={{ padding: 24, marginBottom: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--goon-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 20px 0' }}>
        {title}
      </h3>
      {children}
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
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar cliente')
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
      // silent — plans list is non-critical
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
      toast.success('Campo atualizado')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
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
      toast.success(`Status alterado para ${statusLabel(newStatus)}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao alterar status')
    } finally {
      setChangingStatus(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <div style={{
          width: 36,
          height: 36,
          border: '3px solid var(--goon-border)',
          borderTopColor: 'var(--goon-primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    )
  }

  if (!client) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--goon-text-muted)' }}>
        <p>Cliente não encontrado.</p>
        <button className="goon-btn-ghost" onClick={() => router.push('/clients')} style={{ marginTop: 16 }}>
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
          style={{ marginBottom: 16, padding: '6px 14px', fontSize: 13 }}
        >
          ← Clientes
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--goon-text-primary)', margin: '0 0 6px 0' }}>
              {client.companyName}
            </h1>
            {client.tradeName && (
              <p style={{ fontSize: 14, color: 'var(--goon-text-muted)', margin: 0 }}>{client.tradeName}</p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Status dropdown */}
            <div style={{ position: 'relative' }}>
              <select
                className="goon-select"
                value={client.status}
                onChange={e => handleStatusChange(e.target.value)}
                disabled={changingStatus}
                style={{ paddingLeft: 12, paddingRight: 32, fontSize: 13, width: 'auto', cursor: 'pointer' }}
              >
                <option value="ACTIVE">Ativo</option>
                <option value="PROSPECT">Prospect</option>
                <option value="INACTIVE">Inativo</option>
              </select>
            </div>

            {/* WhatsApp */}
            {(client.whatsapp ?? client.phone) && (
              <a
                href={`https://wa.me/${(client.whatsapp ?? client.phone ?? '').replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="goon-btn-ghost"
                style={{ padding: '8px 14px', fontSize: 13, textDecoration: 'none' }}
              >
                💬 WhatsApp
              </a>
            )}

            {/* Email */}
            {client.email && (
              <a
                href={`mailto:${client.email}`}
                className="goon-btn-ghost"
                style={{ padding: '8px 14px', fontSize: 13, textDecoration: 'none' }}
              >
                ✉️ E-mail
              </a>
            )}
          </div>
        </div>

        {/* Status badge display */}
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
          <p style={{ color: 'var(--goon-text-muted)', fontSize: 14 }}>Carregando planos...</p>
        ) : plans.length === 0 ? (
          <p style={{ color: 'var(--goon-text-muted)', fontSize: 14 }}>Nenhum plano vinculado ainda.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {plans.map(plan => {
              const color = PRODUCT_COLORS[plan.product.code] ?? '#6b7280'
              return (
                <div
                  key={plan.id}
                  style={{
                    padding: '14px 16px',
                    background: 'var(--goon-input-bg)',
                    borderRadius: 8,
                    border: '1px solid var(--goon-border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Product badge */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: `${color}22`,
                        color,
                        fontSize: 13,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {plan.product.code}
                    </span>
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--goon-text-primary)', fontSize: 14 }}>
                        {plan.product.name}
                      </span>
                      <div style={{ fontSize: 12, color: 'var(--goon-text-muted)', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <span>{paymentTypeLabel(plan.paymentType)}</span>
                        {plan.installments && <span>{plan.installments}x {fmtBRL(plan.installmentValue ?? undefined)}</span>}
                        <span>Início: {new Date(plan.startDate).toLocaleDateString('pt-BR')}</span>
                        {plan.endDate && <span>Término: {new Date(plan.endDate).toLocaleDateString('pt-BR')}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: 'var(--goon-text-primary)', fontSize: 15 }}>
                      {fmtBRL(plan.value)}
                    </span>
                    <span className={statusClass(plan.status)}>{statusLabel(plan.status)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <button
          className="goon-btn-ghost"
          onClick={() => setShowAddPlan(true)}
          style={{ marginTop: 16 }}
        >
          + Adicionar Plano
        </button>
      </Section>

      {/* Add Plan Modal */}
      {showAddPlan && (
        <AddPlanModal
          clientId={id}
          onClose={() => setShowAddPlan(false)}
          onCreated={plan => {
            setPlans(prev => [plan, ...prev])
            // Refresh client to get updated onboarding
            fetchClient()
          }}
        />
      )}

      {/* Contracts Section */}
      <Section title="Contratos">
        {loadingContracts ? (
          <p style={{ color: 'var(--goon-text-muted)', fontSize: 14 }}>Carregando contratos...</p>
        ) : contracts.length === 0 ? (
          <p style={{ color: 'var(--goon-text-muted)', fontSize: 14 }}>Nenhum contrato gerado ainda.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {contracts.map(contract => {
              const productCode = contract.templateType.toUpperCase()
              const color = PRODUCT_COLORS[productCode] ?? '#6b7280'
              const productName = contract.clientPlan?.product?.name ?? contract.templateType

              return (
                <div
                  key={contract.id}
                  style={{
                    padding: '14px 16px',
                    background: 'var(--goon-input-bg)',
                    borderRadius: 8,
                    border: '1px solid var(--goon-border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                    <span
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 36, height: 36, borderRadius: 6, background: `${color}22`,
                        color, fontSize: 12, fontWeight: 800, flexShrink: 0,
                      }}
                    >
                      {productCode}
                    </span>
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--goon-text-primary)', fontSize: 14 }}>{productName}</span>
                      <div style={{ fontSize: 12, color: 'var(--goon-text-muted)', marginTop: 2, display: 'flex', gap: 8 }}>
                        <span>v{contract.version}</span>
                        <span>{new Date(contract.createdAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <ContractStatusBadge status={contract.status} />
                    <ContractActions contract={contract} onRefresh={fetchContracts} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <button
          className="goon-btn-ghost"
          onClick={() => setShowCreateContract(true)}
          style={{ marginTop: 16 }}
        >
          + Gerar Contrato
        </button>
      </Section>

      {/* Create Contract Modal */}
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
              <p style={{ fontSize: 13, color: 'var(--goon-text-muted)', margin: '0 0 6px 0' }}>Etapa atual</p>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: (STAGE_COLORS[client.onboarding.currentStage] ?? '#888') + '22',
                  color: STAGE_COLORS[client.onboarding.currentStage] ?? '#888',
                  border: `1px solid ${(STAGE_COLORS[client.onboarding.currentStage] ?? '#888')}44`,
                  borderRadius: 10,
                  padding: '3px 10px',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: STAGE_COLORS[client.onboarding.currentStage] ?? '#888',
                    flexShrink: 0,
                  }}
                />
                {STAGE_LABELS[client.onboarding.currentStage] ?? client.onboarding.currentStage}
              </span>
            </div>
            <a
              href="/onboarding"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                background: 'transparent',
                border: '1px solid var(--goon-border)',
                borderRadius: 8,
                color: 'var(--goon-text-secondary)',
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              Ver no Kanban →
            </a>
          </div>
        ) : (
          <p style={{ color: 'var(--goon-text-muted)', fontSize: 14 }}>Sem onboarding registrado.</p>
        )}
      </Section>

      {/* Activity Log */}
      <Section title="Histórico de Atividades">
        {client.activityLogs.length === 0 ? (
          <p style={{ color: 'var(--goon-text-muted)', fontSize: 14 }}>Nenhuma atividade registrada.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {client.activityLogs.map(log => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: '1px solid var(--goon-border-subtle)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--goon-text-secondary)' }}>
                    {log.description ?? log.action}
                  </div>
                  {log.fromValue && log.toValue && (
                    <div style={{ fontSize: 12, color: 'var(--goon-text-muted)', marginTop: 3 }}>
                      {log.fromValue} → {log.toValue}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--goon-text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {relativeTime(log.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
