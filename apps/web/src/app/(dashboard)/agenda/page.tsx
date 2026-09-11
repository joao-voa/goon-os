'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'

interface Meeting {
  id: string
  clientId: string
  title: string
  type: string
  category?: string
  date: string
  duration: number
  mentorName: string | null
  notes: string | null
  status: string
  client: { id: string; companyName: string }
}

interface Client {
  id: string
  companyName: string
}

const TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: 'Mentoria Individual',
  GRUPO: 'Mentoria em Grupo',
  CS: 'CS (Customer Success)',
  DIAGNOSTICO: 'Diagnostico',
  PLANO_VOO: 'Plano de Voo',
  KICKOFF: 'Kickoff',
  FOLLOW_UP: 'Follow Up',
  RG: 'Ritual de Gestao',
  COMERCIAL: 'Reuniao Comercial',
  ALINHAMENTO: 'Alinhamento Interno',
  OUTRO: 'Outro',
}
const TYPE_COLORS: Record<string, string> = {
  INDIVIDUAL: '#4A78FF',
  GRUPO: '#7c3aed',
  CS: '#0d9488',
  DIAGNOSTICO: '#059669',
  PLANO_VOO: '#d97706',
  KICKOFF: '#dc2626',
  FOLLOW_UP: '#06b6d4',
  RG: '#000080',
  COMERCIAL: '#22c55e',
  ALINHAMENTO: '#475569',
  OUTRO: '#888',
}
const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Agendada',
  DONE: 'Realizada',
  CANCELLED: 'Cancelada',
  RESCHEDULED: 'Reagendada',
  NO_SHOW: 'No-Show',
}

