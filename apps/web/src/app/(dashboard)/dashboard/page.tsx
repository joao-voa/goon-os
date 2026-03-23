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
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
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
        background: '#c8c8c8',
        border: '1px solid #aaa',
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
        background: 'white',
        border: '2px solid black',
        boxShadow: '4px 4px 0px 0px #000',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translate(-2px, -2px)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '6px 6px 0px 0px #000'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = ''
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '4px 4px 0px 0px #000'
      }}
    >
      {/* Accent left border */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: 4,
          background: accentColor,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          color: '#555',
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          {label}
        </span>
        <div
          style={{
            width: 36,
            height: 36,
            border: '2px solid black',
            background: 'var(--retro-gray)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'black',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>
      <span
        style={{
          fontFamily: 'var(--font-pixel)',
          color: 'black',
          fontSize: 16,
          lineHeight: 1.3,
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ---- Revenue Product Card ----
function RevenueProductCard({ code, value }: { code: string; value: number }) {
  const productNames: Record<string, string> = { GE: 'Gestão Empresarial', GI: 'Gestão Imobiliária', GS: 'Gestão de Saúde' }
  const colors: Record<string, string> = { GE: 'var(--retro-blue)', GI: 'var(--success)', GS: 'var(--warning)' }
  const color = colors[code] ?? 'black'

  return (
    <div
      style={{
        background: 'white',
        border: '2px solid black',
        boxShadow: '4px 4px 0px 0px #000',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translate(-2px, -2px)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '6px 6px 0px 0px #000'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = ''
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '4px 4px 0px 0px #000'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: color,
            color: 'white',
            border: '1px solid black',
            boxShadow: '1px 1px 0 black',
            padding: '2px 10px',
            fontFamily: 'var(--font-pixel)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.05em',
            width: 'fit-content',
          }}
        >
          {code}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 11 }}>{productNames[code]}</span>
      </div>
      <span style={{ fontFamily: 'var(--font-pixel)', color: 'black', fontSize: 13 }}>
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
        background: 'white',
        border: '2px solid black',
        boxShadow: '4px 4px 0px 0px #000',
        padding: '20px 24px',
        flex: 1,
        minWidth: 0,
      }}
    >
      <h3 style={{ fontFamily: 'var(--font-pixel)', color: 'black', fontSize: 10, margin: '0 0 16px 0', textTransform: 'uppercase' }}>
        Pipeline Onboarding
      </h3>
      {data.length === 0 ? (
        <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 12 }}>Nenhum onboarding ativo</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.map(item => {
            const color = STAGE_COLORS[item.stage] ?? '#888'
            const label = STAGE_LABELS[item.stage] ?? item.stage
            const pct = Math.round((item.count / maxCount) * 100)
            return (
              <div
                key={item.stage}
                style={{ cursor: 'pointer' }}
                onClick={() => router.push('/onboarding')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'black', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                    {label}
                  </span>
                  <span
                    style={{
                      background: 'black',
                      color: 'white',
                      border: '1px solid black',
                      padding: '1px 6px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {item.count}
                  </span>
                </div>
                <div style={{ height: 8, background: 'var(--retro-gray)', border: '1px solid black' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: 'black',
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
    { label: 'Rascunho', status: 'DRAFT', badgeClass: 'goon-badge goon-badge-draft' },
    { label: 'Enviado', status: 'SENT', badgeClass: 'goon-badge goon-badge-sent' },
    { label: 'Assinado', status: 'SIGNED', badgeClass: 'goon-badge goon-badge-signed' },
  ]
  return (
    <div
      style={{
        background: 'white',
        border: '2px solid black',
        boxShadow: '4px 4px 0px 0px #000',
        padding: '20px 24px',
        flex: '0 0 240px',
      }}
    >
      <h3 style={{ fontFamily: 'var(--font-pixel)', color: 'black', fontSize: 10, margin: '0 0 16px 0', textTransform: 'uppercase' }}>
        Contratos
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(item => (
          <div
            key={item.status}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              border: '2px solid black',
              background: 'var(--retro-gray)',
            }}
          >
            <span className={item.badgeClass}>{item.label}</span>
            <span style={{ fontFamily: 'var(--font-pixel)', color: 'black', fontSize: 16 }}>
              {getCount(item.status)}
            </span>
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
        background: 'white',
        border: '2px solid black',
        boxShadow: '4px 4px 0px 0px #000',
        padding: '20px 24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Activity size={16} color="black" />
        <h3 style={{ fontFamily: 'var(--font-pixel)', color: 'black', fontSize: 10, margin: 0, textTransform: 'uppercase' }}>
          Atividade Recente
        </h3>
      </div>
      {data.length === 0 ? (
        <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 12 }}>Nenhuma atividade registrada</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxHeight: 320, overflowY: 'auto' }}>
          {data.map((entry, idx) => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                padding: '8px 0',
                borderBottom: idx < data.length - 1 ? '1px solid black' : 'none',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'black',
                  fontWeight: 700,
                  flexShrink: 0,
                  marginTop: 2,
                }}>{'>'}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: 'black',
                      fontSize: 12,
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {entry.description}
                  </span>
                  {entry.client && (
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 10 }}>
                      {entry.client.companyName}
                    </span>
                  )}
                </div>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 10, flexShrink: 0, paddingTop: 2 }}>
                [{timeAgo(entry.createdAt)}]
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
              background: 'white',
              border: '2px solid black',
              boxShadow: '4px 4px 0px 0px #000',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <Skeleton height={10} width="60%" />
            <Skeleton height={24} width="40%" />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              background: 'white',
              border: '2px solid black',
              boxShadow: '4px 4px 0px 0px #000',
              padding: '16px 20px',
            }}
          >
            <Skeleton height={16} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap, flexDirection: isMobile ? 'column' : 'row' }}>
        <div style={{ flex: 1, background: 'white', border: '2px solid black', boxShadow: '4px 4px 0px 0px #000', padding: '20px 24px' }}>
          <Skeleton height={12} width="50%" />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2, 3].map(i => <Skeleton key={i} height={10} />)}
          </div>
        </div>
        <div style={{ flex: '0 0 240px', background: 'white', border: '2px solid black', boxShadow: '4px 4px 0px 0px #000', padding: '20px 24px' }}>
          <Skeleton height={12} width="60%" />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0, 1, 2].map(i => <Skeleton key={i} height={40} />)}
          </div>
        </div>
      </div>
      <div style={{ background: 'white', border: '2px solid black', boxShadow: '4px 4px 0px 0px #000', padding: '20px 24px' }}>
        <Skeleton height={12} width="40%" />
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
        <h1 style={{
          fontFamily: 'var(--font-pixel)',
          color: 'black',
          fontSize: isMobile ? 12 : 16,
          fontWeight: 700,
          margin: 0,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}>
          Dashboard
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 12, marginTop: 6, marginBottom: 0 }}>
          {'>'} Visão geral da operação
        </p>
      </div>

      {error && (
        <div
          style={{
            background: '#fff0f0',
            border: '2px solid var(--danger)',
            boxShadow: '4px 4px 0 var(--danger)',
            padding: '12px 16px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--danger)',
            fontSize: 12,
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          [ERRO] {error}
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
              value={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{stats.kpis.totalActiveClients}</span>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      background: 'var(--retro-green)',
                      border: '1px solid black',
                      borderRadius: '50%',
                      animation: 'pulse 2s ease-in-out infinite',
                    }}
                  />
                </div>
              }
              icon={<Building2 size={18} />}
              accentColor="var(--retro-blue)"
            />
            <KpiCard
              label="Novos este Mês"
              value={stats.kpis.newClientsThisMonth}
              icon={<UserPlus size={18} />}
              accentColor={stats.kpis.newClientsThisMonth > 0 ? "var(--retro-green)" : "var(--success)"}
            />
            <KpiCard
              label="Receita Total"
              value={fmtBRL(stats.kpis.totalRevenue)}
              icon={<DollarSign size={18} />}
              accentColor="var(--retro-green)"
            />
            <KpiCard
              label="Contratos Assinados"
              value={signedContracts}
              icon={<FileCheck size={18} />}
              accentColor="var(--success)"
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
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
