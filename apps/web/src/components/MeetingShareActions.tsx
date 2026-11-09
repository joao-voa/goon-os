'use client'

import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { meetingInviteText, whatsappLink } from '@/lib/meetingShare'

// Status no Google Agenda + Meet + copiar link/convite + WhatsApp. Usado na Agenda,
// na Agenda do CRM e no detalhe do lead.
export type ShareableMeeting = {
  id: string
  date: string
  type?: string
  category?: string
  title?: string
  meetLink?: string | null
  googleEventId?: string | null
  googleSyncError?: string | null
}
type Contact = { companyName?: string | null; responsible?: string | null; whatsapp?: string | null; phone?: string | null } | null | undefined

const btn: React.CSSProperties = { border: '1px solid #e2e8f0', background: '#fff', borderRadius: 6, padding: '3px 9px', fontSize: 11, cursor: 'pointer', color: '#0f172a', fontWeight: 600, fontFamily: 'var(--font-sans)' }

export default function MeetingShareActions({ meeting: m, contact, onChanged }: { meeting: ShareableMeeting; contact: Contact; onChanged?: () => void }) {
  if (!m.meetLink && !m.googleEventId && !m.googleSyncError) return null
  const wa = m.meetLink ? whatsappLink(contact, meetingInviteText(m, contact)) : null

  async function resync() {
    try {
      await apiFetch(`/api/meetings/${m.id}/sync`, { method: 'POST' })
      toast.success('Sincronização tentada de novo')
      onChanged?.()
    } catch { toast.error('Erro') }
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, flexWrap: 'wrap', fontFamily: 'var(--font-sans)', fontSize: 11 }}>
      {m.googleEventId && !m.googleSyncError && <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Na agenda Google</span>}
      {m.meetLink && <a href={m.meetLink} target="_blank" rel="noopener noreferrer" style={{ color: '#1a73e8', fontWeight: 600 }}>Entrar no Meet</a>}
      {m.meetLink && <button type="button" onClick={() => { navigator.clipboard.writeText(m.meetLink!); toast.success('Link copiado') }} style={btn}>Copiar link</button>}
      {m.meetLink && <button type="button" onClick={() => { navigator.clipboard.writeText(meetingInviteText(m, contact)); toast.success('Convite copiado') }} style={btn}>Copiar convite</button>}
      {wa && <a href={wa} target="_blank" rel="noopener noreferrer" style={{ background: '#25d366', color: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>Enviar no WhatsApp</a>}
      {m.googleSyncError && (
        <>
          <span style={{ color: '#dc2626', fontWeight: 600 }} title={m.googleSyncError}>Google não sincronizou</span>
          <button type="button" onClick={resync} style={btn}>Tentar de novo</button>
        </>
      )}
    </div>
  )
}
