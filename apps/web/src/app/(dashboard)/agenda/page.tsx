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

  const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 10px', border: '1px solid #e2e8f0', fontFamily: 'var(--font-mono)', fontSize: 12 }
  const labelStyle: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, display: 'block', marginBottom: 3 }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 20, margin: 0 }}>AGENDA</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['painel', 'calendario'] as const).map(v => (
            <button key={v} onClick={() => setViewMode(v)} style={{
              padding: '6px 14px', border: '1px solid #e2e8f0', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, cursor: 'pointer',
              background: viewMode === v ? 'black' : 'white', color: viewMode === v ? 'white' : 'black',
            }}>{v === 'painel' ? 'PAINEL' : 'CALENDARIO'}</button>
          ))}
        </div>
        <button onClick={() => openNewMeeting(new Date().toISOString().split('T')[0])} style={{
          padding: '8px 16px', border: '1px solid #e2e8f0', background: '#0A0A0C', color: 'white',
          fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        }}>+ NOVA REUNIAO</button>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#666' }}>Categoria:</span>
        {['', 'MENTORIA', 'COMERCIAL', 'GESTAO'].map(cat => (
          <button key={cat} onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)} style={{
            padding: '4px 10px', border: '1px solid #e2e8f0', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, cursor: 'pointer',
            background: categoryFilter === cat ? 'black' : 'white', color: categoryFilter === cat ? 'white' : 'black',
          }}>{cat || 'TODAS'}</button>
        ))}
      </div>

      {/* Mentor filter */}
      {mentors.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#666' }}>Mentor:</span>
          <button onClick={() => setMentorFilter('')} style={{
            padding: '4px 10px', border: '1px solid #e2e8f0', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, cursor: 'pointer',
            background: !mentorFilter ? 'black' : 'white', color: !mentorFilter ? 'white' : 'black',
          }}>TODOS</button>
          {mentors.map(m => (
            <button key={m} onClick={() => setMentorFilter(mentorFilter === m ? '' : m)} style={{
              padding: '4px 10px', border: '1px solid #e2e8f0', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, cursor: 'pointer',
              background: mentorFilter === m ? 'black' : 'white', color: mentorFilter === m ? 'white' : 'black',
            }}>{m}</button>
          ))}
        </div>
      )}

      {/* ---- PAINEL VIEW ---- */}
      {viewMode === 'painel' && (
        <div>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div style={{ border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', padding: '14px 16px', background: '#f0f5ff' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: '#666' }}>Hoje</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 22, color: '#4A78FF' }}>{stats?.todayCount ?? 0}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#888' }}>reunioes</div>
            </div>
            <div style={{ border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', padding: '14px 16px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: '#666' }}>Esta Semana</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 22 }}>{stats?.weekCount ?? 0}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#888' }}>agendadas</div>
            </div>
            <div style={{ border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', padding: '14px 16px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: '#666' }}>Realizadas</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 22, color: '#006600' }}>{stats?.totalDone ?? 0}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#888' }}>total</div>
            </div>
            <div style={{ border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', padding: '14px 16px', background: (() => { const c = cadenceData.filter(d => d.health === 'red').length; return c > 0 ? '#fef2f2' : 'white' })() }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: '#666' }}>Saude Critica</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 22, color: '#cc0000' }}>{cadenceData.filter(d => d.health === 'red').length}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#888' }}>clientes</div>
            </div>
          </div>

          {/* Filtros do painel de atencao + refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Filtrar:</span>
            {([
              ['Inadimplente', fltInadimplente, setFltInadimplente, '#dc2626'] as const,
              ['Vencido', fltVencido, setFltVencido, '#b45309'] as const,
              ['Sem reuniao', fltSemReuniao, setFltSemReuniao, '#f59e0b'] as const,
              ['Em dia', fltEmDia, setFltEmDia, '#16a34a'] as const,
            ]).map(([label, val, set, color]) => (
              <button key={label} onClick={() => set(v => !v)} style={{
                padding: '5px 10px', border: `1px solid ${val ? color : '#e2e8f0'}`,
                background: val ? color : 'white', color: val ? 'white' : '#999',
                fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, cursor: 'pointer', borderRadius: 3,
              }}>{val ? '✓ ' : ''}{label}</button>
            ))}
            <select value={programFilter} onChange={e => setProgramFilter(e.target.value)} style={{
              padding: '5px 10px', border: '1px solid #e2e8f0', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, cursor: 'pointer',
            }}>
              <option value="">Todos os programas</option>
              {[...new Set(cadenceData.map(d => d.programCode).filter(Boolean))].sort().map(p => (
                <option key={p} value={p as string}>{p}</option>
              ))}
            </select>
            <button onClick={handleRefresh} disabled={refreshing} title="Atualizar o painel (apos dar baixa em pagamento)" style={{
              marginLeft: 'auto', padding: '5px 14px', border: '1px solid #0A0A0C',
              background: '#0A0A0C', color: 'white', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
              cursor: refreshing ? 'wait' : 'pointer', borderRadius: 3,
            }}>{refreshing ? '↻ ATUALIZANDO...' : '↻ SYNC'}</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Proximas reunioes */}
            <div style={{ border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)', background: 'white' }}>
              <div style={{ background: '#0A0A0C', color: 'white', padding: '8px 16px', fontFamily: 'var(--font-sans)', fontSize: 10 }}>PROXIMAS REUNIOES</div>
              <div style={{ padding: 12, maxHeight: 300, overflowY: 'auto' }}>
                {meetings.filter(m => m.status === 'SCHEDULED' && new Date(m.date) >= new Date()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 10).map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    <div>
                      <span style={{ background: TYPE_COLORS[m.type] ?? '#888', color: 'white', padding: '1px 5px', fontSize: 8, fontWeight: 700, marginRight: 6 }}>{TYPE_LABELS[m.type]?.split(' ')[0] ?? m.type}</span>
                      <strong>{m.client?.companyName ?? m.title}</strong>
                    </div>
                    <span style={{ color: '#555', fontSize: 10 }}>{new Date(m.date).toLocaleDateString('pt-BR')} {new Date(m.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
                {meetings.filter(m => m.status === 'SCHEDULED' && new Date(m.date) >= new Date()).length === 0 && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#888', textAlign: 'center', padding: 20 }}>Nenhuma reuniao agendada</div>
                )}
              </div>
            </div>

            {/* Clientes que precisam de atencao */}
            <div style={{ border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)', background: 'white' }}>
              <div style={{ background: '#0A0A0C', color: 'white', padding: '8px 16px', fontFamily: 'var(--font-sans)', fontSize: 10 }}>CLIENTES · ATENCAO NO TOPO ({roster.length})</div>
              <div style={{ padding: 12, maxHeight: 420, overflowY: 'auto' }}>
                {roster.map(d => {
                  const next = d.nextMeetingDate ? new Date(d.nextMeetingDate) : null
                  const isGreen = d.health === 'green'
                  const tag = (bg: string, label: string) => (
                    <span key={label} style={{ background: bg, color: 'white', padding: '2px 6px', fontSize: 8, fontWeight: 700, borderRadius: 3, whiteSpace: 'nowrap' }}>{label}</span>
                  )
                  return (
                    <div key={d.clientId} style={{ padding: '10px 0', borderBottom: '1px solid #eee', fontFamily: 'var(--font-mono)', fontSize: 11, opacity: isGreen ? 0.72 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isGreen ? 3 : 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.health === 'red' ? '#dc2626' : d.health === 'yellow' ? '#f59e0b' : '#16a34a', flexShrink: 0 }} />
                        <strong style={{ flex: 1 }}>{d.companyName}</strong>
                        {d.programCode && <span style={{ background: '#0A0A0C', color: 'white', padding: '2px 6px', fontSize: 8, fontWeight: 700, borderRadius: 3 }}>{d.programCode}</span>}
                      </div>
                      {!isGreen && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6, paddingLeft: 16 }}>
                          {d.overdueCount > 0 && tag('#dc2626', `FINANCEIRO ATRASADO · R$${d.overdueValue.toLocaleString('pt-BR')}`)}
                          {d.planExpired && tag('#b45309', 'CONTRATO VENCIDO')}
                          {d.reasons.includes('SEM_REUNIAO') && tag('#f59e0b', d.daysSinceLastMeeting !== null ? `${d.daysSinceLastMeeting}D SEM REUNIAO` : 'NUNCA REUNIU')}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 16, fontSize: 9, color: '#888' }}>
                        <span>{isGreen ? <span style={{ color: '#16a34a', fontWeight: 700 }}>EM DIA</span> : null} {d.doneMeetingsCount} {d.doneMeetingsCount === 1 ? 'reuniao' : 'reunioes'}{d.daysSinceLastMeeting !== null ? ` · ultima ha ${d.daysSinceLastMeeting}d` : ''}</span>
                        {next
                          ? <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ proxima {next.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                          : !isGreen ? <span style={{ color: '#dc2626', fontWeight: 700 }}>sem reuniao marcada</span> : <span>—</span>}
                      </div>
                    </div>
                  )
                })}
                {roster.length === 0 && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#888', textAlign: 'center', padding: 20 }}>Nenhum cliente nesse filtro.</div>
                )}
              </div>
            </div>
          </div>

          {/* Reunioes recentes */}
          <div style={{ border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)', background: 'white', marginTop: 16 }}>
            <div style={{ background: '#16a34a', color: 'white', padding: '8px 16px', fontFamily: 'var(--font-sans)', fontSize: 10 }}>ULTIMAS REUNIOES REALIZADAS</div>
            <div style={{ padding: 12 }}>
              {meetings.filter(m => m.status === 'DONE').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8).map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  <div>
                    <span style={{ background: TYPE_COLORS[m.type] ?? '#888', color: 'white', padding: '1px 5px', fontSize: 8, fontWeight: 700, marginRight: 6 }}>{TYPE_LABELS[m.type]?.split(' ')[0] ?? m.type}</span>
                    <strong>{m.client?.companyName ?? m.title}</strong>
                    {m.mentorName && <span style={{ color: '#888', marginLeft: 6 }}>• {m.mentorName}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {m.clientId && <a href={`/clients/${m.clientId}#trackrecord`} title="Trackrecord da mentoria" style={{ background: '#0A0A0C', color: 'white', padding: '2px 7px', fontSize: 9, fontWeight: 700, textDecoration: 'none', borderRadius: 3 }}>+ SESSÃO</a>}
                    <span style={{ color: '#555', fontSize: 10 }}>{new Date(m.date).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              ))}
              {meetings.filter(m => m.status === 'DONE').length === 0 && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#888', textAlign: 'center', padding: 20 }}>Nenhuma reuniao realizada ainda</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---- CALENDARIO VIEW ---- */}
      {viewMode === 'calendario' && <>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
        <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }} style={{
          padding: '6px 14px', border: '1px solid #e2e8f0', background: 'white', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>◀</button>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, textTransform: 'uppercase', minWidth: 200, textAlign: 'center' }}>{monthName}</span>
        <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }} style={{
          padding: '6px 14px', border: '1px solid #e2e8f0', background: 'white', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>▶</button>
      </div>

      {/* Calendar grid */}
      <div style={{ border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)', background: 'white' }}>
        {/* Weekday headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'black' }}>
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(d => (
            <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 9, color: 'white' }}>{d}</div>
          ))}
        </div>

        {/* Days */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {Array.from({ length: firstDay }, (_, i) => (
            <div key={'e' + i} style={{ minHeight: 80, borderRight: '1px solid #eee', borderBottom: '1px solid #eee', background: '#f9f9f9' }} />
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
                  minHeight: 80, padding: 4, borderRight: '1px solid #eee', borderBottom: '1px solid #eee',
                  cursor: 'pointer', background: isToday ? '#fffff0' : selectedDate === dateStr ? '#f0f5ff' : 'white',
                }}
              >
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: isToday ? 900 : 400,
                  color: isToday ? '#4A78FF' : 'black', marginBottom: 4,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span>{day}</span>
                  {dayMeetings.length > 0 && (
                    <span style={{ background: '#0A0A0C', color: 'white', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
                      {dayMeetings.length}
                    </span>
                  )}
                </div>
                {dayMeetings.slice(0, 3).map(m => (
                  <div key={m.id} onClick={e => { e.stopPropagation(); openEditMeeting(m) }} style={{
                    fontFamily: 'var(--font-mono)', fontSize: 8, padding: '2px 4px', marginBottom: 2,
                    background: TYPE_COLORS[m.type] ?? '#888', color: 'white', borderRadius: 2,
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    opacity: m.status === 'CANCELLED' || m.status === 'NO_SHOW' ? 0.5 : 1,
                    textDecoration: m.status === 'CANCELLED' ? 'line-through' : 'none',
                  }}>
                    {new Date(m.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} {m.client?.companyName ?? m.title}
                  </div>
                ))}
                {dayMeetings.length > 3 && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#888' }}>+{dayMeetings.length - 3} mais</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Day detail panel */}
      {selectedDate && (
        <div style={{ marginTop: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)', background: 'white' }}>
          <div style={{ background: '#0A0A0C', color: 'white', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11 }}>
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <button onClick={() => openNewMeeting(selectedDate)} style={{
              padding: '4px 12px', border: '1px solid white', background: 'transparent', color: 'white',
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, cursor: 'pointer',
            }}>+ AGENDAR</button>
          </div>
          <div style={{ padding: 12 }}>
            {(meetingsByDay[parseInt(selectedDate.split('-')[2])] ?? []).length === 0 ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#888', padding: 16, textAlign: 'center' }}>Nenhuma reuniao neste dia</div>
            ) : (
              (meetingsByDay[parseInt(selectedDate.split('-')[2])] ?? []).map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 8px', borderBottom: '1px solid #eee', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ background: TYPE_COLORS[m.type] ?? '#888', color: 'white', padding: '1px 6px', fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{TYPE_LABELS[m.type] ?? m.type}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700 }}>{m.title}</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555' }}>
                      {new Date(m.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • {m.duration}min • {m.client?.companyName ?? m.title}
                      {m.mentorName && <> • {m.mentorName}</>}
                    </div>
                    {m.notes && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#888', marginTop: 4 }}>{m.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {m.status === 'SCHEDULED' && (
                      <>
                        <button onClick={() => handleStatusChange(m.id, 'DONE')} style={{ background: '#16a34a', color: 'white', border: '1px solid #e2e8f0', padding: '3px 8px', fontSize: 9, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>FEITA</button>
                        <button onClick={() => handleStatusChange(m.id, 'NO_SHOW')} style={{ background: '#f59e0b', color: 'white', border: '1px solid #e2e8f0', padding: '3px 8px', fontSize: 9, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>FALTOU</button>
                        <button onClick={() => handleStatusChange(m.id, 'RESCHEDULED')} style={{ background: '#0ea5e9', color: 'white', border: '1px solid #e2e8f0', padding: '3px 8px', fontSize: 9, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>REAGENDAR</button>
                        <button onClick={() => handleStatusChange(m.id, 'CANCELLED')} style={{ background: '#888', color: 'white', border: '1px solid #e2e8f0', padding: '3px 8px', fontSize: 9, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>CANCELAR</button>
                      </>
                    )}
                    <button onClick={() => openEditMeeting(m)} style={{ background: '#0A0A0C', color: 'white', border: '1px solid #e2e8f0', padding: '3px 8px', fontSize: 9, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>EDITAR</button>
                    <button onClick={() => handleDelete(m.id)} style={{ background: '#dc2626', color: 'white', border: '1px solid #e2e8f0', padding: '3px 8px', fontSize: 9, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>X</button>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) { if (confirm('Sair sem salvar?')) setShowModal(false) } }}>
          <div style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ background: '#0A0A0C', color: 'white', padding: '10px 16px', fontFamily: 'var(--font-sans)', fontSize: 11 }}>
              {selectedMeeting ? 'EDITAR REUNIAO' : 'NOVA REUNIAO'}
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#888', marginTop: 4 }}>
                    A reuniao sera marcada para TODOS os clientes ativos desse programa (saem da atencao).
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700 }}>
                    <input type="checkbox" checked={formGroupDone} onChange={e => setFormGroupDone(e.target.checked)} />
                    Ja realizada (registrar como feita)
                  </label>
                </div>
              )}
              {!['RG', 'ALINHAMENTO'].includes(formType) && !(formType === 'GRUPO' && !selectedMeeting) && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={labelStyle}>Cliente *</label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {([['active', 'Ativos'], ['lead', 'Leads (CRM)']] as const).map(([src, lbl]) => (
                        <button key={src} type="button" onClick={() => { setClientSource(src); setFormClientId('') }}
                          style={{ padding: '3px 8px', border: `1px solid ${clientSource === src ? '#0A0A0C' : '#e2e8f0'}`, background: clientSource === src ? '#0A0A0C' : 'white', color: clientSource === src ? 'white' : '#888', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, cursor: 'pointer', borderRadius: 3 }}>{lbl}</button>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '10px', border: '1px solid #e2e8f0', background: 'white', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>CANCELAR</button>
                <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '10px', border: '1px solid #e2e8f0', background: '#0A0A0C', color: 'white', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                  {saving ? 'SALVANDO...' : selectedMeeting ? 'ATUALIZAR' : 'AGENDAR'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
