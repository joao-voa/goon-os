'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'

interface DebitItem {
  date: string
  value: number
  description: string
  paid: boolean
}

interface PersonAccount {
  id: string
  name: string
  type: string
  aliases: string[]
  isActive: boolean
  notes: string | null
  totalDebits: number
  totalCredits: number
  balance: number
  debits: DebitItem[]
}

interface Transaction {
  id: string
  personId: string
  type: string
  source: string
  sourceId: string | null
  description: string
  value: number
  date: string
  notes: string | null
}

interface ExtractData {
  person: PersonAccount
  totalDebits: number
  totalCredits: number
  balance: number
  transactions: Transaction[]
}

const TYPE_LABELS: Record<string, string> = { VENDEDOR: 'Vendedor', MENTOR: 'Mentor', SOCIO: 'Socio' }
const TYPE_COLORS: Record<string, string> = { VENDEDOR: '#4A78FF', MENTOR: '#006600', SOCIO: '#000080' }

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtFull = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function PersonAccountsPage() {
  const [persons, setPersons] = useState<PersonAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [extractId, setExtractId] = useState<string | null>(null)
  const [extract, setExtract] = useState<ExtractData | null>(null)
  const [syncing, setSyncing] = useState(false)

  const loadPersons = useCallback(async () => {
    try {
      const data = await apiFetch<PersonAccount[]>('/api/person-accounts')
      setPersons(data)
    } catch { toast.error('Erro ao carregar contas') }
    setLoading(false)
  }, [])

  useEffect(() => { loadPersons() }, [loadPersons])

  async function loadExtract(personId: string) {
    try {
      const data = await apiFetch<ExtractData>(`/api/person-accounts/${personId}/extract`)
      setExtract(data)
    } catch { toast.error('Erro ao carregar extrato') }
  }

  function toggleExpand(personId: string) {
    if (expandedId === personId) {
      setExpandedId(null)
    } else {
      setExpandedId(personId)
      if (extractId !== personId) { setExtractId(null); setExtract(null) }
    }
  }

  function toggleExtract(personId: string) {
    if (extractId === personId) {
      setExtractId(null)
      setExtract(null)
    } else {
      setExtractId(personId)
      setExpandedId(personId)
      loadExtract(personId)
    }
  }

  async function handlePay(person: PersonAccount) {
    const input = prompt(`Quanto pagar para ${person.name}?\nSaldo devedor: ${fmtFull(person.balance)}`)
    if (!input) return
    const amount = parseFloat(input.replace(/[^\d.,]/g, '').replace(',', '.'))
    if (!amount || amount <= 0) { toast.error('Valor invalido'); return }

    const dateInput = prompt('Data do pagamento (DD/MM/AAAA):\nDeixe vazio para hoje')
    let date: string | undefined
    if (dateInput) {
      const parts = dateInput.split('/')
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10))
        if (!isNaN(d.getTime())) date = d.toISOString()
      }
    }

    try {
      await apiFetch(`/api/person-accounts/${person.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({ amount, date }),
      })
      toast.success(`${fmtFull(amount)} pago para ${person.name}`)
      loadPersons()
      if (expandedId === person.id) loadExtract(person.id)
    } catch { toast.error('Erro ao registrar pagamento') }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const result = await apiFetch<{ synced: { commissions: number; expenses: number } }>('/api/person-accounts/sync', { method: 'POST' })
      toast.success(`Sincronizado: ${result.synced.commissions} comissoes, ${result.synced.expenses} mentorias`)
      loadPersons()
      if (expandedId) loadExtract(expandedId)
    } catch { toast.error('Erro ao sincronizar') }
    setSyncing(false)
  }

  async function handleDeleteTx(txId: string) {
    if (!confirm('Excluir este pagamento?')) return
    try {
      await apiFetch(`/api/person-accounts/transactions/${txId}`, { method: 'DELETE' })
      toast.success('Pagamento excluido')
      loadPersons()
      if (expandedId) loadExtract(expandedId)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  const totalBalance = persons.reduce((s, p) => s + p.balance, 0)
  const totalPaid = persons.reduce((s, p) => s + p.totalCredits, 0)
  const personsWithBalance = persons.filter(p => p.balance > 0)

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={{ background: '#1e293b', color: 'white', padding: '12px 16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
          <div style={{ fontSize: 9, textTransform: 'uppercase', opacity: 0.8 }}>Total a Pagar</div>
          <div style={{ fontSize: 18 }}>{fmt(totalBalance)}</div>
          <div style={{ fontSize: 9, opacity: 0.7 }}>{personsWithBalance.length} pessoas com saldo</div>
        </div>
        <div style={{ background: '#334155', color: 'white', padding: '12px 16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
          <div style={{ fontSize: 9, textTransform: 'uppercase', opacity: 0.8 }}>Total Pago</div>
          <div style={{ fontSize: 18 }}>{fmt(totalPaid)}</div>
          <div style={{ fontSize: 9, opacity: 0.7 }}>Creditos registrados</div>
        </div>
        <div style={{ background: '#475569', color: 'white', padding: '12px 16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
          <div style={{ fontSize: 9, textTransform: 'uppercase', opacity: 0.8 }}>Pessoas Cadastradas</div>
          <div style={{ fontSize: 18 }}>{persons.length}</div>
          <div style={{ fontSize: 9, opacity: 0.7 }}>
            {persons.filter(p => p.type === 'VENDEDOR').length} vendedores, {persons.filter(p => p.type === 'MENTOR').length} mentores
          </div>
        </div>
      </div>

      {/* Sync button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={handleSync} disabled={syncing} style={{
          background: '#0f172a', color: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          padding: '6px 16px', cursor: syncing ? 'wait' : 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
        }}>
          {syncing ? 'SINCRONIZANDO...' : 'SYNC'}
        </button>
      </div>

      {/* Persons table */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-mono)', color: '#888' }}>Carregando...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12, background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: 'white', textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Nome</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Tipo</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Devido</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Pago</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Saldo</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {persons.map(p => (
                <>
                  <tr key={p.id} onClick={() => toggleExpand(p.id)} style={{ borderBottom: expandedId === p.id ? 'none' : '1px solid #ddd', cursor: 'pointer', background: expandedId === p.id ? '#f5f5f5' : 'transparent' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                      <span style={{ marginRight: 6, fontSize: 10 }}>{expandedId === p.id ? '▼' : '▶'}</span>
                      {p.name}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ background: TYPE_COLORS[p.type] ?? '#888', color: 'white', padding: '2px 8px', fontSize: 9, fontWeight: 700 }}>
                        {TYPE_LABELS[p.type] ?? p.type}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmtFull(p.totalDebits)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#006600' }}>{fmtFull(p.totalCredits)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: p.balance > 0 ? '#cc0000' : '#006600' }}>
                      {fmtFull(p.balance)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        {p.balance > 0 && p.type !== 'SOCIO' && (
                          <button onClick={() => handlePay(p)} style={{ background: '#006600', color: 'white', border: '1px solid #e2e8f0', padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700 }}>PAGAR</button>
                        )}
                        <button onClick={() => toggleExtract(p.id)} style={{ background: extractId === p.id ? 'black' : 'var(--retro-blue)', color: 'white', border: '1px solid #e2e8f0', padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700 }}>
                          {extractId === p.id ? 'FECHAR' : 'EXTRATO'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Inline debits expansion */}
                  {expandedId === p.id && !extractId && p.debits.length > 0 && (
                    <tr key={p.id + '-debits'}>
                      <td colSpan={6} style={{ padding: 0, background: '#fafafa', borderBottom: '1px solid #ddd' }}>
                        <div style={{ padding: '8px 16px 12px 36px' }}>
                          {/* Header */}
                          <div style={{ display: 'flex', padding: '0 4px 6px', borderBottom: '1px solid #ddd', marginBottom: 4, fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                            <span style={{ minWidth: 80 }}>Dt Prevista</span>
                            <span style={{ flex: 1, marginLeft: 12 }}>Descricao</span>
                            <span style={{ minWidth: 90, textAlign: 'right', marginRight: 8 }}>Valor</span>
                            <span style={{ minWidth: 50 }}></span>
                          </div>
                          {p.debits.map((d, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: i < p.debits.length - 1 ? '1px solid #eee' : 'none', fontFamily: 'var(--font-mono)', fontSize: 11, background: d.paid ? '#f0fff0' : 'transparent', opacity: d.paid ? 0.7 : 1, paddingLeft: 4, paddingRight: 4 }}>
                              <span style={{ color: d.paid ? '#006600' : '#555', minWidth: 80 }}>{fmtDate(d.date)}</span>
                              <span style={{ flex: 1, marginLeft: 12, color: d.paid ? '#006600' : '#333', textDecoration: d.paid ? 'line-through' : 'none' }}>{d.description}</span>
                              <span style={{ fontWeight: 700, minWidth: 90, textAlign: 'right', marginRight: 8, color: d.paid ? '#006600' : 'inherit' }}>{fmtFull(d.value)}</span>
                              {p.type !== 'SOCIO' && !d.paid && (
                                <button onClick={async () => {
                                  try {
                                    await apiFetch(`/api/person-accounts/${p.id}/pay`, { method: 'POST', body: JSON.stringify({ amount: d.value, notes: d.description }) })
                                    toast.success(`${fmtFull(d.value)} pago — ${d.description}`)
                                    loadPersons()
                                  } catch { toast.error('Erro ao pagar') }
                                }} style={{ background: '#006600', color: 'white', border: '1px solid #e2e8f0', padding: '2px 8px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, flexShrink: 0 }}>PG</button>
                              )}
                              {d.paid && (
                                <button onClick={async () => {
                                  if (!confirm('Reverter pagamento dessa parcela?')) return
                                  try {
                                    await apiFetch(`/api/person-accounts/${p.id}/revert-pay`, { method: 'POST', body: JSON.stringify({ notes: d.description }) })
                                    toast.success('Pagamento revertido')
                                    loadPersons()
                                  } catch { toast.error('Erro ao reverter') }
                                }} style={{ background: '#cc0000', color: 'white', border: '1px solid #e2e8f0', padding: '2px 6px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, flexShrink: 0 }}>PAGO ✕</button>
                              )}
                            </div>
                          ))}
                          {p.balance > 0 && p.type !== 'SOCIO' && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, marginRight: 12 }}>Saldo: {fmtFull(p.balance)}</span>
                              <button onClick={() => handlePay(p)} style={{ background: '#006600', color: 'white', border: '1px solid #e2e8f0', padding: '6px 16px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>PAGAR</button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  {/* Full extract */}
                  {extractId === p.id && expandedId === p.id && extract && (
                    <tr key={p.id + '-extract'}>
                      <td colSpan={6} style={{ padding: 0, background: '#f9f9f9' }}>
                        <div style={{ padding: '12px 16px' }}>
                          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, marginBottom: 10 }}>
                            EXTRATO — {p.name.toUpperCase()}
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '4px 8px', textAlign: 'left', fontSize: 9, textTransform: 'uppercase' }}>Data</th>
                                <th style={{ padding: '4px 8px', textAlign: 'left', fontSize: 9, textTransform: 'uppercase' }}>Descricao</th>
                                <th style={{ padding: '4px 8px', textAlign: 'center', fontSize: 9, textTransform: 'uppercase' }}>Origem</th>
                                <th style={{ padding: '4px 8px', textAlign: 'right', fontSize: 9, textTransform: 'uppercase' }}>Debito</th>
                                <th style={{ padding: '4px 8px', textAlign: 'right', fontSize: 9, textTransform: 'uppercase' }}>Credito</th>
                                <th style={{ padding: '4px 8px', textAlign: 'right', fontSize: 9, textTransform: 'uppercase' }}>Saldo</th>
                                <th style={{ padding: '4px 8px', textAlign: 'center', fontSize: 9, textTransform: 'uppercase' }}>Acao</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                let runningBalance = 0
                                return extract.transactions.map(tx => {
                                  if (tx.type === 'DEBIT') runningBalance += tx.value
                                  else runningBalance -= tx.value
                                  return (
                                    <tr key={tx.id} style={{ borderBottom: '1px solid #eee', background: tx.type === 'CREDIT' ? '#f0fff0' : 'transparent' }}>
                                      <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{fmtDate(tx.date)}</td>
                                      <td style={{ padding: '5px 8px', fontSize: 10 }}>{tx.description}</td>
                                      <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                                        <span style={{ background: tx.source === 'MANUAL' ? '#e6a800' : tx.source === 'COMMISSION' ? '#4A78FF' : '#006600', color: 'white', padding: '1px 6px', fontSize: 8, fontWeight: 700 }}>
                                          {tx.source}
                                        </span>
                                      </td>
                                      <td style={{ padding: '5px 8px', textAlign: 'right', color: '#cc0000' }}>
                                        {tx.type === 'DEBIT' ? fmtFull(tx.value) : ''}
                                      </td>
                                      <td style={{ padding: '5px 8px', textAlign: 'right', color: '#006600' }}>
                                        {tx.type === 'CREDIT' ? fmtFull(tx.value) : ''}
                                      </td>
                                      <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: runningBalance > 0 ? '#cc0000' : '#006600' }}>
                                        {fmtFull(runningBalance)}
                                      </td>
                                      <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                                        {tx.source === 'MANUAL' && tx.type === 'CREDIT' && (
                                          <button onClick={() => handleDeleteTx(tx.id)} style={{ background: '#cc0000', color: 'white', border: '1px solid #e2e8f0', padding: '2px 6px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700 }}>X</button>
                                        )}
                                      </td>
                                    </tr>
                                  )
                                })
                              })()}
                              <tr style={{ borderTop: '1px solid #e2e8f0', fontWeight: 700 }}>
                                <td colSpan={3} style={{ padding: '8px' }}>SALDO FINAL</td>
                                <td style={{ padding: '8px', textAlign: 'right', color: '#cc0000' }}>{fmtFull(extract.totalDebits)}</td>
                                <td style={{ padding: '8px', textAlign: 'right', color: '#006600' }}>{fmtFull(extract.totalCredits)}</td>
                                <td style={{ padding: '8px', textAlign: 'right', color: extract.balance > 0 ? '#cc0000' : '#006600', fontSize: 13 }}>{fmtFull(extract.balance)}</td>
                                <td />
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {persons.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#888' }}>Nenhuma pessoa cadastrada. Clique em SYNC para importar.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
