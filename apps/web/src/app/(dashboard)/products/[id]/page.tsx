'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import {
  PRODUCT_COLORS,
  PRODUCT_NAMES,
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  CONTRACT_STATUS_COLORS,
} from '@/lib/constants'

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

// ---- Helpers ----
const fmtBRL = (n?: number | null) =>
  n != null
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)
    : '—'

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—')

function statusLabel(s: string) {
  const map: Record<string, string> = { ACTIVE: 'Ativo', PROSPECT: 'Prospect', INACTIVE: 'Inativo', CANCELLED: 'Cancelado' }
  return map[s] ?? s
}

function statusBadgeStyle(s: string): React.CSSProperties {
  const colors: Record<string, string> = {
    ACTIVE: '#006600',
    PROSPECT: '#000080',
    INACTIVE: '#c0c0c0',
    CANCELLED: '#cc0000',
  }
  const textColors: Record<string, string> = {
    INACTIVE: '#333',
  }
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    background: colors[s] ?? '#c0c0c0',
    color: textColors[s] ?? 'white',
    border: '1px solid black',
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  }
}

function planStatusBadge(s: string) {
  return (
    <span style={statusBadgeStyle(s)}>{statusLabel(s)}</span>
  )
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
    <div style={{ display: 'flex', gap: 0, marginBottom: 0, borderBottom: '2px solid black' }}>
      {tabs.map((tab, i) => (
        <button
          key={tab}
          onClick={() => onChange(i)}
          style={{
            padding: '10px 18px',
            background: i === active ? 'black' : '#c0c0c0',
            color: i === active ? 'white' : 'black',
            border: '2px solid black',
            borderBottom: i === active ? '2px solid black' : '2px solid black',
            fontFamily: 'var(--font-pixel)',
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            cursor: 'pointer',
            boxShadow: i === active ? 'inset 0 -2px 0 rgba(255,255,255,0.15)' : 'none',
            marginBottom: i === active ? -2 : 0,
            zIndex: i === active ? 1 : 0,
            position: 'relative',
            transition: 'background 0.1s',
          }}
        >
          {tab}
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

function KpiCard({ label, value, color = 'black', onClick }: KpiCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'white',
        border: '2px solid black',
        boxShadow: '4px 4px 0px 0px #000',
        padding: '16px 20px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.1s, box-shadow 0.1s',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
      onMouseEnter={e => {
        if (!onClick) return
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translate(-1px, -1px)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '5px 5px 0px 0px #000'
      }}
      onMouseLeave={e => {
        if (!onClick) return
        ;(e.currentTarget as HTMLDivElement).style.transform = ''
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '4px 4px 0px 0px #000'
      }}
    >
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: '#555',
        textTransform: 'uppercase',
        fontWeight: 700,
        letterSpacing: 0.5,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-pixel)',
        fontSize: 14,
        color,
        fontWeight: 800,
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
      toast.success('[OK] Produto atualizado')
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao salvar produto')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: '100%', maxWidth: 440, background: 'white', border: '2px solid black', boxShadow: '8px 8px 0px 0px #000' }}>
        <div style={{ background: 'black', color: 'white', fontFamily: 'var(--font-pixel)', fontSize: 10, textTransform: 'uppercase', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', letterSpacing: 1, backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
          <span>Editar Programa</span>
          <button onClick={onClose} style={{ background: 'var(--danger)', border: '1px solid white', color: 'white', cursor: 'pointer', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700 }}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="goon-label">Nome</label>
            <input className="goon-input" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <label className="goon-label">Descrição</label>
            <textarea className="goon-textarea" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8, borderTop: '2px solid black', paddingTop: 16 }}>
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

  const fetchProduct = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<Product>(`/api/products/${id}`)
      setProduct(data)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao carregar produto')
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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, gap: 12 }}>
        <div style={{ width: 32, height: 32, border: '3px solid black', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!product) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 13 }}>Produto não encontrado.</p>
        <button className="goon-btn-secondary" onClick={() => router.push('/products')} style={{ marginTop: 16 }}>← Voltar</button>
      </div>
    )
  }

  const productColor = PRODUCT_COLORS[product.code] ?? 'black'

  // KPI calculations
  const activeClients = clients.filter(c => c.status === 'ACTIVE')
  const totalRevenue = clients.reduce((sum, c) => {
    const activePlans = c.plans.filter(p => p.status === 'ACTIVE' && p.product.code === product.code)
    return sum + activePlans.reduce((s, p) => s + (p.value ?? 0), 0)
  }, 0)
  const cycleDuration = 3 // default months
  const monthlyRevenue = cycleDuration > 0 ? totalRevenue / cycleDuration : totalRevenue
  const activeContracts = contracts.filter(c => c.status === 'SIGNED' || c.status === 'SENT')
  const overduePayments = payments.filter(p => p.status === 'OVERDUE')
  const renewingClients = clients.filter(c => {
    const activePlan = c.plans.find(p => p.status === 'ACTIVE' && p.product.code === product.code)
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
      <div style={{ marginBottom: 28 }}>
        <button
          className="goon-btn-ghost"
          onClick={() => router.push('/products')}
          style={{ marginBottom: 16, fontSize: 11 }}
        >
          ← Voltar aos Programas
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              padding: '6px 14px',
              background: productColor,
              color: 'white',
              border: '2px solid black',
              fontFamily: 'var(--font-pixel)',
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: 1,
            }}>
              {product.code}
            </span>
            <div>
              <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: 14, fontWeight: 800, color: 'black', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: 1 }}>
                {PRODUCT_NAMES[product.code] ?? product.name}
              </h1>
              {product.description && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555', margin: 0 }}>{product.description}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowEditModal(true)}
            style={{
              background: '#c0c0c0',
              color: 'black',
              border: '2px solid black',
              boxShadow: '3px 3px 0 black',
              fontFamily: 'var(--font-pixel)',
              fontSize: 9,
              textTransform: 'uppercase',
              padding: '8px 14px',
              cursor: 'pointer',
              letterSpacing: 0.5,
            }}
          >
            Editar Programa
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 32 }}>
        <KpiCard
          label="Total Clientes"
          value={clients.length}
          onClick={() => router.push(`/clients?product=${product.code}`)}
        />
        <KpiCard
          label="Ativos"
          value={activeClients.length}
          color="var(--success)"
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
          color={overduePayments.length > 0 ? 'var(--danger)' : 'black'}
          onClick={() => setActiveTab(2)}
        />
        <KpiCard
          label="Em Renovação"
          value={renewingClients.length}
          color={renewingClients.length > 0 ? '#ff6600' : 'black'}
        />
        <KpiCard
          label="Progresso Médio"
          value="0%"
          color="#555"
        />
      </div>

      {/* Tabs */}
      <div style={{ border: '2px solid black', boxShadow: '4px 4px 0 black', overflow: 'hidden' }}>
        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

        <div style={{ background: 'white', padding: 24 }}>
          {/* Tab 0: CLIENTES */}
          {activeTab === 0 && (
            <div>
              {loadingClients ? (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555' }}>Carregando clientes...</p>
              ) : clients.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555' }}>Nenhum cliente com este programa.</p>
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
                        const plan = client.plans.find(p => p.product.code === product.code)
                        const contract = client.contracts[0]
                        return (
                          <tr
                            key={client.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => router.push(`/clients/${client.id}`)}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}
                          >
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13 }}>
                              {client.companyName}
                            </td>
                            <td>
                              <span style={statusBadgeStyle(client.status)}>{statusLabel(client.status)}</span>
                            </td>
                            <td>
                              {contract ? (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '2px 8px',
                                  background: CONTRACT_STATUS_COLORS[contract.status] ?? '#c0c0c0',
                                  color: contract.status === 'DRAFT' || contract.status === 'CANCELLED' ? '#333' : 'white',
                                  border: '1px solid black',
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                }}>
                                  {contractStatusLabel(contract.status)}
                                  {contract.isSigned ? ' ✓' : ''}
                                </span>
                              ) : (
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#aaa' }}>—</span>
                              )}
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                              {plan ? fmtBRL(plan.value) : '—'}
                            </td>
                            <td>
                              {(client._pendenciesCount ?? 0) > 0 ? (
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#cc0000', fontWeight: 700 }}>
                                  {client._pendenciesCount}
                                </span>
                              ) : (
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#aaa' }}>—</span>
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
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555' }}>Carregando contratos...</p>
              ) : contracts.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555' }}>Nenhum contrato para este programa.</p>
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
                          onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}
                        >
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13 }}>
                            {contract.client.companyName}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                            {contract.clientPlan?.startDate
                              ? `${fmtDate(contract.clientPlan.startDate)} → ${fmtDate(contract.clientPlan.endDate)}`
                              : '—'}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                            {fmtDate(contract.createdAt)}
                          </td>
                          <td>
                            {contract.isSigned ? (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#006600', fontWeight: 700 }}>
                                ✓ Assinado{contract.signatureDate ? ` ${fmtDate(contract.signatureDate)}` : ''}
                              </span>
                            ) : (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#cc0000', fontWeight: 700 }}>
                                ✗ Pendente
                              </span>
                            )}
                          </td>
                          <td>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '2px 8px',
                              background: CONTRACT_STATUS_COLORS[contract.status] ?? '#c0c0c0',
                              color: contract.status === 'DRAFT' || contract.status === 'CANCELLED' ? '#333' : 'white',
                              border: '1px solid black',
                              fontFamily: 'var(--font-mono)',
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                            }}>
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
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555' }}>Carregando pagamentos...</p>
              ) : payments.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555' }}>Nenhum pagamento para este programa.</p>
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
                          const rowBg = isOverdue ? '#fff0f0' : isDueSoon ? '#fff8ee' : 'transparent'
                          return (
                            <tr
                              key={payment.id}
                              style={{ cursor: 'pointer', background: rowBg }}
                              onClick={() => router.push(`/clients/${payment.client.id}`)}
                              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                            >
                              <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13 }}>
                                {payment.client.companyName}
                              </td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                                {payment.installment}/{payment.totalInstallments}
                              </td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                                {fmtDate(payment.dueDate)}
                              </td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>
                                {fmtBRL(payment.value)}
                              </td>
                              <td>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '2px 8px',
                                  background: PAYMENT_STATUS_COLORS[payment.status] ?? '#c0c0c0',
                                  color: payment.status === 'SCHEDULED' || payment.status === 'CANCELLED' ? '#333' : 'white',
                                  border: '1px solid black',
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                }}>
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
                  <div style={{ marginTop: 20, padding: '14px 20px', background: 'var(--retro-gray)', border: '2px solid black', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    <div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555', textTransform: 'uppercase', display: 'block', fontWeight: 700, marginBottom: 4 }}>Total Pago</span>
                      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 13, color: '#006600', fontWeight: 800 }}>
                        {fmtBRL(payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.value, 0))}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555', textTransform: 'uppercase', display: 'block', fontWeight: 700, marginBottom: 4 }}>Total Pendente</span>
                      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 13, color: '#000080', fontWeight: 800 }}>
                        {fmtBRL(payments.filter(p => p.status === 'PENDING').reduce((s, p) => s + p.value, 0))}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555', textTransform: 'uppercase', display: 'block', fontWeight: 700, marginBottom: 4 }}>Total Vencido</span>
                      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 13, color: '#cc0000', fontWeight: 800 }}>
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
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-pixel)', fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>
                Em desenvolvimento...
              </p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#888', marginTop: 12 }}>
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
