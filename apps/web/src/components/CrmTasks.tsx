'use client'

import { useState, useEffect, useCallback, useMemo, type CSSProperties } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { LEAD_STAGE_LABELS, LEAD_STAGE_COLORS } from '@/lib/constants'
import { X, Trash2, Check } from 'lucide-react'

// Aba Tarefas do CRM. Usa a mesma tabela de /tasks (fonte única): aqui aparecem só as tarefas
// ligadas a um lead (clientId), e elas também aparecem no quadro geral de Tarefas.

const C = {
  ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0', bg: '#f8fafc',
  neon: '#C7F900', green: '#16a34a', red: '#dc2626', amber: '#f59e0b', slate: '#475569',
}
const num: CSSProperties = { fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }
const card: CSSProperties = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }
const inputStyle: CSSProperties = { width: '100%', padding: '8px 10px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: 'var(--font-sans)', fontSize: 13, color: C.ink, background: '#fff', boxSizing: 'border-box' }
const labelStyle: CSSProperties = { display: 'block', fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: C.mid, marginBottom: 4 }

const PRIORITY_LABELS: Record<string, string> = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', URGENT: 'Urgente' }
const PRIORITY_COLORS: Record<string, string> = { LOW: C.dim, MEDIUM: C.slate, HIGH: C.amber, URGENT: C.red }

export interface CrmTask {
  id: string
  title: string
  description: string | null
  stage: string
  priority: string
  assignee: string | null
  dueDate: string | null
  completedAt: string | null
  createdAt: string
  clientId: string | null
  client: { id: string; companyName: string; responsible: string; leadStage: string | null } | null
}

interface LeadOption { id: string; companyName: string; responsible: string; salesRep?: string | null }

// dueDate é gravado como meia-noite UTC do dia escolhido; comparamos pela string YYYY-MM-DD.
const dayKey = (iso: string) => iso.slice(0, 10)
const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })

type Group = 'atrasadas' | 'hoje' | 'semana' | 'depois' | 'semData'
const GROUP_LABELS: Record<Group, string> = {
  atrasadas: 'Atrasadas', hoje: 'Hoje', semana: 'Próximos 7 dias', depois: 'Mais adiante', semData: 'Sem prazo',
}
const GROUP_COLORS: Record<Group, string> = {
  atrasadas: C.red, hoje: C.amber, semana: C.slate, depois: C.dim, semData: C.dim,
}

