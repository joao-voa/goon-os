'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { ONBOARDING_STAGES, STAGE_LABELS, STAGE_COLORS, PRODUCT_COLORS } from '@/lib/constants'
import dynamic from 'next/dynamic'
import type { OnboardingItem } from '@/components/KanbanBoard'
import KanbanListView from '@/components/KanbanListView'

// Lazy load KanbanBoard to avoid SSR issues with @dnd-kit
const KanbanBoard = dynamic(() => import('@/components/KanbanBoard'), { ssr: false })

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
    ? (item.productCode === 'GE' ? 'var(--retro-blue)' : item.productCode === 'GI' ? 'var(--success)' : 'var(--warning)')
    : null
  const currentColor = STAGE_COLORS[item.currentStage] ?? '#888'

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
        background: 'rgba(0,0,0,0.6)',
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
          background: 'white',
          border: '2px solid black',
          boxShadow: '8px 8px 0px 0px #000',
          width: '100%',
          maxWidth: 480,
          position: 'relative',
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
          <span>Onboarding</span>
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
          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <h2
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 16,
                  fontWeight: 700,
                  color: 'black',
                  margin: 0,
                  flex: 1,
                  textTransform: 'uppercase',
                }}
              >
                {item.client.companyName}
              </h2>
              {productColor && item.productCode && (
                <span
                  style={{
                    background: productColor,
                    color: 'white',
                    border: '1px solid black',
                    boxShadow: '1px 1px 0 black',
                    padding: '2px 8px',
                    fontFamily: 'var(--font-pixel)',
                    fontSize: 9,
                    fontWeight: 700,
                  }}
                >
                  {item.productCode}
                </span>
              )}
            </div>
            <p style={{ fontFamily: 'var(--font-mono)', margin: 0, fontSize: 12, color: '#555' }}>
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
              style={{ marginBottom: 20, display: 'inline-flex', textDecoration: 'none', background: 'var(--success)', color: 'white' }}
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
                  background: 'var(--retro-gray)',
                  border: `2px solid black`,
                  boxShadow: '2px 2px 0 black',
                  cursor: changing ? 'not-allowed' : 'pointer',
                  color: 'black',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  fontWeight: 700,
                  textAlign: 'left',
                  textTransform: 'uppercase',
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    background: currentColor,
                    border: '1px solid black',
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1 }}>{STAGE_LABELS[item.currentStage] ?? item.currentStage}</span>
                <span style={{ color: '#555', fontSize: 12 }}>{changing ? '...' : '▾'}</span>
              </button>

              {stageDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'white',
                    border: '2px solid black',
                    boxShadow: '4px 4px 0 black',
                    zIndex: 100,
                    marginTop: 2,
                    overflow: 'hidden',
                    maxHeight: 300,
                    overflowY: 'auto',
                  }}
                >
                  {ONBOARDING_STAGES.map((stage) => {
                    const c = STAGE_COLORS[stage] ?? '#888'
                    const isCurrent = stage === item.currentStage
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
                          background: isCurrent ? 'var(--retro-blue)' : 'transparent',
                          border: 'none',
                          borderBottom: '1px solid black',
                          cursor: 'pointer',
                          color: isCurrent ? 'white' : 'black',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                          fontWeight: 700,
                          textAlign: 'left',
                          textTransform: 'uppercase',
                        }}
                        onMouseEnter={e => {
                          if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.background = 'var(--retro-gray)'
                        }}
                        onMouseLeave={e => {
                          if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                        }}
                      >
                        <span
                          style={{ width: 8, height: 8, background: c, border: '1px solid rgba(0,0,0,0.4)', flexShrink: 0 }}
                        />
                        <span style={{ flex: 1 }}>{STAGE_LABELS[stage] ?? stage}</span>
                        {isCurrent && (
                          <span style={{ fontSize: 12, fontWeight: 700 }}>✓</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div style={{ display: 'flex', gap: 10, borderTop: '2px solid black', paddingTop: 16 }}>
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
              fontFamily: 'var(--font-pixel)',
              fontSize: 14,
              fontWeight: 700,
              color: 'black',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            Onboarding
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555', margin: '4px 0 0 0' }}>
            {'>'} {items.length} cliente{items.length !== 1 ? 's' : ''} em processo
          </p>
        </div>
      </div>

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
            width: 32,
            height: 32,
            border: '3px solid black',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>
            Carregando...
          </span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div
          style={{
            padding: 16,
            background: '#fff0f0',
            border: '2px solid var(--danger)',
            boxShadow: '4px 4px 0 var(--danger)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--danger)',
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}
        >
          [ERRO] {error}
          <button
            onClick={loadData}
            className="goon-btn-danger"
            style={{ fontSize: 10, padding: '4px 10px' }}
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
