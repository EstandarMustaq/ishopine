import { Body, Controller, Post } from '@nestjs/common';
import { LogisticsService } from './logistics.service';
import { ShippingQuoteDto } from './dto/shipping-quote.dto';

@Controller('logistics')
export class LogisticsController {
  constructor(private readonly logistics: LogisticsService) {}

  @Post('quote')
  quote(@Body() body: ShippingQuoteDto) {
    return this.logistics.quote(body);
  }
}
