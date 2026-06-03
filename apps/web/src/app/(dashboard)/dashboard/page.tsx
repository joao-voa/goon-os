'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users,
  TrendingUp,
  AlertTriangle,
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

interface CashflowMonth {
  month: number
  year: number
  entradas: { received: number; pending: number; overdue: number; total: number }
  saidas: { previsto: number; pago: number; total: number }
  comissoes: { pending: number; paid: number; total: number }
  saldo: number
  saldoProjetado: number
}

interface CashflowTotals {
  entradas: number
  entradasReceived: number
  saidas: number
  saidasPago: number
  comissoes: number
  comissoesPaid: number
  saldo: number
  saldoProjetado: number
}

interface CashflowData {
  year: number
  months: CashflowMonth[]
  totals: CashflowTotals
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
          <div key={i} style={{ flex: '1 1 200px', height: 64, background: '#c8c8c8', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)' }} />
        ))}
      </div>
      {/* KPI row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton height={10} width="60%" />
            <Skeleton height={24} width="40%" />
          </div>
        ))}
      </div>
      {/* KPI row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton height={10} width="60%" />
            <Skeleton height={24} width="40%" />
          </div>
        ))}
      </div>
      {/* Pipeline + Contracts */}
      <div style={{ display: 'flex', gap, flexDirection: isMobile ? 'column' : 'row' }}>
        <div style={{ flex: 1, background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)', height: 200 }} />
        <div style={{ flex: '0 0 240px', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)', height: 200 }} />
      </div>
      {/* Revenue by Product */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)', padding: '16px 20px', height: 80 }} />
        ))}
      </div>
      {/* Activity */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)', padding: '20px 24px' }}>
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
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)',
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
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.08)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = ''
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.07)'
      }}
    >
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'white', flexShrink: 0 }}>
        {icon}
      </span>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 18, color: 'white', flexShrink: 0, lineHeight: 1 }}>
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
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)',
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
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.08)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = ''
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.07)'
      }}
    >
      {/* Colored left accent */}
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: accentColor }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </span>
        <div style={{ width: 34, height: 34, border: '1px solid #e2e8f0', background: 'var(--retro-gray)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
      </div>
      <span style={{ fontFamily: 'var(--font-sans)', color: 'black', fontSize: 16, lineHeight: 1.3 }}>
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
    <div style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)' }}>
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
                {client.daysLeft < 0 ? (
                  <strong style={{ color: '#cc0000' }}>Contrato vencido ha {Math.abs(client.daysLeft)} dias</strong>
                ) : client.daysLeft === 0 ? (
                  <strong style={{ color: '#cc0000' }}>Contrato vence hoje</strong>
                ) : (
                  <>Contrato vence em <strong style={{ color: client.daysLeft <= 7 ? '#cc0000' : '#ff6600' }}>{client.daysLeft} dias</strong></>
                )}
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
    <div style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)', flex: 1, minWidth: 0 }}>
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
                      <div style={{ width: 10, height: 10, background: color, border: '1px solid #e2e8f0', flexShrink: 0 }} />
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'black', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                        {label}
                      </span>
                    </div>
                    <span style={{ background: '#0f172a', color: 'white', border: '1px solid #e2e8f0', padding: '1px 6px', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700 }}>
                      {item.count}
                    </span>
                  </div>
                  <div style={{ height: 8, background: 'var(--retro-gray)', border: '1px solid #e2e8f0' }}>
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
    <div style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)', flex: '0 0 240px' }}>
      <div className="goon-card-header">STATUS CONTRATOS</div>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(item => (
          <div
            key={item.status}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid #e2e8f0', background: 'var(--retro-gray)' }}
          >
            <span
              style={{ background: item.color, color: item.textColor, border: '1px solid #e2e8f0', boxShadow: 'none', padding: '2px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}
            >
              {item.label}
            </span>
            <span style={{ fontFamily: 'var(--font-sans)', color: 'black', fontSize: 16 }}>
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
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)',
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
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.08)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = ''
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.07)'
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: color }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ background: color, color: 'white', border: '1px solid #e2e8f0', padding: '2px 10px', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700 }}>
          {code}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 11 }}>{PRODUCT_NAMES[code]}</span>
      </div>
      <span style={{ fontFamily: 'var(--font-sans)', color: 'black', fontSize: 16, lineHeight: 1.3 }}>
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
    <div style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)' }}>
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
    <div style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)' }}>
      <div className="goon-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>EM NEGOCIACAO</span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: '#e6a800' }}>{fmt(data.total)} ({data.count} leads)</span>
      </div>
      {data.leads.length > 0 ? (
        <div style={{ padding: '12px 16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
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


// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const isMobile = useIsMobile()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [cashflow, setCashflow] = useState<CashflowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Alert dismiss state
  const [showOverdue, setShowOverdue] = useState(true)
  const [showRenewal, setShowRenewal] = useState(true)
  const [showUnsigned, setShowUnsigned] = useState(true)

  const gap = isMobile ? 8 : 16
  const currentYear = new Date().getFullYear()

  useEffect(() => {
    apiFetch('/api/payments/check-overdue', { method: 'POST' }).catch(() => {})

    Promise.all([
      apiFetch<DashboardStats>('/api/dashboard'),
      apiFetch<CashflowData>(`/api/cashflow?year=${currentYear}`),
    ])
      .then(([dashData, cfData]) => { setStats(dashData); setCashflow(cfData); setLoading(false) })
      .catch(err => { setError(err.message ?? 'Erro ao carregar dashboard'); setLoading(false) })
  }, [currentYear])

  const signedContracts = stats?.contractsStatus.find(c => c.status === 'SIGNED')?.count ?? 0

  // Cashflow-derived KPIs
  const currentMonth = new Date().getMonth()
  const mesAtual = cashflow?.months[currentMonth]
  const aReceberAno = cashflow ? cashflow.totals.entradas - cashflow.totals.entradasReceived : 0
  const aReceberMes = mesAtual ? mesAtual.entradas.pending + mesAtual.entradas.overdue : 0
  const gastosAno = cashflow ? cashflow.totals.saidas + cashflow.totals.comissoes : 0
  const aPagarAno = cashflow ? (cashflow.totals.saidas - cashflow.totals.saidasPago) + (cashflow.totals.comissoes - cashflow.totals.comissoesPaid) : 0
  const gastosMes = mesAtual ? mesAtual.saidas.total + mesAtual.comissoes.total : 0
  const aPagarMes = mesAtual ? mesAtual.saidas.previsto + mesAtual.comissoes.pending : 0

  // Inadimplencia
  const totalOverdue = stats?.financialKpis?.totalOverdue ?? 0
  const overdueCount = stats?.financialKpis?.overdueCount ?? 0
  const carteiraAno = cashflow?.totals.entradas ?? 0
  const taxaInadimplencia = carteiraAno > 0 ? (totalOverdue / carteiraAno) * 100 : 0

  // Resultado e Saldos
  const saldoRealizadoMes = mesAtual ? mesAtual.saldo : 0
  const saldoProjetadoMes = mesAtual ? mesAtual.saldoProjetado : 0
  const saldoRealizadoAno = cashflow?.totals.saldo ?? 0
  const saldoProjetadoAno = cashflow?.totals.saldoProjetado ?? 0

  const cfCardStyle = (bg: string): React.CSSProperties => ({ background: bg, color: 'white', padding: '12px 16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)', fontFamily: 'var(--font-mono)', fontWeight: 700 })

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? 16 : 24 }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', color: 'black', fontSize: isMobile ? 12 : 16, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>
          Dashboard
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', color: '#555', fontSize: 12, marginTop: 6, marginBottom: 0 }}>
          {'>'} Visão geral da operação
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fff0f0', border: '1px solid #fecaca', boxShadow: '4px 4px 0 var(--danger)', padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--danger)', fontSize: 12, fontWeight: 700, marginBottom: 16 }}>
          [ERRO] {error}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton isMobile={isMobile} />
      ) : stats ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap }}>

          {/* ══ 1. VISÃO ESTRATÉGICA — Clientes + Ticket ══════════════════ */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap }}>
            <KpiCard
              label="Clientes Ativos"
              value={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{stats.kpis.totalActiveClients}</span>
                  <span style={{ display: 'inline-block', width: 8, height: 8, background: '#ccff00', border: '1px solid #e2e8f0', borderRadius: '50%', animation: 'pulse 2s ease-in-out infinite' }} />
                </div>
              }
              icon={<Users size={16} />}
              accentColor="#ccff00"
              href="/clients"
            />
            <KpiCard
              label="Ticket Médio"
              value={fmtBRL(stats.financialKpis?.averageTicket)}
              icon={<TrendingUp size={16} />}
              accentColor="black"
              href="/payments"
            />
            <KpiCard
              label="Novos este Mês"
              value={stats.kpis.newClientsThisMonth}
              icon={<Users size={16} />}
              accentColor={stats.kpis.newClientsThisMonth > 0 ? '#ccff00' : 'black'}
              href="/clients"
            />
            <KpiCard
              label="Contratos Ativos"
              value={signedContracts}
              icon={<FileText size={16} />}
              accentColor="black"
              href="/contracts"
            />
          </div>

          {/* ══ 2. FATURAMENTO — 8 KPI cards (igual fluxo de caixa) ══════ */}
          {cashflow && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12 }}>
                <div style={cfCardStyle('#1e293b')}>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', opacity: 0.8 }}>Faturamento Total (Ano)</div>
                  <div style={{ fontSize: 18 }}>{fmtBRL(cashflow.totals.entradas)}</div>
                  <div style={{ fontSize: 9, opacity: 0.7 }}>Todos os pagamentos {currentYear}</div>
                </div>
                <div style={cfCardStyle('#334155')}>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', opacity: 0.8 }}>A Receber (Total)</div>
                  <div style={{ fontSize: 18 }}>{fmtBRL(aReceberAno)}</div>
                  <div style={{ fontSize: 9, opacity: 0.7 }}>Pendente + Vencido no ano</div>
                </div>
                <div style={cfCardStyle('#475569')}>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', opacity: 0.8 }}>Faturamento Previsto (Mes)</div>
                  <div style={{ fontSize: 18 }}>{fmtBRL(mesAtual?.entradas.total ?? 0)}</div>
                  <div style={{ fontSize: 9, opacity: 0.7 }}>Recebido: {fmtBRL(mesAtual?.entradas.received ?? 0)}</div>
                </div>
                <div style={cfCardStyle('#64748b')}>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', opacity: 0.8 }}>A Receber (Mes)</div>
                  <div style={{ fontSize: 18 }}>{fmtBRL(aReceberMes)}</div>
                  <div style={{ fontSize: 9, opacity: 0.7 }}>Falta receber este mes</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12 }}>
                <div style={cfCardStyle('#1e293b')}>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', opacity: 0.8 }}>Gastos Total (Ano)</div>
                  <div style={{ fontSize: 18 }}>{fmtBRL(gastosAno)}</div>
                  <div style={{ fontSize: 9, opacity: 0.7 }}>Despesas + Comissoes {currentYear}</div>
                </div>
                <div style={cfCardStyle('#334155')}>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', opacity: 0.8 }}>A Pagar (Total)</div>
                  <div style={{ fontSize: 18 }}>{fmtBRL(aPagarAno)}</div>
                  <div style={{ fontSize: 9, opacity: 0.7 }}>Previsto + Pendente no ano</div>
                </div>
                <div style={cfCardStyle('#475569')}>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', opacity: 0.8 }}>Gastos Previstos (Mes)</div>
                  <div style={{ fontSize: 18 }}>{fmtBRL(gastosMes)}</div>
                  <div style={{ fontSize: 9, opacity: 0.7 }}>Pago: {fmtBRL(mesAtual ? mesAtual.saidas.pago + mesAtual.comissoes.paid : 0)}</div>
                </div>
                <div style={cfCardStyle('#64748b')}>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', opacity: 0.8 }}>A Pagar (Mes)</div>
                  <div style={{ fontSize: 18 }}>{fmtBRL(aPagarMes)}</div>
                  <div style={{ fontSize: 9, opacity: 0.7 }}>Falta pagar este mes</div>
                </div>
              </div>
            </>
          )}

          {/* ══ 3. INADIMPLÊNCIA ══════════════════════════════════════════ */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)' }}>
            <div className="goon-card-header" style={{ background: overdueCount > 0 ? '#cc0000' : 'black' }}>INADIMPLENCIA</div>
            <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>Valor Vencido</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: totalOverdue > 0 ? '#cc0000' : '#006600' }}>{fmtBRL(totalOverdue)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>Parcelas Vencidas</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: overdueCount > 0 ? '#cc0000' : 'black' }}>{overdueCount}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>Taxa Inadimplencia</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: taxaInadimplencia > 5 ? '#cc0000' : taxaInadimplencia > 0 ? '#e6a800' : '#006600' }}>{taxaInadimplencia.toFixed(1)}%</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#888' }}>sobre total do ano</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>Pendencias</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: (stats.pendencies?.total ?? 0) > 0 ? '#cc0000' : 'black' }}>{stats.pendencies?.total ?? 0}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#888' }}>total abertas</span>
              </div>
            </div>
          </div>

          {/* ══ 4. RESULTADO E SALDOS ═════════════════════════════════════ */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)' }}>
            <div className="goon-card-header">RESULTADO E SALDOS</div>
            <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>Saldo Realizado (Mes)</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: saldoRealizadoMes >= 0 ? '#006600' : '#cc0000' }}>{fmtBRL(saldoRealizadoMes)}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#888' }}>recebido - pago</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>Saldo Projetado (Mes)</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: saldoProjetadoMes >= 0 ? '#006600' : '#cc0000' }}>{fmtBRL(saldoProjetadoMes)}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#888' }}>entradas - saidas previstas</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>Resultado Realizado (Ano)</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: saldoRealizadoAno >= 0 ? '#006600' : '#cc0000' }}>{fmtBRL(saldoRealizadoAno)}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#888' }}>acumulado {currentYear}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>Resultado Projetado (Ano)</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: saldoProjetadoAno >= 0 ? '#006600' : '#cc0000' }}>{fmtBRL(saldoProjetadoAno)}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#888' }}>projecao {currentYear}</span>
              </div>
            </div>
          </div>

          {/* ══ 5. RECEITA POR PROGRAMA ═══════════════════════════════════ */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap }}>
            {(['GE', 'GI', 'GS'] as const).map(code => (
              <RevenueProductCard
                key={code}
                code={code}
                value={stats.kpis.revenueByProduct[code] ?? 0}
              />
            ))}
          </div>

          {/* ══ 6. EM NEGOCIAÇÃO ══════════════════════════════════════════ */}
          {stats.negotiation && stats.negotiation.count > 0 && (
            <NegotiationCard data={stats.negotiation} isMobile={isMobile} />
          )}

          {/* ══ 7. OPERAÇÃO — pipeline + contratos ════════════════════════ */}
          <div style={{ display: 'flex', gap, flexDirection: isMobile ? 'column' : 'row', alignItems: 'stretch' }}>
            <PipelineSummary data={stats.pipelineSummary} />
            <div style={isMobile ? {} : { flex: '0 0 260px' }}>
              <ContractsStatus data={stats.contractsStatus} />
            </div>
          </div>

          {/* ══ 8. ALERTAS — ações urgentes (só se houver) ════════════════ */}
          {(() => {
            const oCount = stats.pendencies?.paymentOverdue ?? stats.financialKpis?.overdueCount ?? 0
            const renewalCount = stats.renewals?.count ?? 0
            const unsignedCount = stats.pendencies?.contractUnsigned ?? 0
            const hasAny = (oCount > 0 && showOverdue) || (renewalCount > 0 && showRenewal) || (unsignedCount > 0 && showUnsigned)
            if (!hasAny) return null
            return (
              <div style={{ display: 'flex', gap, flexWrap: 'wrap' }}>
                {oCount > 0 && showOverdue && (
                  <AlertCard icon="▲" count={oCount} label="boletos vencidos" bg="#cc0000" href="/payments" onDismiss={() => setShowOverdue(false)} />
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

          {/* ══ 9. RENOVAÇÕES — se houver ═════════════════════════════════ */}
          {stats.renewals && stats.renewals.count > 0 && (
            <RenewalSection renewals={stats.renewals} isMobile={isMobile} />
          )}

          {/* ══ 10. ATIVIDADE RECENTE ═════════════════════════════════════ */}
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
