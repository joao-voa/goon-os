'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
  endDate?: string | null
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
  hasContract: boolean
  hasBilling: boolean
  isClientActive: boolean
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
      fontFamily: 'var(--font-sans)',
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.04em',
      background: bg,
      color: 'white',
      border: '1px solid #e2e8f0',
      boxShadow: 'none',
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
      border: '1px solid #e2e8f0',
      fontFamily: 'var(--font-sans)',
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
        borderTop: '1px solid #e2e8f0',
        boxShadow: '0 -4px 0 black',
        width: '100%',
        maxHeight: '85vh',
        overflowY: 'auto',
      } : {
        background: 'white',
        border: '1px solid #e2e8f0',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
        width: '95%',
        maxWidth: 640,
        maxHeight: '85vh',
        overflowY: 'auto',
      }}>
        {/* Modal header */}
        <div style={{
          background: 'black',
          color: 'white',
          fontFamily: 'var(--font-sans)',
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
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
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
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)',
        padding: 16,
        cursor: 'pointer',
        marginBottom: 12,
        transition: 'transform 0.1s, box-shadow 0.1s',
      }}
      onClick={onClick}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translate(-2px, -2px)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.08)'
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
      </div>
    </div>
  )
}

// ---- Segmentos da base ----
const SEGMENTS = [
  { key: 'ativos', label: 'Clientes ativos', desc: 'Contrato ativo dentro do prazo' },
  { key: 'recorrentes', label: 'Recorrentes', desc: 'Ainda pagando, mas com contrato vencido — a renovar' },
  { key: 'base', label: 'Base de clientes', desc: 'Ex-clientes sem contrato ativo nem pagamentos' },
  { key: 'leads', label: 'Leads', desc: 'Possíveis clientes (nunca fecharam)' },
] as const

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
  const [bucket, setBucket] = useState('ativos')
  const [counts, setCounts] = useState<{ ativos: number; recorrentes: number; base: number; leads: number } | null>(null)
  const [programFilter, setProgramFilter] = useState('')
  const [sort, setSort] = useState('companyName')

  const [sortField, setSortField] = useState<string>('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const filterLabelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-sans)',
    fontSize: 11,
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    display: 'block',
    marginBottom: 5,
  }

  const sortedClients = [...clients].sort((a, b) => {
    if (!sortField) return 0
    let aVal: string | number | boolean = ''
    let bVal: string | number | boolean = ''
    switch (sortField) {
      case 'companyName': aVal = a.companyName.toLowerCase(); bVal = b.companyName.toLowerCase(); break
      case 'responsible': aVal = a.responsible.toLowerCase(); bVal = b.responsible.toLowerCase(); break
      case 'hasContract': aVal = a.hasContract ? 1 : 0; bVal = b.hasContract ? 1 : 0; break
      case 'hasBilling': aVal = a.hasBilling ? 1 : 0; bVal = b.hasBilling ? 1 : 0; break
      case 'isClientActive': aVal = a.isClientActive ? 1 : 0; bVal = b.isClientActive ? 1 : 0; break
      case 'status': aVal = a.status; bVal = b.status; break
      default: return 0
    }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
    return 0
  })

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
      if (bucket) params.set('bucket', bucket)
      if (programFilter) params.set('product', programFilter)
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
  }, [debouncedSearch, bucket, programFilter, page, sort])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  // Contagem por segmento (respeita a busca)
  useEffect(() => {
    const p = new URLSearchParams()
    if (debouncedSearch) p.set('search', debouncedSearch)
    apiFetch<{ ativos: number; recorrentes: number; base: number; leads: number }>(`/api/clients/buckets/counts?${p}`).then(setCounts).catch(() => {})
  }, [debouncedSearch, total])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, bucket, programFilter, sort])

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#0f172a', margin: 0 }}>Clientes</h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#64748b', margin: '2px 0 0 0' }}>{SEGMENTS.find(s => s.key === bucket)?.desc} · {total}</p>
        </div>
        <button className="goon-btn-accent" onClick={() => setShowModal(true)}>+ Novo Cliente</button>
      </div>

      {/* Segmentos */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e2e8f0', overflowX: 'auto' }}>
        {SEGMENTS.map(s => {
          const active = bucket === s.key
          const n = counts ? counts[s.key] : null
          return (
            <button key={s.key} onClick={() => setBucket(s.key)} style={{
              padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? '#0f172a' : '#94a3b8', borderBottom: active ? '2px solid #C7F900' : '2px solid transparent',
              marginBottom: -1, whiteSpace: 'nowrap',
            }}>
              {s.label}{n != null ? <span style={{ marginLeft: 6, fontSize: 11, color: active ? '#64748b' : '#cbd5e1', fontWeight: 600 }}>{n}</span> : null}
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={filterLabelStyle}>Busca</label>
          <input className="goon-input" style={{ maxWidth: 300 }} placeholder="Buscar empresa, responsável..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div>
          <label style={filterLabelStyle}>Programa</label>
          <select className="goon-select" style={{ maxWidth: 190 }} value={programFilter} onChange={e => setProgramFilter(e.target.value)}>
            <option value="">Todos os programas</option>
            <option value="GE">GOON Elite</option>
            <option value="GI">GOON Infinity</option>
            <option value="TTS">TikTok Scale</option>
            <option value="TTSG">TikTok Scale Grupo</option>
            <option value="GA">GOON Advisor</option>
          </select>
        </div>
        <div>
          <label style={filterLabelStyle}>Ordenar</label>
          <select className="goon-select" style={{ maxWidth: 190 }} value={sort} onChange={e => setSort(e.target.value)}>
            <option value="companyName">Empresa</option>
            <option value="createdAt">Mais recentes</option>
          </select>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{
            width: 32,
            height: 32,
            border: '1px solid #e2e8f0',
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
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)',
        }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'black', margin: 0, textTransform: 'uppercase' }}>
            Nenhum cliente encontrado
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 12, color: '#555' }}>
            Tente ajustar os filtros ou crie um novo cliente
          </p>
        </div>
      )}

      {/* Desktop Table */}
      {!loading && clients.length > 0 && !isMobile && (
        <div style={{ overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.08)' }}>
          <table className="goon-table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('companyName')}>Empresa {sortField === 'companyName' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('responsible')}>Responsável {sortField === 'responsible' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                <th>Produto</th>
                <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Vencimento</th>
                <th style={{ textAlign: 'center', width: 70, cursor: 'pointer' }} onClick={() => toggleSort('hasContract')}>Contrato {sortField === 'hasContract' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ textAlign: 'center', width: 70, cursor: 'pointer' }} onClick={() => toggleSort('hasBilling')}>Boleto {sortField === 'hasBilling' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ textAlign: 'center', width: 60, cursor: 'pointer' }} onClick={() => toggleSort('isClientActive')}>Ativo {sortField === 'isClientActive' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('status')}>Status {sortField === 'status' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ width: 80 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedClients.map(client => (
                <tr
                  key={client.id}
                  style={{ cursor: 'pointer' }}
                >
                  <td onClick={() => router.push(`/clients/${client.id}`)}>
                    <div style={{ fontWeight: 700, color: 'black' }}>{client.companyName}</div>
                    {client.tradeName && <div style={{ fontSize: 11, color: '#555' }}>{client.tradeName}</div>}
                  </td>
                  <td onClick={() => router.push(`/clients/${client.id}`)}>{client.responsible}</td>
                  <td onClick={() => router.push(`/clients/${client.id}`)}>{productBadge(client.plans)}</td>
                  <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                    {(() => {
                      const plan = client.plans.find(p => p.status === 'ACTIVE')
                      if (!plan?.endDate) return '-'
                      const end = new Date(plan.endDate)
                      const days = Math.ceil((end.getTime() - Date.now()) / (1000*60*60*24))
                      const color = days < 0 ? '#cc0000' : days <= 30 ? '#ff6600' : '#006600'
                      return <span style={{ color, fontWeight: 700 }}>{days < 0 ? 'Vencido' : end.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                    })()}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={client.hasContract} onChange={async () => {
                      try {
                        await apiFetch(`/api/clients/${client.id}`, { method: 'PUT', body: JSON.stringify({ hasContract: !client.hasContract }) })
                        fetchClients()
                      } catch { toast.error('Erro ao atualizar') }
                    }} style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#006600' }} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={client.hasBilling} onChange={async () => {
                      try {
                        await apiFetch(`/api/clients/${client.id}`, { method: 'PUT', body: JSON.stringify({ hasBilling: !client.hasBilling }) })
                        fetchClients()
                      } catch { toast.error('Erro ao atualizar') }
                    }} style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#006600' }} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={client.isClientActive} onChange={async () => {
                      try {
                        await apiFetch(`/api/clients/${client.id}`, { method: 'PUT', body: JSON.stringify({ isClientActive: !client.isClientActive }) })
                        fetchClients()
                      } catch { toast.error('Erro ao atualizar') }
                    }} style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#006600' }} />
                  </td>
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
                        style={{ background: '#dc2626', color: 'white', border: '1px solid #e2e8f0', padding: '3px 8px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700 }}
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
