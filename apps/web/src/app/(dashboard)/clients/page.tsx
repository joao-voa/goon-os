'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { PRODUCT_COLORS } from '@/lib/constants'

// ---- Types ----
interface Product {
  id: string
  code: string
  name: string
}

interface ClientPlan {
  id: string
  status: string
  product: Product
}

interface Client {
  id: string
  companyName: string
  tradeName?: string
  cnpj?: string
  responsible: string
  phone?: string
  email?: string
  whatsapp?: string
  segment?: string
  goonFitScore?: number
  status: string
  plans: ClientPlan[]
}

interface PaginatedClients {
  data: Client[]
  total: number
  page: number
  limit: number
}

// ---- Helpers ----
function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    ACTIVE: { label: 'Ativo', className: 'goon-badge goon-badge-active' },
    PROSPECT: { label: 'Prospect', className: 'goon-badge goon-badge-highlight' },
    INACTIVE: { label: 'Inativo', className: 'goon-badge goon-badge-inactive' },
  }
  const s = map[status] ?? { label: status, className: 'goon-badge goon-badge-inactive' }
  return <span className={s.className}>{s.label}</span>
}

function productBadge(plans: ClientPlan[]) {
  const active = plans.find(p => p.status === 'ACTIVE')
  if (!active) return <span style={{ fontFamily: 'var(--font-mono)', color: '#888' }}>—</span>

  const code = active.product.code
  const bg = PRODUCT_COLORS[code] ?? 'black'

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      fontFamily: 'var(--font-pixel)',
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.04em',
      background: bg,
      color: 'white',
      border: '1px solid black',
      boxShadow: '1px 1px 0 black',
      cursor: 'pointer',
    }}>
      {code}
    </span>
  )
}

function fitScoreBadge(score?: number) {
  if (score == null) return <span style={{ fontFamily: 'var(--font-mono)', color: '#888' }}>—</span>
  const bg = score >= 7 ? 'var(--success)' : score >= 4 ? 'var(--warning)' : 'var(--danger)'
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 28,
      height: 28,
      background: bg,
      color: 'white',
      border: '2px solid black',
      fontFamily: 'var(--font-pixel)',
      fontSize: 10,
      fontWeight: 700,
    }}>
      {score}
    </span>
  )
}

// ---- Creation Modal ----
interface CreateModalProps {
  onClose: () => void
  onCreated: () => void
}

