'use client'

import { useState } from 'react'
import CashView from './CashView'
import CashflowDetalhado from './CashflowDetalhado'

// Fluxo de caixa: "Caixa" (dia a dia + projeção) é a visão principal;
// "Detalhado" é a tela antiga por camadas, para quem quer o nível de item.
export default function CashflowPage() {
  const [tab, setTab] = useState<'caixa' | 'detalhado'>('caixa')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
        {([['caixa', 'Caixa'], ['detalhado', 'Detalhado']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '8px 4px', marginRight: 20, background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: tab === k ? 700 : 500,
            color: tab === k ? '#0f172a' : '#94a3b8',
            borderBottom: tab === k ? '2px solid #C7F900' : '2px solid transparent', marginBottom: -1,
          }}>{l}</button>
        ))}
      </div>
      {tab === 'caixa' ? <CashView /> : <CashflowDetalhado />}
    </div>
  )
}
