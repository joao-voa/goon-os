import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ClientsService } from './clients.service'
import { CreateClientDto } from './dto/create-client.dto'
import { UpdateClientDto } from './dto/update-client.dto'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'

@Controller('api/clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('segment') segment?: string,
    @Query('product') product?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
  ) {
    return this.clientsService.findAll({
      search,
      status,
      segment,
      product,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      sort: sort ?? 'companyName',
    })
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id)
  }
}
