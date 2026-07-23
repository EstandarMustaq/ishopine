import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return {
      ok: true,
      service: 'ishopine-api',
      mode: 'nest-shell',
      phase: '40+',
      marketplace: 'iShopine',
      country: 'MZ',
      currency: 'MZN',
      timestamp: new Date().toISOString(),
    };
  }
}
