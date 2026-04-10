'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'

interface Expense {
  id: string
  description: string
  category: string
  value: number
  recurrence: string
  dueDate: string
  status: string
  paidAt: string | null
  notes: string | null
}

interface Summary {
  totalPrevisto: number
  totalPago: number
  byCategory: Array<{ category: string; total: number }>
}

const CATEGORIES = ['MENTORIA', 'COMISSAO', 'IMPOSTOS', 'MARKETING', 'PESSOAS', 'SISTEMAS', 'ESTRUTURA', 'OUTRO']
const RECURRENCES = ['UNICA', 'MENSAL', 'TRIMESTRAL', 'ANUAL']
const CATEGORY_LABELS: Record<string, string> = { MENTORIA: 'Mentoria', COMISSAO: 'Comissao', IMPOSTOS: 'Impostos', SISTEMAS: 'Sistemas', MARKETING: 'Marketing', PESSOAS: 'Pessoas', ESTRUTURA: 'Estrutura', OUTRO: 'Outro' }
const CATEGORY_COLORS: Record<string, string> = { MENTORIA: '#4A78FF', COMISSAO: '#e6a800', IMPOSTOS: '#cc0000', MARKETING: '#7c3aed', PESSOAS: '#059669', SISTEMAS: '#06b6d4', ESTRUTURA: '#475569', OUTRO: '#888' }
const RECURRENCE_LABELS: Record<string, string> = { UNICA: 'Unica', MENSAL: 'Mensal', TRIMESTRAL: 'Trimestral', ANUAL: 'Anual' }

