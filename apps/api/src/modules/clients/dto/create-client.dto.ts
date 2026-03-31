import { IsString, IsOptional, IsEmail, IsInt, IsBoolean, Min, Max } from 'class-validator'

export class CreateClientDto {
  @IsString()
  companyName: string

  @IsOptional() @IsString()
  tradeName?: string

  @IsOptional() @IsString()
  cnpj?: string

  @IsString()
  responsible: string

  @IsOptional() @IsString()
  phone?: string

  @IsOptional() @IsEmail()
  email?: string

  @IsOptional() @IsString()
  whatsapp?: string

  @IsOptional() @IsString()
  segment?: string

  @IsOptional() @IsString()
  address?: string

  @IsOptional() @IsString()
  addressNumber?: string

  @IsOptional() @IsString()
  neighborhood?: string

  @IsOptional() @IsString()
  city?: string

  @IsOptional() @IsString()
  state?: string

  @IsOptional() @IsString()
  zipCode?: string

  @IsOptional() @IsString()
  employeeCount?: string

  @IsOptional() @IsString()
  estimatedRevenue?: string

  @IsOptional() @IsString()
  mainPains?: string

  @IsOptional() @IsString()
  strategicGoals?: string

  @IsOptional() @IsString()
  maturity?: string

  @IsOptional() @IsInt() @Min(1) @Max(10)
  goonFitScore?: number

  @IsOptional() @IsString()
  leadStage?: string

  @IsOptional() @IsString()
  leadSource?: string

  @IsOptional() @IsString()
  salesRep?: string

  @IsOptional()
  saleValue?: number

  @IsOptional() @IsString()
  paymentMethod?: string

  @IsOptional() @IsInt() @Min(1)
  saleInstallments?: number

  @IsOptional()
  installmentValue?: number

  @IsOptional() @IsString()
  leadNotes?: string

  @IsOptional() @IsString()
  status?: string

  @IsOptional() @IsBoolean()
  hasContract?: boolean

  @IsOptional() @IsBoolean()
  hasBilling?: boolean

  @IsOptional() @IsBoolean()
  isClientActive?: boolean
}
