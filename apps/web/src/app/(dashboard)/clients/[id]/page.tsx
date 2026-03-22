'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'

// ---- Types ----
interface Product {
  id: string
  code: string
  name: string
}

interface ClientPlan {
  id: string
  status: string
  value: string
  paymentType: string
  startDate: string
  endDate?: string
  product: Product
}

interface Contract {
  id: string
  templateType: string
  status: string
  createdAt: string
}

interface Onboarding {
  id: string
  currentStage: string
  notes?: string
}

interface ActivityLog {
  id: string
  action: string
  description?: string
  fromValue?: string
  toValue?: string
  createdAt: string
}

interface ClientDetail {
  id: string
  companyName: string
  tradeName?: string
  cnpj?: string
  responsible: string
  phone?: string
  email?: string
  whatsapp?: string
  segment?: string
  address?: string
  addressNumber?: string
  neighborhood?: string
  city?: string
  state?: string
  zipCode?: string
  employeeCount?: string
  estimatedRevenue?: string
  mainPains?: string
  strategicGoals?: string
  maturity?: string
  goonFitScore?: number
  status: string
  plans: ClientPlan[]
  contracts: Contract[]
  onboarding?: Onboarding
  activityLogs: ActivityLog[]
  createdAt: string
  updatedAt: string
}

// ---- Helpers ----
function relativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'agora mesmo'
  if (diffMins < 60) return `há ${diffMins}min`
  if (diffHours < 24) return `há ${diffHours}h`
  if (diffDays === 1) return 'há 1 dia'
  if (diffDays < 30) return `há ${diffDays} dias`
  return date.toLocaleDateString('pt-BR')
}

function statusLabel(status: string) {
  const map: Record<string, string> = { ACTIVE: 'Ativo', PROSPECT: 'Prospect', INACTIVE: 'Inativo', CANCELLED: 'Cancelado' }
  return map[status] ?? status
}

function statusClass(status: string) {
  const map: Record<string, string> = {
    ACTIVE: 'goon-badge goon-badge-success',
    PROSPECT: 'goon-badge goon-badge-primary',
    INACTIVE: 'goon-badge goon-badge-muted',
    CANCELLED: 'goon-badge goon-badge-danger',
  }
  return map[status] ?? 'goon-badge goon-badge-muted'
}

function maturityLabel(v?: string) {
  const map: Record<string, string> = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta' }
  return v ? (map[v] ?? v) : '—'
}

function onboardingStageLabel(stage: string) {
  const map: Record<string, string> = {
    CLIENT_CLOSED: 'Cliente Fechado',
    ONBOARDING_STARTED: 'Onboarding Iniciado',
    DOCS_SENT: 'Docs Enviados',
    SETUP_DONE: 'Setup Concluído',
    LIVE: 'Em Produção',
  }
  return map[stage] ?? stage
}

// ---- Inline editable field ----
interface InlineFieldProps {
  label: string
  value?: string | number | null
  field: string
  type?: 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select'
  options?: { value: string; label: string }[]
  onSave: (field: string, value: string) => Promise<void>
  min?: number
  max?: number
}

function InlineField({ label, value, field, type = 'text', options, onSave, min, max }: InlineFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value != null ? String(value) : '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (draft === (value != null ? String(value) : '')) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(field, draft)
      setEditing(false)
    } catch {
      setDraft(value != null ? String(value) : '')
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') handleSave()
    if (e.key === 'Escape') { setDraft(value != null ? String(value) : ''); setEditing(false) }
  }

  const displayValue = value != null && String(value) !== '' ? String(value) : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label className="goon-label">{label}</label>
      {editing ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          {type === 'textarea' ? (
            <textarea
              className="goon-textarea"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              autoFocus
              style={{ minHeight: 80 }}
            />
          ) : type === 'select' && options ? (
            <select
              className="goon-select"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={handleSave}
              autoFocus
            >
              <option value="">Selecionar...</option>
              {options.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <input
              className="goon-input"
              type={type}
              min={min}
              max={max}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              autoFocus
              disabled={saving}
            />
          )}
        </div>
      ) : (
        <div
          onClick={() => { setDraft(value != null ? String(value) : ''); setEditing(true) }}
          style={{
            fontSize: 14,
            color: value != null && String(value) !== '' ? 'var(--goon-text-secondary)' : 'var(--goon-text-muted)',
            cursor: 'pointer',
            padding: '6px 8px',
            borderRadius: 6,
            border: '1px solid transparent',
            minHeight: 34,
            display: 'flex',
            alignItems: 'center',
            transition: 'border-color 0.15s ease, background 0.15s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--goon-border)'
            ;(e.currentTarget as HTMLDivElement).style.background = 'var(--goon-input-bg)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'
            ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
          }}
          title="Clique para editar"
        >
          {type === 'select' && options
            ? (options.find(o => o.value === displayValue)?.label ?? displayValue)
            : displayValue}
        </div>
      )}
    </div>
  )
}

