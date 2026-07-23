# iShopine — variáveis de ambiente (deploy)

Use este ficheiro como checklist. **Não cole secrets no chat público** se preferir: pode enviar por canal privado / Vercel env / 1Password. Aqui separámos o que **você fornece** do que **nós geramos / derivamos**.

---

## 1. Você fornece agora (credenciais)

### Neon (PostgreSQL)
| Variável | Notas |
|---|---|
| `DATABASE_URL` | Connection string pooled ou directa (`?sslmode=require`). Preferir a URL **pooled** do Neon em serverless. |

Alternativa: project ID Neon + branch — pedimos a connection string via MCP e configuramos.

### Google OAuth
| Variável | Notas |
|---|---|
| `GOOGLE_CLIENT_ID` | Google Cloud Console → OAuth 2.0 Client |
| `GOOGLE_CLIENT_SECRET` | Idem |
| (Authorized redirect URI) | Tem de coincidir com `GOOGLE_CALLBACK_URL` (nós derivamos o URL após o host da API — ver §2) |

### SMTP
| Variável | Notas |
|---|---|
| `SMTP_HOST` | Ex.: `smtp.resend.com`, `smtp.gmail.com`, Mailgun… |
| `SMTP_PORT` | Normalmente `587` (STARTTLS) ou `465` |
| `SMTP_USER` | |
| `SMTP_PASS` | |
| `SMTP_FROM` | Ex.: `iShopine <noreply@ishopine.com>` (domínio verificado no provider) |

### Cloudinary
| Variável | Notas |
|---|---|
| `CLOUDINARY_CLOUD_NAME` | |
| `CLOUDINARY_API_KEY` | |
| `CLOUDINARY_API_SECRET` | |

Nós definimos `UPLOAD_PROVIDER=cloudinary` e `MEDIA_PUBLIC_BASE_URL` a partir do cloud (ou CNAME se tiver).

### DHL Express (MyDHL)
| Variável | Notas |
|---|---|
| `DHL_EXPRESS_API_KEY` | |
| `DHL_EXPRESS_API_SECRET` | |
| `DHL_EXPRESS_ACCOUNT_NUMBER` | |
| `DHL_EXPRESS_ENV` | `test` agora; `production` quando for live |
| `DHL_EXPRESS_ORIGIN_COUNTRY` | default `MZ` se omitir |
| `DHL_EXPRESS_ORIGIN_CITY` | default `Maputo` |
| `DHL_EXPRESS_ORIGIN_POSTAL` | default `1100` |

### PaySuite — **não enviar agora**
Mantemos desactivado até aprovação da cota:

```
PAYSUITE_ENABLED=0
# PAYSUITE_TOKEN=          (vazio)
# PAYSUITE_WEBHOOK_SECRET= (vazio)
PAYSUITE_SIMULATE=false
```

Checkout devolve 503 claro (“cota comerciante pendente”). Sem cobranças reais nem simulação em produção.

---

## 2. Nós geramos / derivamos automaticamente

| Variável | Como |
|---|---|
| `JWT_SECRET` | `openssl rand -base64 48` (≥32 chars) |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `INTERNAL_SERVICE_SECRET` | `openssl rand -hex 32` |
| `CARRIER_WEBHOOK_SECRET` | `openssl rand -hex 32` (webhooks DHL/carriers) |
| `GOOGLE_CALLBACK_URL` | `https://<API_HOST>/api/auth/google/callback` após o host da API estar definido |
| `APP_URL` / `WEB_URL` | URLs públicas pós-deploy (Vercel / domínio custom) |
| `NEXT_PUBLIC_API_URL` | Mesmo host da API |
| `NEXT_PUBLIC_MARKETPLACE_URL` | Host marketplace |
| `NEXT_PUBLIC_SELLER_URL` | Host seller |
| `NEXT_PUBLIC_BACKOFFICE_URL` | Host admin |
| `NEXT_PUBLIC_AFFILIATE_URL` | Host afiliados |
| `NEXT_PUBLIC_CUSTOMER_URL` | Host conta cliente |
| `NEXT_PUBLIC_MOBILE_URL` | Host mobile/PWA |
| `CORS_ORIGIN` | Lista dos frontends acima (sem wildcard) |
| `UPLOAD_PROVIDER` | `cloudinary` quando as 3 vars Cloudinary existirem |
| `MEDIA_PUBLIC_BASE_URL` | `https://res.cloudinary.com/<cloud>/…` ou CNAME |
| `COOKIE_DOMAIN` / SSO | Só se domínio partilhado (ex. `.ishopine.com`) |
| `PLATFORM_ORG_SLUG` | default `ishopine` |
| `JWT_EXPIRES_IN` | default `7d` |
| `PLATFORM_OPS_URL` | URL do serviço platform-ops (cron outbox) |

Strangler URLs (`IDENTITY_URL`, `ORDERS_URL`, …) e flags `*_OWNED=1` — configuradas no runtime de deploy (gateway / compose), não são “credenciais” suas.

---

## 3. Formato sugerido para me enviar

Cole (ou partilhe por canal seguro) neste bloco:

```bash
# Neon
DATABASE_URL="postgresql://..."

# Google
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
# Se já tiver redirect URI exacto no Console, indique-o:
# GOOGLE_CALLBACK_URL="https://..."

# SMTP
SMTP_HOST="..."
SMTP_PORT="587"
SMTP_USER="..."
SMTP_PASS="..."
SMTP_FROM="iShopine <noreply@seudominio.com>"

# Cloudinary
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."

# DHL
DHL_EXPRESS_API_KEY="..."
DHL_EXPRESS_API_SECRET="..."
DHL_EXPRESS_ACCOUNT_NUMBER="..."
DHL_EXPRESS_ENV="test"
# opcional:
# DHL_EXPRESS_ORIGIN_CITY="Maputo"
# DHL_EXPRESS_ORIGIN_POSTAL="1100"
```

Opcional útil: domínio de produção pretendido (`ishopine.com` / subdomínios) e se a API vai para Vercel serverless ou outro host.

---

## 4. Fora de âmbito neste deploy

- **Correios MZ** — bloqueado sem OpenAPI em `docs/contracts/`
- **PaySuite live** — activar só com `PAYSUITE_ENABLED=1` + token + webhook secret após cota
