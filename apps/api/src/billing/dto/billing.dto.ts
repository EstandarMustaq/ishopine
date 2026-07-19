import { ArrayMinSize, IsArray, IsOptional, IsString, Matches } from 'class-validator';

export class StripeCheckoutDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderIds!: string[];
}

export class MpesaC2bDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderIds!: string[];

  @IsString()
  @Matches(/^(258)?8\d{8}$/, {
    message: 'msisdn deve ser um número M-Pesa Moçambique válido',
  })
  msisdn!: string;
}

export class MpesaCallbackDto {
  @IsOptional()
  @IsString()
  input_OriginalConversationID?: string;

  @IsOptional()
  @IsString()
  input_ThirdPartyReference?: string;

  @IsOptional()
  @IsString()
  input_TransactionID?: string;

  @IsOptional()
  @IsString()
  input_ResultCode?: string;

  @IsOptional()
  @IsString()
  input_ResultDesc?: string;
}
