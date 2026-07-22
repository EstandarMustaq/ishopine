/**
 * Generic strangler proxy service: health locally, everything else → upstream.
 */
import http from "node:http";
import httpProxy from "http-proxy";

export type StranglerOptions = {
  service: string;
  port: number;
  upstream: string;
  /** Path prefixes this service owns (for health metadata). */
  owns: string[];
};

export function startStranglerProxy(opts: StranglerOptions) {
  const proxy = httpProxy.createProxyServer({
    target: opts.upstream,
    changeOrigin: true,
    xfwd: true,
  });

  proxy.on("error", (err, _req, res) => {
    console.error(`[${opts.service}] proxy error`, err.message);
    if ("writeHead" in res) {
      (res as http.ServerResponse).writeHead(502, {
        "Content-Type": "application/json",
      });
      (res as http.ServerResponse).end(
        JSON.stringify({
          message: "Upstream indisponível",
          service: opts.service,
          upstream: opts.upstream,
        }),
      );
    }
  });

  const server = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/api/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          service: opts.service,
          upstream: opts.upstream,
          owns: opts.owns,
          mode: "strangler-proxy",
        }),
      );
      return;
    }

    req.headers["x-strangler-service"] = opts.service;
    proxy.web(req, res);
  });

  server.listen(opts.port, () => {
    console.log(
      `[${opts.service}] :${opts.port} → ${opts.upstream} (strangler-proxy owns ${opts.owns.join(", ")})`,
    );
  });

  return server;
}
