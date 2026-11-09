// Envio do link da reunião (Google Meet) para o cliente: mensagem pronta + WhatsApp.

type ShareMeeting = { date: string; type?: string; category?: string; title?: string; meetLink?: string | null }
type ShareClient = { companyName?: string | null; responsible?: string | null; whatsapp?: string | null; phone?: string | null } | null | undefined

/** Nome da call igual ao do Google Agenda: "Conversa - GOON & Cliente" / "Mentoria - GOON & Cliente". */
export function meetingName(m: ShareMeeting, client: ShareClient) {
  const company = client?.companyName?.trim()
  const comercial = m.category === 'COMERCIAL' || m.type === 'COMERCIAL'
  if (company && m.type !== 'GRUPO') return `${comercial ? 'Conversa' : 'Mentoria'} - GOON & ${company}`
  return m.title ?? (comercial ? 'Conversa - GOON' : 'Mentoria - GOON')
}

export function meetingInviteText(m: ShareMeeting, client: ShareClient) {
  const d = new Date(m.date)
  const dia = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const firstName = client?.responsible?.trim().split(/\s+/)[0]
  return [
    `Olá${firstName ? `, ${firstName}` : ''}! Tudo bem?`,
    `Confirmando nossa reunião: ${meetingName(m, client)}`,
    `Dia: ${dia}, às ${hora}`,
    m.meetLink ? `Link da reunião: ${m.meetLink}` : null,
    'Até lá!',
  ].filter(Boolean).join('\n')
}

/** Link wa.me com DDI 55 quando o número não tiver. null se não houver telefone. */
export function whatsappLink(client: ShareClient, text: string) {
  const raw = client?.whatsapp || client?.phone
  if (!raw) return null
  let digits = raw.replace(/\D/g, '').replace(/^0+/, '')
  if (!digits) return null
  if (!(digits.startsWith('55') && digits.length >= 12)) digits = `55${digits}`
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
