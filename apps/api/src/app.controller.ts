import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return {
      ok: true,
      service: 'ishopine-api',
      marketplace: 'iShopine',
      country: 'MZ',
      currency: 'MZN',
      payments: 'paysuite',
      timestamp: new Date().toISOString(),
    };
  }
}
