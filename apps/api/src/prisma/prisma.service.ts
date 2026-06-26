import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

// O driver Neon usa WebSocket quando roda em Node (serverless do Vercel).
neonConfig.webSocketConstructor = ws

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Conecta via driver Neon (HTTP/WS na porta 443) — engine WASM, sem binário nativo.
    const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL })
    super({ adapter })
  }

  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
