'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { ONBOARDING_STAGES, STAGE_LABELS, STAGE_COLORS, PRODUCT_COLORS } from '@/lib/constants'
import dynamic from 'next/dynamic'
import type { OnboardingItem } from '@/components/KanbanBoard'
import KanbanListView from '@/components/KanbanListView'

// Lazy load KanbanBoard to avoid SSR issues with @dnd-kit
const KanbanBoard = dynamic(() => import('@/components/KanbanBoard'), { ssr: false })

const C = {
  ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0', bg: '#f8fafc',
  neon: '#C7F900', green: '#16a34a', red: '#dc2626', amber: '#f59e0b', slate: '#475569',
}
const num: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }

// ---- Modal ----
interface DetailModalProps {
  item: OnboardingItem
  onClose: () => void
  onStageChange: (id: string, toStage: string) => Promise<void>
}

function DetailModal({ item, onClose, onStageChange }: DetailModalProps) {
  const [stageDropdownOpen, setStageDropdownOpen] = useState(false)
  const [changing, setChanging] = useState(false)

  const productColor = item.productCode
    ? (PRODUCT_COLORS[item.productCode] ?? C.slate)
    : null
  const currentColor = STAGE_COLORS[item.currentStage] ?? C.dim

  async function handleStageSelect(toStage: string) {
    if (toStage === item.currentStage) {
      setStageDropdownOpen(false)
      return
    }
    if (toStage === 'ONBOARDING_DONE') {
      if (!window.confirm('Finalizar onboarding? Esta é a etapa final.')) {
        setStageDropdownOpen(false)
        return
      }
    }
    setStageDropdownOpen(false)
    setChanging(true)
    try {
      await onStageChange(item.id, toStage)
    } finally {
      setChanging(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: '#fff',
          border: `1px solid ${C.line}`,
          borderRadius: 12,
          boxShadow: '0 20px 40px -12px rgba(15,23,42,0.25)',
          width: '100%',
          maxWidth: 480,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Modal header */}
        <div style={{
          background: '#fff',
          color: C.ink,
          borderBottom: `1px solid ${C.line}`,
          fontFamily: 'var(--font-sans)',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontWeight: 600,
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ color: C.mid }}>Onboarding</span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: C.dim,
              cursor: 'pointer',
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-sans)',
              fontSize: 18,
              lineHeight: 1,
              borderRadius: 6,
            }}
          >×</button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: C.ink,
                  margin: 0,
                  flex: 1,
                }}
              >
                {item.client.companyName}
              </h2>
              {productColor && item.productCode && (
                <span
                  style={{
                    background: productColor,
                    color: '#fff',
                    borderRadius: 6,
                    padding: '3px 9px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                  }}
                >
                  {item.productCode}
                </span>
              )}
            </div>
            <p style={{ fontFamily: 'var(--font-sans)', margin: 0, fontSize: 13, color: C.mid }}>
              {item.client.responsible}
            </p>
          </div>

          {/* WhatsApp button */}
          {item.client.phone && (
            <a
              href={`https://wa.me/${item.client.phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="goon-btn-secondary"
              style={{ marginBottom: 20, display: 'inline-flex', textDecoration: 'none', background: C.green, color: 'white', borderColor: C.green }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp
            </a>
          )}

          {/* Stage dropdown */}
          <div style={{ marginBottom: 20 }}>
            <label className="goon-label" style={{ marginBottom: 8 }}>Etapa Atual</label>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setStageDropdownOpen((o) => !o)}
                disabled={changing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 14px',
                  background: '#fff',
                  border: `1px solid ${C.line}`,
                  borderRadius: 8,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  cursor: changing ? 'not-allowed' : 'pointer',
                  color: C.ink,
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: currentColor,
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1 }}>{STAGE_LABELS[item.currentStage] ?? item.currentStage}</span>
                <span style={{ color: C.dim, fontSize: 12 }}>{changing ? '...' : '▾'}</span>
              </button>

              {stageDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'white',
                    border: `1px solid ${C.line}`,
                    borderRadius: 8,
                    boxShadow: '0 8px 20px -6px rgba(15,23,42,0.18)',
                    zIndex: 100,
                    marginTop: 4,
                    overflow: 'hidden',
                    maxHeight: 300,
                    overflowY: 'auto',
                  }}
                >
                  {ONBOARDING_STAGES.map((stage) => {
                    const c = STAGE_COLORS[stage] ?? C.dim
                    const isCurrent = stage === item.currentStage
                    const isDone = stage === 'ONBOARDING_DONE'
                    return (
                      <button
                        key={stage}
                        onClick={() => handleStageSelect(stage)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          width: '100%',
                          padding: '10px 14px',
                          background: isCurrent ? (isDone ? 'rgba(199,249,0,0.18)' : C.bg) : 'transparent',
                          border: 'none',
                          borderBottom: `1px solid ${C.bg}`,
                          cursor: 'pointer',
                          color: C.ink,
                          fontFamily: 'var(--font-sans)',
                          fontSize: 13,
                          fontWeight: isCurrent ? 700 : 500,
                          textAlign: 'left',
                        }}
                        onMouseEnter={e => {
                          if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.background = C.bg
                        }}
                        onMouseLeave={e => {
                          if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                        }}
                      >
                        <span
                          style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }}
                        />
                        <span style={{ flex: 1 }}>{STAGE_LABELS[stage] ?? stage}</span>
                        {isCurrent && (
                          <span style={{ fontSize: 13, fontWeight: 700, color: isDone ? C.green : C.mid }}>✓</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div style={{ display: 'flex', gap: 10, borderTop: `1px solid ${C.line}`, paddingTop: 16 }}>
            <a
              href={`/clients/${item.clientId}`}
              className="goon-btn-primary"
              style={{ flex: 1, textDecoration: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            >
              Ver Cliente
            </a>
            <button
              onClick={onClose}
              className="goon-btn-secondary"
              style={{ flex: 1 }}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Page ----
export default function OnboardingPage() {
  const isMobile = useIsMobile()
  const [items, setItems] = useState<OnboardingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<OnboardingItem | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [clients, setClients] = useState<Array<{ id: string; companyName: string }>>([])
  const [newClientId, setNewClientId] = useState('')
  const [creating, setCreating] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiFetch<OnboardingItem[]>('/api/onboarding')
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar onboardings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    apiFetch<{ data: Array<{ id: string; companyName: string }> }>('/api/clients?limit=200')
      .then(res => setClients(res.data ?? []))
      .catch(() => {})
  }, [loadData])

  async function handleStageChange(id: string, toStage: string) {
    if (toStage === 'ONBOARDING_DONE') {
      if (!window.confirm('Finalizar onboarding? Esta é a etapa final.')) return
    }

    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, currentStage: toStage } : item)),
    )
    setSelectedItem((prev) => (prev && prev.id === id ? { ...prev, currentStage: toStage } : prev))

    try {
      await apiFetch(`/api/onboarding/${id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ toStage }),
      })
      toast.success(`[OK] Etapa → ${STAGE_LABELS[toStage] ?? toStage}`)
    } catch {
      toast.error('[ERRO] Falha ao mudar etapa')
      loadData()
    }
  }

  function handleCardClick(item: OnboardingItem) {
    setSelectedItem(item)
  }

  const currentSelected = selectedItem
    ? (items.find((i) => i.id === selectedItem.id) ?? selectedItem)
    : null

  return (
    <div style={{ padding: '0 0 40px 0' }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: C.ink,
              margin: 0,
            }}
          >
            Onboarding
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid, margin: '4px 0 0 0' }}>
            {items.length} cliente{items.length !== 1 ? 's' : ''} em processo
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{
          padding: '9px 16px', border: 'none', background: C.ink, color: 'white', borderRadius: 6,
          fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>+ Criar</button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}>
          <div style={{ background: 'white', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 20px 40px -12px rgba(15,23,42,0.25)', width: '100%', maxWidth: 400, overflow: 'hidden' }}>
            <div style={{ background: '#fff', color: C.mid, borderBottom: `1px solid ${C.line}`, padding: '14px 20px', fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Criar Onboarding</div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.mid, display: 'block', marginBottom: 6 }}>Cliente</label>
                <select value={newClientId} onChange={e => setNewClientId(e.target.value)} style={{ width: '100%', padding: '9px 10px', border: `1px solid ${C.line}`, borderRadius: 8, fontFamily: 'var(--font-sans)', fontSize: 13, color: C.ink }}>
                  <option value="">Selecione...</option>
                  {clients.filter(c => !items.some(i => i.clientId === c.id)).map(c => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowCreate(false)} style={{ flex: 1, padding: '10px', border: `1px solid ${C.line}`, borderRadius: 6, background: 'white', color: C.ink, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                <button disabled={creating || !newClientId} onClick={async () => {
                  setCreating(true)
                  try {
                    await apiFetch('/api/onboarding', { method: 'POST', body: JSON.stringify({ clientId: newClientId }) })
                    toast.success('Onboarding criado!')
                    setShowCreate(false)
                    setNewClientId('')
                    loadData()
                  } catch { toast.error('Erro ao criar. Cliente ja pode ter onboarding.') }
                  setCreating(false)
                }} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 6, background: (creating || !newClientId) ? '#cbd5e1' : C.ink, color: 'white', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: creating ? 'wait' : (!newClientId ? 'not-allowed' : 'pointer') }}>
                  {creating ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '60px 0',
            gap: 12,
          }}
        >
          <div style={{
            width: 28,
            height: 28,
            border: `2px solid ${C.line}`,
            borderTopColor: C.neon,
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid }}>
            Carregando...
          </span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div
          style={{
            padding: 16,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 12,
            fontFamily: 'var(--font-sans)',
            color: C.red,
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}
        >
          {error}
          <button
            onClick={loadData}
            className="goon-btn-danger"
            style={{ fontSize: 11, padding: '6px 12px' }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Board / List */}
      {!loading && !error && (
        isMobile ? (
          <KanbanListView items={items} onCardClick={handleCardClick} />
        ) : (
          <KanbanBoard
            items={items}
            onStageChange={handleStageChange}
            onCardClick={handleCardClick}
          />
        )
      )}

      {/* Detail modal */}
      {currentSelected && (
        <DetailModal
          item={currentSelected}
          onClose={() => setSelectedItem(null)}
          onStageChange={handleStageChange}
        />
      )}
    </div>
  )
}