const emptyForm = { description: '', category: 'SISTEMAS', value: '', recurrence: 'MENSAL', dueDate: '', notes: '' }

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [sortField, setSortField] = useState<keyof Expense | ''>('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const toggleSort = (field: keyof Expense) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (categoryFilter) params.set('category', categoryFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (month) params.set('month', String(month))
      if (year) params.set('year', String(year))
      params.set('page', String(page))
      params.set('limit', '20')

      const [list, sum] = await Promise.all([
        apiFetch<{ data: Expense[]; total: number }>(`/api/expenses?${params}`),
        apiFetch<Summary>(`/api/expenses/summary?month=${month}&year=${year}`),
      ])

      setExpenses(list.data)
      setTotal(list.total)
      setSummary(sum)
    } catch { toast.error('Erro ao carregar despesas') }
  }, [categoryFilter, statusFilter, month, year, page])

  useEffect(() => { loadData() }, [loadData])

  const handleSave = async () => {
    try {
      const body = { ...form, value: parseFloat(form.value) }
      if (editId) {
        await apiFetch(`/api/expenses/${editId}`, { method: 'PUT', body: JSON.stringify(body) })
      } else {
        await apiFetch('/api/expenses', { method: 'POST', body: JSON.stringify(body) })
      }
      toast.success(editId ? 'Despesa atualizada' : 'Despesa criada')
      setShowModal(false)
      setEditId(null)
      setForm(emptyForm)
      loadData()
    } catch { toast.error('Erro ao salvar despesa') }
  }

  const handleEdit = (e: Expense) => {
    setEditId(e.id)
    setForm({ description: e.description, category: e.category, value: String(e.value), recurrence: e.recurrence, dueDate: e.dueDate.slice(0, 10), notes: e.notes ?? '' })
    setShowModal(true)
  }

  const handlePay = async (id: string) => {
    try {
      await apiFetch(`/api/expenses/${id}/pay`, { method: 'PATCH' })
      toast.success('Despesa paga')
      loadData()
    } catch { toast.error('Erro ao pagar despesa') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir despesa?')) return
    try {
      await apiFetch(`/api/expenses/${id}`, { method: 'DELETE' })
      toast.success('Despesa excluida')
      loadData()
    } catch { toast.error('Erro ao excluir') }
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }
  const labelStyle: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }

  const sortedExpenses = [...expenses].sort((a, b) => {
    if (!sortField) return 0
    const aVal = a[sortField]
    const bVal = b[sortField]
    if (aVal == null && bVal == null) return 0
    if (aVal == null) return 1
    if (bVal == null) return -1
    if (typeof aVal === 'number' && typeof bVal === 'number') return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    const cmp = String(aVal).localeCompare(String(bVal), 'pt-BR')
    return sortDir === 'asc' ? cmp : -cmp
  })

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: 20 }}>DESPESAS</h1>
        <button onClick={() => { setEditId(null); setForm(emptyForm); setShowModal(true) }} style={{ background: 'black', color: 'white', border: '2px solid black', boxShadow: '4px 4px 0 black', padding: '8px 16px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>+ NOVA DESPESA</button>
      </div>

      {/* KPI Strip */}
      {summary && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ background: '#e6a800', color: 'white', padding: '12px 20px', border: '2px solid black', boxShadow: '4px 4px 0 black', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase' }}>Previsto</div>
            <div style={{ fontSize: 18 }}>{fmt(summary.totalPrevisto)}</div>
          </div>
          <div style={{ background: '#006600', color: 'white', padding: '12px 20px', border: '2px solid black', boxShadow: '4px 4px 0 black', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase' }}>Pago</div>
            <div style={{ fontSize: 18 }}>{fmt(summary.totalPago)}</div>
          </div>
          {summary.byCategory.map(c => {
            const color = CATEGORY_COLORS[c.category] ?? '#888'
            const isActive = categoryFilter === c.category
            return (
              <div key={c.category} onClick={() => setCategoryFilter(isActive ? '' : c.category)} style={{
                background: isActive ? color : 'white', color: isActive ? 'white' : 'inherit',
                borderLeft: `4px solid ${color}`, padding: '12px 20px', border: `2px solid ${isActive ? color : 'black'}`,
                boxShadow: '4px 4px 0 black', fontFamily: 'var(--font-mono)', fontWeight: 700, cursor: 'pointer',
              }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase' }}>{CATEGORY_LABELS[c.category] ?? c.category}</div>
                <div style={{ fontSize: 14 }}>{fmt(c.total)}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={labelStyle}>Categoria</label>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ padding: '6px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            <option value="">Todas categorias</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '6px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            <option value="">Todos status</option>
            <option value="PREVISTO">Previsto</option>
            <option value="PAGO">Pago</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Mes</label>
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))} style={{ padding: '6px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('pt-BR', { month: 'long' })}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Ano</label>
          <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} style={{ width: 80, padding: '6px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }} />
        </div>
        <button onClick={() => loadData()} style={{ background: 'black', color: 'white', border: '2px solid black', boxShadow: '4px 4px 0 black', padding: '8px 16px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>APLICAR</button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'black', color: 'white', textTransform: 'uppercase' }}>
              <th onClick={() => toggleSort('description')} style={{ padding: '8px 12px', textAlign: 'left', cursor: 'pointer' }}>Descricao{sortField === 'description' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th onClick={() => toggleSort('category')} style={{ padding: '8px 12px', textAlign: 'center', cursor: 'pointer' }}>Categoria{sortField === 'category' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th onClick={() => toggleSort('value')} style={{ padding: '8px 12px', textAlign: 'right', cursor: 'pointer' }}>Valor{sortField === 'value' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th onClick={() => toggleSort('recurrence')} style={{ padding: '8px 12px', textAlign: 'center', cursor: 'pointer' }}>Recorrencia{sortField === 'recurrence' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th onClick={() => toggleSort('dueDate')} style={{ padding: '8px 12px', textAlign: 'center', cursor: 'pointer' }}>Vencimento{sortField === 'dueDate' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th onClick={() => toggleSort('status')} style={{ padding: '8px 12px', textAlign: 'center', cursor: 'pointer' }}>Status{sortField === 'status' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {sortedExpenses.map(e => (
              <tr key={e.id} style={{ borderBottom: '1px solid #ccc' }}>
                <td style={{ padding: '8px 12px' }}>{e.description}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>{CATEGORY_LABELS[e.category] ?? e.category}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{fmt(e.value)}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>{RECURRENCE_LABELS[e.recurrence] ?? e.recurrence}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>{new Date(e.dueDate).toLocaleDateString('pt-BR')}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <span style={{ background: e.status === 'PAGO' ? '#006600' : '#e6a800', color: 'white', padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{e.status}</span>
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                    <button onClick={() => handleEdit(e)} style={{ background: 'var(--retro-blue)', color: 'white', border: '2px solid black', padding: '4px 8px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700 }}>EDITAR</button>
                    {e.status === 'PREVISTO' && (
                      <button onClick={() => handlePay(e.id)} style={{ background: '#006600', color: 'white', border: '2px solid black', padding: '4px 8px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700 }}>PAGAR</button>
                    )}
                    <button onClick={() => handleDelete(e.id)} style={{ background: '#cc0000', color: 'white', border: '2px solid black', padding: '4px 8px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700 }}>X</button>
                  </div>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', fontFamily: 'var(--font-mono)', color: '#888' }}>Nenhuma despesa encontrada</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--retro-gray)', border: '3px solid black', boxShadow: '6px 6px 0 black', padding: 24, width: 400, maxWidth: '90vw' }}>
            <h2 style={{ fontFamily: 'var(--font-pixel)', fontSize: 16, marginBottom: 16 }}>{editId ? 'EDITAR' : 'NOVA'} DESPESA</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input placeholder="Descricao" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={inputStyle} />
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
              <input type="number" placeholder="Valor" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} style={inputStyle} />
              <select value={form.recurrence} onChange={e => setForm(f => ({ ...f, recurrence: e.target.value }))} style={inputStyle}>
                {RECURRENCES.map(r => <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>)}
              </select>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} style={inputStyle} />
              <textarea placeholder="Observacoes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, minHeight: 60 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setEditId(null) }} style={{ padding: '8px 16px', border: '2px solid black', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>CANCELAR</button>
              <button onClick={handleSave} style={{ background: 'black', color: 'white', padding: '8px 16px', border: '2px solid black', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>SALVAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
