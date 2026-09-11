'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'

interface Task {
  id: string
  title: string
  description: string | null
  stage: string
  priority: string
  assignee: string | null
  dueDate: string | null
  tags: string | null
  order: number
  completedAt: string | null
  createdAt: string
}

const C = { ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0', bg: '#f8fafc', neon: '#C7F900', green: '#16a34a', red: '#dc2626', amber: '#f59e0b', slate: '#475569', purple: '#7c3aed' }
const num: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }

const STAGES = ['TODO', 'DOING', 'DONE', 'WIKI'] as const
const STAGE_LABELS: Record<string, string> = { TODO: 'A Fazer', DOING: 'Fazendo', DONE: 'Feito', WIKI: 'Wiki' }
const STAGE_COLORS: Record<string, string> = { TODO: C.slate, DOING: C.amber, DONE: C.green, WIKI: C.purple }
const PRIORITY_LABELS: Record<string, string> = { LOW: 'Baixa', MEDIUM: 'Media', HIGH: 'Alta', URGENT: 'Urgente' }
const PRIORITY_COLORS: Record<string, string> = { LOW: C.dim, MEDIUM: C.slate, HIGH: C.amber, URGENT: C.red }

function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  const tags: string[] = task.tags ? (() => { try { return JSON.parse(task.tags) } catch { return [] } })() : []
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.stage !== 'DONE'

  return (
    <div ref={setNodeRef} {...listeners} {...attributes} onClick={onClick} style={{
      background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10,
      boxShadow: isDragging ? '0 8px 20px rgba(15,23,42,0.12)' : '0 1px 2px rgba(15,23,42,0.05)',
      padding: '12px 14px', cursor: isDragging ? 'grabbing' : 'grab', opacity: isDragging ? 0.4 : 1,
      marginBottom: 8, transition: 'box-shadow 0.15s, border-color 0.15s',
    }}
      onMouseEnter={e => { if (!isDragging) { e.currentTarget.style.boxShadow = '0 4px 10px rgba(15,23,42,0.08)'; e.currentTarget.style.borderColor = C.dim } }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 2px rgba(15,23,42,0.05)'; e.currentTarget.style.borderColor = C.line }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: task.description ? 6 : 8 }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: C.ink, flex: 1, lineHeight: 1.35 }}>{task.title}</span>
        <span style={{ background: PRIORITY_COLORS[task.priority], color: '#fff', padding: '2px 7px', borderRadius: 100, fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-sans)', flexShrink: 0, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
          {PRIORITY_LABELS[task.priority]}
        </span>
      </div>
      {task.description && (
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.mid, marginBottom: 8, lineHeight: 1.4 }}>
          {task.description.length > 80 ? task.description.slice(0, 80) + '...' : task.description}
        </div>
      )}
      {tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {tags.map(tag => (
            <span key={tag} style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 6, padding: '2px 7px', fontSize: 10, fontFamily: 'var(--font-sans)', fontWeight: 600, color: C.slate }}>{tag}</span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        {task.assignee
          ? <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: C.slate }}>{task.assignee}</span>
          : <span />}
        {task.dueDate && (
          <span style={{ ...num, fontSize: 11, color: isOverdue ? C.red : C.mid, fontWeight: isOverdue ? 700 : 500 }}>
            {new Date(task.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
          </span>
        )}
      </div>
    </div>
  )
}

function Column({ stage, tasks, onCardClick }: { stage: string; tasks: Task[]; onCardClick: (t: Task) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const accent = STAGE_COLORS[stage]
  return (
    <div style={{
      flex: '1 1 300px', minWidth: 280, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 200px)',
      background: C.bg, border: `1px solid ${isOver ? accent : C.line}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.15s',
    }}>
      <div style={{ height: 3, background: accent }} />
      <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: C.ink }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent, flexShrink: 0 }} />
          {STAGE_LABELS[stage]}
        </span>
        <span style={{ ...num, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 100, padding: '1px 9px', fontSize: 11, fontWeight: 700, color: C.mid }}>{tasks.length}</span>
      </div>
      <div ref={setNodeRef} style={{
        flex: 1, padding: '0 10px 10px', overflowY: 'auto',
        background: isOver ? 'rgba(15,23,42,0.03)' : 'transparent', transition: 'background 0.15s',
      }}>
        {tasks.map(t => <TaskCard key={t.id} task={t} onClick={() => onCardClick(t)} />)}
        {tasks.length === 0 && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.dim, textAlign: 'center', padding: '24px 8px' }}>Sem tarefas</div>}
      </div>
    </div>
  )
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [assignees, setAssignees] = useState<string[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  // Form
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formPriority, setFormPriority] = useState('MEDIUM')
  const [formAssignee, setFormAssignee] = useState('')
  const [formDueDate, setFormDueDate] = useState('')
  const [formTags, setFormTags] = useState('')
  const [formStage, setFormStage] = useState('TODO')
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const loadTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (assigneeFilter) params.set('assignee', assigneeFilter)
      const data = await apiFetch<Task[]>(`/api/tasks?${params}`)
      setTasks(data)
    } catch { toast.error('Erro ao carregar tarefas') }
  }, [assigneeFilter])

  useEffect(() => { loadTasks() }, [loadTasks])
  useEffect(() => {
    apiFetch<string[]>('/api/tasks/assignees').then(setAssignees).catch(() => {})
    apiFetch<string[]>('/api/tasks/tags').then(setAllTags).catch(() => {})
  }, [])

  function openNew() {
    setEditTask(null)
    setFormTitle(''); setFormDesc(''); setFormPriority('MEDIUM'); setFormAssignee(''); setFormDueDate(''); setFormTags(''); setFormStage('TODO')
    setShowModal(true)
  }

  function openEdit(t: Task) {
    setEditTask(t)
    setFormTitle(t.title)
    setFormDesc(t.description ?? '')
    setFormPriority(t.priority)
    setFormAssignee(t.assignee ?? '')
    setFormDueDate(t.dueDate ? t.dueDate.split('T')[0] : '')
    setFormTags(t.tags ? (() => { try { return JSON.parse(t.tags).join(', ') } catch { return '' } })() : '')
    setFormStage(t.stage)
    setShowModal(true)
  }

  async function handleSave() {
    if (!formTitle.trim()) { toast.error('Titulo obrigatorio'); return }
    setSaving(true)
    const tags = formTags.split(',').map(t => t.trim()).filter(Boolean)
    const body = {
      title: formTitle.trim(),
      description: formDesc.trim() || undefined,
      priority: formPriority,
      assignee: formAssignee.trim() || undefined,
      dueDate: formDueDate || undefined,
      tags: tags.length > 0 ? tags : undefined,
      stage: formStage,
    }
    try {
      if (editTask) {
        await apiFetch(`/api/tasks/${editTask.id}`, { method: 'PUT', body: JSON.stringify(body) })
        toast.success('Tarefa atualizada')
      } else {
        await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify(body) })
        toast.success('Tarefa criada')
      }
      setShowModal(false)
      loadTasks()
      apiFetch<string[]>('/api/tasks/tags').then(setAllTags).catch(() => {})
      apiFetch<string[]>('/api/tasks/assignees').then(setAssignees).catch(() => {})
    } catch { toast.error('Erro ao salvar') }
    setSaving(false)
  }

  async function handleDelete() {
    if (!editTask || !confirm('Excluir esta tarefa?')) return
    try {
      await apiFetch(`/api/tasks/${editTask.id}`, { method: 'DELETE' })
      toast.success('Tarefa excluida')
      setShowModal(false)
      loadTasks()
    } catch { toast.error('Erro ao excluir') }
  }

  function handleDragStart(e: DragStartEvent) { setActiveId(e.active.id as string) }
  async function handleDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const toStage = over.id as string
    const task = tasks.find(t => t.id === active.id)
    if (task && task.stage !== toStage) {
      try {
        await apiFetch(`/api/tasks/${task.id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage: toStage }) })
        loadTasks()
        toast.success(`Movido para ${STAGE_LABELS[toStage]}`)
      } catch { toast.error('Erro ao mover') }
    }
  }

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null
  const tasksByStage: Record<string, Task[]> = { TODO: [], DOING: [], DONE: [], WIKI: [] }
  tasks.forEach(t => { if (tasksByStage[t.stage]) tasksByStage[t.stage].push(t) })

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: 'var(--font-sans)', fontSize: 13, color: C.ink }
  const labelStyle: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.mid, display: 'block', marginBottom: 5 }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Tarefas</h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid, margin: '2px 0 0' }}>Quadro de tarefas · arraste os cartões entre as colunas</p>
        </div>
        <button onClick={openNew} style={{
          padding: '9px 16px', border: 'none', borderRadius: 6, background: C.neon, color: C.ink,
          fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>+ Nova tarefa</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.mid, marginRight: 2 }}>Responsavel</span>
        <button onClick={() => setAssigneeFilter('')} style={{ padding: '5px 12px', border: `1px solid ${!assigneeFilter ? C.ink : C.line}`, borderRadius: 100, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: !assigneeFilter ? C.ink : '#fff', color: !assigneeFilter ? '#fff' : C.mid }}>Todos</button>
        {assignees.map(a => (
          <button key={a} onClick={() => setAssigneeFilter(assigneeFilter === a ? '' : a)} style={{ padding: '5px 12px', border: `1px solid ${assigneeFilter === a ? C.ink : C.line}`, borderRadius: 100, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: assigneeFilter === a ? C.ink : '#fff', color: assigneeFilter === a ? '#fff' : C.mid }}>{a}</button>
        ))}
      </div>

      {/* Kanban */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16 }}>
          {STAGES.map(stage => (
            <Column key={stage} stage={stage} tasks={tasksByStage[stage]} onCardClick={openEdit} />
          ))}
        </div>
        <DragOverlay>
          {activeTask && (
            <div style={{ width: 280, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: '0 12px 28px rgba(15,23,42,0.16)', padding: '12px 14px', opacity: 0.97 }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: C.ink }}>{activeTask.title}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget && confirm('Sair sem salvar?')) setShowModal(false) }}>
          <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 24px 48px rgba(15,23,42,0.24)', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ background: C.ink, color: '#fff', padding: '14px 20px', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', borderRadius: '12px 12px 0 0' }}>
              {editTask ? 'Editar tarefa' : 'Nova tarefa'}
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={labelStyle}>Titulo *</label>
                <input value={formTitle} onChange={e => setFormTitle(e.target.value)} style={inputStyle} placeholder="O que precisa ser feito?" />
              </div>
              <div>
                <label style={labelStyle}>Descricao</label>
                <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Detalhes da tarefa..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={labelStyle}>Prioridade</label>
                  <select value={formPriority} onChange={e => setFormPriority(e.target.value)} style={inputStyle}>
                    <option value="LOW">Baixa</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta</option>
                    <option value="URGENT">Urgente</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Etapa</label>
                  <select value={formStage} onChange={e => setFormStage(e.target.value)} style={inputStyle}>
                    <option value="TODO">A Fazer</option>
                    <option value="DOING">Fazendo</option>
                    <option value="DONE">Feito</option>
                    <option value="WIKI">Wiki</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={labelStyle}>Responsavel</label>
                  <input list="task-assignee-list" value={formAssignee} onChange={e => setFormAssignee(e.target.value)} style={inputStyle} />
                  <datalist id="task-assignee-list">
                    {assignees.map(a => <option key={a} value={a} />)}
                  </datalist>
                </div>
                <div>
                  <label style={labelStyle}>Prazo</label>
                  <input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Tags (separadas por virgula)</label>
                <input value={formTags} onChange={e => setFormTags(e.target.value)} style={inputStyle} placeholder="marketing, urgente, site..." />
                {allTags.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                    {allTags.map(tag => (
                      <button key={tag} type="button" onClick={() => {
                        const current = formTags.split(',').map(t => t.trim()).filter(Boolean)
                        if (!current.includes(tag)) setFormTags([...current, tag].join(', '))
                      }} style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 6, padding: '3px 8px', fontSize: 11, fontFamily: 'var(--font-sans)', fontWeight: 600, color: C.slate, cursor: 'pointer' }}>+{tag}</button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {editTask && (
                  <button onClick={handleDelete} style={{ padding: '10px 14px', border: 'none', borderRadius: 6, background: C.red, color: '#fff', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Excluir</button>
                )}
                <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '10px', border: `1px solid ${C.line}`, borderRadius: 6, background: '#fff', color: C.mid, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 6, background: C.ink, color: '#fff', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Salvando...' : editTask ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
