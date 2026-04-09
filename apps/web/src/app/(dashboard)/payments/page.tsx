'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const PaymentsContent = dynamic(() => import('./PaymentsContent'), { ssr: false })
const ExpensesPage = dynamic(() => import('../expenses/page'), { ssr: false })
const CommissionsPage = dynamic(() => import('../commissions/page'), { ssr: false })
const CashflowPage = dynamic(() => import('../cashflow/page'), { ssr: false })

const TABS = [
  { key: 'pagamentos', label: 'PAGAMENTOS' },
  { key: 'despesas', label: 'DESPESAS' },
  { key: 'comissoes', label: 'COMISSOES' },
  { key: 'fluxo', label: 'FLUXO DE CAIXA' },
] as const

type TabKey = typeof TABS[number]['key']

export default function FinanceiroPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('pagamentos')

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: 20, margin: 0, marginBottom: 16 }}>
        FINANCEIRO
      </h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: '10px 20px', border: '2px solid black',
            borderBottom: activeTab === tab.key ? 'none' : '2px solid black',
            background: activeTab === tab.key ? 'white' : '#f0f0f0',
            fontFamily: 'var(--font-pixel)', fontSize: 10, fontWeight: 700, cursor: 'pointer',
            textTransform: 'uppercase', position: 'relative',
            marginBottom: activeTab === tab.key ? -2 : 0, zIndex: activeTab === tab.key ? 1 : 0,
            color: activeTab === tab.key ? 'black' : '#888',
            whiteSpace: 'nowrap',
          }}>
            {tab.label}
          </button>
        ))}
        <div style={{ flex: 1, borderBottom: '2px solid black' }} />
      </div>

      {activeTab === 'pagamentos' && <PaymentsContent />}
      {activeTab === 'despesas' && <ExpensesPage />}
      {activeTab === 'comissoes' && <CommissionsPage />}
      {activeTab === 'fluxo' && <CashflowPage />}
    </div>
  )
}
