'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useIsMobile } from '@/hooks/useMediaQuery'
import {
  PENDENCY_TYPE_COLORS,
  PENDENCY_TYPE_LABELS,
  PENDENCY_TYPE_ICONS,
  PRODUCT_COLORS,
} from '@/lib/constants'

// ---- Types ----
interface Client {
  id: string
  companyName: string
}

interface Pendency {
  id: string
  type: string
  status: string
  description?: string | null
  resolvedAt?: string | null
  createdAt: string
  client: Client
}

// ---- Design tokens ----
const C = {
  ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0',
  bg: '#f8fafc', neon: '#C7F900', green: '#16a34a', red: '#dc2626', amber: '#f59e0b', slate: '#475569',
}
const num: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' }
const thBase: React.CSSProperties = {
  background: '#f8fafc', color: '#64748b', fontFamily: 'var(--font-sans)', fontSize: 11,
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '10px 14px',
  borderBottom: '1px solid #e2e8f0',
}

// ---- Helpers ----
const fmtDateTime = (d: string) => {
  const dt = new Date(d)
  return (
    dt.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) +
    ' ' +
    dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )
}

// ---- KPI Strip ----
function KpiStrip({ pendencies }: { pendencies: Pendency[] }) {
  const open = pendencies.filter(p => p.status === 'OPEN').length
  const noContract = pendencies.filter(p => p.type === 'CONTRACT_UNSIGNED').length
  const overdue = pendencies.filter(p => p.type === 'PAYMENT_OVERDUE').length
  const renewal = pendencies.filter(p => p.type === 'RENEWAL_PENDING').length

  const items = [
    { label: 'Total Abertas', value: open, accent: 'var(--danger)' },
    { label: 'Contratos s/ Assinatura', value: noContract, accent: 'var(--retro-blue)' },
    { label: 'Boletos Vencidos', value: overdue, accent: 'var(--danger)' },
    { label: 'Em Renovação', value: renewal, accent: 'var(--warning)' },
  ]

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 12,
        marginBottom: 20,
      }}
    >
      {items.map(item => (
        <div
          key={item.label}
          style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 7,
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: '#555',
            }}
          >
            {item.label}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 20,
              color: item.accent,
              letterSpacing: 1,
            }}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---- Pendency Card ----
interface PendencyCardProps {
  pendency: Pendency
  onChangeStatus: (id: string, status: string) => void
}

