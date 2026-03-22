import { Controller, Get } from '@nestjs/common'

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return { status: 'ok', service: 'goon-os-api' }
  }

  @Get('health')
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }
}
