'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const PaymentsContent = dynamic(() => import('./PaymentsContent'), { ssr: false })
const ExpensesPage = dynamic(() => import('../expenses/page'), { ssr: false })
const CommissionsPage = dynamic(() => import('../commissions/page'), { ssr: false })
const CashflowPage = dynamic(() => import('../cashflow/page'), { ssr: false })

const TABS = [
  { key: 'fluxo', label: 'Fluxo de Caixa' },
  { key: 'pagamentos', label: 'Pagamentos' },
  { key: 'despesas', label: 'Despesas' },
  { key: 'comissoes', label: 'Comissões & Repasses' },
] as const

type TabKey = typeof TABS[number]['key']

export default function FinanceiroPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('fluxo')

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 18px' }}>
        Financeiro
      </h1>

      {/* Tabs — pílulas modernas */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, overflowX: 'auto', paddingBottom: 4, borderBottom: '1px solid #e2e8f0' }}>
        {TABS.map(tab => {
          const active = activeTab === tab.key
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding: '9px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? '#0f172a' : '#94a3b8', whiteSpace: 'nowrap', position: 'relative',
              borderBottom: active ? '2px solid #C7F900' : '2px solid transparent', marginBottom: -1,
              transition: 'color .15s',
            }}>
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'fluxo' && <CashflowPage />}
      {activeTab === 'pagamentos' && <PaymentsContent />}
      {activeTab === 'despesas' && <ExpensesPage />}
      {activeTab === 'comissoes' && <CommissionsPage />}
    </div>
  )
}
