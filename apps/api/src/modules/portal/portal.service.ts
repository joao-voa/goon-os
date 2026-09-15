import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { MentorshipService } from '../mentorship/mentorship.service'

type MonthlyDto = {
  month: string
  faturamento?: number | null; clientesAtivos?: number | null; estoqueQtd?: number | null; estoqueValor?: number | null
  ticketMedio?: number | null; numVendas?: number | null; investimentoTrafego?: number | null; roas?: number | null; seguidoresIg?: number | null
}

/**
 * Acesso PÚBLICO (sem login) ao auto-preenchimento de métricas pelo próprio cliente.
 * Autenticação = token único do link (Client.portalToken). Cada token só enxerga/edita um cliente.
 */
@Injectable()
export class PortalService {
  constructor(private prisma: PrismaService, private mentorship: MentorshipService) {}

  // resolve o token contra os dois campos e retorna também o modo do link
  private async clientByToken(token: string): Promise<{ id: string; companyName: string; responsible: string | null; mode: 'fill' | 'panel' }> {
    if (!token || token.length < 8) throw new NotFoundException('Link inválido')
    const client = await this.prisma.client.findFirst({
      where: { OR: [{ portalFillToken: token }, { portalPanelToken: token }] },
      select: { id: true, companyName: true, responsible: true, portalFillToken: true, portalPanelToken: true },
    })
    if (!client) throw new NotFoundException('Link inválido ou expirado')
    const mode: 'fill' | 'panel' = client.portalPanelToken === token ? 'panel' : 'fill'
    return { id: client.id, companyName: client.companyName, responsible: client.responsible, mode }
  }

  async getByToken(token: string) {
    const client = await this.clientByToken(token)
    const now = Date.now()
    const [profile, metrics, actions, meetings, lastStudy] = await Promise.all([
      this.prisma.menteeProfile.findUnique({ where: { clientId: client.id }, select: { mentorName: true, goal: true } }),
      this.prisma.monthlyMetric.findMany({ where: { clientId: client.id }, orderBy: { month: 'asc' } }),
      // só tarefas em aberto do próprio cliente (nada interno)
      this.prisma.actionItem.findMany({ where: { clientId: client.id, done: false }, orderBy: [{ dueDate: 'asc' }], select: { id: true, what: true, dueDate: true } }),
      // agenda de reuniões do cliente
      this.prisma.meeting.findMany({ where: { clientId: client.id }, orderBy: { date: 'desc' }, take: 40, select: { id: true, title: true, date: true, status: true } }),
      // próximos passos da última sessão (campo voltado ao cliente)
      this.prisma.sessionCaseStudy.findFirst({ where: { clientId: client.id }, orderBy: { sessionDate: 'desc' }, select: { sessionDate: true, proximosPassos: true } }),
    ])
    return {
      mode: client.mode,
      company: client.companyName,
      responsible: client.responsible ?? null,
      mentorName: profile?.mentorName ?? null,
      goal: profile?.goal ?? null,
      months: metrics.map(m => ({
        month: m.month, faturamento: m.faturamento, clientesAtivos: m.clientesAtivos, estoqueQtd: m.estoqueQtd,
        estoqueValor: m.estoqueValor, ticketMedio: m.ticketMedio, numVendas: m.numVendas,
        investimentoTrafego: m.investimentoTrafego, roas: m.roas, seguidoresIg: m.seguidoresIg,
      })),
      tasks: actions.map(a => ({ id: a.id, what: a.what, dueDate: a.dueDate?.toISOString() ?? null, overdue: !!a.dueDate && a.dueDate.getTime() < now })),
      meetings: meetings.map(m => ({ id: m.id, title: m.title, date: m.date.toISOString(), status: m.status })),
      nextSteps: lastStudy?.proximosPassos ?? null,
      lastSessionDate: lastStudy?.sessionDate?.toISOString() ?? null,
    }
  }

  async saveByToken(token: string, dto: MonthlyDto) {
    const client = await this.clientByToken(token)
    if (client.mode !== 'fill') throw new ForbiddenException('Este link é somente leitura')
    if (!dto?.month || !/^\d{4}-\d{2}$/.test(dto.month)) throw new BadRequestException('Mês inválido')
    await this.mentorship.upsertMonthlyMetric(client.id, dto)
    return { ok: true }
  }
}
