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
      toast.success('Produto atualizado')
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar produto')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="goon-card"
        style={{ width: '100%', maxWidth: 440, padding: 28 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--goon-text-primary)', margin: 0 }}>
            Editar Produto
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
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
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="goon-label" style={{ display: 'block', marginBottom: 6 }}>Nome</label>
            <input
              className="goon-input"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label className="goon-label" style={{ display: 'block', marginBottom: 6 }}>Descrição</label>
            <textarea
              className="goon-textarea"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="goon-btn-ghost" onClick={onClose} disabled={saving}>
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
}

function ProductCard({ product, onEdit, onToggleActive }: ProductCardProps) {
  const color = PRODUCT_COLORS[product.code] ?? '#6b7280'

  return (
    <div
      className="goon-card"
      style={{
        padding: 24,
        cursor: 'pointer',
        transition: 'box-shadow 0.15s ease, transform 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
      onClick={() => onEdit(product)}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)'
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = ''
        ;(e.currentTarget as HTMLDivElement).style.transform = ''
      }}
    >
      {/* Code badge */}
      <div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: 12,
            background: `${color}22`,
            color,
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: '0.05em',
          }}
        >
          {product.code}
        </span>
      </div>

      {/* Name & Description */}
      <div style={{ flex: 1 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--goon-text-primary)', margin: '0 0 6px 0' }}>
          {product.name}
        </h3>
        {product.description ? (
          <p style={{ fontSize: 13, color: 'var(--goon-text-muted)', margin: 0, lineHeight: 1.5 }}>
            {product.description}
          </p>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--goon-text-muted)', margin: 0, fontStyle: 'italic' }}>
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
          paddingTop: 12,
          borderTop: '1px solid var(--goon-border-subtle)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <span style={{ fontSize: 13, color: 'var(--goon-text-muted)' }}>
          {product._count.plans} {product._count.plans === 1 ? 'cliente ativo' : 'clientes ativos'}
        </span>

        <label
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          title={product.isActive ? 'Desativar produto' : 'Ativar produto'}
        >
          <span style={{ fontSize: 12, color: product.isActive ? 'var(--goon-success)' : 'var(--goon-text-muted)' }}>
            {product.isActive ? 'Ativo' : 'Inativo'}
          </span>
          <div
            onClick={() => onToggleActive(product)}
            style={{
              width: 36,
              height: 20,
              borderRadius: 10,
              background: product.isActive ? color : 'var(--goon-border)',
              position: 'relative',
              cursor: 'pointer',
              transition: 'background 0.2s ease',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 2,
                left: product.isActive ? 18 : 2,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            />
          </div>
        </label>
      </div>
    </div>
  )
}

// ---- Main Page ----
export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<Product[]>('/api/products')
      setProducts(data)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar produtos')
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
      toast.success(updated.isActive ? 'Produto ativado' : 'Produto desativado')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar produto')
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
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--goon-text-primary)', margin: '0 0 6px 0' }}>
          Produtos
        </h1>
        <p style={{ fontSize: 14, color: 'var(--goon-text-muted)', margin: 0 }}>
          Gerencie os produtos GOON disponíveis para seus clientes
        </p>
      </div>

      {/* Products grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
          <div
            style={{
              width: 36,
              height: 36,
              border: '3px solid var(--goon-border)',
              borderTopColor: 'var(--goon-primary)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 20,
          }}
        >
          {products.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={setEditingProduct}
              onToggleActive={handleToggleActive}
            />
          ))}
        </div>
      )}

      {products.length === 0 && !loading && (
        <div
          className="goon-card"
          style={{ padding: 48, textAlign: 'center', color: 'var(--goon-text-muted)' }}
        >
          <p style={{ fontSize: 14 }}>Nenhum produto cadastrado.</p>
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
