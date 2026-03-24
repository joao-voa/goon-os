'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { PRODUCT_COLORS } from '@/lib/constants'

// ---- Types ----
interface Product {
  id: string
  code: string
  name: string
}

interface Client {
  id: string
  companyName: string
  responsible: string
}

interface ClientPlan {
  id: string
  value: number
  startDate?: string | null
  endDate?: string | null
  paymentStartDate?: string | null
  paymentEndDate?: string | null
  product: Product
}

interface Contract {
  id: string
  templateType: string
  status: string
  version: number
  dynamicFields: Record<string, string>
  generatedPdfUrl?: string | null
  sentAt?: string | null
  signedAt?: string | null
  isSigned?: boolean
  signatureDate?: string | null
  createdAt: string
  client: Client
  clientPlan?: ClientPlan | null
}

interface ContractsPage {
  data: Contract[]
  total: number
  page: number
  limit: number
}

// ---- Helpers ----
const fmtBRL = (n?: number | null) =>
  n != null
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)
    : '—'

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '—'

function daysUntil(dateStr?: string | null): number {
  if (!dateStr) return 999
  const end = new Date(dateStr)
  const now = new Date()
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function contractStatusLabel(status: string) {
  const map: Record<string, string> = {
    DRAFT: 'Rascunho',
    SENT: 'Enviado',
    SIGNED: 'Assinado',
    CANCELLED: 'Cancelado',
  }
  return map[status] ?? status
}

function contractStatusClass(status: string) {
  const map: Record<string, string> = {
    DRAFT: 'goon-badge goon-badge-draft',
    SENT: 'goon-badge goon-badge-sent',
    SIGNED: 'goon-badge goon-badge-signed',
    CANCELLED: 'goon-badge goon-badge-danger',
  }
  return map[status] ?? 'goon-badge goon-badge-inactive'
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function openContractInTab(path: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    method: path.includes('generate-pdf') ? 'POST' : 'GET',
  })
    .then(r => r.text())
    .then(html => {
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    })
    .catch(() => toast.error('[ERRO] Erro ao abrir contrato'))
}

// ---- Signature Badge ----
function SignatureBadge({ isSigned, signatureDate }: { isSigned?: boolean; signatureDate?: string | null }) {
  if (isSigned) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        background: 'var(--success)',
        color: 'white',
        border: '1px solid black',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}>
        ✓ ASSINADO{signatureDate ? ` ${fmtDate(signatureDate)}` : ''}
      </span>
    )
  }
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      background: 'var(--danger)',
      color: 'white',
      border: '1px solid black',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      fontWeight: 700,
    }}>
      ✗ PENDENTE
    </span>
  )
}

// ---- Contract Detail Modal ----
interface DetailModalProps {
  contract: Contract
  onClose: () => void
  onRefresh: () => void
}

