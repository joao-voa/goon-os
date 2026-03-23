'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
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
    DRAFT: 'goon-badge goon-badge-muted',
    SENT: 'goon-badge goon-badge-warning',
    SIGNED: 'goon-badge goon-badge-success',
    CANCELLED: 'goon-badge goon-badge-danger',
  }
  return map[status] ?? 'goon-badge goon-badge-muted'
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
    .catch(() => toast.error('Erro ao abrir contrato'))
}

// ---- Contract Detail Modal ----
interface DetailModalProps {
  contract: Contract
  onClose: () => void
  onRefresh: () => void
}

function ContractDetailModal({ contract, onClose, onRefresh }: DetailModalProps) {
  const [loading, setLoading] = useState(false)
  const fields = contract.dynamicFields ?? {}

  const handleGenerate = async () => {
    setLoading(true)
    try {
      openContractInTab(`/api/contracts/${contract.id}/generate-pdf`)
      toast.success('Contrato gerado — abrindo para impressão')
      onRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar contrato')
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
      toast.success(`Status alterado para ${contractStatusLabel(newStatus)}`)
      onRefresh()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao alterar status')
    } finally {
      setLoading(false)
    }
  }

  const fieldRows: { label: string; key: string }[] = [
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
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
        overflowY: 'auto',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="goon-card"
        style={{ width: '100%', maxWidth: 560, padding: 28, margin: 'auto' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--goon-text-primary)', margin: '0 0 6px 0' }}>
              Contrato {contract.templateType}
            </h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={contractStatusClass(contract.status)}>{contractStatusLabel(contract.status)}</span>
              <span style={{ fontSize: 12, color: 'var(--goon-text-muted)' }}>v{contract.version}</span>
              <span style={{ fontSize: 12, color: 'var(--goon-text-muted)' }}>
                {new Date(contract.createdAt).toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--goon-text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>

        {/* Client */}
        <div style={{ fontSize: 13, color: 'var(--goon-text-secondary)', marginBottom: 16 }}>
          <strong style={{ color: 'var(--goon-text-primary)' }}>{contract.client.companyName}</strong>
          {' — '}{contract.client.responsible}
        </div>

        {/* Dynamic Fields */}
        <div
          style={{
            background: 'var(--goon-input-bg)',
            borderRadius: 8,
            border: '1px solid var(--goon-border-subtle)',
            padding: 16,
            marginBottom: 20,
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--goon-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            Campos do Contrato
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
            {fieldRows.map(({ label, key }) => (
              <div key={key}>
                <span style={{ fontSize: 11, color: 'var(--goon-text-muted)', display: 'block' }}>{label}</span>
                <span style={{ fontSize: 13, color: 'var(--goon-text-secondary)' }}>{fields[key] || '—'}</span>
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
                className="goon-btn-ghost"
                onClick={handleDownload}
                disabled={loading}
                style={{ flex: 1 }}
              >
                Baixar
              </button>
            )}
          </div>

          {/* Status Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {contract.status === 'DRAFT' && (
              <button
                className="goon-btn-ghost"
                onClick={() => handleStatus('SENT')}
                disabled={loading}
                style={{ flex: 1 }}
              >
                Marcar como Enviado
              </button>
            )}
            {contract.status === 'SENT' && (
              <button
                className="goon-btn-ghost"
                onClick={() => handleStatus('SIGNED')}
                disabled={loading}
                style={{ flex: 1 }}
              >
                Marcar como Assinado
              </button>
            )}
            {(contract.status === 'DRAFT' || contract.status === 'SENT') && (
              <button
                onClick={() => handleStatus('CANCELLED')}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--goon-border)',
                  background: 'transparent',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Main Page ----
export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
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
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar contratos')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => {
    fetchContracts()
  }, [fetchContracts])

  const totalPages = Math.ceil(total / limit)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--goon-text-primary)', margin: 0 }}>Contratos</h1>
          <p style={{ fontSize: 14, color: 'var(--goon-text-muted)', margin: '4px 0 0 0' }}>
            {total} contrato{total !== 1 ? 's' : ''} no total
          </p>
        </div>

        {/* Status filter */}
        <select
          className="goon-select"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          style={{ width: 'auto', minWidth: 160 }}
        >
          <option value="">Todos os status</option>
          <option value="DRAFT">Rascunho</option>
          <option value="SENT">Enviado</option>
          <option value="SIGNED">Assinado</option>
          <option value="CANCELLED">Cancelado</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{
            width: 36, height: 36,
            border: '3px solid var(--goon-border)',
            borderTopColor: 'var(--goon-primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      ) : contracts.length === 0 ? (
        <div className="goon-card" style={{ padding: 60, textAlign: 'center' }}>
          <p style={{ color: 'var(--goon-text-muted)', fontSize: 15 }}>
            {statusFilter ? 'Nenhum contrato com este status.' : 'Nenhum contrato criado ainda.'}
          </p>
          <p style={{ color: 'var(--goon-text-muted)', fontSize: 13, marginTop: 8 }}>
            Crie contratos a partir da página de um cliente.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="goon-card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--goon-border)' }}>
                    {['Cliente', 'Produto', 'Valor', 'Status', 'Versão', 'Data'].map(h => (
                      <th
                        key={h}
                        style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--goon-text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contracts.map(contract => {
                    const productCode = contract.templateType.toUpperCase()
                    const color = PRODUCT_COLORS[productCode] ?? '#6b7280'
                    const productName = contract.clientPlan?.product?.name ?? contract.templateType
                    const value = contract.clientPlan?.value

                    return (
                      <tr
                        key={contract.id}
                        onClick={() => setSelected(contract)}
                        style={{
                          borderBottom: '1px solid var(--goon-border-subtle)',
                          cursor: 'pointer',
                          transition: 'background 0.1s ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--goon-input-bg)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--goon-text-primary)', fontSize: 14 }}>
                            {contract.client.companyName}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--goon-text-muted)', marginTop: 2 }}>
                            {contract.client.responsible}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '3px 10px',
                              borderRadius: 4,
                              background: `${color}22`,
                              color,
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            {productCode} — {productName}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--goon-text-primary)', fontSize: 14 }}>
                          {fmtBRL(value)}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span className={contractStatusClass(contract.status)}>
                            {contractStatusLabel(contract.status)}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--goon-text-muted)' }}>
                          v{contract.version}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 12, color: 'var(--goon-text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(contract.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile card view */}
          <div style={{ display: 'none' }} className="mobile-contracts">
            {contracts.map(contract => {
              const productCode = contract.templateType.toUpperCase()
              const color = PRODUCT_COLORS[productCode] ?? '#6b7280'
              return (
                <div
                  key={contract.id}
                  className="goon-card"
                  onClick={() => setSelected(contract)}
                  style={{ padding: 16, marginBottom: 10, cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--goon-text-primary)', fontSize: 15 }}>
                        {contract.client.companyName}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--goon-text-muted)', marginTop: 2 }}>
                        {contract.client.responsible}
                      </div>
                    </div>
                    <span className={contractStatusClass(contract.status)}>
                      {contractStatusLabel(contract.status)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, background: `${color}22`, color, fontSize: 12, fontWeight: 700 }}>
                      {productCode}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--goon-text-muted)' }}>v{contract.version}</span>
                    <span style={{ fontSize: 12, color: 'var(--goon-text-muted)' }}>
                      {new Date(contract.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24, flexWrap: 'wrap' }}>
              <button
                className="goon-btn-ghost"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: '6px 14px', fontSize: 13 }}
              >
                ← Anterior
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--goon-border)',
                    background: p === page ? 'var(--goon-primary)' : 'transparent',
                    color: p === page ? 'white' : 'var(--goon-text-secondary)',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: p === page ? 700 : 400,
                  }}
                >
                  {p}
                </button>
              ))}
              <button
                className="goon-btn-ghost"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ padding: '6px 14px', fontSize: 13 }}
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
          onRefresh={fetchContracts}
        />
      )}
    </div>
  )
}
