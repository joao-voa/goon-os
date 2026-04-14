'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  FileText,
  AlertCircle,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { STAGE_LABELS, STAGE_COLORS, PRODUCT_COLORS, PRODUCT_NAMES } from '@/lib/constants'

// ── Types ────────────────────────────────────────────────────────────────────

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

interface FinancialKPIs {
  totalReceivedMonth: number
  totalReceivedAll: number
  toReceiveMonth: number
  totalPending: number
  totalOverdue: number
  overdueCount: number
  averageTicket: number
}

interface Pendencies {
  total: number
  contractUnsigned: number
  paymentOverdue: number
  renewalPending: number
}

interface RenewalClient {
  id: string
  companyName: string
  contractEndDate: string
  daysLeft: number
}

interface Renewals {
  count: number
  clients: RenewalClient[]
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

interface FinancialConsolidation {
  entradas: { receivedMonth: number; receivedAll: number; toReceiveMonth: number; pending: number; overdue: number }
  saidas: { pagoMes: number; previstoMes: number; expenses: number; commissions: number }
  netBalanceMonth: number
  projectedBalanceMonth: number
}

interface NegotiationLead {
  id: string
  companyName: string
  stage: string
  value: number
  salesRep: string | null
}

interface Negotiation {
  total: number
  count: number
  leads: NegotiationLead[]
}

interface DashboardStats {
  kpis: KPIs
  financialKpis: FinancialKPIs
  financialConsolidation?: FinancialConsolidation
  negotiation?: Negotiation
  pendencies: Pendencies
  renewals: Renewals
  pipelineSummary: PipelineStage[]
  contractsStatus: ContractStatusItem[]
  recentActivity: ActivityEntry[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `há ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours}h`
  return `há ${Math.floor(hours / 24)}d`
}

const fmtBRL = (n?: number | null) =>
  n != null
    ? new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
      }).format(n)
    : 'R$ 0'

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR')
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ width, height }: { width?: string | number; height?: string | number }) {
  return (
    <div
      className="goon-skeleton"
      style={{ width: width ?? '100%', height: height ?? 16 }}
    />
  )
}

function LoadingSkeleton({ isMobile }: { isMobile: boolean }) {
  const gap = isMobile ? 8 : 16
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {/* Alert placeholders */}
      <div style={{ display: 'flex', gap, flexWrap: 'wrap' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ flex: '1 1 200px', height: 64, background: '#c8c8c8', border: '2px solid black', boxShadow: '4px 4px 0 black' }} />
        ))}
      </div>
      {/* KPI row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ background: 'white', border: '2px solid black', boxShadow: '4px 4px 0 black', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton height={10} width="60%" />
            <Skeleton height={24} width="40%" />
          </div>
        ))}
      </div>
      {/* KPI row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ background: 'white', border: '2px solid black', boxShadow: '4px 4px 0 black', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton height={10} width="60%" />
            <Skeleton height={24} width="40%" />
          </div>
        ))}
      </div>
      {/* Pipeline + Contracts */}
      <div style={{ display: 'flex', gap, flexDirection: isMobile ? 'column' : 'row' }}>
        <div style={{ flex: 1, background: 'white', border: '2px solid black', boxShadow: '4px 4px 0 black', height: 200 }} />
        <div style={{ flex: '0 0 240px', background: 'white', border: '2px solid black', boxShadow: '4px 4px 0 black', height: 200 }} />
      </div>
      {/* Revenue by Product */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ background: 'white', border: '2px solid black', boxShadow: '4px 4px 0 black', padding: '16px 20px', height: 80 }} />
        ))}
      </div>
      {/* Activity */}
      <div style={{ background: 'white', border: '2px solid black', boxShadow: '4px 4px 0 black', padding: '20px 24px' }}>
        <Skeleton height={12} width="40%" />
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} height={12} />)}
        </div>
      </div>
    </div>
  )
}

// ── Alert Card ────────────────────────────────────────────────────────────────

