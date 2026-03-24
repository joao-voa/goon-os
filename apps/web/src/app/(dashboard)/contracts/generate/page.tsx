'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { PRODUCT_COLORS } from '@/lib/constants'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ---- Types ----
interface ContractFields {
  nome: string
  nacionalidade: string
  profissao: string
  estadoCivil: string
  cpf: string
  rg: string
  endereco: string
  enderecoNumero: string
  cep: string
  cidade: string
  estado: string
  email: string
  empresa: string
  cnpj: string
  valorTotal: string
  valorExtenso: string
  formaPagamento: string
  programa: string
  duracaoMeses: string
  dataContrato: string
}

interface ClientSearchResult {
  id: string
  companyName: string
  responsible: string
  email?: string | null
  cnpj?: string | null
  address?: string | null
  addressNumber?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  clientPlans?: Array<{
    id: string
    value: number
    product: { code: string; name: string }
  }>
}

// ---- Programs ----
const PROGRAMS = [
  { code: 'GE', label: 'GE — GOON ELITE', programa: 'GOON ELITE', color: PRODUCT_COLORS.GE },
  { code: 'GI', label: 'GI — GOON INFINITY', programa: 'GOON INFINITY', color: PRODUCT_COLORS.GI },
  { code: 'GS', label: 'GS — GOON SCALE', programa: 'GOON SCALE', color: PRODUCT_COLORS.GS },
]

const ESTADOS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

const DURACAO_OPTIONS = ['3', '6', '12', '18', '24']

// ---- Today formatted ----
function todayBR(): string {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function todayFull(): string {
  return new Date().toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// ---- Helper to download blob ----
async function downloadDocx(fields: ContractFields) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  const res = await fetch(`${API_URL}/api/contracts/generate-docx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(fields),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { message?: string }).message ?? 'Erro ao gerar contrato')
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const fname = `Contrato_${fields.programa}_${fields.empresa || fields.nome}.docx`.replace(/\s+/g, '_')
  a.download = fname
  a.click()
  URL.revokeObjectURL(url)
}

// ---- Helper to open PDF HTML in new tab ----
async function openPdfPreview(fields: ContractFields) {
  // Map programa to template type
  const typeMap: Record<string, string> = {
    'GOON ELITE': 'ge',
    'GOON INFINITY': 'gi',
    'GOON SCALE': 'gs',
  }
  const templateType = typeMap[fields.programa] ?? 'ge'
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null

  // We generate via the saved-contract path; for raw fields we post to generate-pdf-preview
  // Since there's no raw HTML endpoint, we'll use a workaround: create a draft, generate PDF, then delete
  // Actually we can POST to generate-docx and explain the user should print from Word.
  // For PDF: use existing HTML template path by posting to a temp contract OR open with browser print.
  // Best approach: call the existing generate-pdf on a freshly created draft contract.
  // For now we'll create a draft on the fly using the client info if available, then open PDF.

  // Build a minimal contract-creation payload
  // Since the generate-pdf endpoint requires a saved contract, we do:
  // 1. POST /api/contracts with minimal info (we don't have clientId easily here)
  // Instead, replicate PdfService logic on client side by fetching the HTML template.
  // Simplest: fetch the HTML template from API's template endpoint if it exists, or just
  // instruct user to use the Word doc and print.

  // For now: generate the docx and tell user to use Word's export-to-PDF.
  // OR: create a simple inline HTML from the fields and open in new tab.
  const res = await fetch(`${API_URL}/api/contracts/generate-docx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(fields),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { message?: string }).message ?? 'Erro ao gerar PDF')
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}

