'use client'

import { useState } from 'react'
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
import { ONBOARDING_STAGES, STAGE_LABELS, STAGE_COLORS, PRODUCT_COLORS } from '@/lib/constants'

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
        background: 'var(--goon-card-bg)',
        border: '1px solid var(--goon-border)',
        borderRadius: 6,
        padding: 10,
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.35 : 1,
        userSelect: 'none',
        marginBottom: 8,
      }}
    >
      <CardContent item={item} />
    </div>
  )
}

// ---- Card Content (shared between draggable and overlay) ----
function CardContent({ item }: { item: OnboardingItem }) {
  const productColor = item.productCode ? (PRODUCT_COLORS[item.productCode] ?? '#888') : null
  const daysWarning = item.daysInStage > 14

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--goon-text-primary)', lineHeight: 1.3, flex: 1 }}>
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
              marginLeft: 6,
              flexShrink: 0,
            }}
          >
            {item.productCode}
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: 'var(--goon-text-secondary)', marginBottom: 4 }}>
        {item.client.responsible}
      </div>
      <div
        style={{
          fontSize: 11,
          color: daysWarning ? '#f59e0b' : 'var(--goon-text-muted)',
          fontWeight: daysWarning ? 600 : 400,
        }}
      >
        {item.daysInStage === 0 ? 'hoje' : `${item.daysInStage}d nesta etapa`}
        {daysWarning && ' ⚠'}
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
        width: 220,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Column header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          marginBottom: 8,
          background: 'var(--goon-card-bg)',
          border: '1px solid var(--goon-border)',
          borderRadius: 8,
        }}
      >
        <div
          style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--goon-text-primary)',
            flex: 1,
            lineHeight: 1.3,
          }}
        >
          {label}
        </span>
        <span
          style={{
            background: color + '22',
            color: color,
            border: `1px solid ${color}44`,
            borderRadius: 10,
            padding: '1px 7px',
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
          padding: '4px 4px',
          borderRadius: 8,
          border: isOver ? '2px dashed ' + color : '2px dashed transparent',
          background: isOver ? color + '0D' : 'transparent',
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
              color: 'var(--goon-text-muted)',
              fontSize: 12,
              padding: '20px 0',
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
          paddingBottom: 16,
          alignItems: 'flex-start',
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
              width: 212,
              background: 'var(--goon-card-bg)',
              border: '1px solid var(--goon-border)',
              borderRadius: 6,
              padding: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              transform: 'rotate(2deg)',
              opacity: 0.95,
            }}
          >
            <CardContent item={activeItem} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
