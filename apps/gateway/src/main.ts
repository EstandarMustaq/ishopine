import http from "node:http";
import httpProxy from "http-proxy";
import { GATEWAY_ROUTES } from "@ishopine/shared";

const port = Number(process.env.PORT || 8080);
const upstream = process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000";

/** When false (default), always use monolith — safe rollout. */
const stranglerEnabled = process.env.STRANGLER_ROUTING === "1";

function resolveTarget(urlPath: string): {
  target: string;
  service: string;
} {
  if (!stranglerEnabled) {
    return { target: upstream, service: "monolith" };
  }

  for (const route of GATEWAY_ROUTES) {
    if (!urlPath.startsWith(route.prefix)) continue;
    const envUrl = route.envKey ? process.env[route.envKey] : undefined;
    if (envUrl) {
      return { target: envUrl.replace(/\/$/, ""), service: route.service };
    }
    // Env not set → fall through to monolith (partial rollout).
    return { target: upstream, service: "monolith" };
  }

  return { target: upstream, service: "monolith" };
}

const proxies = new Map<string, httpProxy>();

function getProxy(target: string) {
  let proxy = proxies.get(target);
  if (!proxy) {
    proxy = httpProxy.createProxyServer({
      target,
      changeOrigin: true,
      xfwd: true,
    });
    proxy.on("error", (err, _req, res) => {
      console.error("[gateway] proxy error", target, err.message);
      if ("writeHead" in res) {
        (res as http.ServerResponse).writeHead(502, {
          "Content-Type": "application/json",
        });
        (res as http.ServerResponse).end(
          JSON.stringify({
            message: "Upstream indisponível",
            target,
          }),
        );
      }
    });
    proxies.set(target, proxy);
  }
  return proxy;
}

const server = http.createServer((req, res) => {
  const urlPath = (req.url || "/").split("?")[0];

  if (urlPath === "/health" || urlPath === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "gateway",
        upstream,
        stranglerRouting: stranglerEnabled,
        routes: GATEWAY_ROUTES.map((r) => ({
          prefix: r.prefix,
          service: r.service,
          configured: Boolean(r.envKey && process.env[r.envKey!]),
        })),
        mode: "strangler",
      }),
    );
    return;
  }

  const { target, service } = resolveTarget(urlPath);
  req.headers["x-gateway-service"] = service;
  getProxy(target).web(req, res);
});

server.listen(port, () => {
  console.log(
    `[gateway] :${port} → default ${upstream} (STRANGLER_ROUTING=${stranglerEnabled ? "1" : "0"})`,
  );
});
