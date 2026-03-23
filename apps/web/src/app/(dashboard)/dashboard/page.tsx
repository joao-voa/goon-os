'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, UserPlus, DollarSign, FileCheck, Activity } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { STAGE_LABELS, STAGE_COLORS, PRODUCT_COLORS } from '@/lib/constants'

// ---- Types ----
interface RevenueByProduct {
  GE: number
  GI: number
  GS: number
}

interface KPIs {
  totalActiveClients: number
  newClientsThisMonth: number
  totalRevenue: number
  revenueByProduct: RevenueByProduct
}

interface PipelineStage {
  stage: string
  count: number
}

interface ContractStatusItem {
  status: string
  count: number
}

interface ActivityEntry {
  id: string
  description: string
  createdAt: string
  action: string
  client?: { id: string; companyName: string } | null
}

interface DashboardStats {
  kpis: KPIs
  pipelineSummary: PipelineStage[]
  contractsStatus: ContractStatusItem[]
  recentActivity: ActivityEntry[]
}

// ---- Helpers ----
function timeAgo(date: string): string {
  const now = Date.now()
  const diff = now - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `há ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  return `há ${days}d`
}

const fmtBRL = (n?: number | null) =>
  n != null
    ? new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
      }).format(n)
    : 'R$ 0'

// ---- Skeleton ----
function Skeleton({ width, height }: { width?: string | number; height?: string | number }) {
  return (
    <div
      style={{
        width: width ?? '100%',
        height: height ?? 16,
        borderRadius: 6,
        background: 'var(--goon-border)',
        opacity: 0.5,
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  )
}

// ---- KPI Card ----
interface KpiCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  accentColor: string
}

function KpiCard({ label, value, icon, accentColor }: KpiCardProps) {
  return (
    <div
      style={{
        background: 'var(--goon-dark-card)',
        border: '1px solid var(--goon-border)',
        borderRadius: 12,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Accent top border */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: accentColor,
          borderRadius: '12px 12px 0 0',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ color: 'var(--goon-text-muted)', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: `${accentColor}1a`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accentColor,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>
      <span
        style={{
          color: 'var(--goon-text-primary)',
          fontSize: 28,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ---- Revenue Product Card ----
function RevenueProductCard({ code, value }: { code: string; value: number }) {
  const color = PRODUCT_COLORS[code] ?? '#6b7280'
  const productNames: Record<string, string> = { GE: 'Gestão Empresarial', GI: 'Gestão Imobiliária', GS: 'Gestão de Saúde' }
  return (
    <div
      style={{
        background: 'var(--goon-dark-card)',
        border: '1px solid var(--goon-border)',
        borderRadius: 10,
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: `${color}22`,
            color,
            borderRadius: 6,
            padding: '2px 10px',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.05em',
            width: 'fit-content',
          }}
        >
          {code}
        </span>
        <span style={{ color: 'var(--goon-text-muted)', fontSize: 12 }}>{productNames[code]}</span>
      </div>
      <span style={{ color: 'var(--goon-text-primary)', fontSize: 18, fontWeight: 700 }}>
        {fmtBRL(value)}
      </span>
    </div>
  )
}

// ---- Pipeline Summary ----
function PipelineSummary({ data }: { data: PipelineStage[] }) {
  const router = useRouter()
  const maxCount = Math.max(...data.map(d => d.count), 1)
  return (
    <div
      style={{
        background: 'var(--goon-dark-card)',
        border: '1px solid var(--goon-border)',
        borderRadius: 12,
        padding: '20px 24px',
        flex: 1,
        minWidth: 0,
      }}
    >
      <h3 style={{ color: 'var(--goon-text-primary)', fontSize: 14, fontWeight: 600, margin: '0 0 16px 0' }}>
        Pipeline de Onboarding
      </h3>
      {data.length === 0 ? (
        <p style={{ color: 'var(--goon-text-muted)', fontSize: 13 }}>Nenhum onboarding ativo</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.map(item => {
            const color = STAGE_COLORS[item.stage] ?? '#6b7280'
            const label = STAGE_LABELS[item.stage] ?? item.stage
            const pct = Math.round((item.count / maxCount) * 100)
            return (
              <div
                key={item.stage}
                style={{ cursor: 'pointer' }}
                onClick={() => router.push('/onboarding')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ color: 'var(--goon-text-secondary)', fontSize: 12 }}>{label}</span>
                  </div>
                  <span
                    style={{
                      background: `${color}22`,
                      color,
                      borderRadius: 12,
                      padding: '1px 8px',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {item.count}
                  </span>
                </div>
                <div style={{ height: 4, background: 'var(--goon-border)', borderRadius: 4 }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: color,
                      borderRadius: 4,
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---- Contracts Status ----
function ContractsStatus({ data }: { data: ContractStatusItem[] }) {
  const getCount = (status: string) => data.find(d => d.status === status)?.count ?? 0
  const items = [
    { label: 'Rascunho', status: 'DRAFT', color: '#6b7280' },
    { label: 'Enviado', status: 'SENT', color: '#f59e0b' },
    { label: 'Assinado', status: 'SIGNED', color: '#10b981' },
  ]
  return (
    <div
      style={{
        background: 'var(--goon-dark-card)',
        border: '1px solid var(--goon-border)',
        borderRadius: 12,
        padding: '20px 24px',
        flex: '0 0 240px',
      }}
    >
      <h3 style={{ color: 'var(--goon-text-primary)', fontSize: 14, fontWeight: 600, margin: '0 0 16px 0' }}>
        Status de Contratos
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map(item => (
          <div
            key={item.status}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              background: `${item.color}10`,
              border: `1px solid ${item.color}33`,
              borderRadius: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
              <span style={{ color: 'var(--goon-text-secondary)', fontSize: 13 }}>{item.label}</span>
            </div>
            <span style={{ color: item.color, fontWeight: 700, fontSize: 20 }}>{getCount(item.status)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Recent Activity ----
function RecentActivity({ data }: { data: ActivityEntry[] }) {
  return (
    <div
      style={{
        background: 'var(--goon-dark-card)',
        border: '1px solid var(--goon-border)',
        borderRadius: 12,
        padding: '20px 24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Activity size={16} color="var(--goon-text-muted)" />
        <h3 style={{ color: 'var(--goon-text-primary)', fontSize: 14, fontWeight: 600, margin: 0 }}>
          Atividade Recente
        </h3>
      </div>
      {data.length === 0 ? (
        <p style={{ color: 'var(--goon-text-muted)', fontSize: 13 }}>Nenhuma atividade registrada</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxHeight: 320, overflowY: 'auto' }}>
          {data.map((entry, idx) => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                padding: '10px 0',
                borderBottom: idx < data.length - 1 ? '1px solid var(--goon-border)' : 'none',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: 'var(--goon-primary)',
                    flexShrink: 0,
                    marginTop: 5,
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span
                    style={{
                      color: 'var(--goon-text-secondary)',
                      fontSize: 13,
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {entry.description}
                  </span>
                  {entry.client && (
                    <span style={{ color: 'var(--goon-text-muted)', fontSize: 11 }}>
                      {entry.client.companyName}
                    </span>
                  )}
                </div>
              </div>
              <span style={{ color: 'var(--goon-text-muted)', fontSize: 11, flexShrink: 0, paddingTop: 2 }}>
                {timeAgo(entry.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Loading Skeleton Dashboard ----
function LoadingSkeleton({ isMobile }: { isMobile: boolean }) {
  const gap = isMobile ? 8 : 16
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
          gap,
        }}
      >
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              background: 'var(--goon-dark-card)',
              border: '1px solid var(--goon-border)',
              borderRadius: 12,
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <Skeleton height={12} width="60%" />
            <Skeleton height={28} width="40%" />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              background: 'var(--goon-dark-card)',
              border: '1px solid var(--goon-border)',
              borderRadius: 10,
              padding: '16px 20px',
            }}
          >
            <Skeleton height={16} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap, flexDirection: isMobile ? 'column' : 'row' }}>
        <div style={{ flex: 1, background: 'var(--goon-dark-card)', border: '1px solid var(--goon-border)', borderRadius: 12, padding: '20px 24px' }}>
          <Skeleton height={14} width="50%" />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2, 3].map(i => <Skeleton key={i} height={10} />)}
          </div>
        </div>
        <div style={{ flex: '0 0 240px', background: 'var(--goon-dark-card)', border: '1px solid var(--goon-border)', borderRadius: 12, padding: '20px 24px' }}>
          <Skeleton height={14} width="60%" />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0, 1, 2].map(i => <Skeleton key={i} height={40} />)}
          </div>
        </div>
      </div>
      <div style={{ background: 'var(--goon-dark-card)', border: '1px solid var(--goon-border)', borderRadius: 12, padding: '20px 24px' }}>
        <Skeleton height={14} width="40%" />
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} height={12} />)}
        </div>
      </div>
    </div>
  )
}

// ---- Main Page ----
export default function DashboardPage() {
  const isMobile = useIsMobile()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const gap = isMobile ? 8 : 16

  useEffect(() => {
    apiFetch<DashboardStats>('/api/dashboard')
      .then(data => {
        setStats(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message ?? 'Erro ao carregar dashboard')
        setLoading(false)
      })
  }, [])

  const signedContracts = stats?.contractsStatus.find(c => c.status === 'SIGNED')?.count ?? 0

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? 16 : 24 }}>
        <h1 style={{ color: 'var(--goon-text-primary)', fontSize: isMobile ? 18 : 22, fontWeight: 700, margin: 0 }}>
          Dashboard
        </h1>
        <p style={{ color: 'var(--goon-text-muted)', fontSize: 13, marginTop: 4, marginBottom: 0 }}>
          Visão geral da operação
        </p>
      </div>

      {error && (
        <div
          style={{
            background: '#ef444420',
            border: '1px solid #ef444444',
            borderRadius: 8,
            padding: '12px 16px',
            color: '#ef4444',
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton isMobile={isMobile} />
      ) : stats ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap }}>
          {/* KPI Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
              gap,
            }}
          >
            <KpiCard
              label="Clientes Ativos"
              value={stats.kpis.totalActiveClients}
              icon={<Building2 size={18} />}
              accentColor="var(--goon-primary)"
            />
            <KpiCard
              label="Novos este Mês"
              value={stats.kpis.newClientsThisMonth}
              icon={<UserPlus size={18} />}
              accentColor="#22c55e"
            />
            <KpiCard
              label="Receita Total"
              value={fmtBRL(stats.kpis.totalRevenue)}
              icon={<DollarSign size={18} />}
              accentColor="#f59e0b"
            />
            <KpiCard
              label="Contratos Assinados"
              value={signedContracts}
              icon={<FileCheck size={18} />}
              accentColor="#10b981"
            />
          </div>

          {/* Revenue by Product */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              gap,
            }}
          >
            {(['GE', 'GI', 'GS'] as const).map(code => (
              <RevenueProductCard
                key={code}
                code={code}
                value={stats.kpis.revenueByProduct[code] ?? 0}
              />
            ))}
          </div>

          {/* Pipeline + Contracts */}
          <div
            style={{
              display: 'flex',
              gap,
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: 'stretch',
            }}
          >
            <PipelineSummary data={stats.pipelineSummary} />
            <div style={isMobile ? {} : { flex: '0 0 240px' }}>
              <ContractsStatus data={stats.contractsStatus} />
            </div>
          </div>

          {/* Recent Activity */}
          <RecentActivity data={stats.recentActivity} />
        </div>
      ) : null}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}
