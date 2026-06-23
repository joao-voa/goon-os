// Entry serverless da API NestJS no Vercel.
// Bootstrapa o Nest uma vez (cache entre invocações) e encaminha as requests
// pro Express interno. O roteamento /(.*) -> /api é feito no vercel.json.
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import type { IncomingMessage, ServerResponse } from 'http'
import { AppModule } from '../src/app.module'
import { GlobalExceptionFilter } from '../src/filters/http-exception.filter'

type ExpressInstance = (req: IncomingMessage, res: ServerResponse) => void

let cachedInstance: ExpressInstance | null = null
let bootstrapPromise: Promise<ExpressInstance> | null = null

async function bootstrap(): Promise<ExpressInstance> {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] })

  app.enableCors({
    origin: [
      process.env.FRONTEND_URL ?? 'http://localhost:3000',
      'http://localhost:3000',
      'https://goon-os-web.vercel.app',
    ].filter(Boolean),
    credentials: true,
  })

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  )
  app.useGlobalFilters(new GlobalExceptionFilter())

  await app.init()
  return app.getHttpAdapter().getInstance() as ExpressInstance
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrap().then(instance => {
      cachedInstance = instance
      return instance
    })
  }
  const instance = cachedInstance ?? (await bootstrapPromise)
  return instance(req, res)
}
