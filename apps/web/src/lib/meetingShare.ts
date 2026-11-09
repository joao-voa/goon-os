// Envio do link da reunião (Google Meet) para o cliente: mensagem pronta + WhatsApp.

type ShareMeeting = { date: string; type?: string; category?: string; meetLink?: string | null; mentorName?: string | null }
type ShareClient = { responsible?: string | null; whatsapp?: string | null; phone?: string | null } | null | undefined

export function meetingInviteText(m: ShareMeeting, client: ShareClient) {
  const d = new Date(m.date)
  const dia = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const firstName = client?.responsible?.trim().split(/\s+/)[0]
  const oque = m.category === 'COMERCIAL' || m.type === 'COMERCIAL' ? 'nossa conversa' : 'nossa mentoria'
  return [
    `Olá${firstName ? `, ${firstName}` : ''}! Tudo bem?`,
    `Confirmando ${oque}${m.mentorName ? ` com ${m.mentorName}` : ''} ${dia}, às ${hora}.`,
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
