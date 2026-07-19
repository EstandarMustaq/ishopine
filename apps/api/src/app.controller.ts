import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return {
      ok: true,
      service: 'ishopine-api',
      marketplace: 'iShopine',
      operator: 'Nkateko Investment and Service',
      timestamp: new Date().toISOString(),
    };
  }
}
