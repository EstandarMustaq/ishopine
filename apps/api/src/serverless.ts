import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from './create-app';

type NestApp = Awaited<ReturnType<typeof createApp>>;

let app: NestApp | undefined;
let ready: Promise<NestApp> | undefined;

async function getApp(): Promise<NestApp> {
  if (app) return app;
  if (!ready) {
    ready = createApp().then(async (instance) => {
      await instance.init();
      app = instance;
      return instance;
    });
  }
  return ready;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  const nest = await getApp();
  const expressApp = nest.getHttpAdapter().getInstance();
  return expressApp(req, res);
}