function CreateClientModal({ onClose, onCreated }: CreateModalProps) {
  const isMobile = useIsMobile()
  const [form, setForm] = useState<Record<string, string>>({
    companyName: '',
    responsible: '',
    phone: '',
    email: '',
    whatsapp: '',
    segment: '',
    status: 'ACTIVE',
  })
  const [showMore, setShowMore] = useState(false)
  const [showStrategic, setShowStrategic] = useState(false)
  const [loading, setLoading] = useState(false)

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.companyName.trim() || !form.responsible.trim()) {
      toast.error('[ERRO] Empresa e responsável são obrigatórios')
      return
    }
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(form)) {
        if (v !== '') payload[k] = k === 'goonFitScore' ? parseInt(v, 10) : v
      }
      await apiFetch('/api/clients', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      toast.success('[OK] Cliente criado')
      onCreated()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao criar cliente')
    } finally {
      setLoading(false)
    }
  }

  const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }

  return (
    <div
      className="goon-overlay"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={isMobile ? { alignItems: 'flex-end', padding: 0 } : undefined}
    >
      <div style={isMobile ? {
        background: 'white',
        border: 'none',
        borderTop: '2px solid black',
        boxShadow: '0 -4px 0 black',
        width: '100%',
        maxHeight: '85vh',
        overflowY: 'auto',
      } : {
        background: 'white',
        border: '2px solid black',
        boxShadow: '8px 8px 0px 0px #000',
        width: '95%',
        maxWidth: 640,
        maxHeight: '85vh',
        overflowY: 'auto',
      }}>
        {/* Modal header */}
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
          <span>Novo Cliente</span>
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
              lineHeight: 1,
              fontWeight: 700,
            }}
          >×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: isMobile ? '16px' : '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Essential fields */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}>
            <div style={fieldStyle}>
              <label className="goon-label">Empresa *</label>
              <input className="goon-input" value={form.companyName} onChange={e => set('companyName', e.target.value)} placeholder="Nome da empresa" />
            </div>
            <div style={fieldStyle}>
              <label className="goon-label">Responsável *</label>
              <input className="goon-input" value={form.responsible} onChange={e => set('responsible', e.target.value)} placeholder="Nome do responsável" />
            </div>
            <div style={fieldStyle}>
              <label className="goon-label">Telefone</label>
              <input className="goon-input" value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div style={fieldStyle}>
              <label className="goon-label">E-mail</label>
              <input className="goon-input" type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} placeholder="email@empresa.com" />
            </div>
            <div style={fieldStyle}>
              <label className="goon-label">WhatsApp</label>
              <input className="goon-input" value={form.whatsapp ?? ''} onChange={e => set('whatsapp', e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div style={fieldStyle}>
              <label className="goon-label">Segmento</label>
              <input className="goon-input" value={form.segment ?? ''} onChange={e => set('segment', e.target.value)} placeholder="Ex: Tecnologia, Varejo..." />
            </div>
            <div style={fieldStyle}>
              <label className="goon-label">Status</label>
              <select className="goon-select" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="ACTIVE">Ativo</option>
                <option value="PROSPECT">Prospect</option>
                <option value="INACTIVE">Inativo</option>
              </select>
            </div>
          </div>

          {/* More fields toggle */}
          <button
            type="button"
            onClick={() => setShowMore(p => !p)}
            className="goon-btn-ghost"
            style={{ alignSelf: 'flex-start', fontSize: 11 }}
          >
            {showMore ? '▲ Menos campos' : '▼ Mais campos'}
          </button>

          {showMore && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div style={fieldStyle}>
                <label className="goon-label">Nome Fantasia</label>
                <input className="goon-input" value={form.tradeName ?? ''} onChange={e => set('tradeName', e.target.value)} placeholder="Nome fantasia" />
              </div>
              <div style={fieldStyle}>
                <label className="goon-label">CNPJ</label>
                <input className="goon-input" value={form.cnpj ?? ''} onChange={e => set('cnpj', e.target.value)} placeholder="00.000.000/0001-00" />
              </div>
              <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
                <label className="goon-label">Endereço</label>
                <input className="goon-input" value={form.address ?? ''} onChange={e => set('address', e.target.value)} placeholder="Rua, Avenida..." />
              </div>
              <div style={fieldStyle}>
                <label className="goon-label">Número</label>
                <input className="goon-input" value={form.addressNumber ?? ''} onChange={e => set('addressNumber', e.target.value)} placeholder="123" />
              </div>
              <div style={fieldStyle}>
                <label className="goon-label">Bairro</label>
                <input className="goon-input" value={form.neighborhood ?? ''} onChange={e => set('neighborhood', e.target.value)} placeholder="Bairro" />
              </div>
              <div style={fieldStyle}>
                <label className="goon-label">Cidade</label>
                <input className="goon-input" value={form.city ?? ''} onChange={e => set('city', e.target.value)} placeholder="Cidade" />
              </div>
              <div style={fieldStyle}>
                <label className="goon-label">Estado</label>
                <input className="goon-input" value={form.state ?? ''} onChange={e => set('state', e.target.value)} placeholder="SP" maxLength={2} />
              </div>
              <div style={fieldStyle}>
                <label className="goon-label">CEP</label>
                <input className="goon-input" value={form.zipCode ?? ''} onChange={e => set('zipCode', e.target.value)} placeholder="00000-000" />
              </div>
              <div style={fieldStyle}>
                <label className="goon-label">Nº de Funcionários</label>
                <input className="goon-input" value={form.employeeCount ?? ''} onChange={e => set('employeeCount', e.target.value)} placeholder="Ex: 50-200" />
              </div>
              <div style={fieldStyle}>
                <label className="goon-label">Faturamento Estimado</label>
                <input className="goon-input" value={form.estimatedRevenue ?? ''} onChange={e => set('estimatedRevenue', e.target.value)} placeholder="Ex: R$ 500k/mês" />
              </div>
            </div>
          )}

          {/* Strategic toggle */}
          <button
            type="button"
            onClick={() => setShowStrategic(p => !p)}
            className="goon-btn-ghost"
            style={{ alignSelf: 'flex-start', fontSize: 11 }}
          >
            {showStrategic ? '▲ Ocultar estratégicos' : '▼ Dados Estratégicos'}
          </button>

          {showStrategic && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={fieldStyle}>
                <label className="goon-label">Principais Dores</label>
                <textarea className="goon-textarea" value={form.mainPains ?? ''} onChange={e => set('mainPains', e.target.value)} placeholder="Descreva as principais dores..." />
              </div>
              <div style={fieldStyle}>
                <label className="goon-label">Objetivos Estratégicos</label>
                <textarea className="goon-textarea" value={form.strategicGoals ?? ''} onChange={e => set('strategicGoals', e.target.value)} placeholder="Descreva os objetivos..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                <div style={fieldStyle}>
                  <label className="goon-label">Maturidade</label>
                  <select className="goon-select" value={form.maturity ?? ''} onChange={e => set('maturity', e.target.value)}>
                    <option value="">Selecionar...</option>
                    <option value="LOW">Baixa</option>
                    <option value="MEDIUM">Média</option>
                    <option value="HIGH">Alta</option>
                  </select>
                </div>
                <div style={fieldStyle}>
                  <label className="goon-label">Goon Fit Score (1-10)</label>
                  <input
                    className="goon-input"
                    type="number"
                    min={1}
                    max={10}
                    value={form.goonFitScore ?? ''}
                    onChange={e => set('goonFitScore', e.target.value)}
                    placeholder="1-10"
                  />
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 8, borderTop: '2px solid black' }}>
            <button type="button" className="goon-btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="goon-btn-primary" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---- Mobile Card ----
