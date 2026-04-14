'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'

interface Meeting {
  id: string
  clientId: string
  title: string
  type: string
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
  const [showModal, setShowModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)
  const [mentorFilter, setMentorFilter] = useState('')

  // Form state
  const [formClientId, setFormClientId] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formType, setFormType] = useState('INDIVIDUAL')
  const [formDate, setFormDate] = useState('')
  const [formTime, setFormTime] = useState('10:00')
  const [formDuration, setFormDuration] = useState('60')
  const [formMentor, setFormMentor] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [saving, setSaving] = useState(false)

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
  useEffect(() => {
    apiFetch<{ data: Client[] }>('/api/clients?limit=200')
      .then(res => setClients(res.data || []))
      .catch(() => {})
  }, [])

  const mentors = [...new Set(meetings.map(m => m.mentorName).filter(Boolean))] as string[]

  function openNewMeeting(dateStr: string) {
    setSelectedMeeting(null)
    setFormClientId('')
    setFormTitle('')
    setFormType('INDIVIDUAL')
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
    const needsClient = !['RG', 'ALINHAMENTO'].includes(formType)
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

      if (selectedMeeting) {
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

  const meetingsByDay: Record<number, Meeting[]> = {}
  meetings.forEach(m => {
    const d = new Date(m.date)
    if (d.getMonth() === month && d.getFullYear() === year) {
      const day = d.getDate()
      if (!meetingsByDay[day]) meetingsByDay[day] = []
      meetingsByDay[day].push(m)
    }
  })

  const todayDay = now.getMonth() === month && now.getFullYear() === year ? now.getDate() : -1

  const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }
  const labelStyle: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, display: 'block', marginBottom: 3 }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: 20, margin: 0 }}>AGENDA</h1>
        <button onClick={() => openNewMeeting(new Date().toISOString().split('T')[0])} style={{
          padding: '8px 16px', border: '2px solid black', background: '#4A78FF', color: 'white',
          fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '3px 3px 0 black',
        }}>+ NOVA REUNIAO</button>
      </div>

      {/* Mentor filter */}
      {mentors.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#666' }}>Mentor:</span>
          <button onClick={() => setMentorFilter('')} style={{
            padding: '4px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, cursor: 'pointer',
            background: !mentorFilter ? 'black' : 'white', color: !mentorFilter ? 'white' : 'black',
          }}>TODOS</button>
          {mentors.map(m => (
            <button key={m} onClick={() => setMentorFilter(mentorFilter === m ? '' : m)} style={{
              padding: '4px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, cursor: 'pointer',
              background: mentorFilter === m ? 'black' : 'white', color: mentorFilter === m ? 'white' : 'black',
            }}>{m}</button>
          ))}
        </div>
      )}

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
        <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }} style={{
          padding: '6px 14px', border: '2px solid black', background: 'white', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>◀</button>
        <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 14, textTransform: 'uppercase', minWidth: 200, textAlign: 'center' }}>{monthName}</span>
        <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }} style={{
          padding: '6px 14px', border: '2px solid black', background: 'white', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>▶</button>
      </div>

      {/* Calendar grid */}
      <div style={{ border: '2px solid black', boxShadow: '4px 4px 0 black', background: 'white' }}>
        {/* Weekday headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'black' }}>
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(d => (
            <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontFamily: 'var(--font-pixel)', fontSize: 9, color: 'white' }}>{d}</div>
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
                    <span style={{ background: '#4A78FF', color: 'white', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
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
                    {new Date(m.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} {m.client.companyName}
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
        <div style={{ marginTop: 16, border: '2px solid black', boxShadow: '4px 4px 0 black', background: 'white' }}>
          <div style={{ background: 'black', color: 'white', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 11 }}>
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
                      {new Date(m.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • {m.duration}min • {m.client.companyName}
                      {m.mentorName && <> • {m.mentorName}</>}
                    </div>
                    {m.notes && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#888', marginTop: 4 }}>{m.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {m.status === 'SCHEDULED' && (
                      <>
                        <button onClick={() => handleStatusChange(m.id, 'DONE')} style={{ background: '#006600', color: 'white', border: '1px solid black', padding: '3px 8px', fontSize: 9, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>FEITA</button>
                        <button onClick={() => handleStatusChange(m.id, 'NO_SHOW')} style={{ background: '#e6a800', color: 'white', border: '1px solid black', padding: '3px 8px', fontSize: 9, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>FALTOU</button>
                      </>
                    )}
                    <button onClick={() => openEditMeeting(m)} style={{ background: '#4A78FF', color: 'white', border: '1px solid black', padding: '3px 8px', fontSize: 9, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>EDITAR</button>
                    <button onClick={() => handleDelete(m.id)} style={{ background: '#cc0000', color: 'white', border: '1px solid black', padding: '3px 8px', fontSize: 9, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>X</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) { if (confirm('Sair sem salvar?')) setShowModal(false) } }}>
          <div style={{ background: 'white', border: '2px solid black', boxShadow: '8px 8px 0 black', width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ background: '#4A78FF', color: 'white', padding: '10px 16px', fontFamily: 'var(--font-pixel)', fontSize: 11 }}>
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
              {!['RG', 'ALINHAMENTO'].includes(formType) && (
                <div>
                  <label style={labelStyle}>Cliente *</label>
                  <select value={formClientId} onChange={e => setFormClientId(e.target.value)} style={inputStyle}>
                    <option value="">Selecione...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
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
                <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '10px', border: '2px solid black', background: 'white', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>CANCELAR</button>
                <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '10px', border: '2px solid black', background: '#4A78FF', color: 'white', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', boxShadow: '3px 3px 0 black' }}>
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
