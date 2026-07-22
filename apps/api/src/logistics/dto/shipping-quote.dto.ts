import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ShippingQuoteDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  shopId?: string;

  @IsString()
  destinationProvince!: string;

  @IsString()
  destinationDistrict!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @IsNumber()
  @Min(0)
  subtotalCents!: number;
}
