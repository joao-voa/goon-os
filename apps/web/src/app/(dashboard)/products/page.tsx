'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { PRODUCT_COLORS } from '@/lib/constants'

// ---- Palette ----
const C = { ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0', bg: '#f8fafc', neon: '#C7F900', green: '#16a34a', red: '#dc2626' }
const card: React.CSSProperties = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }

// ---- Types ----
interface Product {
  id: string
  code: string
  name: string
  description?: string | null
  isActive: boolean
  _count: {
    plans: number
  }
}

// ---- Edit Modal ----
interface EditModalProps {
  product: Product
  onClose: () => void
  onSaved: (updated: Product) => void
}

function EditModal({ product, onClose, onSaved }: EditModalProps) {
  const [name, setName] = useState(product.name)
  const [description, setDescription] = useState(product.description ?? '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await apiFetch<Product>(`/api/products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, description: description || null }),
      })
      onSaved(updated)
      toast.success('[OK] Programa atualizado')
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao salvar programa')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: '#fff',
          border: `1px solid ${C.line}`,
          borderRadius: 12,
          boxShadow: '0 20px 40px -12px rgba(0,0,0,0.18)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 22px',
          borderBottom: `1px solid ${C.line}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: C.ink }}>Editar Programa</span>
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
            }}
          >×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="goon-label">Nome</label>
            <input
              className="goon-input"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="goon-label">Descrição</label>
            <textarea
              className="goon-textarea"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4, borderTop: `1px solid ${C.line}`, paddingTop: 16 }}>
            <button type="button" className="goon-btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="goon-btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---- Product Card ----
interface ProductCardProps {
  product: Product
  onEdit: (product: Product) => void
  onToggleActive: (product: Product) => void
  onNavigate: (product: Product) => void
}

function ProductCard({ product, onEdit, onToggleActive, onNavigate }: ProductCardProps) {
  const color = PRODUCT_COLORS[product.code] ?? C.ink

  return (
    <div
      style={{
        ...card,
        borderLeft: `4px solid ${color}`,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onClick={() => onNavigate(product)}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 20px -6px rgba(0,0,0,0.12)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = ''
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = card.boxShadow as string
      }}
    >
      {/* Header: code + status */}
      <div style={{ padding: '16px 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 10px',
          borderRadius: 6,
          background: color,
          color: '#fff',
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: '0.04em',
        }}>
          {product.code}
        </span>
        <span className={product.isActive ? 'goon-badge goon-badge-active' : 'goon-badge goon-badge-inactive'}>
          {product.isActive ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      <div style={{ padding: '12px 18px 16px', flex: 1 }}>
        {/* Name & Description */}
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 16,
          fontWeight: 700,
          color: C.ink,
          margin: '0 0 6px 0',
          letterSpacing: '-0.01em',
        }}>
          {product.name}
        </h3>
        {product.description ? (
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid, margin: 0, lineHeight: 1.5 }}>
            {product.description}
          </p>
        ) : (
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.dim, margin: 0, fontStyle: 'italic' }}>
            Sem descrição
          </p>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 18px',
          borderTop: `1px solid ${C.line}`,
          background: C.bg,
        }}
        onClick={e => e.stopPropagation()}
      >
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: C.mid, fontWeight: 600 }}>
          {product._count.plans} {product._count.plans === 1 ? 'cliente' : 'clientes'}
        </span>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={e => { e.stopPropagation(); onEdit(product) }}
            title="Editar produto"
            style={{
              background: '#fff',
              color: C.ink,
              border: `1px solid ${C.line}`,
              borderRadius: 6,
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              fontWeight: 600,
              padding: '5px 12px',
              cursor: 'pointer',
            }}
          >
            Editar
          </button>
          <button
            onClick={() => onToggleActive(product)}
            title={product.isActive ? 'Desativar produto' : 'Ativar produto'}
            style={{
              background: product.isActive ? '#fff' : C.neon,
              color: product.isActive ? C.red : C.ink,
              border: product.isActive ? `1px solid ${C.line}` : 'none',
              borderRadius: 6,
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              fontWeight: product.isActive ? 600 : 700,
              padding: '5px 12px',
              cursor: 'pointer',
            }}
          >
            {product.isActive ? 'Desativar' : 'Ativar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Main Page ----
export default function ProductsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<Product[]>('/api/products')
      setProducts(data)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao carregar programas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const handleToggleActive = async (product: Product) => {
    try {
      const updated = await apiFetch<Product>(`/api/products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !product.isActive }),
      })
      setProducts(prev => prev.map(p => (p.id === updated.id ? { ...updated, _count: p._count } : p)))
      toast.success(updated.isActive ? '[OK] Programa ativado' : '[OK] Programa desativado')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao atualizar programa')
    }
  }

  const handleSaved = (updated: Product) => {
    setProducts(prev =>
      prev.map(p => (p.id === updated.id ? { ...updated, _count: p._count } : p)),
    )
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          fontWeight: 700,
          color: C.ink,
          margin: '0 0 4px 0',
          letterSpacing: '-0.02em',
        }}>
          Programas
        </h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid, margin: 0 }}>
          Gerencie os programas GOON disponíveis para seus clientes
        </p>
      </div>

      {/* Products grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: `2px solid ${C.line}`,
              borderTopColor: C.ink,
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
          }}
        >
          {products.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={setEditingProduct}
              onToggleActive={handleToggleActive}
              onNavigate={p => router.push(`/products/${p.id}`)}
            />
          ))}
        </div>
      )}

      {products.length === 0 && !loading && (
        <div style={{ ...card, padding: 48, textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid, margin: 0 }}>
            Nenhum programa cadastrado.
          </p>
        </div>
      )}

      {/* Edit Modal */}
      {editingProduct && (
        <EditModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