interface AlertCardProps {
  icon: string
  count: number
  label: string
  bg: string
  href: string
  onDismiss: () => void
}

function AlertCard({ icon, count, label, bg, href, onDismiss }: AlertCardProps) {
  const router = useRouter()
  return (
    <div
      style={{
        background: bg,
        border: '2px solid black',
        boxShadow: '4px 4px 0 black',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        flex: '1 1 220px',
        position: 'relative',
        transition: 'transform 0.1s, box-shadow 0.1s',
      }}
      onClick={() => router.push(href)}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translate(-2px,-2px)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '6px 6px 0 black'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = ''
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '4px 4px 0 black'
      }}
    >
      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 14, color: 'white', flexShrink: 0 }}>
        {icon}
      </span>
      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 18, color: 'white', flexShrink: 0, lineHeight: 1 }}>
        {count}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'white', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>
        {label}
      </span>
      <button
        onClick={e => { e.stopPropagation(); onDismiss() }}
        style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.4)',
          color: 'white',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          fontWeight: 700,
          padding: '2px 8px',
          lineHeight: 1.4,
          flexShrink: 0,
        }}
        aria-label="Fechar"
      >
        ✕
      </button>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: React.ReactNode
  icon: React.ReactNode
  accentColor: string
  href?: string
}

function KpiCard({ label, value, icon, accentColor, href }: KpiCardProps) {
  const router = useRouter()
  return (
    <div
      style={{
        background: 'white',
        border: '2px solid black',
        boxShadow: '4px 4px 0 black',
        padding: '20px 20px 20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.15s, box-shadow 0.15s',
        cursor: href ? 'pointer' : 'default',
      }}
      onClick={href ? () => router.push(href) : undefined}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translate(-2px,-2px)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '6px 6px 0 black'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = ''
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '4px 4px 0 black'
      }}
    >
      {/* Colored left accent */}
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: accentColor }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </span>
        <div style={{ width: 34, height: 34, border: '2px solid black', background: 'var(--retro-gray)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
      </div>
      <span style={{ fontFamily: 'var(--font-pixel)', color: 'black', fontSize: 16, lineHeight: 1.3 }}>
        {value}
      </span>
    </div>
  )
}

// ── Renewal Section ───────────────────────────────────────────────────────────

