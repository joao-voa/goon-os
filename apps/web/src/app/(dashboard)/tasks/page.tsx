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

const STAGES = ['TODO', 'DOING', 'DONE', 'WIKI'] as const
const STAGE_LABELS: Record<string, string> = { TODO: 'A Fazer', DOING: 'Fazendo', DONE: 'Feito', WIKI: 'Wiki' }
const STAGE_COLORS: Record<string, string> = { TODO: '#4A78FF', DOING: '#f97316', DONE: '#006600', WIKI: '#7c3aed' }
const PRIORITY_LABELS: Record<string, string> = { LOW: 'Baixa', MEDIUM: 'Media', HIGH: 'Alta', URGENT: 'Urgente' }
const PRIORITY_COLORS: Record<string, string> = { LOW: '#888', MEDIUM: '#4A78FF', HIGH: '#f97316', URGENT: '#cc0000' }

function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  const tags: string[] = task.tags ? (() => { try { return JSON.parse(task.tags) } catch { return [] } })() : []
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.stage !== 'DONE'

  return (
    <div ref={setNodeRef} {...listeners} {...attributes} onClick={onClick} style={{
      background: 'white', border: '2px solid black', boxShadow: isDragging ? 'none' : '3px 3px 0 black',
      padding: '12px', cursor: isDragging ? 'grabbing' : 'grab', opacity: isDragging ? 0.4 : 1,
      marginBottom: 8, transition: 'transform 0.1s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, flex: 1 }}>{task.title}</span>
        <span style={{ background: PRIORITY_COLORS[task.priority], color: 'white', padding: '1px 5px', fontSize: 8, fontWeight: 700, fontFamily: 'var(--font-mono)', flexShrink: 0, marginLeft: 6 }}>
          {PRIORITY_LABELS[task.priority]}
        </span>
      </div>
      {task.description && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555', marginBottom: 6, lineHeight: 1.3 }}>
          {task.description.length > 80 ? task.description.slice(0, 80) + '...' : task.description}
        </div>
      )}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
        {tags.map(tag => (
          <span key={tag} style={{ background: '#f0f0f0', border: '1px solid #ddd', padding: '1px 6px', fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{tag}</span>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {task.assignee && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4A78FF' }}>{task.assignee}</span>}
        {task.dueDate && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: isOverdue ? '#cc0000' : '#888', fontWeight: isOverdue ? 700 : 400 }}>
            {new Date(task.dueDate).toLocaleDateString('pt-BR')}
          </span>
        )}
      </div>
    </div>
  )
}

function Column({ stage, tasks, onCardClick }: { stage: string; tasks: Task[]; onCardClick: (t: Task) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  return (
    <div style={{ flex: '1 1 300px', minWidth: 280, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 200px)' }}>
      <div style={{ background: STAGE_COLORS[stage], color: 'white', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '2px solid black', boxShadow: '4px 4px 0 black' }}>
        <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 10 }}>{STAGE_LABELS[stage]}</span>
        <span style={{ background: 'rgba(255,255,255,0.3)', padding: '2px 8px', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700 }}>{tasks.length}</span>
      </div>
      <div ref={setNodeRef} style={{
        flex: 1, padding: 8, overflowY: 'auto', border: isOver ? '2px dashed black' : '2px dashed rgba(0,0,0,0.1)',
        background: isOver ? 'rgba(0,0,0,0.03)' : 'transparent', transition: 'all 0.15s',
      }}>
        {tasks.map(t => <TaskCard key={t.id} task={t} onClick={() => onCardClick(t)} />)}
        {tasks.length === 0 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#aaa', textAlign: 'center', padding: 20 }}>Sem tarefas</div>}
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

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }
  const labelStyle: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 3 }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: 20, margin: 0 }}>TAREFAS</h1>
        <button onClick={openNew} style={{
          padding: '8px 16px', border: '2px solid black', background: '#4A78FF', color: 'white',
          fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '3px 3px 0 black',
        }}>+ NOVA TAREFA</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#666' }}>Responsavel:</span>
        <button onClick={() => setAssigneeFilter('')} style={{ padding: '4px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, cursor: 'pointer', background: !assigneeFilter ? 'black' : 'white', color: !assigneeFilter ? 'white' : 'black' }}>TODOS</button>
        {assignees.map(a => (
          <button key={a} onClick={() => setAssigneeFilter(assigneeFilter === a ? '' : a)} style={{ padding: '4px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, cursor: 'pointer', background: assigneeFilter === a ? 'black' : 'white', color: assigneeFilter === a ? 'white' : 'black' }}>{a}</button>
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
            <div style={{ width: 280, background: 'white', border: '2px solid black', boxShadow: '8px 8px 0 black', padding: 12, transform: 'rotate(2deg)', opacity: 0.95 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>{activeTask.title}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget && confirm('Sair sem salvar?')) setShowModal(false) }}>
          <div style={{ background: 'white', border: '2px solid black', boxShadow: '8px 8px 0 black', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ background: '#4A78FF', color: 'white', padding: '10px 16px', fontFamily: 'var(--font-pixel)', fontSize: 11 }}>
              {editTask ? 'EDITAR TAREFA' : 'NOVA TAREFA'}
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
                      }} style={{ background: '#f0f0f0', border: '1px solid #ddd', padding: '2px 6px', fontSize: 9, fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>+{tag}</button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {editTask && (
                  <button onClick={handleDelete} style={{ padding: '10px 14px', border: '2px solid black', background: '#cc0000', color: 'white', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>EXCLUIR</button>
                )}
                <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '10px', border: '2px solid black', background: 'white', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>CANCELAR</button>
                <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '10px', border: '2px solid black', background: '#4A78FF', color: 'white', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', boxShadow: '3px 3px 0 black' }}>
                  {saving ? 'SALVANDO...' : editTask ? 'ATUALIZAR' : 'CRIAR'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