const C = {
  ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0', bg: '#f8fafc',
  neon: '#C7F900', green: '#16a34a', red: '#dc2626', amber: '#f59e0b', slate: '#475569',
}
const num: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }
const cardStyle: React.CSSProperties = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export default function AgendaPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [leadClients, setLeadClients] = useState<Client[]>([])
  const [clientSource, setClientSource] = useState<'active' | 'lead'>('active')
  const [showModal, setShowModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)
  const [mentorFilter, setMentorFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  // Form state
  const [formClientId, setFormClientId] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formType, setFormType] = useState('INDIVIDUAL')
  const [formProgram, setFormProgram] = useState('')
  const [formGroupDone, setFormGroupDone] = useState(false)
  const [formDate, setFormDate] = useState('')
  const [formTime, setFormTime] = useState('10:00')
  const [formDuration, setFormDuration] = useState('60')
  const [formMentor, setFormMentor] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [cadenceData, setCadenceData] = useState<Array<{ clientId: string; companyName: string; programCode: string | null; programName: string | null; lastMeetingDate: string | null; nextMeetingDate: string | null; daysSinceLastMeeting: number | null; doneMeetingsCount: number; overdueCount: number; overdueValue: number; planExpired: boolean; reasons: string[]; health: string }>>([])
  const [stats, setStats] = useState<{ todayCount: number; weekCount: number; totalDone: number; totalScheduled: number } | null>(null)
  const [viewMode, setViewMode] = useState<'calendario' | 'painel'>('calendario')
  const [refreshing, setRefreshing] = useState(false)
  const [fltInadimplente, setFltInadimplente] = useState(true)
  const [fltVencido, setFltVencido] = useState(true)
  const [fltSemReuniao, setFltSemReuniao] = useState(true)
  const [fltEmDia, setFltEmDia] = useState(true)
  const [programFilter, setProgramFilter] = useState('')

  const loadMeetings = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set('month', String(month + 1))
      params.set('year', String(year))
      if (mentorFilter) params.set('mentorName', mentorFilter)
      const data = await apiFetch<Meeting[]>(`/api/meetings?${params}`)
      setMeetings(data)
    } catch { toast.error('Erro ao carregar agenda') }
  }, [month, year, mentorFilter])

  useEffect(() => { loadMeetings() }, [loadMeetings])
  const loadPanel = useCallback(async () => {
    try {
      const [cad, st] = await Promise.all([
        apiFetch<typeof cadenceData>('/api/meetings/cadence'),
        apiFetch<typeof stats>('/api/meetings/stats'),
      ])
      setCadenceData(cad)
      setStats(st)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    // Ativos (mentoria) e leads do CRM em listas separadas
    apiFetch<{ data: Client[] }>('/api/clients?status=ACTIVE&limit=500')
      .then(res => setClients(res.data || []))
      .catch(() => {})
    apiFetch<{ data: Client[] }>('/api/clients?status=PROSPECT&limit=500')
      .then(res => setLeadClients(res.data || []))
      .catch(() => {})
    loadPanel()
  }, [loadPanel])

  async function handleRefresh() {
    setRefreshing(true)
    await Promise.all([loadPanel(), loadMeetings()])
    setRefreshing(false)
    toast.success('Painel atualizado')
  }

  const mentors = [...new Set(meetings.map(m => m.mentorName).filter(Boolean))] as string[]

  function openNewMeeting(dateStr: string) {
    setSelectedMeeting(null)
    setFormClientId('')
    setClientSource('active')
    setFormTitle('')
    setFormType('INDIVIDUAL')
    setFormProgram('')
    setFormGroupDone(false)
    setFormDate(dateStr)
    setFormTime('10:00')
    setFormDuration('60')
    setFormMentor('')
    setFormNotes('')
    setShowModal(true)
  }

  function openEditMeeting(m: Meeting) {
    setSelectedMeeting(m)
    setFormClientId(m.clientId)
    setClientSource(leadClients.some(c => c.id === m.clientId) ? 'lead' : 'active')
    setFormTitle(m.title)
    setFormType(m.type)
    const d = new Date(m.date)
    setFormDate(d.toISOString().split('T')[0])
    setFormTime(d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    setFormDuration(String(m.duration))
    setFormMentor(m.mentorName ?? '')
    setFormNotes(m.notes ?? '')
    setShowModal(true)
  }

  async function handleSave() {
    const isGroup = formType === 'GRUPO' && !selectedMeeting
    const needsClient = !['RG', 'ALINHAMENTO'].includes(formType) && !isGroup
    if (isGroup && !formProgram) {
      toast.error('Selecione o programa do grupo')
      return
    }
    if (needsClient && !formClientId) {
      toast.error('Preencha o cliente')
      return
    }
    if (!formTitle || !formDate) {
      toast.error('Preencha titulo e data')
      return
    }
    setSaving(true)
    try {
      const dateTime = new Date(`${formDate}T${formTime}:00`)
      const body = {
        clientId: formClientId || undefined,
        title: formTitle,
        type: formType,
        date: dateTime.toISOString(),
        duration: parseInt(formDuration, 10) || 60,
        mentorName: formMentor || undefined,
        notes: formNotes || undefined,
      }

      if (isGroup) {
        const res = await apiFetch<{ created: number }>('/api/meetings/group', {
          method: 'POST',
          body: JSON.stringify({
            program: formProgram,
            title: formTitle,
            date: dateTime.toISOString(),
            duration: parseInt(formDuration, 10) || 60,
            mentorName: formMentor || undefined,
            notes: formNotes || undefined,
            status: formGroupDone ? 'DONE' : 'SCHEDULED',
          }),
        })
        toast.success(`Mentoria em grupo ${formGroupDone ? 'registrada (realizada)' : 'agendada'} para ${res.created} clientes`)
      } else if (selectedMeeting) {
        await apiFetch(`/api/meetings/${selectedMeeting.id}`, { method: 'PUT', body: JSON.stringify(body) })
        toast.success('Reuniao atualizada')
      } else {
        await apiFetch('/api/meetings', { method: 'POST', body: JSON.stringify(body) })
        toast.success('Reuniao criada')
      }
      setShowModal(false)
      loadMeetings()
    } catch { toast.error('Erro ao salvar') }
    setSaving(false)
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      await apiFetch(`/api/meetings/${id}`, { method: 'PUT', body: JSON.stringify({ status }) })
      toast.success(STATUS_LABELS[status] ?? status)
      loadMeetings()
    } catch { toast.error('Erro') }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta reuniao?')) return
    try {
      await apiFetch(`/api/meetings/${id}`, { method: 'DELETE' })
      toast.success('Reuniao excluida')
      loadMeetings()
      setSelectedDate(null)
    } catch { toast.error('Erro') }
  }

  // Calendar data
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)
  const monthName = new Date(year, month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  // Roster completo do painel: atenção no topo, "em dia" abaixo (rolando)
  const catOf = (d: typeof cadenceData[number]) =>
    d.health === 'green' ? 'OK'
      : d.reasons.includes('FINANCEIRO') ? 'FIN'
        : d.reasons.includes('VENCIDO') ? 'VEN' : 'SEM'
  const healthRank = (h: string) => (h === 'red' ? 0 : h === 'yellow' ? 1 : 2)
  const roster = cadenceData
    .filter(d => !programFilter || d.programCode === programFilter)
    .filter(d => {
      const c = catOf(d)
      return (c === 'FIN' && fltInadimplente) || (c === 'VEN' && fltVencido) || (c === 'SEM' && fltSemReuniao) || (c === 'OK' && fltEmDia)
    })
    .sort((a, b) => (healthRank(a.health) - healthRank(b.health)) || (b.overdueValue - a.overdueValue) || ((b.daysSinceLastMeeting ?? -1) - (a.daysSinceLastMeeting ?? -1)))

  const filteredMeetings = categoryFilter ? meetings.filter(m => m.category === categoryFilter) : meetings
  const meetingsByDay: Record<number, Meeting[]> = {}
  filteredMeetings.forEach(m => {
    const d = new Date(m.date)
    if (d.getMonth() === month && d.getFullYear() === year) {
      const day = d.getDate()
      if (!meetingsByDay[day]) meetingsByDay[day] = []
      meetingsByDay[day].push(m)
    }
  })

  const todayDay = now.getMonth() === month && now.getFullYear() === year ? now.getDate() : -1

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: 'var(--font-sans)', fontSize: 13, color: C.ink, background: '#fff' }
  const labelStyle: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: C.mid, textTransform: 'uppercase' as const, letterSpacing: '0.04em', display: 'block', marginBottom: 5 }

  // Pill de filtro (categoria / mentor)
  const pill = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', border: `1px solid ${active ? C.ink : C.line}`, borderRadius: 100,
    background: active ? C.ink : '#fff', color: active ? '#fff' : C.mid,
    fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: C.ink }}>Agenda</h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid, margin: '4px 0 0' }}>Reunioes, cadencia de mentoria e saude dos clientes</p>
        </div>
        <button onClick={() => openNewMeeting(new Date().toISOString().split('T')[0])} style={{
          padding: '9px 16px', border: 'none', borderRadius: 6, background: C.neon, color: C.ink,
          fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>+ Nova reuniao</button>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.line}` }}>
        {(['painel', 'calendario'] as const).map(v => (
          <button key={v} onClick={() => setViewMode(v)} style={{
            padding: '8px 4px', marginRight: 20, background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: viewMode === v ? 700 : 500,
            color: viewMode === v ? C.ink : C.dim,
            borderBottom: viewMode === v ? `2px solid ${C.neon}` : '2px solid transparent', marginBottom: -1,
          }}>{v === 'painel' ? 'Painel' : 'Calendario'}</button>
        ))}
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.mid, marginRight: 2 }}>Categoria</span>
        {['', 'MENTORIA', 'COMERCIAL', 'GESTAO'].map(cat => (
          <button key={cat} onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)} style={pill(categoryFilter === cat)}>{cat ? cat.charAt(0) + cat.slice(1).toLowerCase() : 'Todas'}</button>
        ))}
      </div>

      {/* Mentor filter */}
      {mentors.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.mid, marginRight: 2 }}>Mentor</span>
          <button onClick={() => setMentorFilter('')} style={pill(!mentorFilter)}>Todos</button>
          {mentors.map(m => (
            <button key={m} onClick={() => setMentorFilter(mentorFilter === m ? '' : m)} style={pill(mentorFilter === m)}>{m}</button>
          ))}
        </div>
      )}

      {/* ---- PAINEL VIEW ---- */}
      {viewMode === 'painel' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
            <div style={{ ...cardStyle, padding: '14px 16px', borderTop: `3px solid ${C.neon}` }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, color: C.mid }}>Hoje</div>
              <div style={{ ...num, fontSize: 24, fontWeight: 700, color: C.ink, marginTop: 4 }}>{stats?.todayCount ?? 0}</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.dim, marginTop: 2 }}>reunioes</div>
            </div>
            <div style={{ ...cardStyle, padding: '14px 16px' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, color: C.mid }}>Esta semana</div>
              <div style={{ ...num, fontSize: 24, fontWeight: 700, color: C.ink, marginTop: 4 }}>{stats?.weekCount ?? 0}</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.dim, marginTop: 2 }}>agendadas</div>
            </div>
            <div style={{ ...cardStyle, padding: '14px 16px' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, color: C.mid }}>Realizadas</div>
              <div style={{ ...num, fontSize: 24, fontWeight: 700, color: C.green, marginTop: 4 }}>{stats?.totalDone ?? 0}</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.dim, marginTop: 2 }}>total</div>
            </div>
            <div style={{ ...cardStyle, padding: '14px 16px', borderTop: cadenceData.filter(d => d.health === 'red').length > 0 ? `3px solid ${C.red}` : `1px solid ${C.line}` }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, color: C.mid }}>Saude critica</div>
              <div style={{ ...num, fontSize: 24, fontWeight: 700, color: C.red, marginTop: 4 }}>{cadenceData.filter(d => d.health === 'red').length}</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.dim, marginTop: 2 }}>clientes</div>
            </div>
          </div>

          {/* Filtros do painel de atencao + refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 2 }}>Filtrar</span>
            {([
              ['Inadimplente', fltInadimplente, setFltInadimplente, C.red] as const,
              ['Vencido', fltVencido, setFltVencido, '#b45309'] as const,
              ['Sem reuniao', fltSemReuniao, setFltSemReuniao, C.amber] as const,
              ['Em dia', fltEmDia, setFltEmDia, C.green] as const,
            ]).map(([label, val, set, color]) => (
              <button key={label} onClick={() => set(v => !v)} style={{
                padding: '5px 12px', border: `1px solid ${val ? color : C.line}`, borderRadius: 100,
                background: val ? color : '#fff', color: val ? '#fff' : C.dim,
                fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>{val ? '✓ ' : ''}{label}</button>
            ))}
            <select value={programFilter} onChange={e => setProgramFilter(e.target.value)} style={{
              padding: '6px 10px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, color: C.ink, cursor: 'pointer', background: '#fff',
            }}>
              <option value="">Todos os programas</option>
              {[...new Set(cadenceData.map(d => d.programCode).filter(Boolean))].sort().map(p => (
                <option key={p} value={p as string}>{p}</option>
              ))}
            </select>
            <button onClick={handleRefresh} disabled={refreshing} title="Atualizar o painel (apos dar baixa em pagamento)" style={{
              marginLeft: 'auto', padding: '7px 14px', border: 'none', borderRadius: 6,
              background: C.ink, color: '#fff', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600,
              cursor: refreshing ? 'wait' : 'pointer',
            }}>{refreshing ? '↻ Atualizando…' : '↻ Sync'}</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {/* Proximas reunioes */}
            <div style={{ ...cardStyle, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: C.ink }}>Proximas reunioes</div>
              <div style={{ padding: '4px 18px 12px', maxHeight: 300, overflowY: 'auto' }}>
                {meetings.filter(m => m.status === 'SCHEDULED' && new Date(m.date) >= new Date()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 10).map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: `1px solid ${C.bg}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ background: TYPE_COLORS[m.type] ?? '#888', color: '#fff', padding: '2px 7px', fontSize: 10, fontWeight: 700, borderRadius: 100, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>{TYPE_LABELS[m.type]?.split(' ')[0] ?? m.type}</span>
                      <strong style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.client?.companyName ?? m.title}</strong>
                    </div>
                    <span style={{ ...num, color: C.mid, fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(m.date).toLocaleDateString('pt-BR')} {new Date(m.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
                {meetings.filter(m => m.status === 'SCHEDULED' && new Date(m.date) >= new Date()).length === 0 && (
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.dim, textAlign: 'center', padding: '20px 0' }}>Nenhuma reuniao agendada</div>
                )}
              </div>
            </div>

            {/* Clientes que precisam de atencao */}
            <div style={{ ...cardStyle, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: C.ink }}>Clientes · atencao no topo <span style={{ color: C.dim, fontWeight: 400, fontSize: 12 }}>({roster.length})</span></div>
              <div style={{ padding: '4px 18px 12px', maxHeight: 420, overflowY: 'auto' }}>
                {roster.map(d => {
                  const next = d.nextMeetingDate ? new Date(d.nextMeetingDate) : null
                  const isGreen = d.health === 'green'
                  const tag = (bg: string, label: string) => (
                    <span key={label} style={{ background: bg, color: '#fff', padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 100, whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)' }}>{label}</span>
                  )
                  return (
                    <div key={d.clientId} style={{ padding: '11px 0', borderTop: `1px solid ${C.bg}`, opacity: isGreen ? 0.72 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isGreen ? 3 : 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.health === 'red' ? C.red : d.health === 'yellow' ? C.amber : C.green, flexShrink: 0 }} />
                        <strong style={{ flex: 1, fontFamily: 'var(--font-sans)', fontSize: 13, color: C.ink }}>{d.companyName}</strong>
                        {d.programCode && <span style={{ background: C.ink, color: '#fff', padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 100, fontFamily: 'var(--font-sans)' }}>{d.programCode}</span>}
                      </div>
                      {!isGreen && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6, paddingLeft: 16 }}>
                          {d.overdueCount > 0 && tag(C.red, `Financeiro atrasado · R$${d.overdueValue.toLocaleString('pt-BR')}`)}
                          {d.planExpired && tag('#b45309', 'Contrato vencido')}
                          {d.reasons.includes('SEM_REUNIAO') && tag(C.amber, d.daysSinceLastMeeting !== null ? `${d.daysSinceLastMeeting}d sem reuniao` : 'Nunca reuniu')}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 16, fontFamily: 'var(--font-sans)', fontSize: 11, color: C.dim }}>
                        <span>{isGreen ? <span style={{ color: C.green, fontWeight: 700 }}>Em dia</span> : null} {d.doneMeetingsCount} {d.doneMeetingsCount === 1 ? 'reuniao' : 'reunioes'}{d.daysSinceLastMeeting !== null ? ` · ultima ha ${d.daysSinceLastMeeting}d` : ''}</span>
                        {next
                          ? <span style={{ color: C.green, fontWeight: 700 }}>✓ proxima {next.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                          : !isGreen ? <span style={{ color: C.red, fontWeight: 700 }}>sem reuniao marcada</span> : <span>—</span>}
                      </div>
                    </div>
                  )
                })}
                {roster.length === 0 && (
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.dim, textAlign: 'center', padding: '20px 0' }}>Nenhum cliente nesse filtro.</div>
                )}
              </div>
            </div>
          </div>

          {/* Reunioes recentes */}
          <div style={{ ...cardStyle, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: C.green }}>Ultimas reunioes realizadas</div>
            <div style={{ padding: '4px 18px 12px' }}>
              {meetings.filter(m => m.status === 'DONE').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8).map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: `1px solid ${C.bg}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ background: TYPE_COLORS[m.type] ?? '#888', color: '#fff', padding: '2px 7px', fontSize: 10, fontWeight: 700, borderRadius: 100, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>{TYPE_LABELS[m.type]?.split(' ')[0] ?? m.type}</span>
                    <strong style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.client?.companyName ?? m.title}</strong>
                    {m.mentorName && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.dim, whiteSpace: 'nowrap' }}>• {m.mentorName}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {m.clientId && <a href={`/clients/${m.clientId}#trackrecord`} title="Trackrecord da mentoria" style={{ background: C.ink, color: '#fff', padding: '3px 9px', fontSize: 11, fontWeight: 600, textDecoration: 'none', borderRadius: 6, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>+ Sessao</a>}
                    <span style={{ ...num, color: C.mid, fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(m.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                  </div>
                </div>
              ))}
              {meetings.filter(m => m.status === 'DONE').length === 0 && (
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.dim, textAlign: 'center', padding: '20px 0' }}>Nenhuma reuniao realizada ainda</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---- CALENDARIO VIEW ---- */}
      {viewMode === 'calendario' && <>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${C.line}`, borderRadius: 100, padding: 4 }}>
          <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }} style={{
            border: 'none', background: 'transparent', color: C.mid, padding: '2px 10px', fontSize: 16, cursor: 'pointer',
          }}>‹</button>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700, color: C.ink, textTransform: 'capitalize', minWidth: 180, textAlign: 'center' }}>{monthName}</span>
          <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }} style={{
            border: 'none', background: 'transparent', color: C.mid, padding: '2px 10px', fontSize: 16, cursor: 'pointer',
          }}>›</button>
        </div>
      </div>

      {/* Calendar grid */}
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        {/* Weekday headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: C.bg, borderBottom: `1px solid ${C.line}` }}>
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(d => (
            <div key={d} style={{ padding: '9px 4px', textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.mid }}>{d}</div>
          ))}
        </div>

        {/* Days */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {Array.from({ length: firstDay }, (_, i) => (
            <div key={'e' + i} style={{ minHeight: 84, borderRight: `1px solid ${C.bg}`, borderBottom: `1px solid ${C.bg}`, background: C.bg }} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1
            const isToday = day === todayDay
            const dayMeetings = meetingsByDay[day] ?? []
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

            return (
              <div
                key={day}
                onClick={() => { setSelectedDate(selectedDate === dateStr ? null : dateStr) }}
                style={{
                  minHeight: 84, padding: 5, borderRight: `1px solid ${C.bg}`, borderBottom: `1px solid ${C.bg}`,
                  cursor: 'pointer', background: isToday ? 'rgba(199,249,0,0.10)' : selectedDate === dateStr ? C.bg : '#fff',
                }}
              >
                <div style={{
                  ...num, fontSize: 12, fontWeight: isToday ? 800 : 500,
                  color: isToday ? C.ink : C.mid, marginBottom: 4,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span>{day}</span>
                  {dayMeetings.length > 0 && (
                    <span style={{ background: C.ink, color: '#fff', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
                      {dayMeetings.length}
                    </span>
                  )}
                </div>
                {dayMeetings.slice(0, 3).map(m => (
                  <div key={m.id} onClick={e => { e.stopPropagation(); openEditMeeting(m) }} style={{
                    fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, padding: '2px 5px', marginBottom: 2,
                    background: TYPE_COLORS[m.type] ?? '#888', color: '#fff', borderRadius: 4,
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    opacity: m.status === 'CANCELLED' || m.status === 'NO_SHOW' ? 0.5 : 1,
                    textDecoration: m.status === 'CANCELLED' ? 'line-through' : 'none',
                  }}>
                    {new Date(m.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} {m.client?.companyName ?? m.title}
                  </div>
                ))}
                {dayMeetings.length > 3 && (
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: C.dim }}>+{dayMeetings.length - 3} mais</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Day detail panel */}
      {selectedDate && (
        <div style={{ ...cardStyle, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: C.ink, textTransform: 'capitalize' }}>
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <button onClick={() => openNewMeeting(selectedDate)} style={{
              padding: '6px 12px', border: 'none', borderRadius: 6, background: C.neon, color: C.ink,
              fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>+ Agendar</button>
          </div>
          <div style={{ padding: '4px 18px 12px' }}>
            {(meetingsByDay[parseInt(selectedDate.split('-')[2])] ?? []).length === 0 ? (
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.dim, padding: '20px 0', textAlign: 'center' }}>Nenhuma reuniao neste dia</div>
            ) : (
              (meetingsByDay[parseInt(selectedDate.split('-')[2])] ?? []).map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderTop: `1px solid ${C.bg}`, gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ background: TYPE_COLORS[m.type] ?? '#888', color: '#fff', padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 100, fontFamily: 'var(--font-sans)' }}>{TYPE_LABELS[m.type] ?? m.type}</span>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: C.ink }}>{m.title}</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.mid }}>
                      {new Date(m.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • {m.duration}min • {m.client?.companyName ?? m.title}
                      {m.mentorName && <> • {m.mentorName}</>}
                    </div>
                    {m.notes && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.dim, marginTop: 4 }}>{m.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {m.status === 'SCHEDULED' && (
                      <>
                        <button onClick={() => handleStatusChange(m.id, 'DONE')} style={{ background: C.green, color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Feita</button>
                        <button onClick={() => handleStatusChange(m.id, 'NO_SHOW')} style={{ background: C.amber, color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Faltou</button>
                        <button onClick={() => handleStatusChange(m.id, 'RESCHEDULED')} style={{ background: C.slate, color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Reagendar</button>
                        <button onClick={() => handleStatusChange(m.id, 'CANCELLED')} style={{ background: '#fff', color: C.mid, border: `1px solid ${C.line}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Cancelar</button>
                      </>
                    )}
                    <button onClick={() => openEditMeeting(m)} style={{ background: C.ink, color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Editar</button>
                    <button onClick={() => handleDelete(m.id)} style={{ background: '#fff', color: C.red, border: `1px solid ${C.line}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>×</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      </>}

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) { if (confirm('Sair sem salvar?')) setShowModal(false) } }}>
          <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)', width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.line}`, fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: C.ink }}>
              {selectedMeeting ? 'Editar reuniao' : 'Nova reuniao'}
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Tipo</label>
                  <select value={formType} onChange={e => setFormType(e.target.value)} style={inputStyle}>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Duracao (min)</label>
                  <input type="number" value={formDuration} onChange={e => setFormDuration(e.target.value)} style={inputStyle} />
                </div>
              </div>
              {formType === 'GRUPO' && !selectedMeeting && (
                <div>
                  <label style={labelStyle}>Programa do grupo *</label>
                  <select value={formProgram} onChange={e => setFormProgram(e.target.value)} style={inputStyle}>
                    <option value="">Selecione o programa...</option>
                    <option value="GI">GOON Infinity (grupo)</option>
                    <option value="TTSG">TikTok Scale Grupo</option>
                    <option value="GE">GOON Elite</option>
                    <option value="GS">GOON Scale</option>
                    <option value="TTS">TikTok Scale</option>
                    <option value="AURA">AURA 360</option>
                  </select>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.dim, marginTop: 5 }}>
                    A reuniao sera marcada para TODOS os clientes ativos desse programa (saem da atencao).
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: C.ink }}>
                    <input type="checkbox" checked={formGroupDone} onChange={e => setFormGroupDone(e.target.checked)} />
                    Ja realizada (registrar como feita)
                  </label>
                </div>
              )}
              {!['RG', 'ALINHAMENTO'].includes(formType) && !(formType === 'GRUPO' && !selectedMeeting) && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Cliente *</label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {([['active', 'Ativos'], ['lead', 'Leads (CRM)']] as const).map(([src, lbl]) => (
                        <button key={src} type="button" onClick={() => { setClientSource(src); setFormClientId('') }}
                          style={{ padding: '4px 10px', border: `1px solid ${clientSource === src ? C.ink : C.line}`, borderRadius: 100, background: clientSource === src ? C.ink : '#fff', color: clientSource === src ? '#fff' : C.mid, fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{lbl}</button>
                      ))}
                    </div>
                  </div>
                  <select value={formClientId} onChange={e => setFormClientId(e.target.value)} style={inputStyle}>
                    <option value="">{clientSource === 'active' ? 'Selecione um cliente ativo...' : 'Selecione um lead do CRM...'}</option>
                    {(clientSource === 'active' ? clients : leadClients)
                      .slice()
                      .sort((a, b) => a.companyName.localeCompare(b.companyName))
                      .map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={labelStyle}>Titulo *</label>
                <input value={formTitle} onChange={e => setFormTitle(e.target.value)} style={inputStyle} placeholder="Ex: Mentoria Individual" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Data *</label>
                  <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Horario</label>
                  <input type="time" value={formTime} onChange={e => setFormTime(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Mentor</label>
                <input list="agenda-mentor-list" value={formMentor} onChange={e => setFormMentor(e.target.value)} style={inputStyle} />
                <datalist id="agenda-mentor-list">
                  {mentors.map(m => <option key={m} value={m} />)}
                </datalist>
              </div>
              <div>
                <label style={labelStyle}>Observacoes</label>
                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '10px', border: `1px solid ${C.line}`, borderRadius: 6, background: '#fff', color: C.ink, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 6, background: C.neon, color: C.ink, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
                  {saving ? 'Salvando...' : selectedMeeting ? 'Atualizar' : 'Agendar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
