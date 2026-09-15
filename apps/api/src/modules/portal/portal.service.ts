import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
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

  private async clientByToken(token: string) {
    if (!token || token.length < 8) throw new NotFoundException('Link inválido')
    const client = await this.prisma.client.findUnique({ where: { portalToken: token }, select: { id: true, companyName: true, responsible: true } })
    if (!client) throw new NotFoundException('Link inválido ou expirado')
    return client
  }

  async getByToken(token: string) {
    const client = await this.clientByToken(token)
    const [profile, metrics] = await Promise.all([
      this.prisma.menteeProfile.findUnique({ where: { clientId: client.id }, select: { mentorName: true } }),
      this.prisma.monthlyMetric.findMany({ where: { clientId: client.id }, orderBy: { month: 'asc' } }),
    ])
    return {
      company: client.companyName,
      responsible: client.responsible ?? null,
      mentorName: profile?.mentorName ?? null,
      months: metrics.map(m => ({
        month: m.month, faturamento: m.faturamento, clientesAtivos: m.clientesAtivos, estoqueQtd: m.estoqueQtd,
        estoqueValor: m.estoqueValor, ticketMedio: m.ticketMedio, numVendas: m.numVendas,
        investimentoTrafego: m.investimentoTrafego, roas: m.roas, seguidoresIg: m.seguidoresIg,
      })),
    }
  }

  async saveByToken(token: string, dto: MonthlyDto) {
    const client = await this.clientByToken(token)
    if (!dto?.month || !/^\d{4}-\d{2}$/.test(dto.month)) throw new BadRequestException('Mês inválido')
    await this.mentorship.upsertMonthlyMetric(client.id, dto)
    return { ok: true }
  }
}
