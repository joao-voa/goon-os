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
import { ONBOARDING_STAGES, STAGE_LABELS, STAGE_COLORS, PRODUCT_COLORS as PROD_COLORS } from '@/lib/constants'

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
        background: 'white',
        border: '2px solid black',
        boxShadow: isDragging ? 'none' : '3px 3px 0px 0px #000',
        padding: '10px 12px',
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.4 : 1,
        userSelect: 'none',
        marginBottom: 8,
        transition: 'transform 0.1s, box-shadow 0.1s',
        transform: isDragging ? 'rotate(2deg)' : 'none',
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: 'black', lineHeight: 1.3, flex: 1, textTransform: 'uppercase' }}>
          {item.client.companyName}
        </span>
        {productColor && item.productCode && (
          <span
            style={{
              background: productColor,
              color: 'white',
              border: '1px solid black',
              padding: '1px 5px',
              fontFamily: 'var(--font-pixel)',
              fontSize: 8,
              fontWeight: 700,
              marginLeft: 6,
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
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: daysWarning ? 'var(--danger)' : '#555',
          fontWeight: daysWarning ? 700 : 400,
          textTransform: 'uppercase',
        }}
      >
        {item.daysInStage === 0 ? '> hoje' : `> ${item.daysInStage}d`}
        {daysWarning && ' [!]'}
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
          background: 'black',
          border: '2px solid black',
          boxShadow: '3px 3px 0 black',
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '12px 12px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{ width: 10, height: 10, background: color, border: '1px solid white', flexShrink: 0 }}
        />
        <span
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 8,
            color: 'white',
            flex: 1,
            lineHeight: 1.4,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        <span
          style={{
            background: color,
            color: 'white',
            border: '1px solid white',
            padding: '1px 6px',
            fontFamily: 'var(--font-mono)',
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
          padding: '4px',
          border: isOver ? '2px dashed black' : '2px dashed rgba(0,0,0,0.2)',
          background: isOver ? 'rgba(0,0,0,0.05)' : 'transparent',
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
              fontFamily: 'var(--font-mono)',
              color: '#aaa',
              fontSize: 11,
              padding: '20px 0',
              textTransform: 'uppercase',
              letterSpacing: 1,
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
              width: 212,
              background: 'white',
              border: '2px solid black',
              boxShadow: '8px 8px 0px 0px #000',
              padding: '10px 12px',
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
