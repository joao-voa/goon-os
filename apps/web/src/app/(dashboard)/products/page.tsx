'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'

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
      toast.success('[OK] Produto atualizado')
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao salvar produto')
    } finally {
      setSaving(false)
    }
  }

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
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'white',
          border: '2px solid black',
          boxShadow: '8px 8px 0px 0px #000',
        }}
      >
        {/* Header */}
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
          <span>Editar Produto</span>
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

        <form onSubmit={handleSubmit} style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
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

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8, borderTop: '2px solid black', paddingTop: 16 }}>
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
}

function ProductCard({ product, onEdit, onToggleActive }: ProductCardProps) {
  const codeColors: Record<string, string> = {
    GE: 'var(--retro-blue)',
    GI: 'var(--success)',
    GS: 'var(--warning)',
  }
  const color = codeColors[product.code] ?? 'black'

  return (
    <div
      style={{
        background: 'white',
        border: '2px solid black',
        boxShadow: '6px 6px 0px 0px #000',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 0,
        overflow: 'hidden',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onClick={() => onEdit(product)}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translate(-2px, -2px)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '8px 8px 0px 0px #000'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = ''
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '6px 6px 0px 0px #000'
      }}
    >
      {/* Code header */}
      <div style={{
        background: color,
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '12px 12px',
      }}>
        <span style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 20,
          color: 'white',
          fontWeight: 900,
          letterSpacing: '0.05em',
        }}>
          {product.code}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'rgba(255,255,255,0.8)',
          fontWeight: 700,
          textTransform: 'uppercase',
        }}>
          {product.isActive ? '[ATIVO]' : '[INATIVO]'}
        </span>
      </div>

      <div style={{ padding: '0 24px 0 24px', flex: 1 }}>
        {/* Name & Description */}
        <h3 style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          fontWeight: 700,
          color: 'black',
          margin: '0 0 8px 0',
          textTransform: 'uppercase',
        }}>
          {product.name}
        </h3>
        {product.description ? (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555', margin: 0, lineHeight: 1.6 }}>
            {product.description}
          </p>
        ) : (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#888', margin: 0, fontStyle: 'italic' }}>
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
          padding: '12px 24px',
          borderTop: '2px solid black',
          background: 'var(--retro-gray)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'black', fontWeight: 700, textTransform: 'uppercase' }}>
          {product._count.plans} {product._count.plans === 1 ? 'cliente' : 'clientes'}
        </span>

        <button
          onClick={() => onToggleActive(product)}
          title={product.isActive ? 'Desativar produto' : 'Ativar produto'}
          style={{
            background: product.isActive ? 'var(--success)' : 'var(--retro-gray)',
            color: product.isActive ? 'white' : 'black',
            border: '2px solid black',
            boxShadow: '2px 2px 0 black',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            padding: '4px 10px',
            cursor: 'pointer',
            transition: 'transform 0.1s, box-shadow 0.1s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translate(1px, 1px)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '1px 1px 0 black'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = ''
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '2px 2px 0 black'
          }}
        >
          {product.isActive ? 'Desativar' : 'Ativar'}
        </button>
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
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao carregar produtos')
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
      toast.success(updated.isActive ? '[OK] Produto ativado' : '[OK] Produto desativado')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `[ERRO] ${err.message}` : '[ERRO] Erro ao atualizar produto')
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
        <h1 style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 14,
          fontWeight: 800,
          color: 'black',
          margin: '0 0 6px 0',
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}>
          Produtos
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555', margin: 0 }}>
          {'>'} Gerencie os produtos GOON disponíveis para seus clientes
        </p>
      </div>

      {/* Products grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
          <div
            style={{
              width: 36,
              height: 36,
              border: '3px solid black',
              borderTopColor: 'transparent',
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
          style={{
            background: 'white',
            border: '2px solid black',
            boxShadow: '4px 4px 0px 0px #000',
            padding: 48,
            textAlign: 'center',
          }}
        >
          <p style={{ fontFamily: 'var(--font-pixel)', fontSize: 11, color: 'black', textTransform: 'uppercase' }}>
            Nenhum produto cadastrado.
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
