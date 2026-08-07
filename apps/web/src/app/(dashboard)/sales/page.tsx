'use client'

import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { OWNER_EMAIL } from '@/lib/constants'

interface Deal { companyName: string; value: number; date: string; salesRep: string | null; product: string | null }
interface MonthSales { month: number; label: string; count: number; total: number; deals: Deal[] }
interface SalesData { year: number; totalYear: number; countYear: number; months: MonthSales[] }

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export default function SalesPage() {
  const { user, loading: authLoading } = useAuth()
  const isOwner = user?.email === OWNER_EMAIL
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState<SalesData | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    if (isOwner) apiFetch<SalesData>(`/api/crm/sales-by-month?year=${year}`).then(setData).catch(() => {})
  }, [isOwner, year])

  if (authLoading) return null
  if (!isOwner) {
    return (
      <div style={{ padding: 40, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
        🔒 Acesso restrito. Esta página é exclusiva do dono do sistema.
      </div>
    )
  }

  const maxTotal = data ? Math.max(...data.months.map(m => m.total), 1) : 1
  const activeMonths = data ? data.months.filter(m => m.count > 0) : []
  const avgTicket = data && data.countYear > 0 ? data.totalYear / data.countYear : 0

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 20, margin: 0 }}>VENDAS</h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#666', margin: '4px 0 0' }}>Contratos fechados por mês · valor total do contrato</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setYear(y => y - 1)} style={{ background: 'white', border: '1px solid #e2e8f0', cursor: 'pointer', padding: '6px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>◀</button>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 16, minWidth: 60, textAlign: 'center' }}>{year}</span>
          <button onClick={() => setYear(y => y + 1)} style={{ background: 'white', border: '1px solid #e2e8f0', cursor: 'pointer', padding: '6px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>▶</button>
        </div>
      </div>

      {/* KPIs do ano */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total no Ano', value: fmtBRL(data?.totalYear ?? 0), accent: '#0A0A0C' },
          { label: 'Contratos', value: String(data?.countYear ?? 0), accent: '#4A78FF' },
          { label: 'Ticket Médio', value: fmtBRL(avgTicket), accent: '#16a34a' },
          { label: 'Meses com Venda', value: String(activeMonths.length), accent: '#7c3aed' },
        ].map(k => (
          <div key={k.label} style={{ border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', padding: '14px 16px', background: 'white' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: '#666' }}>{k.label}</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 20, color: k.accent }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Barras por mês */}
      <div style={{ border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)', background: 'white' }}>
        <div style={{ background: '#0A0A0C', color: 'white', padding: '10px 16px', fontFamily: 'var(--font-sans)', fontSize: 12 }}>EVOLUÇÃO MENSAL</div>
        <div style={{ padding: 12 }}>
          {activeMonths.length === 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#888', textAlign: 'center', padding: 24 }}>Nenhuma venda em {year}.</div>
          )}
          {data?.months.map(m => m.count > 0 && (
            <div key={m.month} style={{ borderBottom: '1px solid #eee' }}>
              <div onClick={() => setExpanded(expanded === m.month ? null : m.month)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                <span style={{ width: 52, fontWeight: 700, textTransform: 'uppercase' }}>{expanded === m.month ? '▾' : '▸'} {m.label}</span>
                <div style={{ flex: 1, background: '#f0f0f0', height: 20, position: 'relative' }}>
                  <div style={{ width: `${(m.total / maxTotal) * 100}%`, background: '#0A0A0C', height: '100%', transition: 'width 0.3s' }} />
                </div>
                <span style={{ width: 44, textAlign: 'center', color: '#888', fontSize: 10 }}>{m.count}x</span>
                <span style={{ width: 120, textAlign: 'right', fontWeight: 700 }}>{fmtBRL(m.total)}</span>
              </div>
              {expanded === m.month && (
                <div style={{ padding: '4px 4px 12px 62px' }}>
                  {m.deals.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((d, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#444', borderBottom: '1px solid #f5f5f5' }}>
                      <span>{new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · <strong>{d.companyName}</strong>{d.product ? ` · ${d.product}` : ''}{d.salesRep ? ` · ${d.salesRep}` : ''}</span>
                      <span style={{ fontWeight: 700 }}>{fmtBRL(d.value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
