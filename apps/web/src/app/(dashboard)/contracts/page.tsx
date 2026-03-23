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
      toast.success('[OK] Contrato gerado — abrindo para impressão')
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
      toast.success(`[OK] Status → ${contractStatusLabel(newStatus)}`)
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
        style={{
          width: '100%',
          maxWidth: 560,
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
          <span>Contrato {contract.templateType}</span>
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
          {/* Status row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
            <span className={contractStatusClass(contract.status)}>{contractStatusLabel(contract.status)}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555' }}>v{contract.version}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555' }}>
              {new Date(contract.createdAt).toLocaleDateString('pt-BR')}
            </span>
          </div>

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
                  Marcar Assinado
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
          <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: 14, fontWeight: 800, color: 'black', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>
            Contratos
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555', margin: '4px 0 0 0' }}>
            {'>'} {total} contrato{total !== 1 ? 's' : ''} no total
          </p>
        </div>

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
      </div>

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
      ) : contracts.length === 0 ? (
        <div style={{
          background: 'white',
          border: '2px solid black',
          boxShadow: '4px 4px 0px 0px #000',
          padding: 60,
          textAlign: 'center',
        }}>
          <p style={{ fontFamily: 'var(--font-pixel)', color: 'black', fontSize: 11, textTransform: 'uppercase' }}>
            {statusFilter ? 'Nenhum contrato com este status.' : 'Nenhum contrato criado ainda.'}
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 12, marginTop: 12 }}>
            Crie contratos a partir da página de um cliente.
          </p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div style={{ overflow: 'hidden', border: '2px solid black', boxShadow: '6px 6px 0px 0px #000', overflowX: 'auto' }}>
            <table className="goon-table">
              <thead>
                <tr>
                  {['Cliente', 'Produto', 'Valor', 'Status', 'Versão', 'Data'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contracts.map(contract => {
                  const productCode = contract.templateType.toUpperCase()
                  const codeColors: Record<string, string> = { GE: 'var(--retro-blue)', GI: 'var(--success)', GS: 'var(--warning)' }
                  const color = codeColors[productCode] ?? '#888'
                  const productName = contract.clientPlan?.product?.name ?? contract.templateType
                  const value = contract.clientPlan?.value

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
                        <span className={contractStatusClass(contract.status)}>
                          {contractStatusLabel(contract.status)}
                        </span>
                      </td>
                      <td style={{ color: '#555' }}>
                        v{contract.version}
                      </td>
                      <td style={{ color: '#555', whiteSpace: 'nowrap' }}>
                        {new Date(contract.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
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
          onRefresh={fetchContracts}
        />
      )}
    </div>
  )
}
