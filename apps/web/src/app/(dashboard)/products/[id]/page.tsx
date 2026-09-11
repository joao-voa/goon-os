'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useIsMobile } from '@/hooks/useMediaQuery'
import {
  PRODUCT_COLORS,
  PRODUCT_NAMES,
  PAYMENT_STATUS_LABELS,
} from '@/lib/constants'

// ---- Palette ----
const C = { ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0', bg: '#f8fafc', neon: '#C7F900', green: '#16a34a', greenDk: '#15803d', red: '#dc2626', amber: '#f59e0b', slate: '#475569' }
const num: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }
const card: React.CSSProperties = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }

// ---- Types ----
interface Product {
  id: string
  code: string
  name: string
  description?: string | null
  isActive: boolean
  _count: { plans: number }
}

interface ClientSummary {
  id: string
  companyName: string
  responsible: string
  status: string
  plans: {
    id: string
    status: string
    value: number
    startDate: string
    endDate?: string | null
    product: { id: string; code: string; name: string }
  }[]
  contracts: {
    id: string
    status: string
    isSigned?: boolean
  }[]
  _pendenciesCount?: number
}

interface ContractRow {
  id: string
  status: string
  isSigned?: boolean
  signatureDate?: string | null
  createdAt: string
  templateType: string
  client: { id: string; companyName: string }
  clientPlan?: {
    id: string
    startDate?: string | null
    endDate?: string | null
    product: { id: string; code: string; name: string }
  } | null
}

interface PaymentRow {
  id: string
  installment: number
  totalInstallments: number
  dueDate: string
  value: number
  status: string
  paidAt?: string | null
  client: { id: string; companyName: string }
  clientPlan?: { id: string; product: { code: string; name: string } } | null
}

interface MentorRow {
  id: string
  mentorName: string
  value: number
  notes: string | null
}

// ---- Helpers ----
const fmtBRL = (n?: number | null) =>
  n != null
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)
    : '—'

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—')

function statusLabel(s: string) {
  const map: Record<string, string> = { ACTIVE: 'Ativo', PROSPECT: 'Prospect', INACTIVE: 'Inativo', CANCELLED: 'Cancelado' }
  return map[s] ?? s
}

// ---- Soft pill badges ----
const pill = (bg: string, fg: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 10px',
  borderRadius: 100,
  background: bg,
  color: fg,
  fontFamily: 'var(--font-sans)',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
  whiteSpace: 'nowrap',
})

const CLIENT_STATUS_SOFT: Record<string, [string, string]> = {
  ACTIVE: ['#dcfce7', '#166534'],
  PROSPECT: ['#dbeafe', '#1e40af'],
  INACTIVE: ['#f1f5f9', '#64748b'],
  CANCELLED: ['#fef2f2', '#dc2626'],
}
const CONTRACT_STATUS_SOFT: Record<string, [string, string]> = {
  DRAFT: ['#f1f5f9', '#64748b'],
  SENT: ['#fef3c7', '#92400e'],
  SIGNED: ['#dcfce7', '#166534'],
  CANCELLED: ['#fef2f2', '#dc2626'],
  RENEWAL: ['#ffedd5', '#9a3412'],
}
const PAYMENT_STATUS_SOFT: Record<string, [string, string]> = {
  PAID: ['#dcfce7', '#166534'],
  PENDING: ['#dbeafe', '#1e40af'],
  OVERDUE: ['#fef2f2', '#dc2626'],
  SCHEDULED: ['#f1f5f9', '#64748b'],
  CANCELLED: ['#f1f5f9', '#64748b'],
}
const NEUTRAL_SOFT: [string, string] = ['#f1f5f9', '#64748b']

function statusBadgeStyle(s: string): React.CSSProperties {
  const [bg, fg] = CLIENT_STATUS_SOFT[s] ?? NEUTRAL_SOFT
  return pill(bg, fg)
}

function contractStatusLabel(s: string) {
  const map: Record<string, string> = { DRAFT: 'Rascunho', SENT: 'Enviado', SIGNED: 'Assinado', CANCELLED: 'Cancelado' }
  return map[s] ?? s
}