function PendencyCard({ pendency, onChangeStatus }: PendencyCardProps) {
  const typeColor = PENDENCY_TYPE_COLORS[pendency.type] ?? '#c0c0c0'
  const typeLabel = PENDENCY_TYPE_LABELS[pendency.type] ?? pendency.type
  const typeIcon = PENDENCY_TYPE_ICONS[pendency.type] ?? '○'
  const isResolved = pendency.status === 'RESOLVED'

  return (
    <div
      style={{
        background: isResolved ? 'rgba(255,255,255,0.5)' : 'white',
        border: '1px solid #e2e8f0',
        boxShadow: isResolved ? '2px 2px 0px 0px #ccc' : '0 2px 4px rgba(0,0,0,0.05)',
        marginBottom: 10,
        borderLeft: `4px solid ${typeColor}`,
        opacity: isResolved ? 0.65 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      <div style={{ padding: '10px 12px' }}>
        {/* Type + Client */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 14, color: typeColor, lineHeight: 1, marginTop: 1 }}>{typeIcon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 8,
                color: typeColor,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 2,
              }}
            >
              {typeLabel}
            </div>
            <a
              href={`/clients/${pendency.client.id}`}
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: 12,
                color: 'var(--retro-blue)',
                textDecoration: 'underline',
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {pendency.client.companyName}
            </a>
          </div>
        </div>

        {/* Description */}
        {pendency.description && (
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: '#555',
              margin: '0 0 6px 0',
              lineHeight: 1.5,
            }}
          >
            {pendency.description}
          </p>
        )}

        {/* Date */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#888', marginBottom: isResolved ? 0 : 8 }}>
          {isResolved && pendency.resolvedAt
            ? `Resolvida em: ${fmtDateTime(pendency.resolvedAt)}`
            : fmtDateTime(pendency.createdAt)}
        </div>

        {/* Actions */}
        {!isResolved && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {pendency.status === 'OPEN' && (
              <button
                className="goon-btn-primary"
                style={{ fontSize: 8, padding: '4px 8px', minHeight: 44 }}
                onClick={() => onChangeStatus(pendency.id, 'IN_PROGRESS')}
              >
                Em Andamento
              </button>
            )}
            <button
              className="goon-btn-accent"
              style={{ fontSize: 8, padding: '4px 8px', minHeight: 44 }}
              onClick={() => onChangeStatus(pendency.id, 'RESOLVED')}
            >
              Resolver
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Kanban Column ----
function KanbanColumn({
  title,
  pendencies,
  onChangeStatus,
  accentColor,
}: {
  title: string
  pendencies: Pendency[]
  onChangeStatus: (id: string, status: string) => void
  accentColor: string
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'white',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)',
      }}
    >
      {/* Column header */}
      <div
        style={{
          background: 'black',
          color: 'white',
          fontFamily: 'var(--font-sans)',
          fontSize: 9,
          textTransform: 'uppercase',
          padding: '10px 14px',
          letterSpacing: 1,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{title}</span>
        <span
          style={{
            background: accentColor,
            color: accentColor === 'var(--retro-green)' ? 'black' : 'white',
            fontFamily: 'var(--font-sans)',
            fontSize: 8,
            padding: '2px 7px',
            border: '1px solid rgba(255,255,255,0.4)',
          }}
        >
          {pendencies.length}
        </span>
      </div>

      {/* Cards */}
      <div
        style={{
          flex: 1,
          padding: '10px 8px',
          overflowY: 'auto',
          minHeight: 200,
        }}
      >
        {pendencies.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '32px 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: '#aaa',
            }}
          >
            Sem pendências
          </div>
        ) : (
          pendencies.map(p => (
            <PendencyCard key={p.id} pendency={p} onChangeStatus={onChangeStatus} />
          ))
        )}
      </div>
    </div>
  )
}

// ---- New Pendency Modal ----
interface NewPendencyModalProps {
  onClose: () => void
  onCreated: () => void
}

