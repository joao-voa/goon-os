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

  // Stages that have at least one item
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
            padding: '6px 14px',
            minHeight: 44,
            borderRadius: 20,
            border: '1px solid',
            borderColor: activeStage === null ? 'var(--goon-primary)' : 'var(--goon-border)',
            background: activeStage === null ? 'var(--goon-primary)' : 'transparent',
            color: activeStage === null ? '#fff' : 'var(--goon-text-secondary)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
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
                padding: '6px 14px',
                minHeight: 44,
                borderRadius: 20,
                border: `1px solid ${isActive ? color : 'var(--goon-border)'}`,
                background: isActive ? color + '22' : 'transparent',
                color: isActive ? color : 'var(--goon-text-secondary)',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: color,
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              {STAGE_LABELS[stage] ?? stage}
              <span
                style={{
                  background: color + '33',
                  color,
                  borderRadius: 8,
                  padding: '0 6px',
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
            color: 'var(--goon-text-muted)',
            fontSize: 14,
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
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '14px 12px',
                  minHeight: 44,
                  background: 'var(--goon-card-bg)',
                  border: '1px solid var(--goon-border)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                {/* Stage color dot */}
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: color,
                    flexShrink: 0,
                    marginTop: 4,
                  }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: 'var(--goon-text-primary)',
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
                          background: productColor + '22',
                          color: productColor,
                          border: `1px solid ${productColor}55`,
                          borderRadius: 4,
                          padding: '1px 6px',
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {item.productCode}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--goon-text-secondary)', marginBottom: 6 }}>
                    {item.client.responsible}
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        background: color + '22',
                        color,
                        border: `1px solid ${color}44`,
                        borderRadius: 10,
                        padding: '1px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {STAGE_LABELS[item.currentStage] ?? item.currentStage}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: daysWarning ? '#f59e0b' : 'var(--goon-text-muted)',
                        fontWeight: daysWarning ? 700 : 400,
                      }}
                    >
                      {item.daysInStage === 0 ? 'hoje' : `${item.daysInStage}d`}
                      {daysWarning && ' ⚠'}
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
