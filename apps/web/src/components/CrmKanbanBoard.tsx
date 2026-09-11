'use client'

import { useState, useEffect, useRef, type CSSProperties } from 'react'
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

// Paleta do design system (tema claro + neon)
const C = { ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0', bg: '#f8fafc', neon: '#C7F900', green: '#16a34a', red: '#dc2626', amber: '#f59e0b', slate: '#475569' }
const num: CSSProperties = { fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }

// Conteúdo visual do card (compartilhado entre o sortable e o overlay)
function CardBody({ item }: { item: LeadItem }) {
  const sourceLabel = item.leadSource ? (LEAD_SOURCE_LABELS[item.leadSource] ?? item.leadSource) : null
  return (
    <>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 3, lineHeight: 1.3 }}>
        {item.companyName}
      </div>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.mid, marginBottom: 2 }}>
        {item.responsible}
      </div>
      {(item.estimatedRevenue || item.faturamentoBand !== 'NAO_INFORMADO') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
          {item.faturamentoBand && item.faturamentoBand !== 'NAO_INFORMADO' && (
            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: 9, fontWeight: 700, letterSpacing: '0.03em', padding: '1px 6px', borderRadius: 999, color: 'white',
              background: item.isICP ? C.green : C.red,
            }}>{item.isICP ? 'ICP' : 'FORA'}</span>
          )}
          {item.estimatedRevenue && (
            <span style={{ ...num, fontSize: 11, color: C.dim }}>
              {item.estimatedRevenue}
            </span>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
        {sourceLabel && (
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: C.slate, background: C.bg, padding: '2px 8px', borderRadius: 999, border: `1px solid ${C.line}` }}>
            {sourceLabel}
          </span>
        )}
        {item.saleValue && (
          <span style={{ ...num, fontSize: 10, fontWeight: 700, color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: 999, border: '1px solid #bbf7d0' }}>
            R$ {item.saleValue.toLocaleString('pt-BR')}
          </span>
        )}
        {item.productCode && (
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 700, background: PRODUCT_COLORS[item.productCode] ?? C.slate, color: 'white', padding: '2px 8px', borderRadius: 999 }}>
            {item.productCode}
          </span>
        )}
        {!item.productCode && item.suggestedProduct && (
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 700, background: 'white', color: PRODUCT_COLORS[item.suggestedProduct] ?? C.slate, padding: '2px 8px', borderRadius: 999, border: '1px dashed ' + (PRODUCT_COLORS[item.suggestedProduct] ?? C.slate) }}>
            {item.suggestedProduct} ?
          </span>
        )}
      </div>
    </>
  )
}

function SortableCard({ item, onClick }: { item: LeadItem; onClick: (item: LeadItem) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const [hover, setHover] = useState(false)
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onClick(item)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? 'box-shadow 0.15s ease, border-color 0.15s ease',
        touchAction: 'none',
        background: '#fff',
        border: `1px solid ${hover && !isDragging ? '#cbd5e1' : C.line}`,
        borderRadius: 10,
        boxShadow: isDragging ? 'none' : (hover ? '0 4px 10px rgba(15,23,42,0.08)' : '0 1px 2px rgba(0,0,0,0.05)'),
        padding: '11px 13px',
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
  const color = LEAD_STAGE_COLORS[stage] ?? C.slate
  const label = LEAD_STAGE_LABELS[stage] ?? stage

  return (
    <div
      style={{
        minWidth: 260,
        maxWidth: 300,
        flex: '1 0 260px',
        background: isOver ? 'rgba(199,249,0,0.06)' : C.bg,
        border: `1px solid ${isOver ? C.neon : C.line}`,
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 260px)',
        overflow: 'hidden',
        transition: 'background 0.15s ease, border-color 0.15s ease',
      }}
    >
      {/* barra fina colorida do estágio */}
      <div style={{ height: 3, background: color }} />
      <div style={{
        padding: '10px 12px', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center',
        borderBottom: `1px solid ${C.line}`,
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: C.ink }}>{label}</span>
        <span style={{ ...num, background: '#fff', border: `1px solid ${C.line}`, color: C.mid, padding: '1px 9px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
          {items.length}
        </span>
      </div>
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} style={{ padding: 8, overflowY: 'auto', flex: 1, minHeight: 60 }}>
          {items.map(item => (
            <SortableCard key={item.id} item={item} onClick={onCardClick} />
          ))}
          {items.length === 0 && (
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.dim, textAlign: 'center', padding: 20 }}>
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
            background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: '0 12px 24px -6px rgba(15,23,42,0.22)',
            padding: '11px 13px', transform: 'rotate(2deg)', cursor: 'grabbing',
          }}>
            <CardBody item={activeItem} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
