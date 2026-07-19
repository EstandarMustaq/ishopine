import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return {
      ok: true,
      service: 'ishoppine-api',
      marketplace: 'iShoppine',
      operator: 'Nkateko Investment and Service',
      timestamp: new Date().toISOString(),
    };
  }
}
