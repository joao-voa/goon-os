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

  const productColor = item.productCode ? (PRODUCT_COLORS[item.productCode] ?? '#888') : null
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
          background: 'var(--goon-card-bg)',
          border: '1px solid var(--goon-border)',
          borderRadius: 12,
          padding: 24,
          width: '100%',
          maxWidth: 480,
          position: 'relative',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'transparent',
            border: 'none',
            color: 'var(--goon-text-muted)',
            cursor: 'pointer',
            fontSize: 20,
            lineHeight: 1,
            padding: 4,
          }}
        >
          ×
        </button>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--goon-text-primary)',
                margin: 0,
                flex: 1,
              }}
            >
              {item.client.companyName}
            </h2>
            {productColor && item.productCode && (
              <span
                style={{
                  background: productColor + '22',
                  color: productColor,
                  border: `1px solid ${productColor}55`,
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {item.productCode}
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--goon-text-secondary)' }}>
            {item.client.responsible}
          </p>
        </div>

        {/* WhatsApp button */}
        {item.client.phone && (
          <a
            href={`https://wa.me/${item.client.phone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: '#22c55e',
              color: '#fff',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              marginBottom: 20,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            WhatsApp
          </a>
        )}

        {/* Stage dropdown */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, color: 'var(--goon-text-muted)', margin: '0 0 8px 0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Etapa Atual
          </p>
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
                background: 'var(--goon-bg)',
                border: `2px solid ${currentColor}`,
                borderRadius: 8,
                cursor: changing ? 'not-allowed' : 'pointer',
                color: 'var(--goon-text-primary)',
                fontSize: 14,
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
              <span style={{ color: 'var(--goon-text-muted)', fontSize: 12 }}>{changing ? '...' : '▾'}</span>
            </button>

            {stageDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'var(--goon-card-bg)',
                  border: '1px solid var(--goon-border)',
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  zIndex: 100,
                  marginTop: 4,
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
                        background: isCurrent ? c + '15' : 'transparent',
                        border: 'none',
                        borderBottom: '1px solid var(--goon-border-subtle)',
                        cursor: 'pointer',
                        color: 'var(--goon-text-primary)',
                        fontSize: 13,
                        textAlign: 'left',
                      }}
                    >
                      <span
                        style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }}
                      />
                      <span style={{ flex: 1 }}>{STAGE_LABELS[stage] ?? stage}</span>
                      {isCurrent && (
                        <span style={{ color: c, fontSize: 14 }}>✓</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <a
            href={`/clients/${item.clientId}`}
            style={{
              flex: 1,
              display: 'block',
              padding: '10px 16px',
              background: 'var(--goon-primary)',
              color: '#fff',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              textAlign: 'center',
            }}
          >
            Ver Cliente
          </a>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: 'transparent',
              border: '1px solid var(--goon-border)',
              borderRadius: 8,
              color: 'var(--goon-text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Fechar
          </button>
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

    // Optimistic update
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, currentStage: toStage } : item)),
    )
    // Also update selected item if open
    setSelectedItem((prev) => (prev && prev.id === id ? { ...prev, currentStage: toStage } : prev))

    try {
      await apiFetch(`/api/onboarding/${id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ toStage }),
      })
      toast.success(`Etapa atualizada → ${STAGE_LABELS[toStage] ?? toStage}`)
    } catch {
      toast.error('Erro ao mudar etapa')
      loadData()
    }
  }

  function handleCardClick(item: OnboardingItem) {
    setSelectedItem(item)
  }

  // Sync selected item when items change (optimistic update)
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
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--goon-text-primary)',
            margin: 0,
          }}
        >
          Onboarding
        </h1>
        <span style={{ fontSize: 13, color: 'var(--goon-text-muted)' }}>
          {items.length} cliente{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Loading */}
      {loading && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '60px 0',
            color: 'var(--goon-text-muted)',
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ animation: 'spin 1s linear infinite' }}
          >
            <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25" />
            <path d="M21 12a9 9 0 00-9-9" />
          </svg>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div
          style={{
            padding: 16,
            background: '#ef444422',
            border: '1px solid #ef4444',
            borderRadius: 8,
            color: '#ef4444',
            fontSize: 14,
          }}
        >
          {error}
          <button
            onClick={loadData}
            style={{
              marginLeft: 12,
              background: 'transparent',
              border: '1px solid #ef4444',
              borderRadius: 6,
              padding: '4px 10px',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: 12,
            }}
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
