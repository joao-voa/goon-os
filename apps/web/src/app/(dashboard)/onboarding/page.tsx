'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { apiFetch, API_URL } from '@/lib/api'
import { addMonths, brl, termsToFields, termsTotal, type ContractTerms } from '@/lib/contract-terms'
import { meetingInviteText } from '@/lib/meetingShare'
import { PRODUCT_COLORS } from '@/lib/constants'

// Onboarding em checklist (ordem livre): cada cliente tem os mesmos itens, marcados
// em qualquer ordem. O que o sistema já sabe (contrato anexado, cobrança, pagamento,
// kickoff na agenda) marca sozinho; o resto é um clique. Tudo feito = Concluídos.

type Item = { key: string; label: string; done: boolean; auto: boolean; manual: boolean }
type Board = {
  id: string; clientId: string
  client: { companyName: string; responsible: string; phone: string | null; whatsapp: string | null; email: string | null }
  productCode: string | null
  items: Item[]; doneCount: number; total: number
  completed: boolean; inactive: boolean
  kickoff: Meet | null
  d1: Meet | null
  linked360?: boolean
  daysSinceClose: number
  notes: string | null
  signature: { status: string | null; sentAt: string | null; signers: Array<{ name: string; email: string; signedAt?: string | null }> | null } | null
}

// quem assina pela GOON (CONTRATADA: AURA360, representada pelo Giulliano)
const GOON_SIGNER = { name: 'Giulliano Puga', email: 'giullianopuga11@gmail.com' }
// cliente já assinou e a GOON ainda não: lembrete pra não esquecer
const goonPending = (b: { signature: { status: string | null; signers: Array<{ email: string; signedAt?: string | null }> | null } | null }) => {
  const sg = b.signature?.signers ?? []
  if (!b.signature || b.signature.status !== 'sent') return false
  const goon = sg.find(x => x.email.toLowerCase() === GOON_SIGNER.email)
  const others = sg.filter(x => x !== goon)
  return !!goon && !goon.signedAt && others.length > 0 && others.every(x => x.signedAt)
}
// já tem contrato em aberto na ClickSign (mandar outro = nova versão, cancela o atual)
const hasOpenSend = (b: { signature: { status: string | null } | null }) => b.signature?.status === 'sent' || b.signature?.status === 'sending'
const splitEmails = (t: string) => [...new Set(t.split(/[\s,;]+/).map(e => e.trim().toLowerCase()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))]
// e-mails conhecidos do cliente: cadastro + os que aparecem nos dados do contrato colados
const clientEmails = (b: { client: { email: string | null }; notes?: string | null }) =>
  splitEmails([b.client.email ?? '', ...((b.notes ?? '').match(/[^\s@:;,]+@[^\s@;,]+\.[^\s@;,]+/g) ?? [])].join(','))
type Meet = { id: string; date: string; status: string; meetLink: string | null; guestEmails?: string[]; inviteClient?: boolean; from360?: boolean }
// D0 = reunião de onboarding; D1 = diagnóstico (tipo KICKOFF, conversa com o GOON 360)
const MEET_KIND = {
  d0: { label: 'D0', type: 'ONBOARDING', title: 'Onboarding (D0)', duration: 60 },
  d1: { label: 'D1', type: 'KICKOFF', title: 'D1 (diagnóstico)', duration: 120 },
} as const
const meetState = (m: Meet) => m.status === 'DONE' ? 'realizada' : new Date(m.date) < new Date() ? 'falta registrar' : 'agendada'
const TEMPLATE_NAMES: Record<string, string> = { GE: 'GOON ELITE', GI: 'GOON INFINITY', TTS: 'TIKTOK SCALE', TTSG: 'TIKTOK SCALE GRUPO', GA: 'GOON ADVISOR', GS: 'GOON SCALE' }
const SIGN_STATUS: Record<string, string> = { sent: 'enviado', delivered: 'aberto pelo cliente', completed: 'assinado', declined: 'recusado', voided: 'cancelado' }

