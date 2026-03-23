'use client'

import { useState } from 'react'
import { ONBOARDING_STAGES, STAGE_LABELS, STAGE_COLORS, PRODUCT_COLORS } from '@/lib/constants'
import type { OnboardingItem } from './KanbanBoard'

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
            flexShrink: 0,
            padding: '6px 12px',
            minHeight: 44,
            border: '2px solid black',
            background: activeStage === null ? 'black' : 'var(--retro-gray)',
            color: activeStage === null ? 'white' : 'black',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            textTransform: 'uppercase',
            boxShadow: '2px 2px 0 black',
            transition: 'transform 0.1s, box-shadow 0.1s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translate(1px, 1px)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '1px 1px 0 black'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = ''
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '2px 2px 0 black'
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
                padding: '6px 12px',
                minHeight: 44,
                border: '2px solid black',
                background: isActive ? 'black' : 'var(--retro-gray)',
                color: isActive ? 'white' : 'black',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                textTransform: 'uppercase',
                boxShadow: '2px 2px 0 black',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'transform 0.1s, box-shadow 0.1s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translate(1px, 1px)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '1px 1px 0 black'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = ''
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '2px 2px 0 black'
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  background: color,
                  border: '1px solid rgba(0,0,0,0.4)',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              {STAGE_LABELS[stage] ?? stage}
              <span
                style={{
                  background: isActive ? 'white' : 'black',
                  color: isActive ? 'black' : 'white',
                  padding: '0 5px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
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
            fontFamily: 'var(--font-mono)',
            color: '#555',
            fontSize: 13,
            padding: '40px 0',
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Nenhum cliente nesta etapa
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((item) => {
            const color = STAGE_COLORS[item.currentStage] ?? '#888'
            const codeColors: Record<string, string> = {
              GE: 'var(--retro-blue)',
              GI: 'var(--success)',
              GS: 'var(--warning)',
            }
            const productColor = item.productCode ? (codeColors[item.productCode] ?? '#888') : null
            const daysWarning = item.daysInStage > 14

            return (
              <button
                key={item.id}
                onClick={() => onCardClick(item)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '14px 12px',
                  minHeight: 44,
                  background: 'white',
                  border: '2px solid black',
                  boxShadow: '3px 3px 0px 0px #000',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'transform 0.1s, box-shadow 0.1s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translate(-1px, -1px)'
                  ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '4px 4px 0px 0px #000'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = ''
                  ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '3px 3px 0px 0px #000'
                }}
              >
                {/* Stage color indicator */}
                <div
                  style={{
                    width: 4,
                    alignSelf: 'stretch',
                    background: color,
                    flexShrink: 0,
                  }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        fontSize: 13,
                        color: 'black',
                        flex: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textTransform: 'uppercase',
                      }}
                    >
                      {item.client.companyName}
                    </span>
                    {productColor && item.productCode && (
                      <span
                        style={{
                          background: productColor,
                          color: 'white',
                          border: '1px solid black',
                          padding: '1px 6px',
                          fontFamily: 'var(--font-pixel)',
                          fontSize: 8,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {item.productCode}
                      </span>
                    )}
                  </div>

                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555', marginBottom: 6 }}>
                    {item.client.responsible}
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span
                      style={{
                        background: 'black',
                        color: 'white',
                        border: '1px solid black',
                        padding: '1px 6px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                      }}
                    >
                      {STAGE_LABELS[item.currentStage] ?? item.currentStage}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: daysWarning ? 'var(--danger)' : '#555',
                        fontWeight: daysWarning ? 700 : 400,
                        textTransform: 'uppercase',
                      }}
                    >
                      {item.daysInStage === 0 ? 'hoje' : `${item.daysInStage}d`}
                      {daysWarning && ' [!]'}
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
