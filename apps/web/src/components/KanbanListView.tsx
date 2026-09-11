'use client'

import { useState, type CSSProperties } from 'react'
import { ONBOARDING_STAGES, STAGE_LABELS, STAGE_COLORS, PRODUCT_COLORS } from '@/lib/constants'
import type { OnboardingItem } from './KanbanBoard'

const C = {
  ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0',
  neon: '#C7F900', green: '#16a34a', red: '#dc2626', amber: '#f59e0b', slate: '#475569', bg: '#f8fafc',
}
const num: CSSProperties = { fontVariantNumeric: 'tabular-nums' }

interface KanbanListViewProps {
  items: OnboardingItem[]
  onCardClick: (item: OnboardingItem) => void
}

export default function KanbanListView({ items, onCardClick }: KanbanListViewProps) {
  const [activeStage, setActiveStage] = useState<string | null>(null)

  const stagesWithItems = ONBOARDING_STAGES.filter((s) => items.some((i) => i.currentStage === s))

  const filtered =
    activeStage === null ? items : items.filter((i) => i.currentStage === activeStage)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Filter chips */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 12,
          WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
        }}
      >
        {/* "Todas" chip */}
        <button
          onClick={() => setActiveStage(null)}
          style={{
            ...num,
            flexShrink: 0,
            padding: '0 14px',
            minHeight: 44,
            borderRadius: 100,
            border: `1px solid ${activeStage === null ? C.ink : C.line}`,
            background: activeStage === null ? C.ink : '#fff',
            color: activeStage === null ? '#fff' : C.slate,
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background 0.12s, border-color 0.12s, color 0.12s',
          }}
        >
          Todas ({items.length})
        </button>

        {stagesWithItems.map((stage) => {
          const color = STAGE_COLORS[stage] ?? '#888'
          const count = items.filter((i) => i.currentStage === stage).length
          const isActive = activeStage === stage
          return (
            <button
              key={stage}
              onClick={() => setActiveStage(stage)}
              style={{
                flexShrink: 0,
                padding: '0 14px',
                minHeight: 44,
                borderRadius: 100,
                border: `1px solid ${isActive ? C.ink : C.line}`,
                background: isActive ? C.ink : '#fff',
                color: isActive ? '#fff' : C.slate,
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                transition: 'background 0.12s, border-color 0.12s, color 0.12s',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  background: color,
                  borderRadius: 100,
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              {STAGE_LABELS[stage] ?? stage}
              <span
                style={{
                  ...num,
                  background: isActive ? 'rgba(255,255,255,0.18)' : C.bg,
                  color: isActive ? '#fff' : C.mid,
                  borderRadius: 100,
                  padding: '1px 7px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Card list */}
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            fontFamily: 'var(--font-sans)',
            color: C.dim,
            fontSize: 14,
            fontWeight: 500,
            padding: '40px 0',
          }}
        >
          Nenhum cliente nesta etapa
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((item) => {
            const color = STAGE_COLORS[item.currentStage] ?? '#888'
            const productColor = item.productCode ? (PRODUCT_COLORS[item.productCode] ?? '#888') : null
            const daysWarning = item.daysInStage > 14

            return (
              <button
                key={item.id}
                onClick={() => onCardClick(item)}
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  gap: 12,
                  padding: '14px 14px',
                  minHeight: 44,
                  background: '#fff',
                  border: `1px solid ${C.line}`,
                  borderRadius: 10,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  overflow: 'hidden',
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.07)'
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#cbd5e1'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = C.line
                }}
              >
                {/* Stage color indicator */}
                <div
                  style={{
                    width: 4,
                    alignSelf: 'stretch',
                    background: color,
                    borderRadius: 100,
                    flexShrink: 0,
                  }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 3 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontWeight: 700,
                        fontSize: 14,
                        color: C.ink,
                        flex: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.client.companyName}
                    </span>
                    {productColor && item.productCode && (
                      <span
                        style={{
                          background: productColor,
                          color: '#fff',
                          borderRadius: 6,
                          padding: '2px 6px',
                          fontFamily: 'var(--font-sans)',
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: '0.02em',
                          flexShrink: 0,
                        }}
                      >
                        {item.productCode}
                      </span>
                    )}
                  </div>

                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.mid, marginBottom: 8 }}>
                    {item.client.responsible}
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        background: C.bg,
                        color: C.slate,
                        border: `1px solid ${C.line}`,
                        borderRadius: 100,
                        padding: '2px 9px',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: 100, background: color, display: 'inline-block' }} />
                      {STAGE_LABELS[item.currentStage] ?? item.currentStage}
                    </span>
                    <span
                      style={{
                        ...num,
                        fontFamily: 'var(--font-sans)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 11,
                        color: daysWarning ? C.red : C.dim,
                        fontWeight: daysWarning ? 700 : 500,
                        background: daysWarning ? 'rgba(220,38,38,0.08)' : 'transparent',
                        border: `1px solid ${daysWarning ? 'rgba(220,38,38,0.2)' : 'transparent'}`,
                        borderRadius: 100,
                        padding: daysWarning ? '2px 8px' : '2px 0',
                      }}
                    >
                      {daysWarning && <span aria-hidden>!</span>}
                      {item.daysInStage === 0 ? 'Hoje' : `${item.daysInStage}d`}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
