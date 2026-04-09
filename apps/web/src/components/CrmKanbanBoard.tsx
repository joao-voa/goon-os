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
import { LEAD_STAGE_LABELS, LEAD_STAGE_COLORS, LEAD_SOURCE_LABELS, PRODUCT_COLORS } from '@/lib/constants'

interface LeadItem {
  id: string
  companyName: string
  responsible: string
  phone: string | null
  whatsapp: string | null
  email: string | null
  leadStage: string
  leadSource: string | null
  salesRep: string | null
  saleValue: number | null
  leadNotes: string | null
  productCode: string | null
  createdAt: string
}

interface CrmKanbanBoardProps {
  items: LeadItem[]
  stages: readonly string[]
  onStageChange: (id: string, toStage: string) => Promise<void>
  onCardClick: (item: LeadItem) => void
}

function DraggableCard({ item, onClick }: { item: LeadItem; onClick: (item: LeadItem) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id })

  const sourceLabel = item.leadSource ? (LEAD_SOURCE_LABELS[item.leadSource] ?? item.leadSource) : null

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
      }}
    >
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
        {item.companyName}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555', marginBottom: 2 }}>
        {item.responsible}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
        {sourceLabel && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, background: '#e0e0e0',
            padding: '2px 6px', border: '1px solid #999',
          }}>
            {sourceLabel}
          </span>
        )}
        {item.salesRep && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, background: '#dbeafe',
            padding: '2px 6px', border: '1px solid #93c5fd',
          }}>
            {item.salesRep}
          </span>
        )}
        {item.saleValue && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, background: '#dcfce7',
            padding: '2px 6px', border: '1px solid #86efac', fontWeight: 700,
          }}>
            R$ {item.saleValue.toLocaleString('pt-BR')}
          </span>
        )}
        {item.productCode && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
            background: PRODUCT_COLORS[item.productCode] ?? '#888',
            color: 'white', padding: '2px 6px', border: '1px solid black',
          }}>
            {item.productCode}
          </span>
        )}
      </div>
    </div>
  )
}

function DroppableColumn({
  stage,
  items,
  onCardClick,
}: {
  stage: string
  items: LeadItem[]
  onCardClick: (item: LeadItem) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const color = LEAD_STAGE_COLORS[stage] ?? '#888'
  const label = LEAD_STAGE_LABELS[stage] ?? stage

  return (
    <div
      ref={setNodeRef}
      style={{
        minWidth: 260,
        maxWidth: 300,
        flex: '1 0 260px',
        background: isOver ? '#f0f7ff' : '#f5f5f5',
        border: '2px solid black',
        boxShadow: '4px 4px 0px 0px #000',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 260px)',
      }}
    >
      <div style={{
        background: color, color: 'white', padding: '8px 12px',
        fontFamily: 'var(--font-pixel)', fontSize: 9, display: 'flex',
        justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{label}</span>
        <span style={{
          background: 'rgba(255,255,255,0.3)', padding: '2px 8px',
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
        }}>
          {items.length}
        </span>
      </div>
      <div style={{ padding: 8, overflowY: 'auto', flex: 1 }}>
        {items.map(item => (
          <DraggableCard key={item.id} item={item} onClick={onCardClick} />
        ))}
        {items.length === 0 && (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, color: '#999',
            textAlign: 'center', padding: 20,
          }}>
            Nenhum lead
          </div>
        )}
      </div>
    </div>
  )
}

export default function CrmKanbanBoard({ items, stages, onStageChange, onCardClick }: CrmKanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const activeItem = activeId ? items.find(i => i.id === activeId) ?? null : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const itemId = active.id as string
    const toStage = over.id as string
    const item = items.find(i => i.id === itemId)
    if (item && item.leadStage !== toStage) {
      onStageChange(itemId, toStage)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12 }}>
        {stages.map(stage => (
          <DroppableColumn
            key={stage}
            stage={stage}
            items={items.filter(i => i.leadStage === stage)}
            onCardClick={onCardClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeItem && (
          <div style={{
            background: 'white', border: '2px solid black', boxShadow: '6px 6px 0px 0px #000',
            padding: '10px 12px', transform: 'rotate(3deg)', opacity: 0.95,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>
              {activeItem.companyName}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555' }}>
              {activeItem.responsible}
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
