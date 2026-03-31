'use client'

import { useState, useEffect, useCallback } from 'react'
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

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [salesRepFilter, setSalesRepFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const loadData = useCallback(async () => {
    const params = new URLSearchParams()
    if (salesRepFilter) params.set('salesRep', salesRepFilter)
    if (statusFilter) params.set('status', statusFilter)
    if (month) params.set('month', String(month))
    if (year) params.set('year', String(year))
    params.set('page', String(page))
    params.set('limit', '20')

    const [list, sum] = await Promise.all([
      apiFetch<{ data: Commission[]; total: number }>(`/api/commissions?${params}`),
      apiFetch<Summary>(`/api/commissions/summary?month=${month}&year=${year}`),
    ])

    setCommissions(list.data)
    setTotal(list.total)
    setSummary(sum)
  }, [salesRepFilter, statusFilter, month, year, page])

  useEffect(() => { loadData() }, [loadData])

  const handlePay = async (id: string) => {
    await apiFetch(`/api/commissions/${id}/pay`, { method: 'PATCH' })
    loadData()
  }

  const handleRevert = async (id: string) => {
    await apiFetch(`/api/commissions/${id}/revert`, { method: 'PATCH' })
    loadData()
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: 20, marginBottom: 16 }}>COMISSOES</h1>

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
            <div key={rep} style={{ background: 'var(--retro-gray)', padding: '12px 20px', border: '2px solid black', boxShadow: '4px 4px 0 black', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
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
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input placeholder="Vendedor" value={salesRepFilter} onChange={e => setSalesRepFilter(e.target.value)} style={{ padding: '6px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '6px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          <option value="">Todos</option>
          <option value="PENDING">Pendente</option>
          <option value="PAID">Pago</option>
          <option value="CANCELLED">Cancelado</option>
        </select>
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))} style={{ padding: '6px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('pt-BR', { month: 'long' })}</option>
          ))}
        </select>
        <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} style={{ width: 80, padding: '6px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }} />
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'black', color: 'white', textTransform: 'uppercase' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Cliente</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Vendedor</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Parcela</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Base</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>%</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Comissao</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Vencimento</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {commissions.map(c => (
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
    </div>
  )
}