export default function CrmTasks({ leads, assigneeSuggestions, onOpenLead }: {
  leads: LeadOption[]
  assigneeSuggestions: string[]
  onOpenLead: (leadId: string) => void
}) {
  const [tasks, setTasks] = useState<CrmTask[]>([])
  const [loading, setLoading] = useState(true)
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [editing, setEditing] = useState<CrmTask | 'new' | null>(null)

  const load = useCallback(async () => {
    try {
      setTasks(await apiFetch<CrmTask[]>('/api/tasks?crm=1'))
    } catch {
      toast.error('Erro ao carregar tarefas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const assignees = useMemo(() => {
    const s = new Set<string>(assigneeSuggestions)
    tasks.forEach(t => { if (t.assignee) s.add(t.assignee) })
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [tasks, assigneeSuggestions])

  const visible = tasks.filter(t => !assigneeFilter || t.assignee === assigneeFilter)
  const open = visible.filter(t => t.stage !== 'DONE' && t.stage !== 'WIKI')
  const done = visible
    .filter(t => t.stage === 'DONE')
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))

  const groups = useMemo(() => {
    const today = todayKey()
    const weekEnd = addDays(today, 7)
    const out: Record<Group, CrmTask[]> = { atrasadas: [], hoje: [], semana: [], depois: [], semData: [] }
    for (const t of open) {
      if (!t.dueDate) { out.semData.push(t); continue }
      const k = dayKey(t.dueDate)
      if (k < today) out.atrasadas.push(t)
      else if (k === today) out.hoje.push(t)
      else if (k <= weekEnd) out.semana.push(t)
      else out.depois.push(t)
    }
    const prio: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
    for (const g of Object.values(out)) {
      g.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || (prio[a.priority] ?? 9) - (prio[b.priority] ?? 9))
    }
    return out
  }, [open])

  async function toggleDone(t: CrmTask) {
    const stage = t.stage === 'DONE' ? 'TODO' : 'DONE'
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, stage, completedAt: stage === 'DONE' ? new Date().toISOString() : null } : x))
    try {
      await apiFetch(`/api/tasks/${t.id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage }) })
    } catch {
      toast.error('Erro ao atualizar tarefa')
      load()
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid }}>Carregando tarefas…</div>
  }

  return (
    <div>
      {/* Resumo + ações */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid }}>
          <span><b style={{ ...num, color: groups.atrasadas.length ? C.red : C.ink }}>{groups.atrasadas.length}</b> atrasadas</span>
          <span><b style={{ ...num, color: C.ink }}>{groups.hoje.length}</b> para hoje</span>
          <span><b style={{ ...num, color: C.ink }}>{open.length}</b> em aberto</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 160 }}>
            <option value="">Todos os responsáveis</option>
            {assignees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={() => setEditing('new')} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: C.ink, color: C.neon, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            + Nova tarefa
          </button>
        </div>
      </div>

      {open.length === 0 && (
        <div style={{ ...card, padding: '40px 20px', textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid }}>
          Nenhuma tarefa em aberto{assigneeFilter ? ` para ${assigneeFilter}` : ''}.
        </div>
      )}

      {(Object.keys(GROUP_LABELS) as Group[]).filter(g => groups[g].length > 0).map(g => (
        <section key={g} style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: GROUP_COLORS[g] }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700, color: C.ink, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{GROUP_LABELS[g]}</span>
            <span style={{ ...num, fontSize: 12, color: C.dim }}>{groups[g].length}</span>
          </div>
          <div style={{ ...card, overflow: 'hidden' }}>
            {groups[g].map((t, i) => (
              <TaskRow key={t.id} task={t} first={i === 0} overdue={g === 'atrasadas'}
                onToggle={() => toggleDone(t)} onEdit={() => setEditing(t)} onOpenLead={onOpenLead} />
            ))}
          </div>
        </section>
      ))}

      {done.length > 0 && (
        <section>
          <button onClick={() => setShowDone(v => !v)} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: C.mid, marginBottom: 8 }}>
            {showDone ? '▾' : '▸'} Concluídas ({done.length})
          </button>
          {showDone && (
            <div style={{ ...card, overflow: 'hidden' }}>
              {done.slice(0, 30).map((t, i) => (
                <TaskRow key={t.id} task={t} first={i === 0} overdue={false}
                  onToggle={() => toggleDone(t)} onEdit={() => setEditing(t)} onOpenLead={onOpenLead} />
              ))}
            </div>
          )}
        </section>
      )}

      {editing && (
        <TaskModal
          task={editing === 'new' ? null : editing}
          leads={leads}
          assignees={assignees}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function TaskRow({ task, first, overdue, onToggle, onEdit, onOpenLead }: {
  task: CrmTask; first: boolean; overdue: boolean
  onToggle: () => void; onEdit: () => void; onOpenLead: (id: string) => void
}) {
  const isDone = task.stage === 'DONE'
  const stage = task.client?.leadStage ?? ''
  return (
    <div onClick={onEdit} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', cursor: 'pointer',
      borderTop: first ? 'none' : `1px solid ${C.line}`,
    }}
      onMouseEnter={e => { e.currentTarget.style.background = C.bg }}
      onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
    >
      <button aria-label={isDone ? 'Reabrir tarefa' : 'Concluir tarefa'}
        onClick={e => { e.stopPropagation(); onToggle() }}
        style={{
          width: 20, height: 20, flexShrink: 0, borderRadius: 5, cursor: 'pointer', padding: 0,
          border: `1.5px solid ${isDone ? C.green : C.dim}`, background: isDone ? C.green : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
        {isDone && <Check size={13} color="#fff" strokeWidth={3} />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: isDone ? C.dim : C.ink, textDecoration: isDone ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.title}
        </div>
        {task.client && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <span onClick={e => { e.stopPropagation(); onOpenLead(task.client!.id) }}
              style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.slate, textDecoration: 'underline', textDecorationColor: C.line, textUnderlineOffset: 2, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.client.companyName}
            </span>
            {stage && LEAD_STAGE_LABELS[stage] && (
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: LEAD_STAGE_COLORS[stage] ?? C.mid, whiteSpace: 'nowrap' }}>
                · {LEAD_STAGE_LABELS[stage]}
              </span>
            )}
          </div>
        )}
      </div>

      {task.priority !== 'MEDIUM' && (
        <span style={{ background: PRIORITY_COLORS[task.priority], color: '#fff', padding: '2px 7px', borderRadius: 100, fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.02em', flexShrink: 0 }}>
          {PRIORITY_LABELS[task.priority]}
        </span>
      )}
      {task.assignee && (
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.mid, flexShrink: 0, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.assignee}</span>
      )}
      <span style={{ ...num, fontSize: 12, width: 42, textAlign: 'right', flexShrink: 0, color: overdue ? C.red : C.mid, fontWeight: overdue ? 700 : 500 }}>
        {task.dueDate ? fmtDay(task.dueDate) : ''}
      </span>
    </div>
  )
}

function TaskModal({ task, leads, assignees, onClose, onSaved }: {
  task: CrmTask | null
  leads: LeadOption[]
  assignees: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [clientId, setClientId] = useState(task?.clientId ?? '')
  const [leadQuery, setLeadQuery] = useState(task?.client?.companyName ?? '')
  const [showLeadList, setShowLeadList] = useState(false)
  const [assignee, setAssignee] = useState(task?.assignee ?? '')
  const [dueDate, setDueDate] = useState(task?.dueDate ? dayKey(task.dueDate) : todayKey())
  const [priority, setPriority] = useState(task?.priority ?? 'MEDIUM')
  const [saving, setSaving] = useState(false)

  const leadMatches = useMemo(() => {
    const q = leadQuery.trim().toLowerCase()
    const list = q
      ? leads.filter(l => l.companyName.toLowerCase().includes(q) || l.responsible.toLowerCase().includes(q))
      : leads
    return list.slice(0, 8)
  }, [leads, leadQuery])

  function pickLead(l: LeadOption) {
    setClientId(l.id)
    setLeadQuery(l.companyName)
    setShowLeadList(false)
    if (!assignee && l.salesRep) setAssignee(l.salesRep)
  }

  async function save() {
    if (!title.trim()) { toast.error('Dê um título à tarefa'); return }
    if (!clientId) { toast.error('Escolha o lead da tarefa'); return }
    setSaving(true)
    const body = {
      title: title.trim(),
      description: description.trim() || null,
      clientId,
      assignee: assignee.trim() || null,
      dueDate: dueDate || null,
      priority,
    }
    try {
      if (task) {
        await apiFetch(`/api/tasks/${task.id}`, { method: 'PUT', body: JSON.stringify(body) })
      } else {
        await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify({ ...body, tags: ['comercial'] }) })
      }
      toast.success(task ? 'Tarefa atualizada' : 'Tarefa criada')
      onSaved()
    } catch {
      toast.error('Erro ao salvar tarefa')
      setSaving(false)
    }
  }

  async function remove() {
    if (!task || !confirm('Excluir esta tarefa?')) return
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
      toast.success('Tarefa excluída')
      onSaved()
    } catch {
      toast.error('Erro ao excluir tarefa')
    }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{ ...card, width: '100%', maxWidth: 460, padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700, color: C.ink }}>{task ? 'Editar tarefa' : 'Nova tarefa'}</span>
          <button onClick={onClose} aria-label="Fechar" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.mid, padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>O que fazer</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="Ex.: Ligar para apresentar a proposta" />
          </div>

          <div style={{ position: 'relative' }}>
            <label style={labelStyle}>Lead</label>
            <input value={leadQuery}
              onChange={e => { setLeadQuery(e.target.value); setClientId(''); setShowLeadList(true) }}
              onFocus={() => setShowLeadList(true)}
              onBlur={() => setTimeout(() => setShowLeadList(false), 150)}
              style={{ ...inputStyle, borderColor: clientId ? C.line : leadQuery ? C.amber : C.line }}
              placeholder="Buscar por empresa ou responsável" />
            {showLeadList && leadMatches.length > 0 && (
              <div style={{ ...card, position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4, zIndex: 5, maxHeight: 240, overflowY: 'auto' }}>
                {leadMatches.map(l => (
                  <div key={l.id} onMouseDown={e => { e.preventDefault(); pickLead(l) }}
                    style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: `1px solid ${C.line}` }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.bg }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: C.ink }}>{l.companyName}</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.mid }}>{l.responsible}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Prazo</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Prioridade</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} style={inputStyle}>
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Responsável</label>
            <input list="crm-task-assignees" value={assignee} onChange={e => setAssignee(e.target.value)} style={inputStyle} />
            <datalist id="crm-task-assignees">{assignees.map(a => <option key={a} value={a} />)}</datalist>
          </div>

          <div>
            <label style={labelStyle}>Detalhes</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          {task && (
            <button onClick={remove} aria-label="Excluir" style={{ padding: '10px 12px', border: `1px solid ${C.line}`, borderRadius: 6, background: '#fff', color: C.red, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <Trash2 size={15} />
            </button>
          )}
          <button onClick={onClose} style={{ flex: 1, padding: '10px', border: `1px solid ${C.line}`, borderRadius: 6, background: '#fff', color: C.mid, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 6, background: C.ink, color: C.neon, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