function ContractDetailModal({ contract, onClose, onRefresh }: DetailModalProps) {
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(false)
  const fields = contract.dynamicFields ?? {}

  const handleGenerate = async () => {
    setLoading(true)
    try {
      openContractInTab(`/api/contracts/${contract.id}/generate-pdf`)
      toast.success('[OK] Contrato gerado — abrindo para impressão')
      onRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao gerar contrato')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    openContractInTab(`/api/contracts/${contract.id}/download`)
  }

  const handleStatus = async (newStatus: string) => {
    setLoading(true)
    try {
      await apiFetch(`/api/contracts/${contract.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
      toast.success(`[OK] Status → ${contractStatusLabel(newStatus)}`)
      onRefresh()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao alterar status')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkSigned = async () => {
    setLoading(true)
    try {
      await apiFetch(`/api/contracts/${contract.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isSigned: true, signatureDate: new Date().toISOString() }),
      })
      toast.success('[OK] Contrato marcado como assinado')
      onRefresh()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao marcar assinatura')
    } finally {
      setLoading(false)
    }
  }

  // Show new template fields if available, otherwise legacy fields
  const isNewTemplate = !!fields['contratanteNome']
  const fieldRows: { label: string; key: string }[] = isNewTemplate
    ? [
        { label: 'Contratante', key: 'contratanteNome' },
        { label: 'CPF/CNPJ', key: 'contratanteCPF' },
        { label: 'Empresa', key: 'contratanteEmpresa' },
        { label: 'E-mail', key: 'contratanteEmail' },
        { label: 'Produto', key: 'productName' },
        { label: 'Valor Total', key: 'valorTotal' },
        { label: 'Pagamento', key: 'formaPagamento' },
        { label: 'Parcela', key: 'valorParcela' },
        { label: 'Parcelas', key: 'numParcelas' },
        { label: 'Início', key: 'vigenciaInicio' },
        { label: 'Término', key: 'vigenciaFim' },
        { label: 'Acesso até', key: 'acessoFim' },
      ]
    : [
        { label: 'Empresa', key: 'companyName' },
        { label: 'CNPJ', key: 'cnpj' },
        { label: 'Responsável', key: 'responsible' },
        { label: 'Endereço', key: 'address' },
        { label: 'Produto', key: 'productName' },
        { label: 'Valor Total', key: 'value' },
        { label: 'Parcelas', key: 'installments' },
        { label: 'Valor da Parcela', key: 'installmentValue' },
        { label: 'Início', key: 'startDate' },
        { label: 'Término', key: 'endDate' },
        { label: 'Duração', key: 'duration' },
      ]

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: isMobile ? 0 : 16,
        overflowY: isMobile ? 'hidden' : 'auto',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={isMobile ? {
          width: '100%',
          background: 'white',
          border: 'none',
          borderTop: '2px solid black',
          boxShadow: '0 -4px 0 black',
          maxHeight: '85vh',
          overflowY: 'auto',
        } : {
          width: '100%',
          maxWidth: 580,
          background: 'white',
          border: '2px solid black',
          boxShadow: '8px 8px 0px 0px #000',
          margin: 'auto',
        }}
      >
        {/* Modal header */}
        <div style={{
          background: 'black',
          color: 'white',
          fontFamily: 'var(--font-pixel)',
          fontSize: 10,
          textTransform: 'uppercase',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          letterSpacing: 1,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}>
          <span>Contrato {contract.templateType.toUpperCase()}</span>
          <button
            onClick={onClose}
            style={{
              background: 'var(--danger)',
              border: '1px solid white',
              color: 'white',
              cursor: 'pointer',
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              fontWeight: 700,
            }}
          >×</button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Status + signature row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
            <span className={contractStatusClass(contract.status)}>{contractStatusLabel(contract.status)}</span>
            <SignatureBadge isSigned={contract.isSigned} signatureDate={contract.signatureDate} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555' }}>v{contract.version}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555' }}>
              {new Date(contract.createdAt).toLocaleDateString('pt-BR')}
            </span>
          </div>

          {/* Vigência */}
          {(contract.clientPlan?.startDate || fields.vigenciaInicio) && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'black',
              marginBottom: 12,
              padding: '6px 10px',
              background: '#f5f5f5',
              border: '1px solid black',
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
            }}>
              <span>Vigência: <strong>{fields.vigenciaInicio || fmtDate(contract.clientPlan?.startDate)}</strong> → <strong>{fields.vigenciaFim || fmtDate(contract.clientPlan?.endDate)}</strong></span>
              {(fields.acessoFim) && (
                <span>Acesso: até <strong>{fields.acessoFim}</strong></span>
              )}
            </div>
          )}

          {/* Client */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'black', marginBottom: 16, padding: '10px 14px', background: 'var(--retro-gray)', border: '2px solid black' }}>
            <strong style={{ color: 'black', fontWeight: 700 }}>{contract.client.companyName}</strong>
            {' — '}{contract.client.responsible}
          </div>

          {/* Dynamic Fields */}
          <div
            style={{
              background: 'var(--retro-gray)',
              border: '2px solid black',
              padding: 16,
              marginBottom: 20,
            }}
          >
            <p style={{ fontFamily: 'var(--font-pixel)', fontSize: 9, color: 'black', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              Campos do Contrato
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
              {fieldRows.map(({ label, key }) => (
                <div key={key}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555', display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>{label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'black' }}>{fields[key] || '—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* PDF Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="goon-btn-primary"
                onClick={handleGenerate}
                disabled={loading}
                style={{ flex: 1 }}
              >
                Gerar PDF
              </button>
              {contract.generatedPdfUrl && (
                <button
                  className="goon-btn-secondary"
                  onClick={handleDownload}
                  disabled={loading}
                  style={{ flex: 1 }}
                >
                  Baixar
                </button>
              )}
            </div>

            {/* Signature action */}
            {!contract.isSigned && contract.status !== 'CANCELLED' && (
              <button
                className="goon-btn-secondary"
                onClick={handleMarkSigned}
                disabled={loading}
                style={{ background: 'var(--success)', color: 'white', border: '2px solid black' }}
              >
                ✓ Marcar Assinado
              </button>
            )}

            {/* Status Actions */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {contract.status === 'DRAFT' && (
                <button
                  className="goon-btn-secondary"
                  onClick={() => handleStatus('SENT')}
                  disabled={loading}
                  style={{ flex: 1 }}
                >
                  Marcar Enviado
                </button>
              )}
              {contract.status === 'SENT' && (
                <button
                  className="goon-btn-secondary"
                  onClick={() => handleStatus('SIGNED')}
                  disabled={loading}
                  style={{ flex: 1 }}
                >
                  Marcar Assinado (Status)
                </button>
              )}
              {(contract.status === 'DRAFT' || contract.status === 'SENT') && (
                <button
                  className="goon-btn-danger"
                  onClick={() => handleStatus('CANCELLED')}
                  disabled={loading}
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Renewal Section ----
function RenewalSection({ contracts, onRefresh }: { contracts: Contract[]; onRefresh: () => void }) {
  const renewalContracts = contracts.filter(c => {
    if (!c.clientPlan?.endDate) return false
    const days = daysUntil(c.clientPlan.endDate)
    return days >= 0 && days <= 30 && c.status !== 'CANCELLED'
  })

  if (renewalContracts.length === 0) return null

  const handleContact = (contract: Contract) => {
    const phone = ''
    if (phone) {
      window.open(`https://wa.me/${phone}`, '_blank')
    } else {
      toast.info(`Contato: ${contract.client.companyName}`)
    }
  }

  return (
    <div style={{
      border: '2px solid black',
      boxShadow: '6px 6px 0px 0px #000',
      marginBottom: 24,
      overflow: 'hidden',
    }}>
      <div style={{
        background: '#f59e0b',
        color: 'black',
        fontFamily: 'var(--font-pixel)',
        fontSize: 10,
        textTransform: 'uppercase',
        padding: '10px 16px',
        letterSpacing: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        backgroundImage: 'radial-gradient(rgba(0,0,0,0.05) 1px, transparent 1px)',
        backgroundSize: '12px 12px',
      }}>
        <span style={{ fontSize: 14 }}>&#8635;</span>
        <span>Contratos em Processo de Renovação ({renewalContracts.length})</span>
      </div>
      <div style={{ background: 'white', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {renewalContracts.map(contract => {
          const days = daysUntil(contract.clientPlan?.endDate)
          const isUrgent = days <= 7
          return (
            <div
              key={contract.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                background: isUrgent ? '#fef2f2' : '#fffbeb',
                border: `2px solid ${isUrgent ? '#ef4444' : '#f59e0b'}`,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: 'black' }}>
                  {contract.client.companyName}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555', marginTop: 2 }}>
                  {contract.client.responsible} &nbsp;|&nbsp; Término: {fmtDate(contract.clientPlan?.endDate)}
                  &nbsp;|&nbsp; <span style={{ color: isUrgent ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
                    {days === 0 ? 'HOJE' : `${days} dia${days !== 1 ? 's' : ''}`}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="goon-btn-secondary"
                  style={{ fontSize: 11, padding: '4px 12px' }}
                  onClick={() => toast.info('Funcionalidade de renovação em breve')}
                >
                  Gerar Renovação
                </button>
                <button
                  className="goon-btn-ghost"
                  style={{ fontSize: 11, padding: '4px 12px' }}
                  onClick={() => handleContact(contract)}
                >
                  Contatar
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- Mobile Contract Card ----
function ContractCard({ contract, onClick }: { contract: Contract; onClick: () => void }) {
  const productCode = contract.templateType.toUpperCase()
  const color = PRODUCT_COLORS[productCode] ?? '#888'
  const fields = contract.dynamicFields ?? {}
  const startDate = fields.vigenciaInicio || fmtDate(contract.clientPlan?.startDate)
  const endDate = fields.vigenciaFim || fmtDate(contract.clientPlan?.endDate)
  const value = contract.clientPlan?.value

  return (
    <div
      onClick={onClick}
      style={{
        background: 'white',
        border: '2px solid black',
        boxShadow: '4px 4px 0px 0px #000',
        padding: 14,
        marginBottom: 12,
        cursor: 'pointer',
        borderLeft: `4px solid ${color}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: 'black' }}>
            {contract.client.companyName}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555', marginTop: 2 }}>
            {contract.client.responsible}
          </div>
        </div>
        <span className={contractStatusClass(contract.status)}>{contractStatusLabel(contract.status)}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 8px',
          background: color,
          color: 'white',
          border: '1px solid black',
          fontFamily: 'var(--font-pixel)',
          fontSize: 9,
          fontWeight: 700,
        }}>
          {productCode}
        </span>
        {value != null && (
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 10, fontWeight: 700, color: 'black' }}>
            {fmtBRL(value)}
          </span>
        )}
        <SignatureBadge isSigned={contract.isSigned} signatureDate={contract.signatureDate} />
      </div>
      {startDate !== '—' && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555' }}>
          {startDate} → {endDate}
        </div>
      )}
    </div>
  )
}

// ---- Main Page ----
export default function ContractsPage() {
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [allContracts, setAllContracts] = useState<Contract[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') ?? '')
  const [filterRenewal, setFilterRenewal] = useState(() => searchParams.get('renewal') === 'true')
  const [filterPendingSig, setFilterPendingSig] = useState(false)
  const [selected, setSelected] = useState<Contract | null>(null)

  const limit = 20

  const fetchContracts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      params.set('page', String(page))
      params.set('limit', String(limit))

      const result = await apiFetch<ContractsPage>(`/api/contracts?${params.toString()}`)
      setContracts(result.data)
      setTotal(result.total)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao carregar contratos')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  // Fetch all contracts (no pagination) for renewal banner
  const fetchAllContracts = useCallback(async () => {
    try {
      const result = await apiFetch<ContractsPage>(`/api/contracts?limit=200`)
      setAllContracts(result.data)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchContracts()
  }, [fetchContracts])

  useEffect(() => {
    fetchAllContracts()
  }, [fetchAllContracts])

  const handleRefresh = useCallback(() => {
    fetchContracts()
    fetchAllContracts()
  }, [fetchContracts, fetchAllContracts])

  const handleMarkSigned = async (contract: Contract, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await apiFetch(`/api/contracts/${contract.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isSigned: true, signatureDate: new Date().toISOString() }),
      })
      toast.success('[OK] Contrato marcado como assinado')
      handleRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao marcar assinatura')
    }
  }

  const totalPages = Math.ceil(total / limit)

  // Apply local filters on top of server results
  let displayedContracts = contracts
  if (filterRenewal) {
    displayedContracts = displayedContracts.filter(c => {
      const days = daysUntil(c.clientPlan?.endDate)
      return days >= 0 && days <= 30 && c.status !== 'CANCELLED'
    })
  }
  if (filterPendingSig) {
    displayedContracts = displayedContracts.filter(c => !c.isSigned && c.status !== 'CANCELLED')
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: 14, fontWeight: 800, color: 'black', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>
            Contratos
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555', margin: '4px 0 0 0' }}>
            {'>'} {total} contrato{total !== 1 ? 's' : ''} no total
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Toggle: Somente Renovação */}
          <button
            onClick={() => setFilterRenewal(v => !v)}
            style={{
              padding: '6px 12px',
              border: '2px solid black',
              background: filterRenewal ? '#f59e0b' : 'white',
              color: filterRenewal ? 'black' : '#555',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 700,
              boxShadow: filterRenewal ? '2px 2px 0 black' : '1px 1px 0 black',
            }}
          >
            &#8635; Renovação
          </button>

          {/* Toggle: Assinatura Pendente */}
          <button
            onClick={() => setFilterPendingSig(v => !v)}
            style={{
              padding: '6px 12px',
              border: '2px solid black',
              background: filterPendingSig ? 'var(--danger)' : 'white',
              color: filterPendingSig ? 'white' : '#555',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 700,
              boxShadow: filterPendingSig ? '2px 2px 0 black' : '1px 1px 0 black',
            }}
          >
            ✗ Assinatura Pendente
          </button>

          {/* Status filter */}
          <select
            className="goon-select"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            style={{ width: 'auto', minWidth: 180 }}
          >
            <option value="">Todos os status</option>
            <option value="DRAFT">Rascunho</option>
            <option value="SENT">Enviado</option>
            <option value="SIGNED">Assinado</option>
            <option value="CANCELLED">Cancelado</option>
          </select>

          {/* Generate contract link */}
          <a
            href="/contracts/generate"
            className="goon-btn-primary"
            style={{
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
            }}
          >
            + GERAR CONTRATO
          </a>
        </div>
      </div>

      {/* Active filter indicators */}
      {(statusFilter || filterRenewal) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {statusFilter && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#ccff00', border: '2px solid black', boxShadow: '2px 2px 0 black' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'black', textTransform: 'uppercase' }}>
                Filtro ativo: status={statusFilter}
              </span>
              <button onClick={() => setStatusFilter('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'black', padding: '0 4px', lineHeight: 1 }}>
                ✕ limpar
              </button>
            </div>
          )}
          {filterRenewal && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#ccff00', border: '2px solid black', boxShadow: '2px 2px 0 black' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'black', textTransform: 'uppercase' }}>
                Filtro ativo: em renovação
              </span>
              <button onClick={() => setFilterRenewal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'black', padding: '0 4px', lineHeight: 1 }}>
                ✕ limpar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Renewal Banner */}
      <RenewalSection contracts={allContracts} onRefresh={handleRefresh} />

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{
            width: 36, height: 36,
            border: '3px solid black',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : displayedContracts.length === 0 ? (
        <div style={{
          background: 'white',
          border: '2px solid black',
          boxShadow: '4px 4px 0px 0px #000',
          padding: 60,
          textAlign: 'center',
        }}>
          <p style={{ fontFamily: 'var(--font-pixel)', color: 'black', fontSize: 11, textTransform: 'uppercase' }}>
            {statusFilter || filterRenewal || filterPendingSig ? 'Nenhum contrato com estes filtros.' : 'Nenhum contrato criado ainda.'}
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 12, marginTop: 12 }}>
            Crie contratos a partir da página de um cliente.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Cards */}
          {isMobile && (
            <div>
              {displayedContracts.map(contract => (
                <ContractCard
                  key={contract.id}
                  contract={contract}
                  onClick={() => setSelected(contract)}
                />
              ))}
            </div>
          )}

          {/* Desktop Table */}
          {!isMobile && <div style={{ overflow: 'hidden', border: '2px solid black', boxShadow: '6px 6px 0px 0px #000', overflowX: 'auto' }}>
            <table className="goon-table">
              <thead>
                <tr>
                  {['Cliente', 'Produto', 'Valor', 'Vigência', 'Status', 'Assinado', 'Versão', ''].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedContracts.map(contract => {
                  const productCode = contract.templateType.toUpperCase()
                  const color = PRODUCT_COLORS[productCode] ?? '#888'
                  const productName = contract.clientPlan?.product?.name ?? contract.templateType
                  const value = contract.clientPlan?.value
                  const fields = contract.dynamicFields ?? {}
                  const startDate = fields.vigenciaInicio || fmtDate(contract.clientPlan?.startDate)
                  const endDate = fields.vigenciaFim || fmtDate(contract.clientPlan?.endDate)
                  const daysLeft = daysUntil(contract.clientPlan?.endDate)
                  const nearExpiry = daysLeft >= 0 && daysLeft <= 30

                  return (
                    <tr
                      key={contract.id}
                      onClick={() => setSelected(contract)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div style={{ fontWeight: 700, color: 'black' }}>
                          {contract.client.companyName}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555', marginTop: 2 }}>
                          {contract.client.responsible}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '3px 10px',
                            background: color,
                            color: 'white',
                            border: '1px solid black',
                            boxShadow: '1px 1px 0 black',
                            fontFamily: 'var(--font-pixel)',
                            fontSize: 9,
                            fontWeight: 700,
                          }}
                        >
                          {productCode}
                        </span>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555', marginTop: 4 }}>
                          {productName}
                        </div>
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        {fmtBRL(value)}
                      </td>
                      <td>
                        {startDate !== '—' ? (
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'nowrap' }}>
                            <div>{startDate}</div>
                            <div style={{ color: nearExpiry ? '#f59e0b' : '#555' }}>
                              → {endDate}
                              {nearExpiry && (
                                <span style={{ marginLeft: 4, color: '#f59e0b', fontWeight: 700 }}>
                                  ({daysLeft}d)
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#aaa', fontFamily: 'var(--font-mono)', fontSize: 11 }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className={contractStatusClass(contract.status)}>
                          {contractStatusLabel(contract.status)}
                        </span>
                      </td>
                      <td>
                        <SignatureBadge isSigned={contract.isSigned} signatureDate={contract.signatureDate} />
                      </td>
                      <td style={{ color: '#555' }}>
                        v{contract.version}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        {!contract.isSigned && contract.status !== 'CANCELLED' && (
                          <button
                            style={{
                              padding: '3px 8px',
                              border: '1px solid black',
                              background: 'var(--success)',
                              color: 'white',
                              cursor: 'pointer',
                              fontFamily: 'var(--font-mono)',
                              fontSize: 10,
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              minHeight: 44,
                            }}
                            onClick={e => handleMarkSigned(contract, e)}
                          >
                            Marcar Assinado
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>}

          {/* Pagination */}
          {!isMobile && totalPages > 1 && !filterRenewal && !filterPendingSig && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                className="goon-btn-ghost"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← Anterior
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{
                    padding: '6px 12px',
                    border: '2px solid black',
                    background: p === page ? 'var(--retro-blue)' : 'white',
                    color: p === page ? 'white' : 'black',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    fontWeight: 700,
                    boxShadow: p === page ? '2px 2px 0 black' : '1px 1px 0 black',
                  }}
                >
                  {p}
                </button>
              ))}
              <button
                className="goon-btn-ghost"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Próxima →
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selected && (
        <ContractDetailModal
          contract={selected}
          onClose={() => setSelected(null)}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  )
}
