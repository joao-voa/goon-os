import { IsString, IsNumber, IsOptional, IsDateString } from 'class-validator'
import { Type } from 'class-transformer'

export class CreatePlanDto {
  @IsString()
  productId: string

  @Type(() => Number)
  @IsNumber()
  value: number

  @IsString()
  paymentType: string // CASH, INSTALLMENT, RECURRING

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  installments?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  installmentValue?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cycleDuration?: number // months

  @IsDateString()
  startDate: string

  @IsOptional()
  @IsString()
  notes?: string
}
