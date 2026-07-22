# Media (strangler — owned upload)

Porta **4105**. Com `MEDIA_OWNED≠0` (default), trata `POST/GET /api/media`
e `/api/uploads` localmente (JWT + Prisma + disco). Outros paths → monólito.

```bash
JWT_SECRET=… DATABASE_URL=… pnpm --filter @ishopine/media dev
```

`MEDIA_OWNED=0` volta ao proxy puro.
