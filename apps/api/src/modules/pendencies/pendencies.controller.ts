import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'
import { PendenciesService } from './pendencies.service'

@Controller('api/pendencies')
@UseGuards(JwtAuthGuard)
export class PendenciesController {
  constructor(private readonly pendenciesService: PendenciesService) {}

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('clientId') clientId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.pendenciesService.findAll({
      status,
      type,
      clientId,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    })
  }

  @Post()
  create(
    @Body()
    dto: {
      clientId: string
      type: string
      status?: string
      description?: string
      relatedId?: string
    },
  ) {
    return this.pendenciesService.create(dto)
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: { status?: string; description?: string; type?: string },
  ) {
    return this.pendenciesService.update(id, dto)
  }

  @Patch(':id/resolve')
  resolve(@Param('id') id: string) {
    return this.pendenciesService.resolve(id)
  }

  @Post('sync')
  async sync() {
    const newCount = await this.pendenciesService.generateAutomatic()
    return { newCount }
  }
}