function ClientCard({ client, onClick }: { client: Client; onClick: () => void }) {
  return (
    <div
      style={{
        background: 'white',
        border: '2px solid black',
        boxShadow: '4px 4px 0px 0px #000',
        padding: 16,
        cursor: 'pointer',
        marginBottom: 12,
        transition: 'transform 0.1s, box-shadow 0.1s',
      }}
      onClick={onClick}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translate(-2px, -2px)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '6px 6px 0px 0px #000'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = ''
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '4px 4px 0px 0px #000'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: 'black' }}>{client.companyName}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555', marginTop: 2 }}>{client.responsible}</div>
        </div>
        {statusBadge(client.status)}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        {productBadge(client.plans)}
        {client.segment && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555' }}>{client.segment}</span>
        )}
      </div>
    </div>
  )
}

// ---- Main Page ----
export default function ClientsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()

  const [clients, setClients] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') ?? '')
  const [segmentFilter, setSegmentFilter] = useState('')
  const [sort, setSort] = useState('companyName')

  const limit = 20
  const totalPages = Math.ceil(total / limit)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 400)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search])

  const fetchClients = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (statusFilter) params.set('status', statusFilter)
      if (segmentFilter) params.set('segment', segmentFilter)
      params.set('page', String(page))
      params.set('limit', String(limit))
      params.set('sort', sort)

      const result = await apiFetch<PaginatedClients>(`/api/clients?${params.toString()}`)
      setClients(result.data)
      setTotal(result.total)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, statusFilter, segmentFilter, page, sort])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter, segmentFilter, sort])

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: 14, fontWeight: 700, color: 'black', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>
            Clientes
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555', margin: '4px 0 0 0' }}>
            {'>'} {total} cliente{total !== 1 ? 's' : ''} no total
          </p>
        </div>
        <button className="goon-btn-accent" onClick={() => setShowModal(true)}>
          + Novo Cliente
        </button>
      </div>

      {/* Filters */}
      <div style={isMobile ? {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        marginBottom: statusFilter ? 8 : 16,
      } : {
        display: 'flex',
        gap: 10,
        marginBottom: statusFilter ? 8 : 20,
        flexWrap: 'wrap',
      }}>
        <input
          className="goon-input"
          style={isMobile ? { width: '100%' } : { maxWidth: 280 }}
          placeholder="Buscar empresa, responsável..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {/* Filter chips row — horizontally scrollable on mobile */}
        <div style={isMobile ? {
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
          paddingBottom: 4,
        } : {
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
        }}>
          <select
            className="goon-select"
            style={isMobile ? { minWidth: 150, flexShrink: 0 } : { maxWidth: 180 }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="ACTIVE">Ativo</option>
            <option value="PROSPECT">Prospect</option>
            <option value="INACTIVE">Inativo</option>
          </select>
          <input
            className="goon-input"
            style={isMobile ? { minWidth: 150, flexShrink: 0 } : { maxWidth: 180 }}
            placeholder="Filtrar segmento..."
            value={segmentFilter}
            onChange={e => setSegmentFilter(e.target.value)}
          />
          <select
            className="goon-select"
            style={isMobile ? { minWidth: 180, flexShrink: 0 } : { maxWidth: 200 }}
            value={sort}
            onChange={e => setSort(e.target.value)}
          >
            <option value="companyName">Ordenar: Empresa</option>
            <option value="createdAt">Ordenar: Mais recentes</option>
            <option value="goonFitScore">Ordenar: Fit Score</option>
          </select>
        </div>
      </div>

      {/* Active filter indicator */}
      {statusFilter && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '6px 12px', background: '#ccff00', border: '2px solid black', boxShadow: '2px 2px 0 black', width: 'fit-content' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'black', textTransform: 'uppercase' }}>
            Filtro ativo: status={statusFilter}
          </span>
          <button
            onClick={() => setStatusFilter('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'black', padding: '0 4px', lineHeight: 1 }}
          >
            ✕ limpar
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
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
      )}

      {/* Empty state */}
      {!loading && clients.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: 60,
          background: 'white',
          border: '2px solid black',
          boxShadow: '4px 4px 0px 0px #000',
        }}>
          <p style={{ fontFamily: 'var(--font-pixel)', fontSize: 12, color: 'black', margin: 0, textTransform: 'uppercase' }}>
            Nenhum cliente encontrado
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 12, color: '#555' }}>
            Tente ajustar os filtros ou crie um novo cliente
          </p>
        </div>
      )}

      {/* Desktop Table */}
      {!loading && clients.length > 0 && !isMobile && (
        <div style={{ overflow: 'hidden', border: '2px solid black', boxShadow: '6px 6px 0px 0px #000' }}>
          <table className="goon-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Responsável</th>
                <th>Segmento</th>
                <th>Produto</th>
                <th>Fit Score</th>
                <th>Status</th>
                <th style={{ width: 80 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(client => (
                <tr
                  key={client.id}
                  style={{ cursor: 'pointer' }}
                >
                  <td onClick={() => router.push(`/clients/${client.id}`)}>
                    <div style={{ fontWeight: 700, color: 'black' }}>{client.companyName}</div>
                    {client.tradeName && <div style={{ fontSize: 11, color: '#555' }}>{client.tradeName}</div>}
                  </td>
                  <td onClick={() => router.push(`/clients/${client.id}`)}>{client.responsible}</td>
                  <td onClick={() => router.push(`/clients/${client.id}`)}>{client.segment ?? <span style={{ color: '#888' }}>—</span>}</td>
                  <td onClick={() => router.push(`/clients/${client.id}`)}>{productBadge(client.plans)}</td>
                  <td onClick={() => router.push(`/clients/${client.id}`)}>{fitScoreBadge(client.goonFitScore)}</td>
                  <td onClick={() => router.push(`/clients/${client.id}`)}>{statusBadge(client.status)}</td>
                  <td>
                    {client.status !== 'INACTIVE' && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (!confirm(`Cancelar ${client.companyName}? Pagamentos e comissoes pendentes serao cancelados.`)) return
                          try {
                            await apiFetch(`/api/clients/${client.id}/cancel`, { method: 'PATCH' })
                            toast.success('Cliente cancelado')
                            fetchClients()
                          } catch { toast.error('Erro ao cancelar') }
                        }}
                        style={{ background: '#cc0000', color: 'white', border: '2px solid black', padding: '3px 8px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700 }}
                      >
                        CANCELAR
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile Cards */}
      {!loading && clients.length > 0 && isMobile && (
        <div>
          {clients.map(client => (
            <ClientCard
              key={client.id}
              client={client}
              onClick={() => router.push(`/clients/${client.id}`)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24, alignItems: 'center' }}>
          <button
            className="goon-btn-ghost"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            ← Anterior
          </button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'black', fontWeight: 700 }}>
            Pág {page} / {totalPages}
          </span>
          <button
            className="goon-btn-ghost"
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Próxima →
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <CreateClientModal
          onClose={() => setShowModal(false)}
          onCreated={fetchClients}
        />
      )}
    </div>
  )
}
