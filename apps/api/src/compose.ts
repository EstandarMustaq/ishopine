/**
 * Production composition — exclusive domain ownership in services/*.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { GATEWAY_ROUTES } from "@ishopine/shared";
import { handleOwnedIdentity } from "../../../services/identity/src/owned";
import { handleOwnedAffiliates } from "../../../services/affiliates/src/owned";
import { handleOwnedAccounts } from "../../../services/accounts/src/owned";
import { handleOwnedMarketplace } from "../../../services/marketplace/src/owned";
import { handleOwnedCatalog } from "../../../services/catalog/src/owned";
import { handleOwnedReviews } from "../../../services/reviews/src/owned";
import { handleOwnedMedia } from "../../../services/media/src/owned";
import { handleOwnedOrders } from "../../../services/orders/src/owned";
import { handleOwnedPayments } from "../../../services/payments/src/owned";
import { handleOwnedWallet } from "../../../services/wallet/src/owned";
import { handleOwnedBilling } from "../../../services/billing/src/owned";
import { handleOwnedDevelopers } from "../../../services/developers/src/owned";
import { handleOwnedLogistics } from "../../../services/logistics/src/owned";
import { handleOwnedAccounting } from "../../../services/accounting/src/owned";
import { handleOwnedComms } from "../../../services/comms/src/owned";
import { handleOwnedCoupons } from "../../../services/coupons/src/owned";
import { handleOwnedInventory } from "../../../services/inventory/src/owned";
import { handleOwnedPlatformSettings } from "../../../services/platform-settings/src/owned";
import { handleOwnedPlatformOps } from "../../../services/platform-ops/src/owned";
import { handleOwnedPlatformSecurity } from "../../../services/platform-security/src/owned";

type OwnedHandler = (
  req: IncomingMessage,
  res: ServerResponse,
) => boolean | Promise<boolean>;

const HANDLERS: Record<string, OwnedHandler> = {
  identity: handleOwnedIdentity,
  affiliates: handleOwnedAffiliates,
  accounts: handleOwnedAccounts,
  marketplace: handleOwnedMarketplace,
  catalog: handleOwnedCatalog,
  reviews: handleOwnedReviews,
  media: handleOwnedMedia,
  orders: handleOwnedOrders,
  payments: handleOwnedPayments,
  wallet: handleOwnedWallet,
  billing: handleOwnedBilling,
  developers: handleOwnedDevelopers,
  logistics: handleOwnedLogistics,
  accounting: handleOwnedAccounting,
  comms: handleOwnedComms,
  coupons: handleOwnedCoupons,
  inventory: handleOwnedInventory,
  "platform-settings": handleOwnedPlatformSettings,
  "platform-ops": handleOwnedPlatformOps,
  "platform-security": handleOwnedPlatformSecurity,
};

function pathOnly(url?: string) {
  return (url || "/").split("?")[0];
}

function applyCors(req: IncomingMessage, res: ServerResponse) {
  const originRaw =
    process.env.CORS_ORIGIN ||
    "https://ishopine.vercel.app,http://localhost:3000";
  const requestOrigin = req.headers.origin;
  if (originRaw === "*") {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else {
    const allowed = originRaw.split(",").map((o) => o.trim());
    if (requestOrigin && allowed.includes(requestOrigin)) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
    }
  }
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Idempotency-Key, X-Request-Id, x-tenant-id",
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  res.setHeader("Access-Control-Expose-Headers", "X-Request-Id");
}

function resolveService(urlPath: string): string | null {
  for (const route of GATEWAY_ROUTES) {
    if (!urlPath.startsWith(route.prefix)) continue;
    if (route.pathRe && !route.pathRe.test(urlPath)) continue;
    return route.service;
  }
  return null;
}

export async function handleComposition(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }

  const urlPath = pathOnly(req.url);

  if (urlPath === "/health" || urlPath === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "ishopine-api",
        mode: "composition",
        phase: "40+",
        marketplace: "iShopine",
        country: "MZ",
        currency: "MZN",
        ownership: "services-exclusive",
        domains: Object.keys(HANDLERS),
        timestamp: new Date().toISOString(),
      }),
    );
    return true;
  }

  const service = resolveService(urlPath);
  if (!service) {
    return false;
  }

  if (service === "commerce-orchestrator") {
    res.writeHead(501, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message:
          "Use /api/orders checkout + /api/billing/paysuite. Orchestrator saga is a separate process when ORCHESTRATOR_URL is set.",
        service: "commerce-orchestrator",
        mode: "composition",
      }),
    );
    return true;
  }

  if (service === "monolith") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: "Monolith domain ownership retired",
        mode: "composition",
      }),
    );
    return true;
  }

  const handler = HANDLERS[service];
  if (!handler) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: `Service handler not registered: ${service}`,
        mode: "composition",
      }),
    );
    return true;
  }

  res.setHeader("x-ishopine-owner", service);
  res.setHeader("x-ishopine-mode", "composition");
  const handled = await handler(req, res);
  if (handled) return true;

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      message: "Not Found",
      service,
      path: urlPath,
      mode: "composition",
    }),
  );
  return true;
}
