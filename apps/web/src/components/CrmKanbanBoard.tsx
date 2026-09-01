'use client'

import { useState, useEffect, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
  estimatedRevenue: string | null
  faturamentoBand: string | null
  isICP: boolean
  segment: string | null
  suggestedProduct: string | null
  cardResponsible: string | null
  productCode: string | null
  createdAt: string
}

interface CrmKanbanBoardProps {
  items: LeadItem[]
  stages: readonly string[]
  onStageChange: (id: string, toStage: string) => Promise<void>
  onReorder: (id: string, toStage: string, orderedIds: string[]) => Promise<void> | void
  onCardClick: (item: LeadItem) => void
}

// Conteúdo visual do card (compartilhado entre o sortable e o overlay)
function CardBody({ item }: { item: LeadItem }) {
  const sourceLabel = item.leadSource ? (LEAD_SOURCE_LABELS[item.leadSource] ?? item.leadSource) : null
  return (
    <>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
        {item.companyName}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555', marginBottom: 2 }}>
        {item.responsible}
      </div>
      {(item.estimatedRevenue || item.faturamentoBand !== 'NAO_INFORMADO') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2, flexWrap: 'wrap' }}>
          {item.faturamentoBand && item.faturamentoBand !== 'NAO_INFORMADO' && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, padding: '1px 5px', color: 'white',
              background: item.isICP ? '#22c55e' : '#cc0000',
            }}>{item.isICP ? 'ICP' : 'FORA'}</span>
          )}
          {item.estimatedRevenue && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#888' }}>
              {item.estimatedRevenue}
            </span>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
        {sourceLabel && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: '#e0e0e0', padding: '2px 6px', border: '1px solid #999' }}>
            {sourceLabel}
          </span>
        )}
        {item.saleValue && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: '#dcfce7', padding: '2px 6px', border: '1px solid #86efac', fontWeight: 700 }}>
            R$ {item.saleValue.toLocaleString('pt-BR')}
          </span>
        )}
        {item.productCode && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, background: PRODUCT_COLORS[item.productCode] ?? '#888', color: 'white', padding: '2px 6px', border: '1px solid #e2e8f0' }}>
            {item.productCode}
          </span>
        )}
        {!item.productCode && item.suggestedProduct && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, background: 'white', color: PRODUCT_COLORS[item.suggestedProduct] ?? '#888', padding: '2px 6px', border: '1px dashed ' + (PRODUCT_COLORS[item.suggestedProduct] ?? '#888') }}>
            {item.suggestedProduct} ?
          </span>
        )}
      </div>
    </>
  )
}

function SortableCard({ item, onClick }: { item: LeadItem; onClick: (item: LeadItem) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onClick(item)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: 'none',
        background: 'white',
        border: '1px solid #e2e8f0',
        boxShadow: isDragging ? 'none' : '0 2px 4px rgba(0,0,0,0.05)',
        padding: '10px 12px',
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.4 : 1,
        userSelect: 'none',
        marginBottom: 8,
      }}
    >
      <CardBody item={item} />
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
      style={{
        minWidth: 260,
        maxWidth: 300,
        flex: '1 0 260px',
        background: isOver ? '#f0f7ff' : '#f5f5f5',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 260px)',
      }}
    >
      <div style={{
        background: color, color: 'white', padding: '8px 12px',
        fontFamily: 'var(--font-sans)', fontSize: 9, display: 'flex',
        justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{label}</span>
        <span style={{ background: 'rgba(255,255,255,0.3)', padding: '2px 8px', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700 }}>
          {items.length}
        </span>
      </div>
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} style={{ padding: 8, overflowY: 'auto', flex: 1, minHeight: 60 }}>
          {items.map(item => (
            <SortableCard key={item.id} item={item} onClick={onCardClick} />
          ))}
          {items.length === 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#999', textAlign: 'center', padding: 20 }}>
              Nenhum lead
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

export default function CrmKanbanBoard({ items, stages, onStageChange, onReorder, onCardClick }: CrmKanbanBoardProps) {
  const [cols, setCols] = useState<Record<string, LeadItem[]>>({})
  const colsRef = useRef<Record<string, LeadItem[]>>({})
  const [activeId, setActiveId] = useState<string | null>(null)

  // Sincroniza colunas a partir das props (já vêm ordenadas por kanbanOrder)
  useEffect(() => {
    const grouped: Record<string, LeadItem[]> = {}
    stages.forEach(s => { grouped[s] = [] })
    items.forEach(it => { (grouped[it.leadStage] ??= []).push(it) })
    setCols(grouped)
    colsRef.current = grouped
  }, [items, stages])

  const setColsSynced = (next: Record<string, LeadItem[]>) => {
    colsRef.current = next
    setCols(next)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
  )

  const findContainer = (id: string): string | undefined => {
    if (id in colsRef.current) return id // soltou sobre a coluna (vazia)
    return Object.keys(colsRef.current).find(s => colsRef.current[s].some(i => i.id === id))
  }

  const activeItem = activeId
    ? Object.values(colsRef.current).flat().find(i => i.id === activeId) ?? null
    : null

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string)
  }

  // Move o card entre colunas em tempo real (preview fluido)
  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over) return
    const from = findContainer(active.id as string)
    const to = findContainer(over.id as string)
    if (!from || !to || from === to) return
    const cur = colsRef.current
    const fromItems = cur[from]
    const toItems = cur[to]
    const moved = fromItems.find(i => i.id === active.id)
    if (!moved) return
    let overIdx = toItems.findIndex(i => i.id === over.id)
    if (overIdx === -1) overIdx = toItems.length
    setColsSynced({
      ...cur,
      [from]: fromItems.filter(i => i.id !== active.id),
      [to]: [...toItems.slice(0, overIdx), { ...moved, leadStage: to }, ...toItems.slice(overIdx)],
    })
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveId(null)
    if (!over) return
    const finalStage = findContainer(active.id as string)
    if (!finalStage) return
    const cur = colsRef.current
    const arr = cur[finalStage]
    const oldIdx = arr.findIndex(i => i.id === active.id)
    const newIdx = arr.findIndex(i => i.id === over.id)
    const reordered = oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx ? arrayMove(arr, oldIdx, newIdx) : arr
    setColsSynced({ ...cur, [finalStage]: reordered })

    const original = items.find(i => i.id === active.id)
    // Ir pra "Ganho" abre o fluxo de fechamento (não persiste ordem aqui)
    if (finalStage === 'FECHADO' && original && original.leadStage !== 'FECHADO') {
      onStageChange(active.id as string, 'FECHADO')
      return
    }
    onReorder(active.id as string, finalStage, reordered.map(i => i.id))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12 }}>
        {stages.map(stage => (
          <DroppableColumn
            key={stage}
            stage={stage}
            items={cols[stage] ?? []}
            onCardClick={onCardClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeItem && (
          <div style={{
            background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.15)',
            padding: '10px 12px', transform: 'rotate(2deg)', cursor: 'grabbing',
          }}>
            <CardBody item={activeItem} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
