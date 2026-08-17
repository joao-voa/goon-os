'use client'

import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/api'

interface Receivables {
  futuros: { total: number; count: number; byMonth: { month: string; total: number; count: number }[] }
  saude: { emDia: number; emDiaValor: number; atrasados: number; atrasadosValor: number; atrasadoAReceber: number; listaAtrasados: { company: string; code: string; value: number; overdue: number; overdueCount: number }[] }
  vigencia: { vigentes: number; vigentesValor: number; encerrados: number; encerradosValor: number; listaEncerrados: { company: string; code: string; value: number; endDate: string }[] }
  recuperacaoExcluidos: number
  totalContratos: number
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const mesLabel = (ym: string) => new Date(ym + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
const dt = (d: string) => new Date(d).toLocaleDateString('pt-BR')

const CARD: React.CSSProperties = { border: '1px solid #e2e8f0', background: 'white', padding: 16, boxShadow: '2px 2px 0 rgba(0,0,0,0.06)' }
const H: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 12px' }
const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' }

export default function ReceivablesContent() {
  const [d, setD] = useState<Receivables | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => { apiFetch<Receivables>('/api/payments/receivables').then(setD).catch(() => setErr(true)) }, [])

  if (err) return <div style={{ ...MONO, color: '#cc0000', fontSize: 12 }}>Erro ao carregar recebíveis.</div>
  if (!d) return <div style={{ ...MONO, color: '#888', fontSize: 12 }}>Carregando…</div>

  const maxMonth = Math.max(1, ...d.futuros.byMonth.map(m => m.total))

  const kpi = (label: string, value: string, sub?: string, color?: string) => (
    <div style={CARD}>
      <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'var(--font-sans)', fontWeight: 700 }}>{label}</div>
      <div style={{ ...MONO, fontSize: 22, fontWeight: 700, marginTop: 6, color: color ?? 'black' }}>{value}</div>
      {sub && <div style={{ ...MONO, fontSize: 11, color: '#888', marginTop: 2 }}>{sub}</div>}
    </div>
  )
  const split = (label: string, aN: number, aV: number, aColor: string, bLabel: string, bN: number, bV: number, bColor: string, aLabel: string) => (
    <div style={CARD}>
      <h3 style={H}>{label}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ borderLeft: `3px solid ${aColor}`, paddingLeft: 10 }}>
          <div style={{ ...MONO, fontSize: 26, fontWeight: 700, color: aColor }}>{aN}</div>
          <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', fontFamily: 'var(--font-sans)', fontWeight: 700 }}>{aLabel}</div>
          <div style={{ ...MONO, fontSize: 12, color: '#888', marginTop: 2 }}>{fmt(aV)}</div>
        </div>
        <div style={{ borderLeft: `3px solid ${bColor}`, paddingLeft: 10 }}>
          <div style={{ ...MONO, fontSize: 26, fontWeight: 700, color: bColor }}>{bN}</div>
          <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', fontFamily: 'var(--font-sans)', fontWeight: 700 }}>{bLabel}</div>
          <div style={{ ...MONO, fontSize: 12, color: '#888', marginTop: 2 }}>{fmt(bV)}</div>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...MONO, fontSize: 11, color: '#888' }}>
        Carteira de recebíveis futuros · <b style={{ color: 'black' }}>{d.totalContratos} contratos ativos</b> considerados
        {d.recuperacaoExcluidos > 0 && <> · <span style={{ color: '#b26a00' }}>{d.recuperacaoExcluidos} em carteira de recuperação excluído(s)</span></>}
      </div>

      {/* KPIs topo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {kpi('Recebíveis futuros', fmt(d.futuros.total), `${d.futuros.count} parcelas a vencer`, '#0a7d34')}
        {kpi('Contratos ativos', String(d.totalContratos), 'planos ativos (fora recuperação)')}
        {kpi('Atrasado a receber', fmt(d.saude.atrasadoAReceber), `${d.saude.atrasados} contratos com atraso`, d.saude.atrasadoAReceber > 0 ? '#cc0000' : 'black')}
        {kpi('A renovar', String(d.vigencia.encerrados), 'vigência encerrada', d.vigencia.encerrados > 0 ? '#b26a00' : 'black')}
      </div>

      {/* Duas quebras */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        {split('Saúde dos contratos', d.saude.emDia, d.saude.emDiaValor, '#0a7d34', 'Atrasados', d.saude.atrasados, d.saude.atrasadosValor, '#cc0000', 'Em dia')}
        {split('Vigência dos contratos', d.vigencia.vigentes, d.vigencia.vigentesValor, '#0a7d34', 'A renovar', d.vigencia.encerrados, d.vigencia.encerradosValor, '#b26a00', 'Vigentes')}
      </div>

      {/* Recebíveis por mês */}
      <div style={CARD}>
        <h3 style={H}>Recebíveis futuros por mês</h3>
        {d.futuros.byMonth.length === 0 ? <div style={{ ...MONO, fontSize: 12, color: '#888' }}>Nenhum recebível futuro.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {d.futuros.byMonth.map(m => (
              <div key={m.month} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 110px', alignItems: 'center', gap: 10 }}>
                <span style={{ ...MONO, fontSize: 11, color: '#666' }}>{mesLabel(m.month)}</span>
                <div style={{ height: 16, background: '#f0f0f0', border: '1px solid #e2e8f0' }}>
                  <div style={{ height: '100%', width: `${(m.total / maxMonth) * 100}%`, background: '#0a7d34' }} />
                </div>
                <span style={{ ...MONO, fontSize: 11, textAlign: 'right', fontWeight: 700 }}>{fmt(m.total)} <span style={{ color: '#aaa', fontWeight: 400 }}>({m.count})</span></span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Listas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        <div style={CARD}>
          <h3 style={H}>Contratos com atraso ({d.saude.listaAtrasados.length})</h3>
          {d.saude.listaAtrasados.length === 0 ? <div style={{ ...MONO, fontSize: 12, color: '#888' }}>Nenhum contrato em atraso. 🎉</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', ...MONO, fontSize: 11 }}>
              <thead><tr style={{ color: '#888', textAlign: 'left' }}><th style={{ padding: '4px 6px' }}>Cliente</th><th style={{ padding: '4px 6px' }}>Prog.</th><th style={{ padding: '4px 6px', textAlign: 'right' }}>Em atraso</th></tr></thead>
              <tbody>
                {d.saude.listaAtrasados.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #eee' }}>
                    <td style={{ padding: '5px 6px', fontWeight: 700 }}>{r.company}</td>
                    <td style={{ padding: '5px 6px', color: '#888' }}>{r.code}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: '#cc0000', fontWeight: 700 }}>{fmt(r.overdue)} <span style={{ color: '#aaa', fontWeight: 400 }}>({r.overdueCount})</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={CARD}>
          <h3 style={H}>Contratos a renovar ({d.vigencia.listaEncerrados.length})</h3>
          {d.vigencia.listaEncerrados.length === 0 ? <div style={{ ...MONO, fontSize: 12, color: '#888' }}>Nenhum contrato com vigência encerrada.</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', ...MONO, fontSize: 11 }}>
              <thead><tr style={{ color: '#888', textAlign: 'left' }}><th style={{ padding: '4px 6px' }}>Cliente</th><th style={{ padding: '4px 6px' }}>Prog.</th><th style={{ padding: '4px 6px', textAlign: 'right' }}>Venceu em</th></tr></thead>
              <tbody>
                {d.vigencia.listaEncerrados.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #eee' }}>
                    <td style={{ padding: '5px 6px', fontWeight: 700 }}>{r.company}</td>
                    <td style={{ padding: '5px 6px', color: '#888' }}>{r.code}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: '#b26a00' }}>{dt(r.endDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
