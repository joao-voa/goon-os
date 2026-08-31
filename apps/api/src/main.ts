import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { GlobalExceptionFilter } from './filters/http-exception.filter'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  // Body até 5MB (upload de PDF de contrato em base64). Padrão é 100kb.
  app.useBodyParser('json', { limit: '5mb' })
  app.useBodyParser('urlencoded', { limit: '5mb', extended: true })

  app.enableShutdownHooks()

  app.enableCors({
    origin: [
      process.env.FRONTEND_URL ?? 'http://localhost:3000',
      'http://localhost:3000',
      'https://goon-os-web.vercel.app',
    ].filter(Boolean),
    credentials: true,
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.useGlobalFilters(new GlobalExceptionFilter())

  await app.listen(process.env.PORT ?? 3001)
  console.log(`API running on http://localhost:${process.env.PORT ?? 3001}`)
}
bootstrap()
