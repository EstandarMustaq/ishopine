import { ConfigService } from '@nestjs/config';
import { createApp } from './create-app';

async function bootstrap() {
  const app = await createApp();
  const config = app.get(ConfigService);
  const port = Number(config.get('API_PORT', 4000));
  await app.listen(port);
  console.log(`iShopine API listening on http://localhost:${port}/api`);
}

bootstrap();
