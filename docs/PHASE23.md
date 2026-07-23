# Fase 23 — Live DHL (fail-closed) + CDN edge real

## Objectivo

Entregar **partners live reais** e **CDN de entrega**, sem teatro:

- **DHL Express** via MyDHL API HTTP — só cotiza com credenciais
- **Correios MZ** continua **indisponível** (sem API pública/contratada) →
  legacy `CORREIOS_MZ` → `MANUAL`
- **CDN**: Cloudinary global edge + `MEDIA_CDN_HOST` (CNAME real) —
  **não** inventamos mapa de PoPs

## Entregue

### Logistics
- Enum `CarrierCode.DHL_EXPRESS`
- Adapter `dhl-express` (owned + Nest): `POST {base}/rates` BasicAuth
- Fail-closed: sem `DHL_EXPRESS_API_KEY` + `SECRET` + `ACCOUNT_NUMBER` →
  quote devolve `null` (carrier omitido)
- `GET /api/logistics/partners` — estado local vs live vs unavailable
- `GET /api/logistics/carriers` inclui `live: boolean`

### Media / CDN
- `MEDIA_CDN_HOST` reescreve host de delivery (Cloudinary CNAME / edge)
- `mediaCdnStatus()` + `GET /api/media/cdn` (ops truth, sem PoP fictícios)
- Edge = rede global Cloudinary (multi-PoP **do vendor**)

## Env

```bash
# DHL Express (MyDHL) — opcional; sem isto DHL não entra nas cotações
DHL_EXPRESS_API_KEY=
DHL_EXPRESS_API_SECRET=
DHL_EXPRESS_ACCOUNT_NUMBER=
DHL_EXPRESS_ENV=test   # ou production
# DHL_EXPRESS_ORIGIN_COUNTRY=MZ
# DHL_EXPRESS_ORIGIN_CITY=Maputo
# DHL_EXPRESS_ORIGIN_POSTAL=1100

# CDN delivery (Cloudinary private CDN / CNAME)
# MEDIA_CDN_HOST=cdn.ishopine.com
# MEDIA_PUBLIC_BASE_URL=https://cdn.ishopine.com
# UPLOAD_PROVIDER=cloudinary
```

Schema: `pnpm db:push` (ou migrate) para `DHL_EXPRESS` no enum.

## Fora de âmbito
- Cliente HTTP Correios MZ (continua sem contrato/API)
- Inventar PoPs (Maputo/JHB/… fictícios)
- Melhor Envio / stubs de tracking inventados
