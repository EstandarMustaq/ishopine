# Media (strangler — owned)

Porta **4105**. Com `MEDIA_OWNED≠0` (default):

| Path | Notas |
|---|---|
| `POST/GET/DELETE /api/media`, `/api/uploads` | JWT + Prisma + Sharp/Cloudinary |
| `GET /uploads/*` | estático local + `Cache-Control` immutable |

Gateway encaminha `/uploads` → `MEDIA_URL` quando `STRANGLER_ROUTING=1`.

```bash
JWT_SECRET=… DATABASE_URL=… pnpm --filter @ishopine/media dev
```

`MEDIA_OWNED=0` → proxy puro.
