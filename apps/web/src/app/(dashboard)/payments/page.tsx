'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS } from '@/lib/constants'

// ---- Types ----
interface Client {
  id: string
  companyName: string
}

interface Payment {
  id: string
  installmentNumber: number
  totalInstallments: number
  dueDate: string
  paidAt?: string | null
  value: number
  status: string
  client: Client
  programName?: string | null
}

interface PaginatedPayments {
  data: Payment[]
  total: number
  page: number
  limit: number
}

// ---- Helpers ----
const fmtBRL = (n?: number | null) =>
  n != null
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)
    : 'R$ 0'

const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

function isDueSoon(dueDateStr: string): boolean {
  const due = new Date(dueDateStr)
  const now = new Date()
  const diffMs = due.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= 5
}

function paymentStatusBadge(status: string) {
  const label = PAYMENT_STATUS_LABELS[status] ?? status
  const color = PAYMENT_STATUS_COLORS[status] ?? '#c0c0c0'
  const isLight = color === '#c0c0c0'
  return (
    <span
      className="goon-badge"
      style={{ background: color, color: isLight ? 'black' : 'white' }}
    >
      {label}
    </span>
  )
}

function rowBackground(payment: Payment): string {
  if (payment.status === 'OVERDUE') return '#fff0f0'
  if (payment.status === 'PENDING' && isDueSoon(payment.dueDate)) return '#fff8f0'
  return ''
}

// ---- KPI Cards ----
function KpiCard({
  label,
  value,
  accent,
  sub,
}: {
  label: string
  value: string
  accent: string
  sub?: string
}) {
  return (
    <div
      style={{
        background: 'white',
        border: '2px solid black',
        boxShadow: '4px 4px 0px 0px #000',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 8,
          textTransform: 'uppercase',
          letterSpacing: 1,
          color: '#555',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 14,
          color: accent,
          letterSpacing: 1,
        }}
      >
        {value}
      </span>
      {sub && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#777' }}>
          {sub}
        </span>
      )}
    </div>
  )
}

// ---- Modal: New Payment ----
interface NewPaymentModalProps {
  onClose: () => void
  onCreated: () => void
}

function NewPaymentModal({ onClose, onCreated }: NewPaymentModalProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [form, setForm] = useState({
    clientId: '',
    installmentNumber: '1',
    totalInstallments: '1',
    dueDate: '',
    value: '',
    status: 'PENDING',
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
    if (!form.clientId || !form.dueDate || !form.value) {
      toast.error('[ERRO] Preencha todos os campos obrigatórios')
      return
    }
    setLoading(true)
    try {
      await apiFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          clientId: form.clientId,
          installmentNumber: parseInt(form.installmentNumber, 10),
          totalInstallments: parseInt(form.totalInstallments, 10),
          dueDate: form.dueDate,
          value: parseFloat(form.value),
          status: form.status,
        }),
      })
      toast.success('[OK] Pagamento criado com sucesso')
      onCreated()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Falha ao criar pagamento')
    } finally {
      setLoading(false)
    }
  }

  const fl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }

  return (
    <div className="goon-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="goon-modal">
        <div className="goon-modal-header">
          <span>Novo Pagamento</span>
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
        <form onSubmit={handleSubmit} className="goon-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={fl}>
            <label className="goon-label">Cliente *</label>
            <select className="goon-select" value={form.clientId} onChange={e => set('clientId', e.target.value)}>
              <option value="">Selecionar cliente...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.companyName}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={fl}>
              <label className="goon-label">Parcela Nº *</label>
              <input
                className="goon-input"
                type="number"
                min={1}
                value={form.installmentNumber}
                onChange={e => set('installmentNumber', e.target.value)}
              />
            </div>
            <div style={fl}>
              <label className="goon-label">Total Parcelas *</label>
              <input
                className="goon-input"
                type="number"
                min={1}
                value={form.totalInstallments}
                onChange={e => set('totalInstallments', e.target.value)}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={fl}>
              <label className="goon-label">Vencimento *</label>
              <input
                className="goon-input"
                type="date"
                value={form.dueDate}
                onChange={e => set('dueDate', e.target.value)}
              />
            </div>
            <div style={fl}>
              <label className="goon-label">Valor (R$) *</label>
              <input
                className="goon-input"
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={form.value}
                onChange={e => set('value', e.target.value)}
              />
            </div>
          </div>
          <div style={fl}>
            <label className="goon-label">Status</label>
            <select className="goon-select" value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="PENDING">Pendente</option>
              <option value="SCHEDULED">Agendado</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '2px solid black' }}>
            <button type="button" className="goon-btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="goon-btn-accent" disabled={loading}>
              {loading ? 'Salvando...' : 'Criar Pagamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---- Mobile Payment Card ----
function PaymentCard({ payment, onPay }: { payment: Payment; onPay: (id: string) => void }) {
  return (
    <div
      style={{
        background: payment.status === 'OVERDUE' ? '#fff0f0' : payment.status === 'PENDING' && isDueSoon(payment.dueDate) ? '#fff8f0' : 'white',
        border: '2px solid black',
        boxShadow: '4px 4px 0px 0px #000',
        padding: 16,
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <a
            href={`/clients/${payment.client.id}`}
            style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: 'var(--retro-blue)', textDecoration: 'underline' }}
          >
            {payment.client.companyName}
          </a>
          {payment.programName && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555', marginTop: 2 }}>
              {payment.programName}
            </div>
          )}
        </div>
        {paymentStatusBadge(payment.status)}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555' }}>
          Parcela {payment.installmentNumber}/{payment.totalInstallments}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555' }}>
          Venc: {fmtDate(payment.dueDate)}
        </span>
        <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 11, color: 'black', fontWeight: 700 }}>
          {fmtBRL(payment.value)}
        </span>
      </div>
      {(payment.status === 'PENDING' || payment.status === 'OVERDUE') && (
        <button
          className="goon-btn-accent"
          style={{ fontSize: 9, padding: '6px 12px' }}
          onClick={() => onPay(payment.id)}
        >
          Marcar Pago
        </button>
      )}
    </div>
  )
}