const C = { ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0', bg: '#f8fafc', neon: '#C7F900', green: '#16a34a', red: '#dc2626', amber: '#d97706', slate: '#475569' }
const sans = 'var(--font-sans)'
const card: React.CSSProperties = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }
const btn: React.CSSProperties = { padding: '6px 12px', border: `1px solid ${C.line}`, borderRadius: 6, background: '#fff', color: C.ink, fontFamily: sans, fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const inp: React.CSSProperties = { padding: '6px 8px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans, fontSize: 12, color: C.ink, background: '#fff' }

const waLink = (phone: string | null) => {
  if (!phone) return null
  let d = phone.replace(/\D/g, '').replace(/^0+/, '')
  if (!d) return null
  if (!(d.startsWith('55') && d.length >= 12)) d = `55${d}`
  return `https://wa.me/${d}`
}

export default function OnboardingPage() {
  const [board, setBoard] = useState<Board[] | null>(null)
  const [tab, setTab] = useState<'andamento' | 'concluidos' | 'inativos'>('andamento')
  const [search, setSearch] = useState('')
  const [kickoffFor, setKickoffFor] = useState<string | null>(null)
  const [kfKind, setKfKind] = useState<'d0' | 'd1'>('d0')
  const [kf, setKf] = useState({ date: '', time: '10:00', owner: 'Giulliano' as 'Giulliano' | 'João', emails: '' })
  // e-mails do D0 já marcado (editar convidados)
  const [d0Emails, setD0Emails] = useState<{ id: string; meetingId: string; text: string; label?: string } | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [clients, setClients] = useState<Array<{ id: string; companyName: string }>>([])
  const [newClientId, setNewClientId] = useState('')
  const [dataFor, setDataFor] = useState<Board | null>(null)
  const [dataText, setDataText] = useState('')
  const [savingData, setSavingData] = useState(false)
  const [signInfo, setSignInfo] = useState<{ enabled: boolean; provider: string; env: string } | null>(null)
  const [signFor, setSignFor] = useState<Board | null>(null)
  const [signFile, setSignFile] = useState<File | null>(null)
  const [signers, setSigners] = useState<Array<{ name: string; email: string }>>([])
  const [sending, setSending] = useState(false)
  // gerar contrato pelo modelo
  type Draft = { terms: ContractTerms; fields: Record<string, string>; fieldList: Array<{ key: string; label: string; long?: boolean }>; templates: Array<{ code: string; name: string }>; suggestedTemplate: string | null; productCode: string | null }
  const [genFor, setGenFor] = useState<Board | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [genTemplate, setGenTemplate] = useState('')
  const [genFields, setGenFields] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState(false)
  const [genTerms, setGenTerms] = useState<ContractTerms | null>(null)
  // depois do envio: mensagem pronta para copiar e mandar ao cliente
  const [sentMsg, setSentMsg] = useState<{ company: string; text: string; title?: string } | null>(null)
  // trava contra clique duplo no envio + confirmação quando já existe um contrato em aberto
  const sendLock = useRef(false)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [eq, setEq] = useState({ n: '', value: '', first: '' })

  const load = useCallback(async () => {
    try { setBoard(await apiFetch<Board[]>('/api/onboarding/board')) } catch { toast.error('Erro ao carregar o onboarding') }
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { apiFetch<{ enabled: boolean; provider: string; env: string }>('/api/onboarding/signature/info').then(setSignInfo).catch(() => {}) }, [])

  function openSign(b: Board) {
    setConfirmReplace(false)
    // e-mail de assinatura colado nos dados do contrato tem preferência
    const signEmail = b.notes?.match(/e-?mail[^:\n]*assinatura[^:\n]*:\s*(\S+@\S+)/i)?.[1]
    setSignFor(b); setSignFile(null)
    setSigners([{ name: b.client.responsible ?? '', email: signEmail ?? b.client.email ?? '' }, GOON_SIGNER])
  }

  function showSentMessage(company: string, name: string, email: string) {
    const short = name.trim().split(/\s+/)[0] ?? ''
    setSentMsg({ company, text: `Fala${short ? ` ${short}` : ''}! Acabamos de enviar o contrato da GOON para assinatura no seu e-mail (${email}). Qualquer dúvida, me chama.` })
  }

  async function sendSign() {
    if (!signFor || !signFile) { toast.error('Escolha o arquivo do contrato'); return }
    const open = hasOpenSend(signFor)
    if (open && !confirmReplace) { setConfirmReplace(true); return }
    if (sendLock.current) return
    sendLock.current = true
    if (signFile.size > 3 * 1024 * 1024) { toast.error('Arquivo maior que 3MB. Comprima o PDF.'); return }
    setSending(true)
    try {
      const dataUrl: string = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(signFile) })
      await apiFetch(`/api/onboarding/${signFor.id}/signature`, {
        method: 'POST', body: JSON.stringify({ filename: signFile.name, mimeType: signFile.type || undefined, data: dataUrl.split(',')[1] ?? '', signers: signers.filter(x => x.name && x.email), replace: open }),
      })
      toast.success('Contrato enviado para assinatura pela ClickSign')
      const cli = signers.find(x => x.email && x.email !== GOON_SIGNER.email) ?? signers[0]
      if (cli) showSentMessage(signFor.client.companyName, cli.name, cli.email)
      setSignFor(null); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro ao enviar') }
    sendLock.current = false; setConfirmReplace(false)
    setSending(false)
  }

  async function openGenerate(b: Board) {
    setGenFor(b); setDraft(null); setConfirmReplace(false)
    try {
      const d = await apiFetch<Draft>(`/api/onboarding/${b.id}/contract/draft`)
      setDraft(d); setGenFields(d.fields); setGenTerms(d.terms); setGenTemplate(d.suggestedTemplate ?? d.templates[0]?.code ?? '')
      setEq({ n: '', value: '', first: '' })
    } catch { toast.error('Erro ao montar os dados do contrato'); setGenFor(null) }
  }

  // gera o .docx no servidor e devolve o arquivo
  async function generateFile(format: 'docx' | 'pdf' = 'docx'): Promise<File | null> {
    if (!genFor || !genTemplate) { toast.error('Escolha o modelo'); return null }
    const token = localStorage.getItem('access_token')
    const res = await fetch(`${API_URL}/api/onboarding/${genFor.id}/contract/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ template: genTemplate, fields: genFields, format }),
    })
    if (!res.ok) { toast.error('Erro ao gerar o contrato'); return null }
    const missing = (res.headers.get('X-Missing-Fields') ?? '').split(',').filter(Boolean)
    if (missing.length) toast.warning(`Campos em branco no contrato: ${missing.join(', ')}`)
    const name = decodeURIComponent((res.headers.get('Content-Disposition') ?? '').match(/filename="([^"]+)"/)?.[1] ?? 'Contrato.docx')
    const blob = await res.blob()
    return new File([blob], name, { type: blob.type })
  }

  // abre o PDF do contrato (do jeito que vai pra assinatura) numa aba nova
  async function previewPdf() {
    const w = window.open('', '_blank')
    setGenerating(true)
    const f = await generateFile('pdf')
    setGenerating(false)
    if (!f) { w?.close(); return }
    const url = URL.createObjectURL(f)
    if (w) w.location.href = url
    else { const a = document.createElement('a'); a.href = url; a.download = f.name; a.click() }
  }

  async function downloadGenerated() {
    setGenerating(true)
    const f = await generateFile()
    if (f) {
      const url = URL.createObjectURL(f); const a = document.createElement('a'); a.href = url; a.download = f.name; a.click(); URL.revokeObjectURL(url)
      toast.success('Contrato gerado'); load()
    }
    setGenerating(false)
  }

  // gera pelo modelo e manda direto pra ClickSign; o PDF enviado fica nos documentos do cliente
  async function sendGenerated() {
    if (!genFor || !genTemplate) return
    const signers = [{ name: genFields.REPRESENTANTE?.trim() ?? '', email: genFields.EMAIL?.trim() ?? '' }, GOON_SIGNER]
    if (!signers[0].name || !signers[0].email) { toast.error('Preencha o representante e o e-mail para assinatura'); return }
    const open = hasOpenSend(genFor)
    if (open && !confirmReplace) { setConfirmReplace(true); return }
    if (sendLock.current) return
    sendLock.current = true
    setGenerating(true)
    try {
      await apiFetch(`/api/onboarding/${genFor.id}/contract/send`, { method: 'POST', body: JSON.stringify({ template: genTemplate, fields: genFields, signers, replace: open }) })
      toast.success(`Contrato enviado para ${signers.map(x => x.email).join(' e ')}`)
      showSentMessage(genFor.client.companyName, signers[0].name, signers[0].email)
      setGenFor(null); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro ao enviar') }
    sendLock.current = false; setConfirmReplace(false)
    setGenerating(false)
  }

  // caso fora do padrão: sobe um PDF ajustado à mão
  function sendCustomPdf() {
    if (!genFor) return
    setSignFor(genFor); setSignFile(null); setConfirmReplace(false)
    setSigners([{ name: genFields.REPRESENTANTE ?? '', email: genFields.EMAIL ?? '' }, GOON_SIGNER])
    setGenFor(null)
  }

  async function uploadTemplate(file: File) {
    if (!genTemplate) { toast.error('Escolha de qual programa é o modelo'); return }
    const dataUrl: string = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file) })
    try {
      await apiFetch('/api/onboarding/contract-templates', { method: 'PUT', body: JSON.stringify({ code: genTemplate, name: TEMPLATE_NAMES[genTemplate] ?? genTemplate, filename: file.name, data: dataUrl.split(',')[1] ?? '' }) })
      toast.success('Modelo atualizado')
      if (genFor) openGenerate(genFor)
    } catch { toast.error('Erro ao salvar o modelo') }
  }

  // condições mudaram -> refaz prazo, início, valor e as frases de pagamento (os campos seguem editáveis)
  function updateTerms(next: ContractTerms) {
    setGenTerms(next)
    setGenFields(f => ({ ...f, ...termsToFields(next) }))
  }
  function setInst(i: number, patch: Partial<ContractTerms['installments'][number]>) {
    if (!genTerms) return
    updateTerms({ ...genTerms, installments: genTerms.installments.map((x, j) => j === i ? { ...x, ...patch } : patch.entry ? { ...x, entry: false } : x) })
  }
  function genEqual() {
    if (!genTerms) return
    const n = parseInt(eq.n, 10), v = parseFloat(eq.value.replace(/\./g, '').replace(',', '.'))
    if (!n || !v || !eq.first) { toast.error('Informe quantidade, valor e primeiro vencimento'); return }
    const entry = genTerms.installments.filter(x => x.entry)
    updateTerms({ ...genTerms, installments: [...entry, ...Array.from({ length: n }, (_, k) => ({ dueDate: addMonths(eq.first, k), value: v, entry: false }))] })
  }

  async function remindSign(b: Board) {
    try {
      await apiFetch(`/api/onboarding/${b.id}/signature/remind`, { method: 'POST' })
      toast.success('Lembrete enviado por e-mail pela ClickSign')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro ao enviar o lembrete') }
  }

  async function refreshSign(b: Board) {
    try {
      const r = await apiFetch<{ status?: string }>(`/api/onboarding/${b.id}/signature/refresh`, { method: 'POST' })
      toast.success(`ClickSign: ${SIGN_STATUS[r.status ?? ''] ?? r.status}`)
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro ao consultar a ClickSign') }
  }

  async function toggle(b: Board, it: Item) {
    // clique alterna; se a marcação manual voltar ao que o sistema já sabe, limpa a manual
    const next = !it.done
    const autoValue = it.manual ? null : it.done
    const payload = autoValue === next ? null : next
    setBoard(bs => bs?.map(x => x.id !== b.id ? x : { ...x, items: x.items.map(i => i.key === it.key ? { ...i, done: next, manual: payload !== null, auto: false } : i), doneCount: x.doneCount + (next ? 1 : -1) }) ?? null)
    try {
      await apiFetch(`/api/onboarding/${b.id}/checklist`, { method: 'PATCH', body: JSON.stringify({ key: it.key, done: next }) })
      if (b.doneCount + 1 === b.total && next) toast.success(`Onboarding de ${b.client.companyName} concluído`)
      load()
    } catch { toast.error('Erro ao salvar'); load() }
  }

  // contrato assinado só conta anexado: sobe o arquivo pra ficha do cliente (Documentos)
  async function attachContract(b: Board, file: File) {
    if (file.size > 3 * 1024 * 1024) { toast.error('Arquivo maior que 3MB. Comprima o PDF.'); return }
    const t = toast.loading('Anexando contrato…')
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file)
      })
      await apiFetch(`/api/clients/${b.clientId}/documents`, {
        method: 'POST',
        body: JSON.stringify({ filename: file.name, data: dataUrl.split(',')[1] ?? '', mimeType: file.type || 'application/pdf', size: file.size, type: 'SIGNED_CONTRACT' }),
      })
      toast.success('Contrato anexado', { id: t })
      load()
    } catch { toast.error('Erro ao anexar o contrato', { id: t }) }
  }

  async function saveContractData() {
    if (!dataFor || !dataText.trim()) return
    setSavingData(true)
    try {
      const r = await apiFetch<{ filled: Record<string, string> }>(`/api/onboarding/${dataFor.id}/contract-data`, { method: 'PATCH', body: JSON.stringify({ text: dataText }) })
      const n = Object.keys(r.filled).length
      toast.success(n ? `Dados salvos e ${n} campos preenchidos no cadastro` : 'Dados salvos')
      setDataFor(null); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro ao salvar os dados') }
    setSavingData(false)
  }

  async function saveD0Emails() {
    if (!d0Emails) return
    try {
      await apiFetch(`/api/meetings/${d0Emails.meetingId}`, { method: 'PATCH', body: JSON.stringify({ inviteClient: false, guestEmails: splitEmails(d0Emails.text) }) })
      toast.success(`Convite enviado para os e-mails da ${d0Emails.label ?? 'D0'}`)
      setD0Emails(null); load()
    } catch { toast.error('Erro ao salvar os e-mails') }
  }

  async function scheduleKickoff(b: Board) {
    if (!kf.date) { toast.error('Escolha o dia'); return }
    const K = MEET_KIND[kfKind]
    try {
      const m = await apiFetch<{ date: string; type?: string; meetLink?: string | null; googleSyncError?: string | null }>('/api/meetings', {
        method: 'POST',
        body: JSON.stringify({
          clientId: b.clientId, title: `${K.title} - GOON & ${b.client.companyName}`, type: K.type, category: 'MENTORIA',
          date: new Date(`${kf.date}T${kf.time}:00`).toISOString(), duration: K.duration, mentorName: kf.owner,
          inviteClient: false, guestEmails: splitEmails(kf.emails),
        }),
      })
      toast.success(m.meetLink ? `${K.label} marcada na agenda, com Meet` : `${K.label} marcada`)
      if (m.googleSyncError) toast.warning('Não foi para o Google Agenda: ' + m.googleSyncError)
      setKickoffFor(null)
      // convite pronto para mandar ao cliente (mesma copy da agenda/CRM)
      setSentMsg({ company: b.client.companyName, title: `${K.label} marcada`, text: meetingInviteText({ ...m, type: K.type, category: 'MENTORIA' }, b.client) })
      load()
    } catch { toast.error(`Erro ao marcar a ${K.label}`) }
  }

  if (!board) return <div style={{ padding: 24, color: C.mid, fontFamily: sans }}>Carregando…</div>

  const q = search.trim().toLowerCase()
  const groups = {
    andamento: board.filter(b => !b.inactive && !b.completed),
    concluidos: board.filter(b => !b.inactive && b.completed),
    inativos: board.filter(b => b.inactive),
  }
  const list = groups[tab]
    .filter(b => !q || b.client.companyName.toLowerCase().includes(q) || b.client.responsible?.toLowerCase().includes(q))
    // em andamento: o que está há mais tempo e com menos itens feitos primeiro
    .sort((a, b) => tab === 'andamento' ? (b.daysSinceClose - a.daysSinceClose) || (a.doneCount - b.doneCount) : a.client.companyName.localeCompare(b.client.companyName))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: sans, color: C.ink }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Onboarding</h1>
          <p style={{ margin: '2px 0 0', color: C.mid, fontSize: 13 }}>O que falta para cada cliente começar. Marque em qualquer ordem.</p>
        </div>
        <button onClick={() => {
          setShowCreate(true)
          apiFetch<{ data: Array<{ id: string; companyName: string }> }>('/api/clients?status=ACTIVE&limit=500').then(r => setClients(r.data ?? [])).catch(() => {})
        }} style={{ ...btn, background: C.ink, color: '#fff', border: 'none', padding: '9px 16px', fontSize: 13, fontWeight: 700 }}>+ Adicionar cliente</button>
      </div>

      {board.some(goonPending) && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: '#fef3c7', border: `1px solid ${C.amber}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: C.ink }}>
          <strong>Falta a assinatura da GOON:</strong>
          <span>{board.filter(goonPending).map(b => b.client.companyName).join(', ')} já {board.filter(goonPending).length === 1 ? 'assinou' : 'assinaram'}.</span>
          <a href="https://app.clicksign.com" target="_blank" rel="noopener noreferrer" style={{ ...btn, marginLeft: 'auto', background: C.ink, color: '#fff', border: 'none', textDecoration: 'none' }}>Assinar na ClickSign</a>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, border: `1px solid ${C.line}`, borderRadius: 100, padding: 4, background: '#fff' }}>
          {([['andamento', 'Em andamento'], ['concluidos', 'Concluídos'], ['inativos', 'Inativos']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '6px 14px', border: 'none', borderRadius: 100, cursor: 'pointer', fontFamily: sans, fontSize: 12, fontWeight: 600, background: tab === k ? C.ink : 'transparent', color: tab === k ? '#fff' : C.mid }}>
              {l} <span style={{ opacity: 0.6 }}>{groups[k].length}</span>
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente…" style={{ ...inp, padding: '8px 12px', fontSize: 13, width: 220 }} />
      </div>

      {list.length === 0 && <div style={{ ...card, padding: 32, textAlign: 'center', color: C.dim, fontSize: 13 }}>Nenhum cliente aqui.</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {list.map(b => {
          const pct = b.total ? b.doneCount / b.total : 0
          const color = b.productCode ? (PRODUCT_COLORS[b.productCode] ?? C.slate) : C.slate
          const wa = waLink(b.client.whatsapp || b.client.phone)
          return (
            <div key={b.id} style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, opacity: b.inactive ? 0.75 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <a href={`/clients/${b.clientId}`} style={{ fontWeight: 700, fontSize: 14, color: C.ink, textDecoration: 'none' }}>{b.client.companyName}</a>
                  <div style={{ fontSize: 12, color: C.mid }}>{b.client.responsible}</div>
                </div>
                {b.productCode && <span style={{ background: color, color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, flexShrink: 0 }}>{b.productCode}</span>}
              </div>

              <div>
                <div style={{ height: 6, background: C.bg, borderRadius: 99, overflow: 'hidden', border: `1px solid ${C.line}` }}>
                  <div style={{ width: `${pct * 100}%`, height: '100%', background: pct === 1 ? C.green : C.ink, borderRadius: 99 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.mid, marginTop: 4 }}>
                  <span>{b.doneCount} de {b.total}</span>
                  <span>fechou há {b.daysSinceClose} {b.daysSinceClose === 1 ? 'dia' : 'dias'}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {b.items.map(it => it.key === 'contrato_assinado' ? (
                  <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 2px' }}>
                    <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, border: `1.5px solid ${it.done ? C.green : C.line}`, background: it.done ? C.green : '#fff', color: '#fff' }}>{it.done ? '✓' : ''}</span>
                    <span style={{ flex: 1, color: it.done ? C.ink : C.mid }}>{it.label}</span>
                    {it.done
                      ? <a href={`/clients/${b.clientId}`} style={{ fontSize: 11, color: C.mid }}>anexado</a>
                      : (
                        <label style={{ ...btn, padding: '2px 8px', fontSize: 11 }}>
                          anexar
                          <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) attachContract(b, f); e.target.value = '' }} />
                        </label>
                      )}
                  </div>
                ) : (
                  <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <button onClick={() => toggle(b, it)} title={it.auto ? 'Marcado pelo sistema. Clique para desmarcar' : 'Clique para marcar'}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, padding: '4px 2px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: sans, fontSize: 13, color: it.done ? C.ink : C.mid, textAlign: 'left' }}>
                      <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, border: `1.5px solid ${it.done ? C.green : C.line}`, background: it.done ? C.green : '#fff', color: '#fff' }}>{it.done ? '✓' : ''}</span>
                      <span style={{ textDecoration: 'none' }}>{it.label}</span>
                      {it.auto && <span style={{ fontSize: 10, color: C.dim }}>auto</span>}
                    </button>
                    {it.key === 'contrato_elaborado' && (
                      <button onClick={() => openGenerate(b)} style={{ ...btn, padding: '2px 8px', fontSize: 11 }}>gerar</button>
                    )}
                    {it.key === 'contrato_enviado' && (b.signature
                      ? <button onClick={() => refreshSign(b)} title="Atualizar status na ClickSign" style={{ ...btn, padding: '2px 8px', fontSize: 11, color: b.signature.status === 'completed' ? C.green : b.signature.status === 'declined' ? C.red : C.mid }}>{SIGN_STATUS[b.signature.status ?? ''] ?? b.signature.status} ↻</button>
                      : signInfo?.enabled ? <button onClick={() => openSign(b)} style={{ ...btn, padding: '2px 8px', fontSize: 11 }}>ClickSign</button> : null)}
                    {it.key === 'dados_contrato' && (
                      <button onClick={() => { setDataFor(b); setDataText(b.notes ?? '') }} style={{ ...btn, padding: '2px 8px', fontSize: 11 }}>{b.notes ? 'ver' : 'colar'}</button>
                    )}
                    {(it.key === 'kickoff' || it.key === 'd1_agendada') && (() => {
                      const kind = it.key === 'kickoff' ? 'd0' : 'd1'
                      const m = kind === 'd0' ? b.kickoff : b.d1
                      if (m) return (
                        <span title={m.from360 ? 'Marcada no GOON 360' : undefined} style={{ fontSize: 11, color: m.status === 'DONE' ? C.green : C.mid, whiteSpace: 'nowrap' }}>
                          {new Date(m.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · {meetState(m)}{m.from360 ? ' · 360' : ''}
                        </span>
                      )
                      return <button onClick={() => { const open = kickoffFor === b.id && kfKind === kind; setKickoffFor(open ? null : b.id); setKfKind(kind); setKf(k => ({ ...k, date: '', emails: clientEmails(b).join(', ') })) }} style={{ ...btn, padding: '2px 8px', fontSize: 11 }}>marcar</button>
                    })()}
                  </div>
                ))}
              </div>

              {b.signature && b.signature.status !== 'completed' && (() => {
                const wa = waLink(b.client.whatsapp || b.client.phone)
                const first = b.client.responsible?.split(' ')[0] ?? ''
                const msg = `Oi${first ? `, ${first}` : ''}! Tudo bem? Enviamos o contrato da GOON para assinatura pela ClickSign, no seu e-mail. Consegue dar uma olhada e assinar quando puder? Qualquer dúvida, estou por aqui.`
                return (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 11.5, color: C.mid, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: '6px 8px' }}>
                    <span style={{ flex: 1, minWidth: 120, color: goonPending(b) ? C.amber : undefined, fontWeight: goonPending(b) ? 700 : undefined }}>{goonPending(b) ? 'Cliente assinou. Falta a GOON assinar' : b.signature.status === 'declined' ? 'Assinatura recusada' : b.signature.status === 'voided' ? 'Envio cancelado' : 'Aguardando assinatura'}{b.signature.sentAt && !goonPending(b) ? ` desde ${new Date(b.signature.sentAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : ''}</span>
                    {goonPending(b)
                      ? <a href="https://app.clicksign.com" target="_blank" rel="noopener noreferrer" style={{ ...btn, padding: '2px 8px', fontSize: 11, background: C.ink, color: '#fff', border: 'none', textDecoration: 'none' }}>Assinar na ClickSign</a>
                      : b.signature.status === 'sent' && <button onClick={() => remindSign(b)} style={{ ...btn, padding: '2px 8px', fontSize: 11 }}>Lembrar por e-mail</button>}
                    {b.signature.status === 'sent' && !goonPending(b) && (() => {
                      const cli = (b.signature.signers ?? []).find(x => x.email.toLowerCase() !== GOON_SIGNER.email)
                      return cli ? <button onClick={() => showSentMessage(b.client.companyName, cli.name, cli.email)} style={{ ...btn, padding: '2px 8px', fontSize: 11 }}>Mensagem</button> : null
                    })()}
                    <button onClick={() => openGenerate(b)} title="Gera ou sobe outro arquivo; o envio anterior é cancelado na ClickSign" style={{ ...btn, padding: '2px 8px', fontSize: 11 }}>Enviar nova versão</button>
                    {wa && !goonPending(b) && <a href={`${wa}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" style={{ ...btn, padding: '2px 8px', fontSize: 11, background: '#25d366', color: '#fff', border: 'none', textDecoration: 'none' }}>WhatsApp</a>}
                  </div>
                )
              })()}

              {d0Emails?.id === b.id && (
                <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: C.mid }}>
                    E-mails que recebem o convite da {d0Emails.label ?? 'D0'} (separe por vírgula)
                    <input value={d0Emails.text} onChange={e => setD0Emails({ ...d0Emails, text: e.target.value })} style={{ ...inp, fontSize: 12 }} />
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={saveD0Emails} style={{ ...btn, background: C.ink, color: '#fff', border: 'none', flex: 1 }}>Salvar e enviar convite</button>
                    <button onClick={() => setD0Emails(null)} style={btn}>Cancelar</button>
                  </div>
                </div>
              )}

              {kickoffFor === b.id && (
                <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="date" value={kf.date} onChange={e => setKf({ ...kf, date: e.target.value })} style={{ ...inp, flex: 1 }} />
                    <input type="time" value={kf.time} onChange={e => setKf({ ...kf, time: e.target.value })} style={{ ...inp, width: 84 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    {(['Giulliano', 'João'] as const).map(n => (
                      <label key={n} style={{ display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer', fontWeight: kf.owner === n ? 700 : 400 }}>
                        <input type="checkbox" checked={kf.owner === n} onChange={() => setKf({ ...kf, owner: n })} />{n}
                      </label>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{kfKind === 'd0' ? 'D0 · reunião de onboarding (1h)' : 'D1 · diagnóstico (2h)'}</div>
                  {kfKind === 'd1' && (
                    <div style={{ fontSize: 11, color: b.linked360 ? C.mid : C.amber }}>
                      {b.linked360 ? 'Vai também para o Advisor da marca no GOON 360.' : 'Marca ainda não ligada ao GOON 360: a D1 fica só aqui e no Google.'}
                    </div>
                  )}
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: C.mid }}>
                    E-mails que recebem o convite (separe por vírgula)
                    <input value={kf.emails} onChange={e => setKf({ ...kf, emails: e.target.value })} placeholder="cliente@empresa.com, socio@empresa.com" style={{ ...inp, fontSize: 12 }} />
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => scheduleKickoff(b)} style={{ ...btn, background: C.ink, color: '#fff', border: 'none', flex: 1 }}>Marcar {MEET_KIND[kfKind].label}</button>
                    <button onClick={() => setKickoffFor(null)} style={btn}>Cancelar</button>
                  </div>
                </div>
              )}

              {b.doneCount === b.total - 1 && !b.items.find(i => i.key === 'contrato_assinado')?.done && (
                <div style={{ fontSize: 11.5, color: C.amber, fontWeight: 600 }}>Só falta anexar o contrato assinado para concluir.</div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'auto', paddingTop: 4, borderTop: `1px solid ${C.bg}` }}>
                {wa && <a href={wa} target="_blank" rel="noopener noreferrer" style={{ ...btn, background: '#25d366', color: '#fff', border: 'none', textDecoration: 'none' }}>WhatsApp</a>}
                {(['d0', 'd1'] as const).map(kind => {
                  const m = kind === 'd0' ? b.kickoff : b.d1
                  if (!m || m.status !== 'SCHEDULED') return null
                  const L = MEET_KIND[kind].label
                  return (
                    <React.Fragment key={kind}>
                      {m.meetLink && <a href={m.meetLink} target="_blank" rel="noopener noreferrer" style={{ ...btn, textDecoration: 'none' }}>Meet da {L}</a>}
                      <button onClick={() => setD0Emails({ id: b.id, meetingId: m.id, label: L, text: [...new Set([...(m.inviteClient && b.client.email ? [b.client.email] : []), ...(m.guestEmails ?? [])])].join(', ') || clientEmails(b).join(', ') })} style={btn}>E-mails da {L}</button>
                      <button onClick={() => setSentMsg({ company: b.client.companyName, title: `Convite da ${L}`, text: meetingInviteText({ date: m.date, type: MEET_KIND[kind].type, category: 'MENTORIA', meetLink: m.meetLink }, b.client) })} style={btn}>Convite da {L}</button>
                    </React.Fragment>
                  )
                })}
                <a href={`/clients/${b.clientId}`} style={{ ...btn, textDecoration: 'none', marginLeft: 'auto' }}>Ver cliente</a>
              </div>
            </div>
          )
        })}
      </div>

      {sentMsg && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setSentMsg(null) }}>
          <div style={{ ...card, width: '100%', maxWidth: 480, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{sentMsg.title ?? 'Contrato enviado'} · {sentMsg.company}</div>
            <div style={{ fontSize: 12, color: C.mid }}>Mensagem para avisar o cliente:</div>
            <textarea value={sentMsg.text} onChange={e => setSentMsg(m => m && { ...m, text: e.target.value })} rows={6} style={{ ...inp, fontSize: 13, padding: 10, lineHeight: 1.5, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setSentMsg(null)} style={btn}>Fechar</button>
              <button onClick={async () => { try { await navigator.clipboard.writeText(sentMsg.text); toast.success('Mensagem copiada') } catch { toast.error('Não consegui copiar') } }} style={{ ...btn, background: C.ink, color: '#fff', border: 'none' }}>Copiar mensagem</button>
            </div>
          </div>
        </div>
      )}

      {genFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setGenFor(null) }}>
          <div style={{ ...card, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Contrato · {genFor.client.companyName}</div>
            {!draft ? <div style={{ color: C.mid, fontSize: 13 }}>Montando os dados…</div> : <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: C.mid }}>Modelo</span>
                <select value={genTemplate} onChange={e => setGenTemplate(e.target.value)} style={{ ...inp, fontSize: 13, padding: 7 }}>
                  <option value="">Selecione…</option>
                  {Object.entries(TEMPLATE_NAMES).map(([code, name]) => (
                    <option key={code} value={code}>{name}{draft.templates.some(t => t.code === code) ? '' : ' (sem modelo)'}</option>
                  ))}
                </select>
                {draft.productCode && draft.productCode !== genTemplate && <span style={{ fontSize: 11, color: C.amber }}>o plano do cliente é {TEMPLATE_NAMES[draft.productCode] ?? draft.productCode}</span>}
                <label style={{ ...btn, marginLeft: 'auto', fontSize: 11 }} title="Sobe o .docx com os campos {{CAMPO}} para este programa">
                  {draft.templates.some(t => t.code === genTemplate) ? 'trocar modelo' : 'subir modelo'}
                  <input type="file" accept=".docx" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadTemplate(f); e.target.value = '' }} />
                </label>
              </div>
              {genTerms && (() => {
                const t = genTerms
                const card = t.paymentType === 'CARTAO'
                const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', flexDirection: 'column', gap: 4 }
                const small: React.CSSProperties = { ...inp, fontSize: 13, padding: 7 }
                return (
                  <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10, background: C.bg }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Condições do contrato</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <label style={lbl}>Prazo (meses)<input type="number" min={1} value={t.months} onChange={e => updateTerms({ ...t, months: parseInt(e.target.value, 10) || 1 })} style={{ ...small, width: 90 }} /></label>
                      <label style={lbl}>Início<input type="date" value={t.startDate} onChange={e => updateTerms({ ...t, startDate: e.target.value })} style={small} /></label>
                      <label style={lbl}>Forma
                        <select value={t.paymentType} onChange={e => {
                          const pt = e.target.value as ContractTerms['paymentType']
                          // cartão = um valor total; volta a ter parcelas ao sair do cartão
                          const inst = pt === 'CARTAO' ? [{ dueDate: t.startDate, value: termsTotal(t), entry: false }] : t.installments
                          updateTerms({ ...t, paymentType: pt, installments: inst })
                        }} style={small}>
                          <option value="BOLETO">Boleto</option><option value="PIX">PIX</option><option value="CARTAO">Cartão</option>
                        </select>
                      </label>
                      {card && <label style={lbl}>Vezes no cartão<input type="number" min={1} value={t.cardInstallments} onChange={e => updateTerms({ ...t, cardInstallments: parseInt(e.target.value, 10) || 1 })} style={{ ...small, width: 90 }} /></label>}
                      {card && <label style={lbl}>Valor total<input type="number" step="0.01" value={t.installments[0]?.value ?? 0} onChange={e => updateTerms({ ...t, installments: [{ dueDate: t.startDate, value: parseFloat(e.target.value) || 0, entry: false }] })} style={{ ...small, width: 130 }} /></label>}
                      {(card || t.installments.length === 1) && (
                        <label style={{ ...lbl, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', textTransform: 'none', letterSpacing: 0, fontSize: 12, paddingBottom: 8 }}>
                          <input type="checkbox" checked={t.paidUpfront} onChange={e => updateTerms({ ...t, paidUpfront: e.target.checked })} /> já pago nesta data
                        </label>
                      )}
                    </div>
                    {!card && <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr 28px', gap: 6, fontSize: 11, fontWeight: 600, color: C.mid, textTransform: 'uppercase' }}>
                          <span>Entrada</span><span>Vencimento</span><span>Valor (R$)</span><span />
                        </div>
                        {t.installments.map((x, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr 28px', gap: 6, alignItems: 'center' }}>
                            <input type="checkbox" checked={x.entry} onChange={e => setInst(i, { entry: e.target.checked })} style={{ justifySelf: 'start' }} />
                            <input type="date" value={x.dueDate} onChange={e => setInst(i, { dueDate: e.target.value })} style={small} />
                            <input type="number" step="0.01" value={x.value} onChange={e => setInst(i, { value: parseFloat(e.target.value) || 0 })} style={small} />
                            <button onClick={() => updateTerms({ ...t, installments: t.installments.filter((_, j) => j !== i) })} style={{ ...btn, padding: '4px 0', color: C.red }}>×</button>
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <button onClick={() => {
                            const last = t.installments[t.installments.length - 1]
                            updateTerms({ ...t, installments: [...t.installments, { dueDate: last ? addMonths(last.dueDate, 1) : t.startDate, value: last?.value ?? 0, entry: false }] })
                          }} style={btn}>+ Parcela</button>
                          <span style={{ marginLeft: 'auto', fontSize: 13 }}>{t.installments.length} {t.installments.length === 1 ? 'pagamento' : 'pagamentos'} · total <strong>{brl(termsTotal(t))}</strong></span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: C.mid, borderTop: `1px dashed ${C.line}`, paddingTop: 8 }}>
                        Gerar parcelas iguais:
                        <input placeholder="qtd" value={eq.n} onChange={e => setEq(v => ({ ...v, n: e.target.value }))} style={{ ...small, width: 60 }} />
                        x R$ <input placeholder="valor" value={eq.value} onChange={e => setEq(v => ({ ...v, value: e.target.value }))} style={{ ...small, width: 100 }} />
                        a partir de <input type="date" value={eq.first} onChange={e => setEq(v => ({ ...v, first: e.target.value }))} style={small} />
                        <button onClick={genEqual} style={btn}>Gerar</button>
                        <span style={{ fontSize: 11 }}>(mantém a entrada; depois dá para mudar valor e data de cada uma)</span>
                      </div>
                    </>}
                  </div>
                )
              })()}
              <div style={{ fontSize: 12, color: C.mid, lineHeight: 1.5 }}>Confira os campos e envie. Em "Ver PDF" você confere o contrato pronto. "Enviar para assinatura" manda esse PDF pela ClickSign e guarda o PDF nos documentos do cliente.</div>
              <div style={{ fontSize: 12, color: C.ink, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 10px', lineHeight: 1.6 }}>
                <strong>Assinam:</strong> {genFields.REPRESENTANTE || '(representante)'} · {genFields.EMAIL || '(e-mail)'} <span style={{ color: C.mid }}>(contratante)</span><br />
                {GOON_SIGNER.name} · {GOON_SIGNER.email} <span style={{ color: C.mid }}>(GOON)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                {draft.fieldList.map(f => (
                  <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: f.long || f.key === 'ENDERECO' || f.key === 'VALOR_TOTAL' ? '1 / -1' : undefined }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: genFields[f.key]?.trim() ? C.mid : C.red, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{f.label}</span>
                    {f.long
                      ? <textarea value={genFields[f.key] ?? ''} onChange={e => setGenFields(v => ({ ...v, [f.key]: e.target.value }))} rows={2} style={{ ...inp, fontSize: 13, padding: 8, resize: 'vertical', lineHeight: 1.4 }} />
                      : <input value={genFields[f.key] ?? ''} onChange={e => setGenFields(v => ({ ...v, [f.key]: e.target.value }))} style={{ ...inp, fontSize: 13, padding: 8 }} />}
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => setGenFor(null)} style={btn}>Fechar</button>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center', fontSize: 11.5 }}>
                  <button onClick={downloadGenerated} disabled={generating || !draft.templates.some(t => t.code === genTemplate)} style={{ background: 'none', border: 'none', padding: 0, color: C.mid, textDecoration: 'underline', cursor: 'pointer', fontSize: 11.5 }} title="Para mudar alguma cláusula à mão">baixar Word</button>
                </span>
                {signInfo?.enabled && <button onClick={sendCustomPdf} style={{ ...btn, border: `1px solid ${C.ink}` }} title="Contrato ajustado fora do padrão">Enviar meu PDF</button>}
                <button onClick={previewPdf} disabled={generating || !draft.templates.some(t => t.code === genTemplate)} style={btn}>{generating ? 'Gerando…' : 'Ver PDF'}</button>
                {signInfo?.enabled && <button onClick={sendGenerated} disabled={generating || !draft.templates.some(t => t.code === genTemplate)} style={{ ...btn, background: C.ink, color: '#fff', border: 'none' }}>{generating ? 'Enviando…' : confirmReplace ? 'Confirmar: cancelar o atual e reenviar' : hasOpenSend(genFor) ? 'Enviar nova versão' : 'Enviar para assinatura'}</button>}
              </div>
            </>}
          </div>
        </div>
      )}

      {signFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setSignFor(null) }}>
          <div style={{ ...card, width: '100%', maxWidth: 520, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Enviar para assinatura · {signFor.client.companyName}</div>
            <label style={{ fontSize: 12, color: C.mid }}>
              Contrato em PDF, versão final (até 3MB)
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                <span style={{ ...btn, background: C.ink, color: '#fff', border: 'none', padding: '9px 16px', fontSize: 13 }}>{signFile ? 'Trocar PDF' : 'Escolher PDF'}</span>
                <span style={{ fontSize: 13, color: signFile ? C.ink : C.dim, fontWeight: signFile ? 600 : 400 }}>{signFile ? signFile.name : 'Nenhum arquivo escolhido'}</span>
              </span>
              <input type="file" accept=".pdf,application/pdf" onChange={e => setSignFile(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
            </label>
            <div style={{ fontSize: 12, color: C.mid }}>Quem assina (nome e sobrenome; a ClickSign manda o e-mail para cada um):</div>
            {signers.map((sg, i) => (
              <div key={i} style={{ display: 'flex', gap: 6 }}>
                <input value={sg.name} onChange={e => setSigners(l => l.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Nome" style={{ ...inp, flex: 1, fontSize: 13, padding: 8 }} />
                <input value={sg.email} onChange={e => setSigners(l => l.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} placeholder="E-mail" style={{ ...inp, flex: 1.3, fontSize: 13, padding: 8 }} />
                {signers.length > 1 && <button onClick={() => setSigners(l => l.filter((_, j) => j !== i))} style={{ ...btn, color: C.red }}>×</button>}
              </div>
            ))}
            <button onClick={() => setSigners(l => [...l, { name: '', email: '' }])} style={{ ...btn, alignSelf: 'flex-start' }}>+ Signatário</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setSignFor(null)} style={{ ...btn, marginLeft: 'auto' }}>Cancelar</button>
              <button onClick={sendSign} disabled={sending || !signFile} style={{ ...btn, background: C.ink, color: '#fff', border: 'none' }}>{sending ? 'Enviando…' : confirmReplace ? 'Confirmar: cancelar o atual e reenviar' : hasOpenSend(signFor) ? 'Enviar nova versão' : 'Enviar pela ClickSign'}</button>
            </div>
          </div>
        </div>
      )}

      {dataFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setDataFor(null) }}>
          <div style={{ ...card, width: '100%', maxWidth: 520, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Dados do contrato · {dataFor.client.companyName}</div>
            <div style={{ fontSize: 12, color: C.mid }}>Cole como o cliente mandou (razão social, CNPJ, endereço, responsável, CPF, e-mail…). O texto fica guardado aqui e o cadastro do cliente é preenchido com o que der.</div>
            <textarea value={dataText} onChange={e => setDataText(e.target.value)} rows={12} autoFocus placeholder={'Razão Social: …\nCNPJ: …\nEndereço: …'}
              style={{ ...inp, fontSize: 13, padding: 10, resize: 'vertical', lineHeight: 1.5 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { navigator.clipboard.writeText(dataText); toast.success('Copiado') }} disabled={!dataText} style={btn}>Copiar</button>
              <button onClick={() => setDataFor(null)} style={{ ...btn, marginLeft: 'auto' }}>Fechar</button>
              <button onClick={saveContractData} disabled={savingData || !dataText.trim()} style={{ ...btn, background: C.ink, color: '#fff', border: 'none' }}>{savingData ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}>
          <div style={{ ...card, width: '100%', maxWidth: 400, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Adicionar cliente ao onboarding</div>
            <select value={newClientId} onChange={e => setNewClientId(e.target.value)} style={{ ...inp, padding: '9px 10px', fontSize: 13 }}>
              <option value="">Selecione o cliente…</option>
              {clients.filter(c => !board.some(b => b.clientId === c.id)).sort((a, b) => a.companyName.localeCompare(b.companyName)).map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowCreate(false)} style={{ ...btn, flex: 1 }}>Cancelar</button>
              <button disabled={!newClientId} onClick={async () => {
                try {
                  await apiFetch('/api/onboarding', { method: 'POST', body: JSON.stringify({ clientId: newClientId }) })
                  toast.success('Cliente adicionado ao onboarding'); setShowCreate(false); setNewClientId(''); load()
                } catch { toast.error('Erro ao adicionar') }
              }} style={{ ...btn, flex: 1, background: newClientId ? C.ink : '#cbd5e1', color: '#fff', border: 'none' }}>Adicionar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
