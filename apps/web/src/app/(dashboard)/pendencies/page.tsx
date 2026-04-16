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

// ---- Helpers ----
const fmtDateTime = (d: string) => {
  const dt = new Date(d)
  return (
    dt.toLocaleDateString('pt-BR') +
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
            border: '2px solid black',
            boxShadow: '3px 3px 0px 0px #000',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-pixel)',
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
              fontFamily: 'var(--font-pixel)',
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
        border: '2px solid black',
        boxShadow: isResolved ? '2px 2px 0px 0px #ccc' : '3px 3px 0px 0px #000',
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
                fontFamily: 'var(--font-pixel)',
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
        border: '2px solid black',
        boxShadow: '4px 4px 0px 0px #000',
      }}
    >
      {/* Column header */}
      <div
        style={{
          background: 'black',
          color: 'white',
          fontFamily: 'var(--font-pixel)',
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
            fontFamily: 'var(--font-pixel)',
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
        borderTop: '2px solid black',
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
              borderTop: '2px solid black',
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
  const [overduePayments, setOverduePayments] = useState<Array<{ id: string; value: number; dueDate: string; installment: number; client: { id: string; companyName: string } }>>([])
  const [expiringPlans, setExpiringPlans] = useState<Array<{ id: string; companyName: string; contractEndDate: string; daysLeft: number; expired: boolean }>>([])
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
    // Load overdue payments
    apiFetch<{ data: Array<{ id: string; value: number; dueDate: string; installment: number; client: { id: string; companyName: string } }> }>('/api/payments?status=OVERDUE&limit=100')
      .then(res => setOverduePayments(res.data ?? []))
      .catch(() => {})
    // Load expiring/expired contracts
    apiFetch<{ renewals: { clients: Array<{ id: string; companyName: string; contractEndDate: string; daysLeft: number; expired: boolean }> } }>('/api/dashboard')
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
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
        {([
          { key: 'inadimplentes' as const, label: `INADIMPLENTES (${overduePayments.length})` },
          { key: 'contratos' as const, label: `FIM DE CONTRATO (${expiringPlans.length})` },
          { key: 'todas' as const, label: 'TODAS PENDENCIAS' },
        ]).map(tab => (
          <button key={tab.key} onClick={() => setPendTab(tab.key)} style={{
            padding: '10px 20px', border: '2px solid black',
            borderBottom: pendTab === tab.key ? 'none' : '2px solid black',
            background: pendTab === tab.key ? 'white' : '#f0f0f0',
            fontFamily: 'var(--font-pixel)', fontSize: 9, fontWeight: 700, cursor: 'pointer',
            textTransform: 'uppercase', position: 'relative',
            marginBottom: pendTab === tab.key ? -2 : 0, zIndex: pendTab === tab.key ? 1 : 0,
            color: pendTab === tab.key ? 'black' : '#888', whiteSpace: 'nowrap',
          }}>{tab.label}</button>
        ))}
        <div style={{ flex: 1, borderBottom: '2px solid black' }} />
      </div>

      {/* INADIMPLENTES TAB */}
      {pendTab === 'inadimplentes' && (
        <div>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 14, marginBottom: 16 }}>CLIENTES INADIMPLENTES</div>
          {overduePayments.length === 0 ? (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#006600', padding: 24, textAlign: 'center', border: '1px dashed #006600' }}>Nenhum inadimplente!</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#cc0000', color: 'white', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Cliente</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Parcela</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Valor</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Vencimento</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Dias Atraso</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {overduePayments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map(pay => {
                    const days = Math.floor((Date.now() - new Date(pay.dueDate).getTime()) / (1000*60*60*24))
                    return (
                      <tr key={pay.id} style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, cursor: 'pointer' }} onClick={() => window.location.href = `/clients/${pay.client.id}`}>{pay.client.companyName}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>{pay.installment}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtBRL(pay.value)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>{new Date(pay.dueDate).toLocaleDateString('pt-BR')}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: '#cc0000', fontWeight: 700 }}>{days}d</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                            <button onClick={async () => {
                              if (!confirm(`Dar baixa no pagamento de ${pay.client.companyName} P${pay.installment} - ${fmtBRL(pay.value)}?`)) return
                              try {
                                await apiFetch(`/api/payments/${pay.id}/pay`, { method: 'PATCH' })
                                toast.success('Pagamento confirmado!')
                                setOverduePayments(prev => prev.filter(p => p.id !== pay.id))
                              } catch { toast.error('Erro ao dar baixa') }
                            }} style={{ background: '#006600', color: 'white', border: '1px solid black', padding: '3px 8px', fontSize: 9, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>PAGAR</button>
                            <button onClick={() => window.location.href = `/clients/${pay.client.id}`} style={{ background: '#4A78FF', color: 'white', border: '1px solid black', padding: '3px 8px', fontSize: 9, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>VER</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  <tr style={{ background: '#f0f0f0', fontWeight: 700 }}>
                    <td colSpan={2} style={{ padding: '8px 12px' }}>TOTAL</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtBRL(overduePayments.reduce((s, p) => s + p.value, 0))}</td>
                    <td colSpan={3} />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* FIM DE CONTRATO TAB */}
      {pendTab === 'contratos' && (
        <div>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 14, marginBottom: 16 }}>CONTRATOS VENCIDOS E A VENCER</div>
          {expiringPlans.length === 0 ? (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#006600', padding: 24, textAlign: 'center', border: '1px dashed #006600' }}>Todos os contratos em dia!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {expiringPlans.sort((a, b) => a.daysLeft - b.daysLeft).map(plan => (
                <div key={plan.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', border: '2px solid black',
                  background: plan.expired ? '#fef2f2' : plan.daysLeft <= 30 ? '#fffbeb' : 'white',
                  boxShadow: '3px 3px 0 black',
                }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13 }}>{plan.companyName}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555', marginTop: 2 }}>
                      {plan.expired
                        ? <span style={{ color: '#cc0000', fontWeight: 700 }}>Vencido ha {Math.abs(plan.daysLeft)} dias ({new Date(plan.contractEndDate).toLocaleDateString('pt-BR')})</span>
                        : <span style={{ color: plan.daysLeft <= 30 ? '#e6a800' : '#006600' }}>Vence em {plan.daysLeft} dias ({new Date(plan.contractEndDate).toLocaleDateString('pt-BR')})</span>
                      }
                    </div>
                  </div>
                  <span style={{
                    padding: '4px 12px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                    background: plan.expired ? '#cc0000' : plan.daysLeft <= 30 ? '#e6a800' : '#006600', color: 'white',
                  }}>
                    {plan.expired ? 'VENCIDO' : plan.daysLeft <= 30 ? 'URGENTE' : 'ATENCAO'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TODAS PENDENCIAS TAB */}
      {pendTab === 'todas' && <>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 14,
              fontWeight: 700,
              color: 'black',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            Pendências
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555', margin: '4px 0 0 0' }}>
            {'>'} {pendencies.filter(p => p.status !== 'RESOLVED').length} pendência(s) em aberto
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="goon-btn-accent" onClick={handleSync}>
            ↺ Sincronizar Pendências
          </button>
          <button className="goon-btn-primary" onClick={() => setShowModal(true)}>
            + Nova Pendência
          </button>
        </div>
      </div>

      {/* Active filter indicator */}
      {clientIdFilter && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '6px 12px', background: '#ccff00', border: '2px solid black', boxShadow: '2px 2px 0 black' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'black', textTransform: 'uppercase' }}>
            Filtro ativo: cliente={clientIdFilter}
          </span>
        </div>
      )}

      {/* KPI Strip */}
      <KpiStrip pendencies={pendencies} />

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 20,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <input
          className="goon-input"
          style={{ maxWidth: 240 }}
          placeholder="Buscar cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="goon-select"
          style={{ maxWidth: 220 }}
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="">Todos os tipos</option>
          {Object.entries(PENDENCY_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button
          className={showResolved ? 'goon-btn-secondary' : 'goon-btn-ghost'}
          onClick={() => setShowResolved(p => !p)}
          style={{ fontSize: 11 }}
        >
          {showResolved ? '✓ Ocultar Resolvidas' : '○ Mostrar Resolvidas'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: '3px solid black',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Desktop Kanban */}
      {!loading && !isMobile && (
        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'flex-start',
          }}
        >
          <KanbanColumn
            title="Abertas"
            pendencies={openList}
            onChangeStatus={handleChangeStatus}
            accentColor="var(--danger)"
          />
          <KanbanColumn
            title="Em Andamento"
            pendencies={inProgressList}
            onChangeStatus={handleChangeStatus}
            accentColor="var(--warning)"
          />
          {showResolved && (
            <KanbanColumn
              title="Resolvidas"
              pendencies={resolvedList}
              onChangeStatus={handleChangeStatus}
              accentColor="var(--retro-green)"
            />
          )}
        </div>
      )}

      {/* Mobile Single Column */}
      {!loading && isMobile && (
        <div>
          {/* Status Chips */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { key: 'OPEN', label: 'Abertas', count: openList.length },
              { key: 'IN_PROGRESS', label: 'Em Andamento', count: inProgressList.length },
              { key: 'RESOLVED', label: 'Resolvidas', count: resolvedList.length },
            ].map(chip => (
              <button
                key={chip.key}
                onClick={() => setMobileStatusFilter(chip.key)}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '6px 12px',
                  border: '2px solid black',
                  boxShadow: mobileStatusFilter === chip.key ? 'none' : '2px 2px 0px 0px #000',
                  background: mobileStatusFilter === chip.key ? 'black' : 'white',
                  color: mobileStatusFilter === chip.key ? 'white' : 'black',
                  cursor: 'pointer',
                  transform: mobileStatusFilter === chip.key ? 'translate(2px,2px)' : 'none',
                  transition: 'all 0.1s',
                }}
              >
                {chip.label} ({chip.count})
              </button>
            ))}
          </div>

          {mobileList.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: 40,
                background: 'white',
                border: '2px solid black',
                boxShadow: '4px 4px 0px 0px #000',
              }}
            >
              <p style={{ fontFamily: 'var(--font-pixel)', fontSize: 10, color: 'black', margin: 0 }}>
                Sem pendências nesta categoria
              </p>
            </div>
          ) : (
            mobileList.map(p => (
              <PendencyCard key={p.id} pendency={p} onChangeStatus={handleChangeStatus} />
            ))
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <NewPendencyModal
          onClose={() => setShowModal(false)}
          onCreated={fetchPendencies}
        />
      )}
      </>}
    </div>
  )
}
