'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'

interface Commission {
  id: string
  clientId: string
  salesRep: string
  percentage: number
  baseValue: number
  value: number
  installment: number
  totalInstallments: number
  status: string
  paidAt: string | null
  client: { id: string; companyName: string }
  payment: { id: string; dueDate: string; status: string }
}

interface Summary {
  totalToPay: number
  totalToPayCount: number
  totalPaid: number
  totalPaidCount: number
  bySalesRep: Record<string, { pending: number; paid: number; cancelled: number }>
  closing: { cutoffDate: string; paymentDate: string; amount: number; count: number }
  future: { amount: number; count: number }
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#e6a800',
  PAID: '#006600',
  CANCELLED: '#cc0000',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  CANCELLED: 'Cancelado',
}

interface Client {
  id: string
  companyName: string
}

function CreateCommissionModal({
  onClose,
  onConfirm,
  clients,
  salesRepSuggestions,
}: {
  onClose: () => void
  onConfirm: () => void
  clients: Client[]
  salesRepSuggestions: string[]
}) {
  const [clientId, setClientId] = useState('')
  const [salesRep, setSalesRep] = useState('')
  const [percentage, setPercentage] = useState('10')
  const [baseValue, setBaseValue] = useState('')
  const [installments, setInstallments] = useState('1')
  const [submitting, setSubmitting] = useState(false)

  const pct = parseFloat(percentage) || 0
  const base = parseFloat(baseValue) || 0
  const inst = parseInt(installments) || 1
  const commissionPerInstallment = Math.round(base * pct) / 100
  const totalCommission = commissionPerInstallment * inst

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId || !salesRep.trim() || base <= 0) {
      toast.error('Preencha todos os campos')
      return
    }
    setSubmitting(true)
    try {
      await apiFetch('/api/commissions/manual', {
        method: 'POST',
        body: JSON.stringify({ clientId, salesRep: salesRep.trim(), percentage: pct, baseValue: base, installments: inst }),
      })
      toast.success(`${inst} comissao(oes) criada(s)!`)
      onConfirm()
    } catch {
      toast.error('Erro ao criar comissao')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 13, background: 'white' }
  const labelStyle: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <form onSubmit={handleSubmit} style={{ background: 'white', border: '2px solid black', boxShadow: '8px 8px 0px 0px #000', width: '100%', maxWidth: 420 }}>
        <div style={{ background: '#e6a800', color: 'white', padding: '10px 16px', fontFamily: 'var(--font-pixel)', fontSize: 11 }}>
          CRIAR COMISSAO MANUAL
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Cliente *</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)} style={inputStyle} required>
              <option value="">Selecione...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Vendedor *</label>
            <input list="comm-salesrep-list" value={salesRep} onChange={e => setSalesRep(e.target.value)} style={inputStyle} required />
            <datalist id="comm-salesrep-list">
              {salesRepSuggestions.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Valor Base (R$)</label>
              <input type="number" step="0.01" value={baseValue} onChange={e => setBaseValue(e.target.value)} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>% Comissao</label>
              <input type="number" step="0.1" value={percentage} onChange={e => setPercentage(e.target.value)} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Parcelas</label>
              <input type="number" min="1" value={installments} onChange={e => setInstallments(e.target.value)} style={inputStyle} required />
            </div>
          </div>
          {base > 0 && pct > 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: '#f0f0f0', padding: '8px 12px', border: '1px solid #ccc' }}>
              {inst}x de R$ {commissionPerInstallment.toFixed(2)} = <strong>R$ {totalCommission.toFixed(2)}</strong> total
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', border: '2px solid black', background: 'white', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>CANCELAR</button>
            <button type="submit" disabled={submitting} style={{ flex: 1, padding: '10px', border: '2px solid black', background: '#e6a800', color: 'white', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: submitting ? 'wait' : 'pointer', boxShadow: '3px 3px 0px 0px #000' }}>
              {submitting ? 'CRIANDO...' : 'CRIAR'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [salesRepFilter, setSalesRepFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [salesRepSuggestions, setSalesRepSuggestions] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'comissoes' | 'mentorias'>('comissoes')
  const [mentorFilter, setMentorFilter] = useState('')
  const [expandedView, setExpandedView] = useState(false)
  const now = new Date()
  const [month, setMonth] = useState<number | null>(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [sortField, setSortField] = useState<string>('dueDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function toggleSort(field: string) {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (salesRepFilter) params.set('salesRep', salesRepFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (month) params.set('month', String(month))
      if (year) params.set('year', String(year))
      params.set('page', String(page))
      params.set('limit', '20')

      const summaryParams = new URLSearchParams()
      if (month) summaryParams.set('month', String(month))
      summaryParams.set('year', String(year))

      const [list, sum] = await Promise.all([
        apiFetch<{ data: Commission[]; total: number }>(`/api/commissions?${params}`),
        apiFetch<Summary>(`/api/commissions/summary?${summaryParams}`),
      ])

      setCommissions(list.data)
      setTotal(list.total)
      setSummary(sum)
    } catch { toast.error('Erro ao carregar comissoes') }
  }, [salesRepFilter, statusFilter, month, year, page])

  const sortedCommissions = [...commissions].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    switch (sortField) {
      case 'client': return dir * a.client.companyName.localeCompare(b.client.companyName)
      case 'salesRep': return dir * a.salesRep.localeCompare(b.salesRep)
      case 'installment': return dir * (a.installment - b.installment)
      case 'baseValue': return dir * (a.baseValue - b.baseValue)
      case 'percentage': return dir * (a.percentage - b.percentage)
      case 'value': return dir * (a.value - b.value)
      case 'dueDate': return dir * (new Date(a.payment.dueDate).getTime() - new Date(b.payment.dueDate).getTime())
      case 'status': return dir * a.status.localeCompare(b.status)
      default: return 0
    }
  })

  const [mentorsList, setMentorsList] = useState<Array<{ id: string; mentorName: string; value: number; notes: string | null; client: string; product: string; productName: string; planValue: number; monthlyBreakdown: Record<string, number> }>>([])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    apiFetch<{ data: Client[] }>('/api/clients?limit=200')
      .then(res => setClients(res.data || []))
      .catch(() => {})
    apiFetch<{ salesReps: string[] }>('/api/crm/suggestions')
      .then(res => setSalesRepSuggestions(res.salesReps || []))
      .catch(() => {})
    apiFetch<Array<{ id: string; mentorName: string; value: number; notes: string | null; client: string; product: string; productName: string; planValue: number; monthlyBreakdown: Record<string, number> }>>('/api/mentors')
      .then(setMentorsList)
      .catch(() => {})
  }, [])

  const handlePay = async (id: string) => {
    try {
      await apiFetch(`/api/commissions/${id}/pay`, { method: 'PATCH' })
      toast.success('Comissao paga')
      loadData()
    } catch { toast.error('Erro ao pagar comissao') }
  }

  const handleRevert = async (id: string) => {
    try {
      await apiFetch(`/api/commissions/${id}/revert`, { method: 'PATCH' })
      toast.success('Comissao revertida')
      loadData()
    } catch { toast.error('Erro ao reverter') }
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: 20, margin: 0 }}>COMISSOES & MENTORIAS</h1>
        {activeTab === 'comissoes' && (
          <button onClick={() => setShowCreateModal(true)} style={{ padding: '8px 16px', border: '2px solid black', background: '#e6a800', color: 'white', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '3px 3px 0px 0px #000' }}>
            + CRIAR COMISSAO
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
        {(['comissoes', 'mentorias'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 24px', border: '2px solid black',
            borderBottom: activeTab === tab ? 'none' : '2px solid black',
            background: activeTab === tab ? 'white' : '#f0f0f0',
            fontFamily: 'var(--font-pixel)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            textTransform: 'uppercase', position: 'relative',
            marginBottom: activeTab === tab ? -2 : 0, zIndex: activeTab === tab ? 1 : 0,
            color: activeTab === tab ? 'black' : '#888',
          }}>
            {tab === 'comissoes' ? 'COMISSOES' : `MENTORIAS (${mentorsList.length})`}
          </button>
        ))}
        <div style={{ flex: 1, borderBottom: '2px solid black' }} />
      </div>

      {activeTab === 'comissoes' && <>
      {/* KPI Strip */}
      {summary && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ background: '#e6a800', color: 'white', padding: '12px 20px', border: '2px solid black', boxShadow: '4px 4px 0 black', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase' }}>Total Pendente</div>
            <div style={{ fontSize: 18 }}>{fmt(summary.totalToPay)}</div>
            <div style={{ fontSize: 10 }}>{summary.totalToPayCount} parcelas</div>
          </div>
          <div style={{ background: '#006600', color: 'white', padding: '12px 20px', border: '2px solid black', boxShadow: '4px 4px 0 black', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase' }}>Total Pago</div>
            <div style={{ fontSize: 18 }}>{fmt(summary.totalPaid)}</div>
            <div style={{ fontSize: 10 }}>{summary.totalPaidCount} parcelas</div>
          </div>
          {Object.entries(summary.bySalesRep).map(([rep, vals]) => (
            <div key={rep} onClick={() => { setSalesRepFilter(salesRepFilter === rep ? '' : rep); setPage(1) }} style={{ background: salesRepFilter === rep ? '#4A78FF' : 'var(--retro-gray)', color: salesRepFilter === rep ? 'white' : 'inherit', padding: '12px 20px', border: '2px solid black', boxShadow: '4px 4px 0 black', fontFamily: 'var(--font-mono)', fontWeight: 700, cursor: 'pointer' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase' }}>{rep}</div>
              <div style={{ fontSize: 14 }}>Pendente: {fmt(vals.pending)}</div>
              <div style={{ fontSize: 14 }}>Pago: {fmt(vals.paid)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Fechamento Cards */}
      {summary?.closing && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ background: 'white', padding: '12px 20px', border: '3px solid #4A78FF', boxShadow: '4px 4px 0 black', fontFamily: 'var(--font-mono)', fontWeight: 700, flex: '1 1 200px' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#4A78FF' }}>Proximo Fechamento</div>
            <div style={{ fontSize: 20, color: 'black', marginTop: 4 }}>{fmt(summary.closing.amount)}</div>
            <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>{summary.closing.count} comissoes</div>
            <div style={{ fontSize: 10, color: '#666' }}>Corte: {new Date(summary.closing.cutoffDate).toLocaleDateString('pt-BR')}</div>
            <div style={{ fontSize: 11, color: '#4A78FF', fontWeight: 900, marginTop: 4 }}>Pagamento: {new Date(summary.closing.paymentDate).toLocaleDateString('pt-BR')}</div>
          </div>
          <div style={{ background: 'white', padding: '12px 20px', border: '3px solid #888', boxShadow: '4px 4px 0 black', fontFamily: 'var(--font-mono)', fontWeight: 700, flex: '1 1 200px' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#888' }}>A Pagar Futuro</div>
            <div style={{ fontSize: 20, color: 'black', marginTop: 4 }}>{fmt(summary.future.amount)}</div>
            <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>{summary.future.count} comissoes futuras</div>
          </div>
          <div style={{ background: '#fff5f5', padding: '12px 20px', border: '2px solid #cc0000', fontFamily: 'var(--font-mono)', fontSize: 10, flex: '1 1 200px', display: 'flex', alignItems: 'center' }}>
            <span style={{ color: '#cc0000' }}>Atencao: se um cliente der churn, as comissoes pendentes dele sao automaticamente canceladas e saem do fechamento.</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Vendedor</label>
          <input placeholder="Todos" value={salesRepFilter} onChange={e => setSalesRepFilter(e.target.value)} style={{ padding: '6px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12, width: 140 }} />
        </div>
        <div>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Status</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '6px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            <option value="">Todos</option>
            <option value="PENDING">Pendente</option>
            <option value="PAID">Pago</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </div>
        <div>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Mes</label>
          <select value={month ?? ''} onChange={e => setMonth(e.target.value ? parseInt(e.target.value) : null)} style={{ padding: '6px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            <option value="">Todos</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('pt-BR', { month: 'long' })}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Ano</label>
          <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} style={{ width: 80, padding: '6px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }} />
        </div>
        <button onClick={() => { setPage(1); loadData() }} style={{ padding: '6px 16px', border: '2px solid black', background: 'black', color: 'white', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, cursor: 'pointer', boxShadow: '3px 3px 0 black', height: 32 }}>
          APLICAR
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'black', color: 'white', textTransform: 'uppercase' }}>
              {([
                { key: 'client', label: 'Cliente', align: 'left' },
                { key: 'salesRep', label: 'Vendedor', align: 'left' },
                { key: 'installment', label: 'Parcela', align: 'center' },
                { key: 'baseValue', label: 'Base', align: 'right' },
                { key: 'percentage', label: '%', align: 'center' },
                { key: 'value', label: 'Comissao', align: 'right' },
                { key: 'dueDate', label: 'Vencimento', align: 'center' },
                { key: 'status', label: 'Status', align: 'center' },
              ] as const).map(col => (
                <th key={col.key} onClick={() => toggleSort(col.key)} style={{ padding: '8px 12px', textAlign: col.align as 'left'|'right'|'center', cursor: 'pointer', userSelect: 'none' }}>
                  {col.label} {sortField === col.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
              ))}
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {sortedCommissions.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #ccc' }}>
                <td style={{ padding: '8px 12px' }}>{c.client.companyName}</td>
                <td style={{ padding: '8px 12px' }}>{c.salesRep}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>{c.installment}/{c.totalInstallments}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(c.baseValue)}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>{c.percentage}%</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{fmt(c.value)}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>{new Date(c.payment.dueDate).toLocaleDateString('pt-BR')}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <span style={{ background: STATUS_COLORS[c.status] ?? '#888', color: 'white', padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{STATUS_LABELS[c.status] ?? c.status}</span>
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                    {c.status === 'PENDING' && (
                      <button onClick={() => handlePay(c.id)} style={{ background: '#006600', color: 'white', border: '2px solid black', padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700 }}>PAGAR</button>
                    )}
                    {c.status === 'PAID' && (
                      <button onClick={() => handleRevert(c.id)} style={{ background: '#e6a800', color: 'white', border: '2px solid black', padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700 }}>REVERTER</button>
                    )}
                    {(
                      <button onClick={async () => {
                        if (!confirm('Excluir esta comissao permanentemente?')) return
                        try {
                          await apiFetch(`/api/commissions/${c.id}`, { method: 'DELETE' })
                          toast.success('Comissao excluida')
                          loadData()
                        } catch { toast.error('Erro ao excluir') }
                      }} style={{ background: '#cc0000', color: 'white', border: '2px solid black', padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700 }}>EXCLUIR</button>
                  </div>
                </td>
              </tr>
            ))}
            {commissions.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', fontFamily: 'var(--font-mono)', color: '#888' }}>Nenhuma comissao encontrada</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '4px 12px', border: '2px solid black', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>Anterior</button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, padding: '4px 8px' }}>{page} / {Math.ceil(total / 20)}</span>
          <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)} style={{ padding: '4px 12px', border: '2px solid black', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>Proximo</button>
        </div>
      )}
      </>}

      {/* ---- MENTORIAS TAB ---- */}
      {activeTab === 'mentorias' && (
        <div>
          {/* KPI Cards */}
          {(() => {
            const totalMentorias = mentorsList.reduce((s, m) => s + m.value, 0)
            const mentorNames = [...new Set(mentorsList.map(m => m.mentorName))]
            return (
              <>
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                  <div style={{ background: '#4A78FF', color: 'white', padding: '12px 20px', border: '2px solid black', boxShadow: '4px 4px 0 black', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase' }}>Total Mentorias</div>
                    <div style={{ fontSize: 18 }}>{fmt(totalMentorias)}</div>
                    <div style={{ fontSize: 10 }}>{mentorsList.length} atribuicoes</div>
                  </div>
                  {mentorNames.map(name => {
                    const mentorTotal = mentorsList.filter(m => m.mentorName === name).reduce((s, m) => s + m.value, 0)
                    const mentorClients = [...new Set(mentorsList.filter(m => m.mentorName === name).map(m => m.client))]
                    return (
                      <div key={name} onClick={() => setMentorFilter(mentorFilter === name ? '' : name)} style={{ background: mentorFilter === name ? '#4A78FF' : 'white', color: mentorFilter === name ? 'white' : 'inherit', padding: '12px 20px', border: '2px solid black', boxShadow: '4px 4px 0 black', fontFamily: 'var(--font-mono)', fontWeight: 700, cursor: 'pointer' }}>
                        <div style={{ fontSize: 10, textTransform: 'uppercase', color: mentorFilter === name ? 'white' : '#4A78FF' }}>{name}</div>
                        <div style={{ fontSize: 18 }}>{fmt(mentorTotal)}</div>
                        <div style={{ fontSize: 10, color: '#666' }}>{mentorClients.length} cliente{mentorClients.length !== 1 ? 's' : ''}</div>
                      </div>
                    )
                  })}
                </div>

                {/* Monthly View */}
                {(() => {
                  // Aggregate all mentors by month
                  const monthlyAll: Record<string, Record<string, number>> = {}
                  const monthTotals: Record<string, number> = {}
                  const filteredMentors = mentorFilter ? mentorsList.filter(m => m.mentorName === mentorFilter) : mentorsList
                  for (const m of filteredMentors) {
                    for (const [month, val] of Object.entries(m.monthlyBreakdown)) {
                      if (!monthlyAll[month]) monthlyAll[month] = {}
                      monthlyAll[month][m.mentorName] = (monthlyAll[month][m.mentorName] ?? 0) + val
                      monthTotals[month] = (monthTotals[month] ?? 0) + val
                    }
                  }
                  const months = Object.keys(monthlyAll).sort()
                  const allMentorNames = [...new Set(filteredMentors.map(m => m.mentorName))]

                  if (months.length === 0) return null

                  const fmtMonth = (m: string) => {
                    const [y, mo] = m.split('-')
                    return new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
                  }

                  // Build per-mentor per-client monthly data for expanded view
                  const mentorClientMonthly: Record<string, Record<string, Record<string, number>>> = {}
                  for (const m of filteredMentors) {
                    if (!mentorClientMonthly[m.mentorName]) mentorClientMonthly[m.mentorName] = {}
                    const clientKey = m.client + ' (' + m.product + ')'
                    if (!mentorClientMonthly[m.mentorName][clientKey]) mentorClientMonthly[m.mentorName][clientKey] = {}
                    for (const [month, val] of Object.entries(m.monthlyBreakdown)) {
                      mentorClientMonthly[m.mentorName][clientKey][month] = (mentorClientMonthly[m.mentorName][clientKey][month] ?? 0) + val
                    }
                  }

                  return (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 12 }}>VISAO MENSAL</div>
                        <button onClick={() => setExpandedView(!expandedView)} style={{
                          padding: '4px 12px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                          background: expandedView ? 'black' : 'white', color: expandedView ? 'white' : 'black',
                        }}>
                          {expandedView ? 'RESUMIDA' : 'COMPLETA'}
                        </button>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                          <thead>
                            <tr style={{ background: 'black', color: 'white', textTransform: 'uppercase' }}>
                              <th style={{ padding: '8px 12px', textAlign: 'left', position: 'sticky', left: 0, background: 'black', zIndex: 2, minWidth: 180 }}>{expandedView ? 'Mentor / Cliente' : 'Mentor'}</th>
                              {months.map(m => (
                                <th key={m} style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtMonth(m)}</th>
                              ))}
                              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allMentorNames.map(name => {
                              const mentorTotal = filteredMentors.filter(m => m.mentorName === name).reduce((s, m) => s + m.value, 0)
                              const clientsOfMentor = mentorClientMonthly[name] ?? {}
                              return (
                                <React.Fragment key={name}>
                                  <tr style={{ borderBottom: expandedView ? 'none' : '1px solid #ddd', background: expandedView ? '#f5f5f5' : 'transparent' }}>
                                    <td style={{ padding: '8px 12px', fontWeight: 700, position: 'sticky', left: 0, background: expandedView ? '#f5f5f5' : 'white', zIndex: 1 }}>{name}</td>
                                    {months.map(m => (
                                      <td key={m} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: expandedView ? 700 : 400 }}>
                                        {monthlyAll[m][name] ? fmt(monthlyAll[m][name]) : '-'}
                                      </td>
                                    ))}
                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{fmt(mentorTotal)}</td>
                                  </tr>
                                  {expandedView && Object.entries(clientsOfMentor).map(([clientKey, clientMonths]) => {
                                    const clientTotal = Object.values(clientMonths).reduce((s, v) => s + v, 0)
                                    return (
                                      <tr key={clientKey} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '4px 12px 4px 28px', fontSize: 10, color: '#555', position: 'sticky', left: 0, background: 'white', zIndex: 1 }}>{clientKey}</td>
                                        {months.map(m => (
                                          <td key={m} style={{ padding: '4px 12px', textAlign: 'right', fontSize: 10, color: '#555' }}>
                                            {clientMonths[m] ? fmt(clientMonths[m]) : '-'}
                                          </td>
                                        ))}
                                        <td style={{ padding: '4px 12px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: '#555' }}>{fmt(clientTotal)}</td>
                                      </tr>
                                    )
                                  })}
                                </React.Fragment>
                              )
                            })}
                            <tr style={{ background: '#f0f0f0', fontWeight: 700 }}>
                              <td style={{ padding: '8px 12px', position: 'sticky', left: 0, background: '#f0f0f0', zIndex: 1 }}>TOTAL</td>
                              {months.map(m => (
                                <td key={m} style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(monthTotals[m])}</td>
                              ))}
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(totalMentorias)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}

                {/* Group by client */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[...new Set((mentorFilter ? mentorsList.filter(m => m.mentorName === mentorFilter) : mentorsList).map(m => m.client + '||' + m.product))].map(key => {
                    const [clientName, productCode] = key.split('||')
                    const clientMentors = (mentorFilter ? mentorsList.filter(m => m.mentorName === mentorFilter) : mentorsList).filter(m => m.client === clientName && m.product === productCode)
                    const clientTotal = clientMentors.reduce((s, m) => s + m.value, 0)
                    const planValue = clientMentors[0]?.planValue ?? 0
                    const product = clientMentors[0]?.product ?? ''
                    const productName = clientMentors[0]?.productName ?? ''
                    return (
                      <div key={clientName} style={{ border: '2px solid black', boxShadow: '4px 4px 0 black', background: 'white' }}>
                        <div style={{ background: 'black', color: 'white', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 11 }}>{clientName}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, marginLeft: 10, opacity: 0.7 }}>{productName}</span>
                          </div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>
                            Plano: {fmt(planValue)}
                          </span>
                        </div>
                        <div style={{ padding: 16 }}>
                          {clientMentors.map(m => (
                            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                              <span style={{ fontWeight: 700 }}>{m.mentorName}</span>
                              <span>{fmt(m.value)}</span>
                              <span style={{ fontSize: 10, color: '#666' }}>{planValue > 0 ? Math.round(m.value / planValue * 100) : 0}% do plano</span>
                            </div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, borderTop: '2px solid black', marginTop: 8 }}>
                            <span>TOTAL MENTORIA</span>
                            <span>{fmt(clientTotal)}</span>
                            <span style={{ color: planValue - clientTotal >= 0 ? '#006600' : '#cc0000', fontSize: 10 }}>
                              Saldo: {fmt(planValue - clientTotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {mentorsList.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 40, fontFamily: 'var(--font-mono)', color: '#888' }}>
                    Nenhuma mentoria atribuida. Atribua mentores nos planos dos clientes fechados.
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}

      {showCreateModal && (
        <CreateCommissionModal
          clients={clients}
          salesRepSuggestions={salesRepSuggestions}
          onClose={() => setShowCreateModal(false)}
          onConfirm={() => { setShowCreateModal(false); loadData() }}
        />
      )}
    </div>
  )
}
