'use client'

import { useState, type CSSProperties } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import { ONBOARDING_STAGES, STAGE_LABELS, STAGE_COLORS, PRODUCT_COLORS as PROD_COLORS } from '@/lib/constants'

const C = {
  ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0',
  neon: '#C7F900', green: '#16a34a', red: '#dc2626', amber: '#f59e0b', slate: '#475569', bg: '#f8fafc',
}
const num: CSSProperties = { fontVariantNumeric: 'tabular-nums' }

export interface OnboardingItem {
  id: string
  clientId: string
  currentStage: string
  daysInStage: number
  client: { companyName: string; responsible: string; phone?: string | null }
  productCode?: string | null
}

interface KanbanBoardProps {
  items: OnboardingItem[]
  onStageChange: (id: string, toStage: string) => Promise<void>
  onCardClick: (item: OnboardingItem) => void
}

// ---- Draggable Card ----
function DraggableCard({
  item,
  onClick,
}: {
  item: OnboardingItem
  onClick: (item: OnboardingItem) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onClick(item)}
      style={{
        background: '#fff',
        border: `1px solid ${C.line}`,
        borderRadius: 10,
        boxShadow: isDragging ? 'none' : '0 1px 2px rgba(0,0,0,0.04)',
        padding: '11px 13px',
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.4 : 1,
        userSelect: 'none',
        marginBottom: 8,
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => {
        if (isDragging) return
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.07)'
        ;(e.currentTarget as HTMLDivElement).style.borderColor = '#cbd5e1'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'
        ;(e.currentTarget as HTMLDivElement).style.borderColor = C.line
      }}
    >
      <CardContent item={item} />
    </div>
  )
}

// ---- Card Content (shared between draggable and overlay) ----
function CardContent({ item }: { item: OnboardingItem }) {
  const productColor = item.productCode ? (PROD_COLORS[item.productCode] ?? '#888') : null
  const daysWarning = item.daysInStage > 14

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 5 }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: C.ink, lineHeight: 1.3, flex: 1 }}>
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
      <div
        style={{
          ...num,
          fontFamily: 'var(--font-sans)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 11,
          color: daysWarning ? C.red : C.dim,
          fontWeight: daysWarning ? 700 : 500,
          background: daysWarning ? 'rgba(220,38,38,0.08)' : C.bg,
          border: `1px solid ${daysWarning ? 'rgba(220,38,38,0.2)' : C.line}`,
          borderRadius: 100,
          padding: '2px 8px',
        }}
      >
        {daysWarning && <span aria-hidden style={{ fontSize: 11 }}>!</span>}
        {item.daysInStage === 0 ? 'Hoje' : `${item.daysInStage}d nesta etapa`}
      </div>
    </>
  )
}

// ---- Droppable Column ----
function DroppableColumn({
  stage,
  items,
  onCardClick,
}: {
  stage: string
  items: OnboardingItem[]
  onCardClick: (item: OnboardingItem) => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage })
  const color = STAGE_COLORS[stage] ?? '#888'
  const label = STAGE_LABELS[stage] ?? stage

  return (
    <div
      style={{
        width: 240,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: C.bg,
        border: `1px solid ${C.line}`,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Column header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 14px',
          background: '#fff',
          borderBottom: `1px solid ${C.line}`,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{ width: 8, height: 8, background: color, borderRadius: 100, flexShrink: 0 }}
        />
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            fontWeight: 700,
            color: C.ink,
            flex: 1,
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
          }}
        >
          {label}
        </span>
        <span
          style={{
            ...num,
            background: C.bg,
            color: C.mid,
            border: `1px solid ${C.line}`,
            borderRadius: 100,
            padding: '1px 8px',
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {items.length}
        </span>
      </div>

      {/* Drop area */}
      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          minHeight: 300,
          padding: 10,
          border: `2px solid ${isOver ? C.neon : 'transparent'}`,
          background: isOver ? 'rgba(199,249,0,0.10)' : 'transparent',
          borderRadius: 10,
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        {items.map((item) => (
          <DraggableCard key={item.id} item={item} onClick={onCardClick} />
        ))}
        {items.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              fontFamily: 'var(--font-sans)',
              color: C.dim,
              fontSize: 12,
              fontWeight: 500,
              padding: '24px 0',
            }}
          >
            Sem clientes
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Main Board ----
export default function KanbanBoard({ items, onStageChange, onCardClick }: KanbanBoardProps) {
  const [activeItem, setActiveItem] = useState<OnboardingItem | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const itemsByStage: Record<string, OnboardingItem[]> = {}
  for (const stage of ONBOARDING_STAGES) {
    itemsByStage[stage] = []
  }
  for (const item of items) {
    const bucket = itemsByStage[item.currentStage]
    if (bucket) bucket.push(item)
    else {
      itemsByStage[item.currentStage] = [item]
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const found = items.find((i) => i.id === event.active.id)
    setActiveItem(found ?? null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null)
    const { active, over } = event
    if (!over) return
    const toStage = over.id as string
    const item = items.find((i) => i.id === active.id)
    if (!item || item.currentStage === toStage) return

    if (toStage === 'ONBOARDING_DONE') {
      if (!window.confirm('Finalizar onboarding? Esta é a etapa final.')) return
    }

    await onStageChange(item.id, toStage)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          overflowY: 'auto',
          paddingBottom: 16,
          alignItems: 'flex-start',
          maxHeight: 'calc(100vh - 200px)',
        }}
      >
        {ONBOARDING_STAGES.map((stage) => (
          <DroppableColumn
            key={stage}
            stage={stage}
            items={itemsByStage[stage] ?? []}
            onCardClick={onCardClick}
          />
        ))}
      </div>

      <DragOverlay>
        {activeItem && (
          <div
            style={{
              width: 220,
              background: '#fff',
              border: `1px solid ${C.neon}`,
              borderRadius: 10,
              boxShadow: '0 12px 24px -6px rgba(15,23,42,0.18)',
              padding: '11px 13px',
              opacity: 0.98,
            }}
          >
            <CardContent item={activeItem} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
