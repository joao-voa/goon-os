'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useIsMobile } from '@/hooks/useMediaQuery'

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
    ACTIVE: { label: 'Ativo', className: 'goon-badge goon-badge-success' },
    PROSPECT: { label: 'Prospect', className: 'goon-badge goon-badge-primary' },
    INACTIVE: { label: 'Inativo', className: 'goon-badge goon-badge-muted' },
  }
  const s = map[status] ?? { label: status, className: 'goon-badge goon-badge-muted' }
  return <span className={s.className}>{s.label}</span>
}

function productBadge(plans: ClientPlan[]) {
  const active = plans.find(p => p.status === 'ACTIVE')
  if (!active) return <span style={{ color: 'var(--goon-text-muted)' }}>—</span>

  const codeColors: Record<string, string> = {
    GE: '#6C3FFF',
    GI: '#06b6d4',
    GS: '#22c55e',
  }
  const code = active.product.code
  const color = codeColors[code] ?? '#6C3FFF'

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 10px',
      borderRadius: 9999,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.04em',
      background: `${color}22`,
      color,
      border: `1px solid ${color}44`,
    }}>
      {code}
    </span>
  )
}

function fitScoreBadge(score?: number) {
  if (score == null) return <span style={{ color: 'var(--goon-text-muted)' }}>—</span>
  const color = score >= 7 ? 'var(--goon-success)' : score >= 4 ? 'var(--goon-warning)' : 'var(--goon-danger)'
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      color,
      fontWeight: 700,
      fontSize: 14,
    }}>
      <span style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        display: 'inline-block',
      }} />
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
      toast.error('Empresa e responsável são obrigatórios')
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
      toast.success('Cliente criado')
      onCreated()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar cliente')
    } finally {
      setLoading(false)
    }
  }

  const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }

  return (
    <div className="goon-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="goon-modal" style={{ maxWidth: 640 }}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--goon-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--goon-text-primary)', margin: 0 }}>Novo Cliente</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--goon-text-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
          >×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Essential fields */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
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
            style={{ background: 'none', border: 'none', color: 'var(--goon-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', padding: 0 }}
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
            style={{ background: 'none', border: 'none', color: 'var(--goon-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', padding: 0 }}
          >
            {showStrategic ? '▲ Ocultar dados estratégicos' : '▼ Dados Estratégicos'}
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

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 8 }}>
            <button type="button" className="goon-btn-ghost" onClick={onClose}>Cancelar</button>
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
      className="goon-card"
      onClick={onClick}
      style={{ padding: 16, cursor: 'pointer', marginBottom: 12 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--goon-text-primary)' }}>{client.companyName}</div>
          <div style={{ fontSize: 13, color: 'var(--goon-text-muted)', marginTop: 2 }}>{client.responsible}</div>
        </div>
        {statusBadge(client.status)}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        {productBadge(client.plans)}
        {client.segment && (
          <span style={{ fontSize: 12, color: 'var(--goon-text-muted)' }}>{client.segment}</span>
        )}
      </div>
    </div>
  )
}

// ---- Main Page ----
export default function ClientsPage() {
  const router = useRouter()
  const isMobile = useIsMobile()

  const [clients, setClients] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
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
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, statusFilter, segmentFilter, page, sort])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter, segmentFilter, sort])

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'var(--goon-primary-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
          }}>
            👥
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--goon-text-primary)', margin: 0 }}>Clientes</h1>
            <p style={{ fontSize: 13, color: 'var(--goon-text-muted)', margin: 0 }}>{total} cliente{total !== 1 ? 's' : ''} no total</p>
          </div>
        </div>
        <button className="goon-btn-primary" onClick={() => setShowModal(true)}>
          + Novo Cliente
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          className="goon-input"
          style={{ maxWidth: 280 }}
          placeholder="Buscar empresa, responsável, CNPJ..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="goon-select"
          style={{ maxWidth: 160 }}
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
          style={{ maxWidth: 180 }}
          placeholder="Filtrar segmento..."
          value={segmentFilter}
          onChange={e => setSegmentFilter(e.target.value)}
        />
        <select
          className="goon-select"
          style={{ maxWidth: 180 }}
          value={sort}
          onChange={e => setSort(e.target.value)}
        >
          <option value="companyName">Ordenar: Empresa</option>
          <option value="createdAt">Ordenar: Mais recentes</option>
          <option value="goonFitScore">Ordenar: Fit Score</option>
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{
            width: 32,
            height: 32,
            border: '3px solid var(--goon-border)',
            borderTopColor: 'var(--goon-primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      )}

      {/* Empty state */}
      {!loading && clients.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: 60,
          color: 'var(--goon-text-muted)',
          background: 'var(--goon-dark-card)',
          borderRadius: 12,
          border: '1px solid var(--goon-border-subtle)',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
          <p style={{ fontSize: 15, margin: 0 }}>Nenhum cliente encontrado</p>
          <p style={{ fontSize: 13, marginTop: 6 }}>Tente ajustar os filtros ou crie um novo cliente</p>
        </div>
      )}

      {/* Desktop Table */}
      {!loading && clients.length > 0 && !isMobile && (
        <div className="goon-card" style={{ overflow: 'hidden' }}>
          <table className="goon-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Responsável</th>
                <th>Segmento</th>
                <th>Produto</th>
                <th>Fit Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(client => (
                <tr
                  key={client.id}
                  onClick={() => router.push(`/clients/${client.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--goon-text-primary)' }}>{client.companyName}</div>
                    {client.tradeName && <div style={{ fontSize: 12, color: 'var(--goon-text-muted)' }}>{client.tradeName}</div>}
                  </td>
                  <td>{client.responsible}</td>
                  <td>{client.segment ?? <span style={{ color: 'var(--goon-text-muted)' }}>—</span>}</td>
                  <td>{productBadge(client.plans)}</td>
                  <td>{fitScoreBadge(client.goonFitScore)}</td>
                  <td>{statusBadge(client.status)}</td>
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
            style={{ padding: '6px 14px', fontSize: 13 }}
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            ← Anterior
          </button>
          <span style={{ fontSize: 13, color: 'var(--goon-text-muted)' }}>
            Página {page} de {totalPages}
          </span>
          <button
            className="goon-btn-ghost"
            style={{ padding: '6px 14px', fontSize: 13 }}
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