function NewPendencyModal({ onClose, onCreated }: NewPendencyModalProps) {
  const isMobileModal = useIsMobile()
  const [clients, setClients] = useState<Client[]>([])
  const [form, setForm] = useState({
    clientId: '',
    type: 'OTHER',
    description: '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    apiFetch<{ data: Client[] }>('/api/clients?limit=200')
      .then(r => setClients(r.data))
      .catch(() => {})
  }, [])

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.clientId) {
      toast.error('[ERRO] Selecione um cliente')
      return
    }
    setLoading(true)
    try {
      await apiFetch('/api/pendencies', {
        method: 'POST',
        body: JSON.stringify({
          clientId: form.clientId,
          type: form.type,
          description: form.description || undefined,
        }),
      })
      toast.success('[OK] Pendência criada com sucesso')
      onCreated()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Falha ao criar pendência')
    } finally {
      setLoading(false)
    }
  }

  const fl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }

  return (
    <div
      className="goon-overlay"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={isMobileModal ? { alignItems: 'flex-end', padding: 0 } : undefined}
    >
      <div className="goon-modal" style={isMobileModal ? {
        width: '100%',
        maxWidth: '100%',
        border: 'none',
        borderTop: '1px solid #e2e8f0',
        boxShadow: '0 -4px 0 black',
        maxHeight: '85vh',
        overflowY: 'auto',
      } : undefined}>
        <div className="goon-modal-header">
          <span>Nova Pendência</span>
          <button
            onClick={onClose}
            style={{
              background: 'var(--danger)',
              border: '1px solid white',
              color: 'white',
              cursor: 'pointer',
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            ×
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          className="goon-modal-body"
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <div style={fl}>
            <label className="goon-label">Cliente *</label>
            <select
              className="goon-select"
              value={form.clientId}
              onChange={e => set('clientId', e.target.value)}
            >
              <option value="">Selecionar cliente...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.companyName}</option>
              ))}
            </select>
          </div>
          <div style={fl}>
            <label className="goon-label">Tipo *</label>
            <select
              className="goon-select"
              value={form.type}
              onChange={e => set('type', e.target.value)}
            >
              {Object.entries(PENDENCY_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div style={fl}>
            <label className="goon-label">Descrição</label>
            <textarea
              className="goon-textarea"
              placeholder="Descreva a pendência..."
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>
          <div
            style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'flex-end',
              paddingTop: 8,
              borderTop: '1px solid #e2e8f0',
            }}
          >
            <button type="button" className="goon-btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="goon-btn-accent" disabled={loading}>
              {loading ? 'Salvando...' : 'Criar Pendência'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---- Main Page ----
export default function PendenciesPage() {
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()

  const [pendTab, setPendTab] = useState<'inadimplentes' | 'contratos' | 'todas'>('inadimplentes')
  const [overduePayments, setOverduePayments] = useState<Array<{ id: string; value: number; dueDate: string; installment: number; inCarteira?: boolean; client: { id: string; companyName: string }; productCode?: string }>>([])
  const [expiringPlans, setExpiringPlans] = useState<Array<{ id: string; companyName: string; contractEndDate: string; daysLeft: number; expired: boolean; productCode?: string }>>([])
  const [productFilter, setProductFilter] = useState('')
  const [carteiraFilter, setCarteiraFilter] = useState<'todos' | 'carteira' | 'sem'>('todos')
  const [agruparCliente, setAgruparCliente] = useState(false)
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())
  const [pendencies, setPendencies] = useState<Pendency[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showResolved, setShowResolved] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [clientIdFilter] = useState(() => searchParams.get('clientId') ?? '')
  const [search, setSearch] = useState(() => {
    // If clientId param provided, we'll filter by it in the list
    return ''
  })
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [mobileStatusFilter, setMobileStatusFilter] = useState<string>('OPEN')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 400)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search])

  const fetchPendencies = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', '200')
      const result = await apiFetch<{ data: Pendency[]; total: number }>(
        `/api/pendencies?${params.toString()}`
      )
      setPendencies(result.data)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao carregar pendências')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPendencies() }, [fetchPendencies])

  useEffect(() => {
    // Auto-check overdue before loading
    apiFetch('/api/payments/check-overdue', { method: 'POST' }).catch(() => {})
    // Load overdue payments with product info
    setTimeout(() => {
      apiFetch<{ data: Array<{ id: string; value: number; dueDate: string; installment: number; installmentNumber?: number; productCode?: string; client: { id: string; companyName: string }; clientPlan?: { product?: { code: string } } }> }>('/api/payments?status=OVERDUE&limit=100')
        .then(res => setOverduePayments((res.data ?? []).map(p => ({ ...p, productCode: p.productCode ?? p.clientPlan?.product?.code ?? '' }))))
        .catch(() => {})
    }, 500)
    // Load expiring/expired contracts with product info
    apiFetch<{ renewals: { clients: Array<{ id: string; companyName: string; contractEndDate: string; daysLeft: number; expired: boolean; productCode?: string }> } }>('/api/dashboard')
      .then(res => setExpiringPlans(res.renewals?.clients ?? []))
      .catch(() => {})
  }, [])

  const handleChangeStatus = async (id: string, status: string) => {
    try {
      if (status === 'RESOLVED') {
        await apiFetch(`/api/pendencies/${id}/resolve`, { method: 'PATCH' })
        toast.success('[OK] Pendência resolvida')
      } else {
        await apiFetch(`/api/pendencies/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ status }),
        })
        toast.success('[OK] Status atualizado')
      }
      fetchPendencies()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Falha ao atualizar status')
    }
  }

  const handleSync = async () => {
    try {
      const result = await apiFetch<{ count?: number; created?: number }>(
        '/api/pendencies/sync',
        { method: 'POST' }
      )
      const count = result.count ?? result.created ?? 0
      toast.success(`[OK] ${count} nova(s) pendência(s) encontrada(s)`)
      fetchPendencies()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Falha ao sincronizar')
    }
  }

  // Filter pendencies
  const filtered = pendencies.filter(p => {
    if (typeFilter && p.type !== typeFilter) return false
    if (clientIdFilter && p.client.id !== clientIdFilter) return false
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      if (!p.client.companyName.toLowerCase().includes(q)) return false
    }
    return true
  })

  const openList = filtered.filter(p => p.status === 'OPEN')
  const inProgressList = filtered.filter(p => p.status === 'IN_PROGRESS')
  const resolvedList = filtered.filter(p => p.status === 'RESOLVED')

  // Mobile single-column list
  const mobileList = isMobile
    ? filtered.filter(p => {
        if (mobileStatusFilter === 'OPEN') return p.status === 'OPEN'
        if (mobileStatusFilter === 'IN_PROGRESS') return p.status === 'IN_PROGRESS'
        if (mobileStatusFilter === 'RESOLVED') return p.status === 'RESOLVED'
        return true
      })
    : []

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: C.ink, margin: 0 }}>Pendências</h1>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid, marginTop: 4 }}>Inadimplência e contratos a vencer</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${C.line}` }}>
        {([
          { key: 'inadimplentes' as const, label: `Inadimplentes (${overduePayments.length})` },
          { key: 'contratos' as const, label: `Fim de contrato (${expiringPlans.length})` },
        ]).map(tab => {
          const active = pendTab === tab.key
          return (
            <button key={tab.key} onClick={() => setPendTab(tab.key)} style={{
              padding: '10px 4px', marginBottom: -1, background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: 14, whiteSpace: 'nowrap',
              fontWeight: active ? 700 : 500, color: active ? C.ink : C.dim,
              borderBottom: active ? `2px solid ${C.neon}` : '2px solid transparent',
            }}>{tab.label}</button>
          )
        })}
      </div>

      {/* Product filter chips */}
      {(pendTab === 'inadimplentes' || pendTab === 'contratos') && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.mid, marginRight: 2 }}>Programa</span>
          {['', 'GE', 'GI', 'TTS', 'AURA'].map(code => {
            const active = productFilter === code
            return (
              <button key={code} onClick={() => setProductFilter(active ? '' : code)} style={{
                padding: '5px 12px', borderRadius: 100, cursor: 'pointer',
                fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600,
                border: active ? '1px solid transparent' : `1px solid ${C.line}`,
                background: active ? C.ink : '#fff',
                color: active ? '#fff' : C.slate,
              }}>{code || 'Todos'}</button>
            )
          })}
        </div>
      )}

      {/* INADIMPLENTES TAB */}
      {pendTab === 'inadimplentes' && (() => {
        const withProduct = productFilter ? overduePayments.filter(p => p.productCode === productFilter) : overduePayments
        const filtered = carteiraFilter === 'todos' ? withProduct : carteiraFilter === 'carteira' ? withProduct.filter(p => p.inCarteira) : withProduct.filter(p => !p.inCarteira)
        const carteiraItems = withProduct.filter(p => p.inCarteira)
        const carteiraTotal = carteiraItems.reduce((s, p) => s + p.value, 0)
        const semCarteiraTotal = withProduct.filter(p => !p.inCarteira).reduce((s, p) => s + p.value, 0)
        return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: C.ink }}>Clientes inadimplentes</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setAgruparCliente(v => !v)} style={{
                padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 12,
                border: agruparCliente ? '1px solid transparent' : `1px solid ${C.line}`,
                background: agruparCliente ? C.ink : '#fff', color: agruparCliente ? '#fff' : C.slate, marginRight: 6,
              }}>{agruparCliente ? 'Por cliente' : 'Por parcela'}</button>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.mid }}>Filtro</span>
              {([['todos', 'Todos', C.slate], ['sem', 'Sem a recuperar', C.green], ['carteira', 'A recuperar', C.red]] as const).map(([key, label, bg]) => {
                const active = carteiraFilter === key
                return (
                  <button key={key} onClick={() => setCarteiraFilter(active ? 'todos' : key)} style={{
                    padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 12,
                    border: active ? '1px solid transparent' : `1px solid ${C.line}`,
                    background: active ? bg : '#fff', color: active ? '#fff' : C.slate,
                  }}>{label}{key === 'carteira' && carteiraItems.length > 0 ? ' · ' + fmtBRL(carteiraTotal) : ''}{key === 'sem' ? ' · ' + fmtBRL(semCarteiraTotal) : ''}</button>
                )
              })}
            </div>
          </div>
          {filtered.length === 0 ? (
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.green, padding: 24, textAlign: 'center', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12 }}>Nenhum inadimplente.</div>
          ) : agruparCliente ? (() => {
            const groups = Object.values(filtered.reduce((acc: Record<string, { client: { id: string; companyName: string }; items: typeof filtered; total: number; carteira: boolean; prod: Set<string> }>, p) => {
              const k = p.client.id
              if (!acc[k]) acc[k] = { client: p.client, items: [], total: 0, carteira: false, prod: new Set() }
              acc[k].items.push(p); acc[k].total += p.value; if (p.inCarteira) acc[k].carteira = true; if (p.productCode) acc[k].prod.add(p.productCode)
              return acc
            }, {})).sort((a, b) => b.total - a.total)
            return (
              <div style={{ overflowX: 'auto', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ ...thBase, textAlign: 'left' }}>Cliente</th>
                      <th style={{ ...thBase, textAlign: 'center' }}>Programa</th>
                      <th style={{ ...thBase, textAlign: 'center' }}>Parcelas em aberto</th>
                      <th style={{ ...thBase, textAlign: 'right' }}>Total a cobrar</th>
                      <th style={{ ...thBase, textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map(g => {
                      const open = expandedClients.has(g.client.id)
                      return (
                        <>
                          <tr key={g.client.id} onClick={() => setExpandedClients(prev => { const n = new Set(prev); n.has(g.client.id) ? n.delete(g.client.id) : n.add(g.client.id); return n })}
                            style={{ borderBottom: `1px solid ${C.line}`, background: g.carteira ? '#fef2f2' : '#fff', cursor: 'pointer', fontWeight: 600, color: C.ink }}>
                            <td style={{ padding: '12px 14px' }}>{open ? '▾ ' : '▸ '}{g.carteira && <span style={{ color: C.red, marginRight: 4, fontSize: 10 }}>●</span>}{g.client.companyName}</td>
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>{[...g.prod].map(pc => <span key={pc} style={{ background: PRODUCT_COLORS[pc] ?? C.mid, color: 'white', padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 700, marginRight: 3 }}>{pc}</span>)}</td>
                            <td style={{ ...num, padding: '12px 14px', textAlign: 'center' }}>{g.items.length}</td>
                            <td style={{ ...num, padding: '12px 14px', textAlign: 'right', color: C.red, fontWeight: 700 }}>{fmtBRL(g.total)}</td>
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                              <button onClick={e => { e.stopPropagation(); window.location.href = `/clients/${g.client.id}` }} style={{ background: C.ink, color: 'white', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Ver</button>
                            </td>
                          </tr>
                          {open && g.items.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map(pay => {
                            const days = Math.floor((Date.now() - new Date(pay.dueDate).getTime()) / (1000*60*60*24))
                            return (
                              <tr key={pay.id} style={{ borderBottom: `1px solid ${C.line}`, background: C.bg, fontSize: 12 }}>
                                <td style={{ padding: '8px 14px 8px 30px', color: C.mid }}>Parcela {pay.installment} · venc {new Date(pay.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} · <span style={{ color: C.red, fontWeight: 700 }}>{days}d atraso</span></td>
                                <td />
                                <td style={{ textAlign: 'center', color: C.dim }}>{pay.inCarteira ? 'A recuperar' : ''}</td>
                                <td style={{ ...num, padding: '8px 14px', textAlign: 'right', color: C.ink }}>{fmtBRL(pay.value)}</td>
                                <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                    <button onClick={async () => {
                                      const dateStr = prompt('Data do pagamento (DD/MM/AAAA):', new Date().toLocaleDateString('pt-BR', { timeZone: 'UTC' }))
                                      if (!dateStr) return
                                      const parts = dateStr.split('/'); if (parts.length !== 3) { toast.error('Data invalida'); return }
                                      const paidDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10), 12)
                                      if (isNaN(paidDate.getTime())) { toast.error('Data invalida'); return }
                                      try { await apiFetch(`/api/payments/${pay.id}`, { method: 'PUT', body: JSON.stringify({ status: 'PAID', paidAt: paidDate.toISOString() }) }); toast.success('Pagamento confirmado'); setOverduePayments(prev => prev.filter(p => p.id !== pay.id)) } catch { toast.error('Erro ao dar baixa') }
                                    }} style={{ background: C.green, color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Pagar</button>
                                    <button onClick={async () => {
                                      try { await apiFetch(`/api/payments/${pay.id}/carteira`, { method: 'PATCH', body: JSON.stringify({ inCarteira: !pay.inCarteira }) }); setOverduePayments(prev => prev.map(p => p.id === pay.id ? { ...p, inCarteira: !p.inCarteira } : p)); toast.success(pay.inCarteira ? 'Removido de A Recuperar' : 'Adicionado a A Recuperar') } catch { toast.error('Erro') }
                                    }} style={{ background: pay.inCarteira ? C.amber : C.mid, color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>{pay.inCarteira ? 'Tirar' : 'Recup'}</button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </>
                      )
                    })}
                    <tr style={{ background: C.bg, fontWeight: 700, color: C.ink }}>
                      <td colSpan={3} style={{ padding: '12px 14px' }}>Total ({groups.length} clientes)</td>
                      <td style={{ ...num, padding: '12px 14px', textAlign: 'right' }}>{fmtBRL(filtered.reduce((s, p) => s + p.value, 0))}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )
          })() : (
            <div style={{ overflowX: 'auto', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ ...thBase, textAlign: 'left' }}>Cliente</th>
                    <th style={{ ...thBase, textAlign: 'center' }}>Programa</th>
                    <th style={{ ...thBase, textAlign: 'center' }}>Parcela</th>
                    <th style={{ ...thBase, textAlign: 'right' }}>Valor</th>
                    <th style={{ ...thBase, textAlign: 'center' }}>Vencimento</th>
                    <th style={{ ...thBase, textAlign: 'center' }}>Dias atraso</th>
                    <th style={{ ...thBase, textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map(pay => {
                    const days = Math.floor((Date.now() - new Date(pay.dueDate).getTime()) / (1000*60*60*24))
                    return (
                      <tr key={pay.id} style={{ borderBottom: `1px solid ${C.line}`, background: pay.inCarteira ? '#fef2f2' : 'transparent' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: C.ink, cursor: 'pointer' }} onClick={() => window.location.href = `/clients/${pay.client.id}`}>
                          {pay.inCarteira && <span style={{ color: C.red, marginRight: 4, fontSize: 10 }}>●</span>}
                          {pay.client.companyName}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          {pay.productCode && <span style={{ background: PRODUCT_COLORS[pay.productCode] ?? C.mid, color: 'white', padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{pay.productCode}</span>}
                        </td>
                        <td style={{ ...num, padding: '12px 14px', textAlign: 'center', color: C.slate }}>{pay.installment}</td>
                        <td style={{ ...num, padding: '12px 14px', textAlign: 'right', color: C.ink }}>{fmtBRL(pay.value)}</td>
                        <td style={{ ...num, padding: '12px 14px', textAlign: 'center', color: C.slate }}>{new Date(pay.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                        <td style={{ ...num, padding: '12px 14px', textAlign: 'center', color: C.red, fontWeight: 700 }}>{days}d</td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button onClick={async () => {
                              const dateStr = prompt('Data do pagamento (DD/MM/AAAA):', new Date().toLocaleDateString('pt-BR', { timeZone: 'UTC' }))
                              if (!dateStr) return
                              const parts = dateStr.split('/')
                              if (parts.length !== 3) { toast.error('Data invalida'); return }
                              const paidDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10), 12)
                              if (isNaN(paidDate.getTime())) { toast.error('Data invalida'); return }
                              try {
                                await apiFetch(`/api/payments/${pay.id}`, { method: 'PUT', body: JSON.stringify({ status: 'PAID', paidAt: paidDate.toISOString() }) })
                                toast.success('Pagamento confirmado em ' + dateStr)
                                setOverduePayments(prev => prev.filter(p => p.id !== pay.id))
                              } catch { toast.error('Erro ao dar baixa') }
                            }} style={{ background: C.green, color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Pagar</button>
                            <button onClick={() => window.location.href = `/clients/${pay.client.id}`} style={{ background: C.ink, color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Ver</button>
                            <button onClick={async () => {
                              try {
                                await apiFetch(`/api/payments/${pay.id}/carteira`, { method: 'PATCH', body: JSON.stringify({ inCarteira: !pay.inCarteira }) })
                                setOverduePayments(prev => prev.map(p => p.id === pay.id ? { ...p, inCarteira: !p.inCarteira } : p))
                                toast.success(pay.inCarteira ? 'Removido de A Recuperar' : 'Adicionado a A Recuperar')
                              } catch { toast.error('Erro') }
                            }} style={{ background: pay.inCarteira ? C.amber : C.mid, color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>{pay.inCarteira ? 'Tirar' : 'Recup'}</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  <tr style={{ background: C.bg, fontWeight: 700, color: C.ink }}>
                    <td colSpan={3} style={{ padding: '12px 14px' }}>Total</td>
                    <td style={{ ...num, padding: '12px 14px', textAlign: 'right' }}>{fmtBRL(filtered.reduce((s, p) => s + p.value, 0))}</td>
                    <td colSpan={3} />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
        )})()}

      {/* FIM DE CONTRATO TAB */}
      {pendTab === 'contratos' && (() => {
        const filteredPlans = productFilter ? expiringPlans.filter(p => p.productCode === productFilter) : expiringPlans
        return (
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: C.ink, marginBottom: 16 }}>Contratos vencidos e a vencer</div>
          {filteredPlans.length === 0 ? (
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.green, padding: 24, textAlign: 'center', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12 }}>Todos os contratos em dia.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredPlans.sort((a, b) => a.daysLeft - b.daysLeft).map(plan => {
                const statusColor = plan.expired ? C.red : plan.daysLeft <= 30 ? C.amber : C.green
                return (
                  <div key={plan.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                    padding: '14px 18px', border: `1px solid ${C.line}`, borderRadius: 12,
                    borderLeft: `3px solid ${statusColor}`,
                    background: plan.expired ? '#fef2f2' : plan.daysLeft <= 30 ? '#fffbeb' : '#fff',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, color: C.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {plan.companyName}
                        {plan.productCode && <span style={{ background: PRODUCT_COLORS[plan.productCode] ?? C.mid, color: 'white', padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{plan.productCode}</span>}
                      </div>
                      <div style={{ ...num, fontFamily: 'var(--font-sans)', fontSize: 12, color: C.mid, marginTop: 3 }}>
                        {plan.expired
                          ? <span style={{ color: C.red, fontWeight: 600 }}>Vencido há {Math.abs(plan.daysLeft)} dias ({new Date(plan.contractEndDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })})</span>
                          : <span style={{ color: plan.daysLeft <= 30 ? C.amber : C.green, fontWeight: 600 }}>Vence em {plan.daysLeft} dias ({new Date(plan.contractEndDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })})</span>
                        }
                      </div>
                    </div>
                    <span style={{
                      padding: '4px 12px', borderRadius: 100, fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.03em',
                      background: statusColor, color: 'white',
                    }}>
                      {plan.expired ? 'Vencido' : plan.daysLeft <= 30 ? 'Urgente' : 'Atenção'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        )})()}

    </div>
  )
}