function RenewalSection({ renewals, isMobile }: { renewals: Renewals; isMobile: boolean }) {
  const router = useRouter()
  if (renewals.count === 0) return null
  return (
    <div style={{ background: 'white', border: '2px solid black', boxShadow: '4px 4px 0 black' }}>
      <div
        className="goon-card-header"
        style={{ background: '#ff6600', backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '16px 16px' }}
      >
        ↺ CONTRATOS EM RENOVAÇÃO ({renewals.count})
      </div>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {renewals.clients.map(client => (
          <div
            key={client.id}
            style={{
              borderLeft: '4px solid #ff6600',
              paddingLeft: 14,
              paddingTop: 10,
              paddingBottom: 10,
              paddingRight: 14,
              border: '1px solid #ddd',
              borderLeftWidth: 4,
              borderLeftColor: '#ff6600',
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'flex-start' : 'center',
              gap: 10,
              background: '#fffdf9',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: 'black' }}>
                {client.companyName}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555' }}>
                Contrato vence em{' '}
                <strong style={{ color: client.daysLeft <= 7 ? '#cc0000' : '#ff6600' }}>{client.daysLeft} dias</strong>
                {' '}({fmtDate(client.contractEndDate)})
              </span>
            </div>
            <button
              className="goon-btn-secondary"
              style={{ fontSize: 10, padding: '8px 14px', whiteSpace: 'nowrap' }}
              onClick={() => router.push(`/clients/${client.id}`)}
            >
              CONTATAR
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Pipeline Summary ──────────────────────────────────────────────────────────

function PipelineSummary({ data }: { data: PipelineStage[] }) {
  const router = useRouter()
  const maxCount = Math.max(...data.map(d => d.count), 1)
  return (
    <div style={{ background: 'white', border: '2px solid black', boxShadow: '4px 4px 0 black', flex: 1, minWidth: 0 }}>
      <div className="goon-card-header">PIPELINE ONBOARDING</div>
      <div style={{ padding: '16px 20px' }}>
        {data.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 12 }}>Nenhum onboarding ativo</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.map(item => {
              const color = STAGE_COLORS[item.stage] ?? '#888'
              const label = STAGE_LABELS[item.stage] ?? item.stage
              const pct = Math.round((item.count / maxCount) * 100)
              return (
                <div key={item.stage} style={{ cursor: 'pointer' }} onClick={() => router.push('/onboarding')}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, background: color, border: '1px solid black', flexShrink: 0 }} />
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'black', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                        {label}
                      </span>
                    </div>
                    <span style={{ background: 'black', color: 'white', border: '1px solid black', padding: '1px 6px', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700 }}>
                      {item.count}
                    </span>
                  </div>
                  <div style={{ height: 8, background: 'var(--retro-gray)', border: '1px solid black' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Contracts Status ──────────────────────────────────────────────────────────

function ContractsStatus({ data }: { data: ContractStatusItem[] }) {
  const getCount = (status: string) => data.find(d => d.status === status)?.count ?? 0
  const items = [
    { label: 'Rascunho', status: 'DRAFT', color: '#c0c0c0', textColor: 'black' },
    { label: 'Enviado', status: 'SENT', color: '#000080', textColor: 'white' },
    { label: 'Assinado', status: 'SIGNED', color: '#006600', textColor: 'white' },
  ]
  return (
    <div style={{ background: 'white', border: '2px solid black', boxShadow: '4px 4px 0 black', flex: '0 0 240px' }}>
      <div className="goon-card-header">STATUS CONTRATOS</div>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(item => (
          <div
            key={item.status}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '2px solid black', background: 'var(--retro-gray)' }}
          >
            <span
              style={{ background: item.color, color: item.textColor, border: '1px solid black', boxShadow: '1px 1px 0 black', padding: '2px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}
            >
              {item.label}
            </span>
            <span style={{ fontFamily: 'var(--font-pixel)', color: 'black', fontSize: 16 }}>
              {getCount(item.status)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Revenue by Product ────────────────────────────────────────────────────────

function RevenueProductCard({ code, value }: { code: string; value: number }) {
  const router = useRouter()
  const color = PRODUCT_COLORS[code] ?? 'black'
  return (
    <div
      style={{
        background: 'white',
        border: '2px solid black',
        boxShadow: '4px 4px 0 black',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.15s, box-shadow 0.15s',
        cursor: 'pointer',
      }}
      onClick={() => router.push('/products')}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translate(-2px,-2px)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '6px 6px 0 black'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = ''
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '4px 4px 0 black'
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: color }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ background: color, color: 'white', border: '1px solid black', padding: '2px 10px', fontFamily: 'var(--font-pixel)', fontSize: 12, fontWeight: 700 }}>
          {code}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 11 }}>{PRODUCT_NAMES[code]}</span>
      </div>
      <span style={{ fontFamily: 'var(--font-pixel)', color: 'black', fontSize: 16, lineHeight: 1.3 }}>
        {fmtBRL(value)}
      </span>
    </div>
  )
}

// ── Recent Activity ───────────────────────────────────────────────────────────

function RecentActivity({ data }: { data: ActivityEntry[] }) {
  const router = useRouter()
  const sliced = data.slice(0, 10)
  return (
    <div style={{ background: 'white', border: '2px solid black', boxShadow: '4px 4px 0 black' }}>
      <div className="goon-card-header">ATIVIDADE RECENTE</div>
      <div style={{ padding: '16px 20px', maxHeight: 340, overflowY: 'auto' }}>
        {sliced.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 12 }}>Nenhuma atividade registrada</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {sliced.map((entry, idx) => (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  padding: '8px 0',
                  borderBottom: idx < sliced.length - 1 ? '1px solid #ddd' : 'none',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#006600', fontWeight: 700, flexShrink: 0, marginTop: 2 }}>{'>'}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'black', fontSize: 12, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.description}
                    </span>
                    {entry.client && (
                      <span
                        style={{ fontFamily: 'var(--font-mono)', color: 'var(--retro-blue)', fontSize: 10, cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => router.push(`/clients/${entry.client!.id}`)}
                      >
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
            {/* Blinking cursor */}
            <div style={{ paddingTop: 8 }}>
              <span
                style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'black', animation: 'blink 1s infinite' }}
              >
                █
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Financial Summary ─────────────────────────────────────────────────────────

const STAGE_LABEL_MAP: Record<string, string> = {
  NOVO_LEAD: 'Novo Lead',
  CONTATO_FEITO: 'Contato Feito',
  PROPOSTA_ENVIADA: 'Proposta Enviada',
  NEGOCIACAO: 'Negociacao',
}

function NegotiationCard({ data, isMobile }: { data: Negotiation; isMobile: boolean }) {
  const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)

  return (
    <div style={{ background: 'white', border: '2px solid black', boxShadow: '4px 4px 0 black' }}>
      <div className="goon-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>EM NEGOCIACAO</span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-pixel)', color: '#e6a800' }}>{fmt(data.total)} ({data.count} leads)</span>
      </div>
      {data.leads.length > 0 ? (
        <div style={{ padding: '12px 16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid black' }}>
                <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase', fontSize: 9 }}>Empresa</th>
                <th style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: 9 }}>Etapa</th>
                {!isMobile && <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase', fontSize: 9 }}>Vendedor</th>}
                <th style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, textTransform: 'uppercase', fontSize: 9 }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {data.leads.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '6px 8px' }}>{l.companyName}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    <span style={{ background: '#e6a800', color: 'white', padding: '1px 6px', fontSize: 9, fontWeight: 700 }}>{STAGE_LABEL_MAP[l.stage] ?? l.stage}</span>
                  </td>
                  {!isMobile && <td style={{ padding: '6px 8px' }}>{l.salesRep ?? '-'}</td>}
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt(l.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: '20px 16px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#888' }}>
          Nenhum lead com valor em negociacao
        </div>
      )}
    </div>
  )
}

function FinancialSummary({ financialKpis, isMobile }: { financialKpis: FinancialKPIs; isMobile: boolean }) {
  return (
    <div style={{ background: 'white', border: '2px solid black', boxShadow: '4px 4px 0 black' }}>
      <div className="goon-card-header">RESUMO FINANCEIRO</div>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 0 }}>
        {[
          { label: 'Entradas no Mes', value: fmtBRL(financialKpis.totalReceivedMonth), color: '#006600', border: '4px solid #006600' },
          { label: 'A Receber no Mes', value: fmtBRL(financialKpis.toReceiveMonth), color: '#4A78FF', border: '4px solid #4A78FF' },
          { label: 'Total Pendente', value: fmtBRL(financialKpis.totalPending), color: '#000080', border: isMobile ? '4px solid #000080' : '4px solid transparent' },
          { label: 'Vencido', value: fmtBRL(financialKpis.totalOverdue), color: '#cc0000', border: isMobile ? '4px solid #cc0000' : '4px solid transparent' },
        ].map((item, idx) => (
          <div
            key={item.label}
            style={{
              flex: 1,
              padding: '16px 24px',
              borderLeft: isMobile ? 'none' : (idx > 0 ? '2px solid black' : 'none'),
              borderTop: isMobile ? (idx > 0 ? '2px solid black' : 'none') : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {item.label}
            </span>
            <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 15, color: item.color, lineHeight: 1.3 }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FinancialConsolidationCard({ data, isMobile }: { data: FinancialConsolidation; isMobile: boolean }) {
  const items = [
    { label: 'Entradas no Mes', value: fmtBRL(data.entradas.receivedMonth), color: '#006600' },
    { label: 'Total Recebido', value: fmtBRL(data.entradas.receivedAll), color: '#006600' },
    { label: 'Saidas no Mes', value: fmtBRL(data.saidas.pagoMes), color: '#cc0000' },
    { label: 'Saidas Previstas', value: fmtBRL(data.saidas.previstoMes), color: '#e6a800' },
    { label: 'Saldo do Mes', value: fmtBRL(data.netBalanceMonth), color: data.netBalanceMonth >= 0 ? '#006600' : '#cc0000' },
    { label: 'Saldo Projetado', value: fmtBRL(data.projectedBalanceMonth), color: data.projectedBalanceMonth >= 0 ? '#006600' : '#cc0000' },
  ]

  return (
    <div style={{ background: 'white', border: '2px solid black', boxShadow: '4px 4px 0 black' }}>
      <div className="goon-card-header">BALANCO DO MES</div>
      <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 16 }}>
        {items.map(item => (
          <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {item.label}
            </span>
            <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 15, color: item.color, lineHeight: 1.3 }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const isMobile = useIsMobile()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Alert dismiss state
  const [showOverdue, setShowOverdue] = useState(true)
  const [showRenewal, setShowRenewal] = useState(true)
  const [showUnsigned, setShowUnsigned] = useState(true)

  const gap = isMobile ? 8 : 16

  useEffect(() => {
    // Silently check overdue payments before loading KPIs
    apiFetch('/api/payments/check-overdue', { method: 'POST' }).catch(() => {})

    apiFetch<DashboardStats>('/api/dashboard')
      .then(data => { setStats(data); setLoading(false) })
      .catch(err => { setError(err.message ?? 'Erro ao carregar dashboard'); setLoading(false) })
  }, [])

  const signedContracts = stats?.contractsStatus.find(c => c.status === 'SIGNED')?.count ?? 0

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? 16 : 24 }}>
        <h1 style={{ fontFamily: 'var(--font-pixel)', color: 'black', fontSize: isMobile ? 12 : 16, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>
          Dashboard
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 12, marginTop: 6, marginBottom: 0 }}>
          {'>'} Visão geral da operação
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fff0f0', border: '2px solid var(--danger)', boxShadow: '4px 4px 0 var(--danger)', padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--danger)', fontSize: 12, fontWeight: 700, marginBottom: 16 }}>
          [ERRO] {error}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton isMobile={isMobile} />
      ) : stats ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap }}>

          {/* ══ 1. VISÃO ESTRATÉGICA — KPIs do negócio ══════════════════ */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap }}>
            <KpiCard
              label="Total Clientes"
              value={stats.kpis.totalActiveClients}
              icon={<Building2 size={16} />}
              accentColor="black"
              href="/clients"
            />
            <KpiCard
              label="Clientes Ativos"
              value={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{stats.kpis.totalActiveClients}</span>
                  <span style={{ display: 'inline-block', width: 8, height: 8, background: '#ccff00', border: '1px solid black', borderRadius: '50%', animation: 'pulse 2s ease-in-out infinite' }} />
                </div>
              }
              icon={<Users size={16} />}
              accentColor="#ccff00"
              href="/clients?status=ACTIVE"
            />
            <KpiCard
              label="Receita Total"
              value={fmtBRL(stats.kpis.totalRevenue)}
              icon={<DollarSign size={16} />}
              accentColor="#ccff00"
              href="/payments"
            />
            <KpiCard
              label="Ticket Médio"
              value={fmtBRL(stats.financialKpis?.averageTicket)}
              icon={<TrendingUp size={16} />}
              accentColor="black"
              href="/payments"
            />
          </div>

          {/* ══ 2. RECEITA POR PROGRAMA — onde está o dinheiro ══════════ */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap }}>
            {(['GE', 'GI', 'GS'] as const).map(code => (
              <RevenueProductCard
                key={code}
                code={code}
                value={stats.kpis.revenueByProduct[code] ?? 0}
              />
            ))}
          </div>

          {/* ══ 2b. EM NEGOCIAÇÃO — leads no pipeline com valor ═════════ */}
          {stats.negotiation && stats.negotiation.count > 0 && (
            <NegotiationCard data={stats.negotiation} isMobile={isMobile} />
          )}

          {/* ══ 3. SAÚDE FINANCEIRA — recebido / pendente / vencido ════ */}
          {stats.financialKpis && (
            <FinancialSummary financialKpis={stats.financialKpis} isMobile={isMobile} />
          )}

          {/* ══ 3b. BALANÇO CONSOLIDADO ════════════════════════════════ */}
          {stats.financialConsolidation && (
            <FinancialConsolidationCard data={stats.financialConsolidation} isMobile={isMobile} />
          )}

          {/* ══ 4. OPERAÇÃO — pipeline + contratos ═════════════════════ */}
          <div style={{ display: 'flex', gap, flexDirection: isMobile ? 'column' : 'row', alignItems: 'stretch' }}>
            <PipelineSummary data={stats.pipelineSummary} />
            <div style={isMobile ? {} : { flex: '0 0 260px' }}>
              <ContractsStatus data={stats.contractsStatus} />
            </div>
          </div>

          {/* ══ 5. INDICADORES OPERACIONAIS ════════════════════════════ */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap }}>
            <KpiCard
              label="Contratos Ativos"
              value={signedContracts}
              icon={<FileText size={16} />}
              accentColor="black"
              href="/contracts?status=SIGNED"
            />
            <KpiCard
              label="Novos este Mês"
              value={stats.kpis.newClientsThisMonth}
              icon={<Users size={16} />}
              accentColor={stats.kpis.newClientsThisMonth > 0 ? '#ccff00' : 'black'}
              href="/clients"
            />
            <KpiCard
              label="Pendências"
              value={stats.pendencies?.total ?? 0}
              icon={<AlertTriangle size={16} />}
              accentColor={(stats.pendencies?.total ?? 0) > 0 ? '#cc0000' : 'black'}
              href="/pendencies"
            />
            <KpiCard
              label="Inadimplentes"
              value={stats.financialKpis?.overdueCount ?? 0}
              icon={<AlertCircle size={16} />}
              accentColor={(stats.financialKpis?.overdueCount ?? 0) > 0 ? '#cc0000' : 'black'}
              href="/payments?status=OVERDUE"
            />
          </div>

          {/* ══ 6. ALERTAS — ações urgentes (só se houver) ════════════ */}
          {(() => {
            const overdueCount = stats.pendencies?.paymentOverdue ?? stats.financialKpis?.overdueCount ?? 0
            const renewalCount = stats.renewals?.count ?? 0
            const unsignedCount = stats.pendencies?.contractUnsigned ?? 0
            const hasAny = (overdueCount > 0 && showOverdue) || (renewalCount > 0 && showRenewal) || (unsignedCount > 0 && showUnsigned)
            if (!hasAny) return null
            return (
              <div style={{ display: 'flex', gap, flexWrap: 'wrap' }}>
                {overdueCount > 0 && showOverdue && (
                  <AlertCard icon="▲" count={overdueCount} label="boletos vencidos" bg="#cc0000" href="/payments" onDismiss={() => setShowOverdue(false)} />
                )}
                {renewalCount > 0 && showRenewal && (
                  <AlertCard icon="↺" count={renewalCount} label="em renovação" bg="#ff6600" href="/contracts?renewal=true" onDismiss={() => setShowRenewal(false)} />
                )}
                {unsignedCount > 0 && showUnsigned && (
                  <AlertCard icon="✦" count={unsignedCount} label="contratos s/ assinatura" bg="#000080" href="/contracts" onDismiss={() => setShowUnsigned(false)} />
                )}
              </div>
            )
          })()}

          {/* ══ 7. RENOVAÇÕES — se houver ═════════════════════════════ */}
          {stats.renewals && stats.renewals.count > 0 && (
            <RenewalSection renewals={stats.renewals} isMobile={isMobile} />
          )}

          {/* ══ 8. ATIVIDADE RECENTE — histórico ═════════════════════ */}
          <RecentActivity data={stats.recentActivity} />
        </div>
      ) : null}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