// ---- Tab Component ----
interface TabBarProps {
  tabs: string[]
  active: number
  onChange: (i: number) => void
}

function TabBar({ tabs, active, onChange }: TabBarProps) {
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${C.line}`, padding: '0 8px' }}>
      {tabs.map((tab, i) => (
        <button
          key={tab}
          onClick={() => onChange(i)}
          style={{
            padding: '11px 16px',
            background: 'transparent',
            color: i === active ? C.ink : C.dim,
            border: 'none',
            borderBottom: i === active ? `2px solid ${C.neon}` : '2px solid transparent',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            fontWeight: i === active ? 700 : 500,
            letterSpacing: '0.01em',
            cursor: 'pointer',
            marginBottom: -1,
            textTransform: 'capitalize',
          }}
        >
          {tab.charAt(0) + tab.slice(1).toLowerCase()}
        </button>
      ))}
    </div>
  )
}

// ---- KPI Card ----
interface KpiCardProps {
  label: string
  value: string | number
  color?: string
  onClick?: () => void
}

function KpiCard({ label, value, color = C.ink, onClick }: KpiCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        ...card,
        padding: '14px 16px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.12s, box-shadow 0.12s',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
      }}
      onMouseEnter={e => {
        if (!onClick) return
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 16px -6px rgba(0,0,0,0.12)'
      }}
      onMouseLeave={e => {
        if (!onClick) return
        ;(e.currentTarget as HTMLDivElement).style.transform = ''
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = card.boxShadow as string
      }}
    >
      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 11,
        color: C.mid,
        textTransform: 'uppercase',
        fontWeight: 600,
        letterSpacing: '0.05em',
      }}>
        {label}
      </div>
      <div style={{
        ...num,
        fontSize: 22,
        color,
        fontWeight: 700,
      }}>
        {value}
      </div>
    </div>
  )
}

// ---- Edit Product Modal ----
interface EditProductModalProps {
  product: Product
  onClose: () => void
  onSaved: (updated: Product) => void
}

function EditProductModal({ product, onClose, onSaved }: EditProductModalProps) {
  const [name, setName] = useState(product.name)
  const [description, setDescription] = useState(product.description ?? '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await apiFetch<Product>(`/api/products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, description: description || null }),
      })
      onSaved(updated)
      toast.success('[OK] Programa atualizado')
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao salvar programa')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: '100%', maxWidth: 440, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 20px 40px -12px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: C.ink }}>Editar Programa</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.dim, cursor: 'pointer', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="goon-label">Nome</label>
            <input className="goon-input" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <label className="goon-label">Descrição</label>
            <textarea className="goon-textarea" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4, borderTop: `1px solid ${C.line}`, paddingTop: 16 }}>
            <button type="button" className="goon-btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="goon-btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---- Main Page ----