// ---- Main Page ----
export default function PaymentsPage() {
  const isMobile = useIsMobile()

  const [payments, setPayments] = useState<Payment[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const limit = 20
  const totalPages = Math.ceil(total / limit)

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 400)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search])

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (debouncedSearch) params.set('search', debouncedSearch)
      params.set('page', String(page))
      params.set('limit', String(limit))
      const result = await apiFetch<PaginatedPayments>(`/api/payments?${params.toString()}`)
      setPayments(result.data)
      setTotal(result.total)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao carregar pagamentos')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, debouncedSearch, page])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  useEffect(() => { setPage(1) }, [statusFilter, debouncedSearch])

  // KPIs
  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()

  const receitaMes = payments
    .filter(p => {
      if (p.status !== 'PAID') return false
      const d = new Date(p.paidAt ?? p.dueDate)
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear
    })
    .reduce((s, p) => s + p.value, 0)

  const totalPendente = payments
    .filter(p => p.status === 'PENDING')
    .reduce((s, p) => s + p.value, 0)

  const totalVencido = payments
    .filter(p => p.status === 'OVERDUE')
    .reduce((s, p) => s + p.value, 0)

  const paidCount = payments.filter(p => p.status === 'PAID').length
  const overdueCount = payments.filter(p => p.status === 'OVERDUE').length
  const adimplencia = paidCount + overdueCount > 0
    ? Math.round((paidCount / (paidCount + overdueCount)) * 100)
    : 100

  const handlePay = async (id: string) => {
    try {
      await apiFetch(`/api/payments/${id}/pay`, { method: 'PATCH' })
      toast.success('[OK] Pagamento confirmado')
      fetchPayments()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Falha ao confirmar pagamento')
    }
  }

  const handleCheckOverdue = async () => {
    try {
      const result = await apiFetch<{ count?: number; updated?: number }>('/api/payments/check-overdue', { method: 'POST' })
      const count = result.count ?? result.updated ?? 0
      toast.success(`[OK] ${count} pagamento(s) marcados como vencidos`)
      fetchPayments()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Falha ao verificar vencidos')
    }
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: 14, fontWeight: 700, color: 'black', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>
            Financeiro
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555', margin: '4px 0 0 0' }}>
            {'>'} {total} pagamento{total !== 1 ? 's' : ''} no total
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="goon-btn-secondary" onClick={handleCheckOverdue}>
            ⚠ Verificar Vencidos
          </button>
          <button className="goon-btn-accent" onClick={() => setShowModal(true)}>
            + Novo Pagamento
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
        <KpiCard label="Receita Mês" value={fmtBRL(receitaMes)} accent="var(--retro-green)" sub="Pagamentos recebidos" />
        <KpiCard label="Total Pendente" value={fmtBRL(totalPendente)} accent="var(--retro-blue)" sub="Aguardando pagamento" />
        <KpiCard label="Total Vencido" value={fmtBRL(totalVencido)} accent="var(--danger)" sub="Boletos atrasados" />
        <KpiCard label="Adimplência" value={`${adimplencia}%`} accent="var(--success)" sub="Pago vs Vencido" />
      </div>

      {/* Info Banner */}
      <div
        style={{
          background: 'white',
          border: '2px solid var(--warning)',
          boxShadow: '4px 4px 0px 0px var(--warning)',
          padding: '12px 16px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
        }}
      >
        <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 9, color: 'var(--warning)', whiteSpace: 'nowrap', lineHeight: 1.8 }}>
          [ℹ ATENÇÃO]
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555', lineHeight: 1.6 }}>
          O prazo financeiro pode diferir da vigência do contrato.
          Acompanhe ambos os prazos na tabela abaixo.
        </span>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          className="goon-input"
          style={{ maxWidth: 280 }}
          placeholder="Buscar cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="goon-select"
          style={{ maxWidth: 200 }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">Todos os status</option>
          <option value="PENDING">Pendente</option>
          <option value="PAID">Pago</option>
          <option value="OVERDUE">Vencido</option>
          <option value="SCHEDULED">Agendado</option>
        </select>
      </div>

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

      {/* Empty */}
      {!loading && payments.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, background: 'white', border: '2px solid black', boxShadow: '4px 4px 0px 0px #000' }}>
          <p style={{ fontFamily: 'var(--font-pixel)', fontSize: 11, color: 'black', margin: 0 }}>
            Nenhum pagamento encontrado
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555', marginTop: 12 }}>
            Ajuste os filtros ou crie um novo pagamento
          </p>
        </div>
      )}

      {/* Desktop Table */}
      {!loading && payments.length > 0 && !isMobile && (
        <div style={{ overflow: 'auto', border: '2px solid black', boxShadow: '6px 6px 0px 0px #000' }}>
          <table className="goon-table">
            <thead>
              <tr>
                <th>Aluno / Empresa</th>
                <th>Programa</th>
                <th>Parcela</th>
                <th>Vencimento</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(payment => {
                const bg = rowBackground(payment)
                return (
                  <tr key={payment.id} style={bg ? { background: bg } : {}}>
                    <td>
                      <a
                        href={`/clients/${payment.client.id}`}
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          color: 'var(--retro-blue)',
                          textDecoration: 'underline',
                          fontSize: 13,
                        }}
                      >
                        {payment.client.companyName}
                      </a>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555' }}>
                        {payment.programName ?? '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>
                        {payment.installmentNumber}/{payment.totalInstallments}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                          color: payment.status === 'OVERDUE' ? 'var(--danger)' : 'black',
                          fontWeight: payment.status === 'OVERDUE' ? 700 : 400,
                        }}
                      >
                        {fmtDate(payment.dueDate)}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 10, fontWeight: 700 }}>
                        {fmtBRL(payment.value)}
                      </span>
                    </td>
                    <td>{paymentStatusBadge(payment.status)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                        {(payment.status === 'PENDING' || payment.status === 'OVERDUE') && (
                          <button
                            className="goon-btn-accent"
                            style={{ fontSize: 8, padding: '5px 8px', whiteSpace: 'nowrap', minHeight: 44 }}
                            onClick={() => handlePay(payment.id)}
                          >
                            Marcar Pago
                          </button>
                        )}
                        {payment.status === 'OVERDUE' && (
                          <button
                            className="goon-btn-danger"
                            style={{ fontSize: 8, padding: '5px 8px', whiteSpace: 'nowrap' }}
                            onClick={() => toast.info('[INFO] Funcionalidade em breve')}
                          >
                            Env. Cobrança
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile Cards */}
      {!loading && payments.length > 0 && isMobile && (
        <div>
          {payments.map(payment => (
            <PaymentCard key={payment.id} payment={payment} onPay={handlePay} />
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
        <NewPaymentModal
          onClose={() => setShowModal(false)}
          onCreated={fetchPayments}
        />
      )}
    </div>
  )
}