// ---- Section Card ----
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="goon-card" style={{ marginBottom: 24 }}>
      <div className="goon-card-header" style={{ marginBottom: 20 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

// ---- Form Field ----
function Field({
  label,
  required,
  children,
  half,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
  half?: boolean
}) {
  return (
    <div style={{ flex: half ? '0 0 calc(50% - 8px)' : '1 1 100%', minWidth: 0 }}>
      <label style={{
        display: 'block',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 6,
        color: 'black',
      }}>
        {label}{required && <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

// ---- Main Page ----
export default function GenerateContractPage() {
  const router = useRouter()
  const isMobile = useIsMobile()

  // Client search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ClientSearchResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Loading states
  const [loadingDocx, setLoadingDocx] = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [loadingDraft, setLoadingDraft] = useState(false)

  // Form state
  const [activeProgram, setActiveProgram] = useState<string>('GE')
  const [fields, setFields] = useState<ContractFields>({
    nome: '',
    nacionalidade: 'brasileira',
    profissao: '',
    estadoCivil: 'solteiro(a)',
    cpf: '',
    rg: '',
    endereco: '',
    enderecoNumero: '',
    cep: '',
    cidade: '',
    estado: 'SP',
    email: '',
    empresa: '',
    cnpj: '',
    valorTotal: '',
    valorExtenso: '',
    formaPagamento: '',
    programa: 'GOON ELITE',
    duracaoMeses: '6',
    dataContrato: todayFull(),
  })

  const set = useCallback((key: keyof ContractFields, value: string) => {
    setFields(prev => ({ ...prev, [key]: value }))
  }, [])

  // ---- Client search ----
  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res = await apiFetch<{ data: ClientSearchResult[] }>(
        `/api/clients?search=${encodeURIComponent(searchQuery)}&limit=10`,
      )
      setSearchResults(res.data ?? [])
      setSearchOpen(true)
    } catch {
      toast.error('[ERRO] Erro ao buscar cliente')
    } finally {
      setSearching(false)
    }
  }

  const handleSelectClient = (c: ClientSearchResult) => {
    setSearchOpen(false)
    setSearchQuery(c.companyName ?? c.responsible)
    // Auto-fill fields
    const updates: Partial<ContractFields> = {
      nome: c.responsible ?? '',
      email: c.email ?? '',
      empresa: c.companyName ?? '',
      cnpj: c.cnpj ?? '',
      endereco: c.address ?? '',
      enderecoNumero: c.addressNumber ?? '',
      cep: c.zipCode ?? '',
      cidade: c.city ?? '',
      estado: c.state ?? 'SP',
    }
    // If client has a plan, auto-fill programa and valor
    if (c.clientPlans && c.clientPlans.length > 0) {
      const plan = c.clientPlans[0]
      const progMap: Record<string, string> = {
        GE: 'GE', GI: 'GI', GS: 'GS',
      }
      const code = plan.product.code?.toUpperCase()
      if (progMap[code]) setActiveProgram(progMap[code])
      updates.programa = plan.product.name ?? fields.programa
      updates.valorTotal = plan.value
        ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(plan.value)
        : ''
    }
    setFields(prev => ({ ...prev, ...updates }))
  }

  // ---- Program select ----
  const handleProgramSelect = (code: string) => {
    setActiveProgram(code)
    const p = PROGRAMS.find(x => x.code === code)
    if (p) set('programa', p.programa)
  }

  // ---- Validate ----
  const validate = (): boolean => {
    const required: Array<[keyof ContractFields, string]> = [
      ['nome', 'Nome'],
      ['cpf', 'CPF'],
      ['email', 'E-mail'],
      ['endereco', 'Endereço'],
      ['cidade', 'Cidade'],
      ['valorTotal', 'Valor Total'],
      ['formaPagamento', 'Forma de Pagamento'],
    ]
    const missing = required.filter(([k]) => !fields[k]?.trim()).map(([, l]) => l)
    if (missing.length > 0) {
      toast.error(`[ERRO] Campos obrigatórios: ${missing.join(', ')}`)
      return false
    }
    return true
  }

  // ---- Actions ----
  const handleGenerateDocx = async () => {
    if (!validate()) return
    setLoadingDocx(true)
    try {
      await downloadDocx(fields)
      toast.success('[OK] Contrato Word gerado e baixado')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao gerar Word')
    } finally {
      setLoadingDocx(false)
    }
  }

  const handleGeneratePdf = async () => {
    if (!validate()) return
    setLoadingPdf(true)
    try {
      await openPdfPreview(fields)
      toast.success('[OK] Abrindo contrato em nova aba')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao gerar PDF')
    } finally {
      setLoadingPdf(false)
    }
  }

  const handleSaveDraft = async () => {
    // To save draft we need a clientId — prompt user to search first
    toast.info('[INFO] Para salvar rascunho, use a página de Contratos e vincule a um cliente.')
  }

  // ---- Input styles ----
  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    padding: '8px 10px',
    border: '2px solid black',
    boxShadow: '3px 3px 0 black',
    outline: 'none',
    borderRadius: 0,
    background: 'white',
    boxSizing: 'border-box',
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'none',
    cursor: 'pointer',
  }

  const row2: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  }

  const row1: React.CSSProperties = {
    marginBottom: 16,
  }

  const activeProg = PROGRAMS.find(p => p.code === activeProgram)

  return (
    <div style={{ padding: isMobile ? '16px 12px' : '24px 28px', maxWidth: 900, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: isMobile ? 12 : 16,
          letterSpacing: 2,
          marginBottom: 8,
        }}>
          GERAR CONTRATO
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: '#555',
        }}>
          {'>'} Preencha os dados para gerar o contrato em Word (.docx)
        </div>
        <button
          onClick={() => router.push('/contracts')}
          style={{
            marginTop: 10,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#555',
            textDecoration: 'underline',
            padding: 0,
          }}
        >
          ← Voltar para Contratos
        </button>
      </div>

      {/* Client search */}
      <SectionCard title="BUSCAR CLIENTE">
        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          <input
            className="goon-input"
            style={{ flex: 1 }}
            placeholder="Nome da empresa ou responsável..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button
            className="goon-btn-secondary"
            onClick={handleSearch}
            disabled={searching}
            style={{ whiteSpace: 'nowrap', minWidth: 90 }}
          >
            {searching ? '...' : 'BUSCAR'}
          </button>
        </div>
        {searchOpen && searchResults.length > 0 && (
          <div
            ref={searchRef}
            style={{
              border: '2px solid black',
              boxShadow: '4px 4px 0 black',
              background: 'white',
              marginTop: 4,
              maxHeight: 220,
              overflowY: 'auto',
              zIndex: 50,
              position: 'relative',
            }}
          >
            {searchResults.map(c => (
              <button
                key={c.id}
                onClick={() => handleSelectClient(c)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 14px',
                  border: 'none',
                  borderBottom: '1px solid #eee',
                  background: 'white',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}
              >
                <strong>{c.companyName}</strong>
                <span style={{ color: '#555', marginLeft: 8 }}>{c.responsible}</span>
              </button>
            ))}
          </div>
        )}
        {searchOpen && searchResults.length === 0 && !searching && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#888', marginTop: 8 }}>
            Nenhum cliente encontrado. Preencha manualmente abaixo.
          </div>
        )}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#888', marginTop: 8 }}>
          — ou preencha manualmente os campos abaixo —
        </div>
      </SectionCard>

      {/* Program selector */}
      <SectionCard title="PROGRAMA">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {PROGRAMS.map(p => {
            const isActive = activeProgram === p.code
            return (
              <button
                key={p.code}
                onClick={() => handleProgramSelect(p.code)}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '10px 20px',
                  border: '2px solid black',
                  boxShadow: isActive ? '4px 4px 0 black' : '2px 2px 0 black',
                  background: isActive ? p.color : 'white',
                  color: isActive ? 'white' : 'black',
                  cursor: 'pointer',
                  borderRadius: 0,
                  transition: 'none',
                  letterSpacing: 1,
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </SectionCard>

      {/* Dados do Contratante */}
      <SectionCard title="DADOS DO CONTRATANTE">
        <div style={row2}>
          <Field label="Nome Completo" required half={!isMobile}>
            <input
              style={inputStyle}
              value={fields.nome}
              onChange={e => set('nome', e.target.value)}
              placeholder="Nome completo"
            />
          </Field>
          <Field label="E-mail" required half={!isMobile}>
            <input
              style={inputStyle}
              type="email"
              value={fields.email}
              onChange={e => set('email', e.target.value)}
              placeholder="email@empresa.com"
            />
          </Field>
        </div>

        <div style={row2}>
          <Field label="Nacionalidade" half={!isMobile}>
            <select style={selectStyle} value={fields.nacionalidade} onChange={e => set('nacionalidade', e.target.value)}>
              <option value="brasileira">brasileira</option>
              <option value="brasileiro">brasileiro</option>
              <option value="estrangeiro(a)">estrangeiro(a)</option>
            </select>
          </Field>
          <Field label="Estado Civil" half={!isMobile}>
            <select style={selectStyle} value={fields.estadoCivil} onChange={e => set('estadoCivil', e.target.value)}>
              <option value="solteiro(a)">solteiro(a)</option>
              <option value="casado(a)">casado(a)</option>
              <option value="divorciado(a)">divorciado(a)</option>
              <option value="viúvo(a)">viúvo(a)</option>
              <option value="união estável">união estável</option>
            </select>
          </Field>
        </div>

        <div style={row2}>
          <Field label="Profissão" half={!isMobile}>
            <input
              style={inputStyle}
              value={fields.profissao}
              onChange={e => set('profissao', e.target.value)}
              placeholder="empresário(a)"
            />
          </Field>
          <Field label="CPF" required half={!isMobile}>
            <input
              style={inputStyle}
              value={fields.cpf}
              onChange={e => set('cpf', e.target.value)}
              placeholder="000.000.000-00"
            />
          </Field>
        </div>

        <div style={row2}>
          <Field label="RG" half={!isMobile}>
            <input
              style={inputStyle}
              value={fields.rg}
              onChange={e => set('rg', e.target.value)}
              placeholder="00.000.000-0"
            />
          </Field>
        </div>

        {/* Address */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 2,
          borderTop: '2px solid black',
          paddingTop: 16,
          marginBottom: 16,
          marginTop: 4,
          color: '#555',
        }}>
          — ENDEREÇO —
        </div>

        <div style={row2}>
          <Field label="Rua / Av." required half={!isMobile}>
            <input
              style={inputStyle}
              value={fields.endereco}
              onChange={e => set('endereco', e.target.value)}
              placeholder="Rua dos Pinheiros"
            />
          </Field>
          <Field label="Número" half={!isMobile}>
            <input
              style={inputStyle}
              value={fields.enderecoNumero}
              onChange={e => set('enderecoNumero', e.target.value)}
              placeholder="100"
            />
          </Field>
        </div>

        <div style={row2}>
          <Field label="CEP" half={!isMobile}>
            <input
              style={inputStyle}
              value={fields.cep}
              onChange={e => set('cep', e.target.value)}
              placeholder="00000-000"
            />
          </Field>
          <Field label="Cidade" required half={!isMobile}>
            <input
              style={inputStyle}
              value={fields.cidade}
              onChange={e => set('cidade', e.target.value)}
              placeholder="São Paulo"
            />
          </Field>
        </div>

        <div style={row2}>
          <Field label="Estado" half={!isMobile}>
            <select style={selectStyle} value={fields.estado} onChange={e => set('estado', e.target.value)}>
              {ESTADOS.map(uf => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </Field>
        </div>

        {/* Company */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 2,
          borderTop: '2px solid black',
          paddingTop: 16,
          marginBottom: 16,
          marginTop: 4,
          color: '#555',
        }}>
          — EMPRESA —
        </div>

        <div style={row2}>
          <Field label="Nome da Empresa" half={!isMobile}>
            <input
              style={inputStyle}
              value={fields.empresa}
              onChange={e => set('empresa', e.target.value)}
              placeholder="Empresa LTDA"
            />
          </Field>
          <Field label="CNPJ" half={!isMobile}>
            <input
              style={inputStyle}
              value={fields.cnpj}
              onChange={e => set('cnpj', e.target.value)}
              placeholder="00.000.000/0001-00"
            />
          </Field>
        </div>
      </SectionCard>

      {/* Dados Financeiros */}
      <SectionCard title="DADOS FINANCEIROS">
        <div style={row2}>
          <Field label="Valor Total" required half={!isMobile}>
            <input
              style={inputStyle}
              value={fields.valorTotal}
              onChange={e => set('valorTotal', e.target.value)}
              placeholder="12.000,00"
            />
          </Field>
          <Field label="Valor por Extenso" half={!isMobile}>
            <input
              style={inputStyle}
              value={fields.valorExtenso}
              onChange={e => set('valorExtenso', e.target.value)}
              placeholder="doze mil reais"
            />
          </Field>
        </div>

        <div style={row1}>
          <Field label="Forma de Pagamento" required>
            <input
              style={inputStyle}
              value={fields.formaPagamento}
              onChange={e => set('formaPagamento', e.target.value)}
              placeholder="Entrada de R$ 1.000,00 + 11x R$ 1.000,00 no boleto"
            />
          </Field>
        </div>

        <div style={row2}>
          <Field label="Duração (meses)" half={!isMobile}>
            <select style={selectStyle} value={fields.duracaoMeses} onChange={e => set('duracaoMeses', e.target.value)}>
              {DURACAO_OPTIONS.map(d => (
                <option key={d} value={d}>{d} meses</option>
              ))}
            </select>
          </Field>
          <Field label="Data do Contrato" half={!isMobile}>
            <input
              style={inputStyle}
              value={fields.dataContrato}
              onChange={e => set('dataContrato', e.target.value)}
              placeholder="24 de março de 2026"
            />
          </Field>
        </div>
      </SectionCard>

      {/* Actions */}
      <SectionCard title="AÇÕES">
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
        }}>
          <button
            className="goon-btn-primary"
            onClick={handleGenerateDocx}
            disabled={loadingDocx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: activeProg ? activeProg.color : undefined,
              minWidth: isMobile ? '100%' : 220,
              justifyContent: 'center',
            }}
          >
            {loadingDocx ? 'GERANDO...' : '↓ GERAR WORD (.docx)'}
          </button>

          <button
            className="goon-btn-secondary"
            onClick={handleGeneratePdf}
            disabled={loadingPdf}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: isMobile ? '100%' : 160,
              justifyContent: 'center',
            }}
          >
            {loadingPdf ? 'ABRINDO...' : '▣ VISUALIZAR'}
          </button>

          <button
            className="goon-btn-accent"
            onClick={handleSaveDraft}
            disabled={loadingDraft}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: isMobile ? '100%' : 200,
              justifyContent: 'center',
            }}
          >
            {loadingDraft ? 'SALVANDO...' : '▶ SALVAR COMO RASCUNHO'}
          </button>
        </div>

        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: '#888',
          marginTop: 14,
        }}>
          * Campos obrigatórios: Nome, CPF, E-mail, Endereço, Cidade, Valor Total, Forma de Pagamento
        </div>
      </SectionCard>
    </div>
  )
}