export default function ProductDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const isMobile = useIsMobile()

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [loadingContracts, setLoadingContracts] = useState(false)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [showEditModal, setShowEditModal] = useState(false)

  // Mentor state
  const [mentors, setMentors] = useState<Record<string, MentorRow[]>>({})
  const [addingMentor, setAddingMentor] = useState<string | null>(null)
  const [newMentorName, setNewMentorName] = useState('')
  const [newMentorValue, setNewMentorValue] = useState('')
  const [savingMentor, setSavingMentor] = useState(false)
  const [suggestions, setSuggestions] = useState<{ salesReps: string[]; mentors: string[] }>({ salesReps: [], mentors: [] })

  const fetchProduct = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<Product>(`/api/products/${id}`)
      setProduct(data)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao carregar programa')
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchClients = useCallback(async (code: string) => {
    setLoadingClients(true)
    try {
      const data = await apiFetch<{ data: ClientSummary[]; total: number }>(`/api/clients?product=${code}&limit=200`)
      setClients(data.data)
    } catch {
      // silent
    } finally {
      setLoadingClients(false)
    }
  }, [])

  const fetchContracts = useCallback(async (code: string) => {
    setLoadingContracts(true)
    try {
      const data = await apiFetch<{ data: ContractRow[]; total: number }>(`/api/contracts?product=${code}&limit=200`)
      setContracts(data.data)
    } catch {
      // silent
    } finally {
      setLoadingContracts(false)
    }
  }, [])

  const fetchPayments = useCallback(async (code: string) => {
    setLoadingPayments(true)
    try {
      const data = await apiFetch<{ data: PaymentRow[]; total: number }>(`/api/payments?product=${code}&limit=500`)
      setPayments(data.data)
    } catch {
      // silent
    } finally {
      setLoadingPayments(false)
    }
  }, [])

  const loadMentors = useCallback(async (planId: string) => {
    try {
      const data = await apiFetch<MentorRow[]>(`/api/plans/${planId}/mentors`)
      setMentors(prev => ({ ...prev, [planId]: data }))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchProduct()
  }, [fetchProduct])

  useEffect(() => {
    if (product) {
      fetchClients(product.code)
      fetchContracts(product.code)
      fetchPayments(product.code)
    }
  }, [product, fetchClients, fetchContracts, fetchPayments])

  // Load mentors for each client's plan
  useEffect(() => {
    clients.forEach(client => {
      const plan = (client.plans ?? []).find(p => p.product.code === product?.code)
      if (plan) loadMentors(plan.id)
    })
  }, [clients, product, loadMentors])

  // Load suggestions for mentor autocomplete
  useEffect(() => {
    apiFetch<{ salesReps: string[]; mentors: string[] }>('/api/crm/suggestions')
      .then(setSuggestions)
      .catch(() => {})
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, gap: 12 }}>
        <div style={{ width: 32, height: 32, border: `2px solid ${C.line}`, borderTopColor: C.ink, borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!product) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <p style={{ fontFamily: 'var(--font-sans)', color: C.mid, fontSize: 13 }}>Programa não encontrado.</p>
        <button className="goon-btn-secondary" onClick={() => router.push('/products')} style={{ marginTop: 16 }}>← Voltar</button>
      </div>
    )
  }

  const productColor = PRODUCT_COLORS[product.code] ?? C.ink

  // KPI calculations
  const activeClients = clients.filter(c => c.status === 'ACTIVE')
  const totalRevenue = clients.reduce((sum, c) => {
    const activePlans = (c.plans ?? []).filter(p => p.status === 'ACTIVE' && p.product.code === product.code)
    return sum + activePlans.reduce((s, p) => s + (p.value ?? 0), 0)
  }, 0)
  const cycleDuration = 3 // default months
  const monthlyRevenue = cycleDuration > 0 ? totalRevenue / cycleDuration : totalRevenue
  const activeContracts = contracts.filter(c => c.status === 'SIGNED' || c.status === 'SENT')
  const overduePayments = payments.filter(p => p.status === 'OVERDUE')
  const renewingClients = clients.filter(c => {
    const activePlan = (c.plans ?? []).find(p => p.status === 'ACTIVE' && p.product.code === product.code)
    if (!activePlan?.endDate) return false
    const end = new Date(activePlan.endDate)
    const now = new Date()
    const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 90
  })

  // Tab content
  const TABS = ['CLIENTES', 'CONTRATOS', 'FINANCEIRO', 'TURMAS']

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          className="goon-btn-ghost"
          onClick={() => router.push('/products')}
          style={{ marginBottom: 16, fontSize: 12 }}
        >
          ← Voltar aos Programas
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              padding: '8px 14px',
              borderRadius: 8,
              background: productColor,
              color: '#fff',
              fontFamily: 'var(--font-sans)',
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: '0.04em',
            }}>
              {product.code}
            </span>
            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: C.ink, margin: '0 0 3px 0', letterSpacing: '-0.02em' }}>
                {PRODUCT_NAMES[product.code] ?? product.name}
              </h1>
              {product.description && (
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid, margin: 0 }}>{product.description}</p>
              )}
            </div>
          </div>
          <button onClick={() => setShowEditModal(true)} className="goon-btn-secondary" style={{ fontSize: 12 }}>
            Editar Programa
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(160px, 1fr))', gap: isMobile ? 8 : 12, marginBottom: 28 }}>
        <KpiCard
          label="Total Clientes"
          value={clients.length}
          onClick={() => router.push(`/clients?product=${product.code}`)}
        />
        <KpiCard
          label="Ativos"
          value={activeClients.length}
          color={C.greenDk}
          onClick={() => router.push(`/clients?product=${product.code}&status=ACTIVE`)}
        />
        <KpiCard
          label="Receita Total"
          value={fmtBRL(totalRevenue)}
          color={productColor}
        />
        <KpiCard
          label="Receita Mensal"
          value={fmtBRL(monthlyRevenue)}
          color={productColor}
        />
        <KpiCard
          label="Contratos Ativos"
          value={activeContracts.length}
          onClick={() => setActiveTab(1)}
        />
        <KpiCard
          label="Inadimplentes"
          value={overduePayments.length}
          color={overduePayments.length > 0 ? C.red : C.ink}
          onClick={() => setActiveTab(2)}
        />
        <KpiCard
          label="Em Renovação"
          value={renewingClients.length}
          color={renewingClients.length > 0 ? C.amber : C.ink}
        />
        <KpiCard
          label="Progresso Médio"
          value="0%"
          color={C.mid}
        />
      </div>

      {/* Tabs */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

        <div style={{ background: '#fff', padding: 20 }}>
          {/* Tab 0: CLIENTES */}
          {activeTab === 0 && (
            <div>
              {loadingClients ? (
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid }}>Carregando clientes...</p>
              ) : clients.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid }}>Nenhum cliente com este programa.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="goon-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Status</th>
                        <th>Contrato</th>
                        <th>Financeiro</th>
                        <th>Pendências</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map(client => {
                        const plan = (client.plans ?? []).find(p => p.product.code === product.code)
                        const contract = client.contracts?.[0]
                        const planMentors = plan ? (mentors[plan.id] ?? []) : []
                        const totalMentors = planMentors.reduce((s, m) => s + m.value, 0)
                        return (
                          <tr key={client.id}>
                            <td
                              colSpan={5}
                              style={{ padding: 0, border: 'none' }}
                            >
                              {/* Client row */}
                              <div
                                style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', alignItems: 'center', gap: 0, cursor: 'pointer', padding: '10px 14px', borderBottom: `1px solid ${C.line}` }}
                                onClick={() => router.push(`/clients/${client.id}`)}
                                onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                                onMouseLeave={e => (e.currentTarget.style.background = '')}
                              >
                                <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: C.ink }}>
                                  {client.companyName}
                                </span>
                                <span style={{ padding: '0 12px' }}>
                                  <span style={statusBadgeStyle(client.status)}>{statusLabel(client.status)}</span>
                                </span>
                                <span style={{ padding: '0 12px' }}>
                                  {contract ? (
                                    <span style={pill(...(CONTRACT_STATUS_SOFT[contract.status] ?? NEUTRAL_SOFT))}>
                                      {contractStatusLabel(contract.status)}
                                      {contract.isSigned ? ' ✓' : ''}
                                    </span>
                                  ) : (
                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.dim }}>—</span>
                                  )}
                                </span>
                                <span style={{ ...num, fontFamily: 'var(--font-sans)', fontSize: 13, padding: '0 12px', color: C.ink }}>
                                  {plan ? fmtBRL(plan.value) : '—'}
                                </span>
                                <span style={{ padding: '0 12px' }}>
                                  {(client._pendenciesCount ?? 0) > 0 ? (
                                    <span style={{ ...num, fontFamily: 'var(--font-sans)', fontSize: 12, color: C.red, fontWeight: 700 }}>
                                      {client._pendenciesCount}
                                    </span>
                                  ) : (
                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.dim }}>—</span>
                                  )}
                                </span>
                              </div>

                              {/* Mentors section */}
                              {plan && (
                                <div style={{ padding: '8px 14px 12px', background: C.bg, borderBottom: `1px solid ${C.line}` }}>
                                  {planMentors.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                                      {planMentors.map(m => (
                                        <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: 12, color: C.slate }}>
                                          <span>{m.mentorName}</span>
                                          <span style={{ ...num, fontWeight: 700 }}>{fmtBRL(m.value)}</span>
                                          <button onClick={async (e) => {
                                            e.stopPropagation()
                                            if (!confirm(`Remover ${m.mentorName}?`)) return
                                            await apiFetch(`/api/mentors/${m.id}`, { method: 'DELETE' })
                                            loadMentors(plan.id)
                                          }} style={{ background: '#fff', color: C.red, border: `1px solid ${C.line}`, borderRadius: 4, padding: '1px 7px', fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>×</button>
                                        </div>
                                      ))}
                                      <div style={{ ...num, fontFamily: 'var(--font-sans)', fontSize: 11, color: C.mid, textAlign: 'right' }}>
                                        Total mentoria: {fmtBRL(totalMentors)} | Saldo: {fmtBRL(plan.value - totalMentors)}
                                      </div>
                                    </div>
                                  )}
                                  {addingMentor === plan.id ? (
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                      <input
                                        list="product-mentor-list"
                                        placeholder="Nome"
                                        value={newMentorName}
                                        onChange={e => setNewMentorName(e.target.value)}
                                        onClick={e => e.stopPropagation()}
                                        style={{ flex: '1 1 100px', fontSize: 12, padding: '6px 8px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: 'var(--font-sans)', background: '#fff' }}
                                      />
                                      <datalist id="product-mentor-list">
                                        {(suggestions?.mentors ?? []).map(s => <option key={s} value={s} />)}
                                      </datalist>
                                      <input
                                        type="number"
                                        placeholder="Valor"
                                        step="0.01"
                                        value={newMentorValue}
                                        onChange={e => setNewMentorValue(e.target.value)}
                                        onClick={e => e.stopPropagation()}
                                        style={{ width: 90, fontSize: 12, padding: '6px 8px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: 'var(--font-sans)', background: '#fff' }}
                                      />
                                      <button
                                        disabled={savingMentor}
                                        onClick={async (e) => {
                                          e.stopPropagation()
                                          if (!newMentorName.trim() || !parseFloat(newMentorValue)) return
                                          setSavingMentor(true)
                                          try {
                                            await apiFetch(`/api/plans/${plan.id}/mentors`, {
                                              method: 'POST',
                                              body: JSON.stringify({ mentorName: newMentorName.trim(), value: parseFloat(newMentorValue) }),
                                            })
                                            toast.success(`${newMentorName} atribuido!`)
                                            setAddingMentor(null)
                                            setNewMentorName('')
                                            setNewMentorValue('')
                                            loadMentors(plan.id)
                                          } catch { toast.error('Erro ao atribuir mentor') }
                                          setSavingMentor(false)
                                        }}
                                        style={{ background: C.green, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 700 }}
                                      >OK</button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setAddingMentor(null) }}
                                        style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 6, padding: '6px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: C.mid }}
                                      >Cancelar</button>
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setAddingMentor(plan.id) }}
                                        style={{ background: '#fff', border: `1px dashed ${C.dim}`, borderRadius: 6, padding: '6px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600, color: C.mid }}
                                      >+ Atribuir mentor</button>
                                      {plan.value - totalMentors > 0 && (
                                        <span style={{ ...num, fontFamily: 'var(--font-sans)', fontSize: 11, color: C.mid }}>Disponível: {fmtBRL(plan.value - totalMentors)}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 1: CONTRATOS */}
          {activeTab === 1 && (
            <div>
              {loadingContracts ? (
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid }}>Carregando contratos...</p>
              ) : contracts.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid }}>Nenhum contrato para este programa.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="goon-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Vigência</th>
                        <th>Criado em</th>
                        <th>Assinado</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contracts.map(contract => (
                        <tr
                          key={contract.id}
                          style={{ cursor: 'pointer' }}
                          onClick={() => router.push(`/clients/${contract.client.id}`)}
                        >
                          <td style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: C.ink }}>
                            {contract.client.companyName}
                          </td>
                          <td style={{ ...num, fontFamily: 'var(--font-sans)', fontSize: 13, color: C.slate }}>
                            {contract.clientPlan?.startDate
                              ? `${fmtDate(contract.clientPlan.startDate)} → ${fmtDate(contract.clientPlan.endDate)}`
                              : '—'}
                          </td>
                          <td style={{ ...num, fontFamily: 'var(--font-sans)', fontSize: 13, color: C.slate }}>
                            {fmtDate(contract.createdAt)}
                          </td>
                          <td>
                            {contract.isSigned ? (
                              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.greenDk, fontWeight: 600 }}>
                                ✓ Assinado{contract.signatureDate ? ` ${fmtDate(contract.signatureDate)}` : ''}
                              </span>
                            ) : (
                              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.red, fontWeight: 600 }}>
                                ✗ Pendente
                              </span>
                            )}
                          </td>
                          <td>
                            <span style={pill(...(CONTRACT_STATUS_SOFT[contract.status] ?? NEUTRAL_SOFT))}>
                              {contractStatusLabel(contract.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: FINANCEIRO */}
          {activeTab === 2 && (
            <div>
              {loadingPayments ? (
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid }}>Carregando pagamentos...</p>
              ) : payments.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid }}>Nenhum pagamento para este programa.</p>
              ) : (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="goon-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Cliente</th>
                          <th>Parcela</th>
                          <th>Vencimento</th>
                          <th>Valor</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map(payment => {
                          const isOverdue = payment.status === 'OVERDUE'
                          const now = new Date()
                          const due = new Date(payment.dueDate)
                          const daysUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                          const isDueSoon = payment.status === 'PENDING' && daysUntilDue >= 0 && daysUntilDue <= 5
                          const rowBg = isOverdue ? '#fef2f2' : isDueSoon ? '#fffbeb' : 'transparent'
                          return (
                            <tr
                              key={payment.id}
                              style={{ cursor: 'pointer', background: rowBg }}
                              onClick={() => router.push(`/clients/${payment.client.id}`)}
                            >
                              <td style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: C.ink }}>
                                {payment.client.companyName}
                              </td>
                              <td style={{ ...num, fontFamily: 'var(--font-sans)', fontSize: 13, color: C.slate }}>
                                {payment.installment}/{payment.totalInstallments}
                              </td>
                              <td style={{ ...num, fontFamily: 'var(--font-sans)', fontSize: 13, color: C.slate }}>
                                {fmtDate(payment.dueDate)}
                              </td>
                              <td style={{ ...num, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: C.ink }}>
                                {fmtBRL(payment.value)}
                              </td>
                              <td>
                                <span style={pill(...(PAYMENT_STATUS_SOFT[payment.status] ?? NEUTRAL_SOFT))}>
                                  {PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary */}
                  <div style={{ marginTop: 16, padding: '16px 20px', background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                    <div>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.mid, textTransform: 'uppercase', display: 'block', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 4 }}>Total Pago</span>
                      <span style={{ ...num, fontSize: 16, color: C.greenDk, fontWeight: 700 }}>
                        {fmtBRL(payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.value, 0))}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.mid, textTransform: 'uppercase', display: 'block', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 4 }}>Total Pendente</span>
                      <span style={{ ...num, fontSize: 16, color: '#1e40af', fontWeight: 700 }}>
                        {fmtBRL(payments.filter(p => p.status === 'PENDING').reduce((s, p) => s + p.value, 0))}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.mid, textTransform: 'uppercase', display: 'block', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 4 }}>Total Vencido</span>
                      <span style={{ ...num, fontSize: 16, color: C.red, fontWeight: 700 }}>
                        {fmtBRL(payments.filter(p => p.status === 'OVERDUE').reduce((s, p) => s + p.value, 0))}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab 3: TURMAS */}
          {activeTab === 3 && (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: C.ink }}>
                Em desenvolvimento
              </p>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid, marginTop: 8 }}>
                Funcionalidade de turmas e grupos chegará em breve.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditProductModal
          product={product}
          onClose={() => setShowEditModal(false)}
          onSaved={updated => setProduct(prev => prev ? { ...prev, ...updated } : prev)}
        />
      )}
    </div>
  )
}