// ---- Section wrapper ----
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="goon-card" style={{ padding: 24, marginBottom: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--goon-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 20px 0' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

// ---- Main Page ----
export default function ClientDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [client, setClient] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [changingStatus, setChangingStatus] = useState(false)

  const fetchClient = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<ClientDetail>(`/api/clients/${id}`)
      setClient(data)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar cliente')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchClient()
  }, [fetchClient])

  const handleSaveField = async (field: string, value: string) => {
    try {
      const payload: Record<string, unknown> = {}
      if (field === 'goonFitScore') {
        payload[field] = value === '' ? null : parseInt(value, 10)
      } else {
        payload[field] = value === '' ? null : value
      }
      const updated = await apiFetch<ClientDetail>(`/api/clients/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      setClient(updated)
      toast.success('Campo atualizado')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
      throw err
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!client || newStatus === client.status) return
    setChangingStatus(true)
    try {
      const updated = await apiFetch<ClientDetail>(`/api/clients/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      })
      setClient(updated)
      toast.success(`Status alterado para ${statusLabel(newStatus)}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao alterar status')
    } finally {
      setChangingStatus(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <div style={{
          width: 36,
          height: 36,
          border: '3px solid var(--goon-border)',
          borderTopColor: 'var(--goon-primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    )
  }

  if (!client) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--goon-text-muted)' }}>
        <p>Cliente não encontrado.</p>
        <button className="goon-btn-ghost" onClick={() => router.push('/clients')} style={{ marginTop: 16 }}>
          ← Voltar
        </button>
      </div>
    )
  }

  const fieldGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 20,
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          className="goon-btn-ghost"
          onClick={() => router.push('/clients')}
          style={{ marginBottom: 16, padding: '6px 14px', fontSize: 13 }}
        >
          ← Clientes
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--goon-text-primary)', margin: '0 0 6px 0' }}>
              {client.companyName}
            </h1>
            {client.tradeName && (
              <p style={{ fontSize: 14, color: 'var(--goon-text-muted)', margin: 0 }}>{client.tradeName}</p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Status dropdown */}
            <div style={{ position: 'relative' }}>
              <select
                className="goon-select"
                value={client.status}
                onChange={e => handleStatusChange(e.target.value)}
                disabled={changingStatus}
                style={{ paddingLeft: 12, paddingRight: 32, fontSize: 13, width: 'auto', cursor: 'pointer' }}
              >
                <option value="ACTIVE">Ativo</option>
                <option value="PROSPECT">Prospect</option>
                <option value="INACTIVE">Inativo</option>
              </select>
            </div>

            {/* WhatsApp */}
            {(client.whatsapp ?? client.phone) && (
              <a
                href={`https://wa.me/${(client.whatsapp ?? client.phone ?? '').replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="goon-btn-ghost"
                style={{ padding: '8px 14px', fontSize: 13, textDecoration: 'none' }}
              >
                💬 WhatsApp
              </a>
            )}

            {/* Email */}
            {client.email && (
              <a
                href={`mailto:${client.email}`}
                className="goon-btn-ghost"
                style={{ padding: '8px 14px', fontSize: 13, textDecoration: 'none' }}
              >
                ✉️ E-mail
              </a>
            )}
          </div>
        </div>

        {/* Status badge display */}
        <div style={{ marginTop: 12 }}>
          <span className={statusClass(client.status)}>{statusLabel(client.status)}</span>
        </div>
      </div>

      {/* Info Section */}
      <Section title="Informações Gerais">
        <div style={fieldGrid}>
          <InlineField label="Empresa" value={client.companyName} field="companyName" onSave={handleSaveField} />
          <InlineField label="Nome Fantasia" value={client.tradeName} field="tradeName" onSave={handleSaveField} />
          <InlineField label="CNPJ" value={client.cnpj} field="cnpj" onSave={handleSaveField} />
          <InlineField label="Responsável" value={client.responsible} field="responsible" onSave={handleSaveField} />
          <InlineField label="Telefone" value={client.phone} field="phone" type="tel" onSave={handleSaveField} />
          <InlineField label="E-mail" value={client.email} field="email" type="email" onSave={handleSaveField} />
          <InlineField label="WhatsApp" value={client.whatsapp} field="whatsapp" type="tel" onSave={handleSaveField} />
          <InlineField label="Segmento" value={client.segment} field="segment" onSave={handleSaveField} />
        </div>

        <hr className="goon-divider" style={{ margin: '20px 0' }} />
        <p className="goon-label" style={{ marginBottom: 16 }}>Endereço</p>
        <div style={fieldGrid}>
          <InlineField label="Logradouro" value={client.address} field="address" onSave={handleSaveField} />
          <InlineField label="Número" value={client.addressNumber} field="addressNumber" onSave={handleSaveField} />
          <InlineField label="Bairro" value={client.neighborhood} field="neighborhood" onSave={handleSaveField} />
          <InlineField label="Cidade" value={client.city} field="city" onSave={handleSaveField} />
          <InlineField label="Estado" value={client.state} field="state" onSave={handleSaveField} />
          <InlineField label="CEP" value={client.zipCode} field="zipCode" onSave={handleSaveField} />
        </div>

        <hr className="goon-divider" style={{ margin: '20px 0' }} />
        <p className="goon-label" style={{ marginBottom: 16 }}>Dados Comerciais</p>
        <div style={fieldGrid}>
          <InlineField label="Nº de Funcionários" value={client.employeeCount} field="employeeCount" onSave={handleSaveField} />
          <InlineField label="Faturamento Estimado" value={client.estimatedRevenue} field="estimatedRevenue" onSave={handleSaveField} />
        </div>
      </Section>

      {/* Strategic Section */}
      <Section title="Dados Estratégicos">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <InlineField label="Principais Dores" value={client.mainPains} field="mainPains" type="textarea" onSave={handleSaveField} />
          <InlineField label="Objetivos Estratégicos" value={client.strategicGoals} field="strategicGoals" type="textarea" onSave={handleSaveField} />
          <div style={fieldGrid}>
            <InlineField
              label="Maturidade"
              value={client.maturity}
              field="maturity"
              type="select"
              options={[
                { value: 'LOW', label: 'Baixa' },
                { value: 'MEDIUM', label: 'Média' },
                { value: 'HIGH', label: 'Alta' },
              ]}
              onSave={handleSaveField}
            />
            <InlineField
              label="Goon Fit Score (1-10)"
              value={client.goonFitScore}
              field="goonFitScore"
              type="number"
              min={1}
              max={10}
              onSave={handleSaveField}
            />
          </div>
        </div>
      </Section>

      {/* Plans Section */}
      <Section title="Planos">
        {client.plans.length === 0 ? (
          <p style={{ color: 'var(--goon-text-muted)', fontSize: 14 }}>Nenhum plano vinculado ainda.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {client.plans.map(plan => (
              <div
                key={plan.id}
                style={{
                  padding: '14px 16px',
                  background: 'var(--goon-input-bg)',
                  borderRadius: 8,
                  border: '1px solid var(--goon-border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--goon-text-primary)', fontSize: 14 }}>
                    {plan.product.code} — {plan.product.name}
                  </span>
                  <div style={{ fontSize: 13, color: 'var(--goon-text-muted)', marginTop: 4 }}>
                    {plan.paymentType} · Início: {new Date(plan.startDate).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: 'var(--goon-text-primary)', fontSize: 15 }}>
                    R$ {Number(plan.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className={statusClass(plan.status)}>{statusLabel(plan.status)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <button className="goon-btn-ghost" disabled style={{ marginTop: 16, opacity: 0.4, cursor: 'not-allowed' }}>
          + Adicionar Plano
        </button>
      </Section>

      {/* Contracts Section */}
      <Section title="Contratos">
        {client.contracts.length === 0 ? (
          <p style={{ color: 'var(--goon-text-muted)', fontSize: 14 }}>Nenhum contrato gerado ainda.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {client.contracts.map(contract => (
              <div
                key={contract.id}
                style={{
                  padding: '12px 16px',
                  background: 'var(--goon-input-bg)',
                  borderRadius: 8,
                  border: '1px solid var(--goon-border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--goon-text-primary)', fontSize: 14 }}>{contract.templateType}</span>
                  <div style={{ fontSize: 12, color: 'var(--goon-text-muted)', marginTop: 2 }}>
                    {new Date(contract.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <span className={statusClass(contract.status)}>{statusLabel(contract.status)}</span>
              </div>
            ))}
          </div>
        )}
        <button className="goon-btn-ghost" disabled style={{ marginTop: 16, opacity: 0.4, cursor: 'not-allowed' }}>
          + Gerar Contrato
        </button>
      </Section>

      {/* Onboarding Section */}
      <Section title="Onboarding">
        {client.onboarding ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ fontSize: 13, color: 'var(--goon-text-muted)', margin: '0 0 6px 0' }}>Etapa atual</p>
              <span className="goon-badge goon-badge-primary">
                {onboardingStageLabel(client.onboarding.currentStage)}
              </span>
            </div>
            <button className="goon-btn-ghost" disabled style={{ opacity: 0.4, cursor: 'not-allowed' }}>
              Ver no Kanban
            </button>
          </div>
        ) : (
          <p style={{ color: 'var(--goon-text-muted)', fontSize: 14 }}>Sem onboarding registrado.</p>
        )}
      </Section>

      {/* Activity Log */}
      <Section title="Histórico de Atividades">
        {client.activityLogs.length === 0 ? (
          <p style={{ color: 'var(--goon-text-muted)', fontSize: 14 }}>Nenhuma atividade registrada.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {client.activityLogs.map(log => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: '1px solid var(--goon-border-subtle)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--goon-text-secondary)' }}>
                    {log.description ?? log.action}
                  </div>
                  {log.fromValue && log.toValue && (
                    <div style={{ fontSize: 12, color: 'var(--goon-text-muted)', marginTop: 3 }}>
                      {log.fromValue} → {log.toValue}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--goon-text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {relativeTime(log.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
