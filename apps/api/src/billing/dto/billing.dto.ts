import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export const PAYSUITE_METHODS = ['mpesa', 'emola', 'credit_card'] as const;
export type PaysuiteMethodDto = (typeof PAYSUITE_METHODS)[number];

export class PaysuiteCheckoutDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderIds!: string[];

  @IsString()
  @IsIn(PAYSUITE_METHODS)
  method!: PaysuiteMethodDto;

  @IsOptional()
  @IsString()
  @Matches(/^(258)?8\d{8}$/, {
    message: 'msisdn deve ser um número moçambicano válido',
  })
  msisdn?: string;
}

export class CreatePayoutDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  reference!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsString()
  @IsIn(['mpesa', 'emola'])
  method!: 'mpesa' | 'emola';

  @IsOptional()
  @IsString()
  @MaxLength(125)
  description?: string;

  @IsString()
  @Matches(/^(258)?8\d{8}$/)
  phone!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  holder!: string;
}

export class CreateRefundDto {
  @IsString()
  paymentId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
