/**
 * Shared strangler proxy helper (Phase 6).
 * Services report mode: proxy | owned.
 */
import http from "node:http";
import httpProxy from "http-proxy";

export type StranglerMode = "proxy" | "owned";

export type StranglerOptions = {
  service: string;
  port: number;
  upstream: string;
  /** Path prefixes this service owns (for health metadata). */
  owns: string[];
  mode?: StranglerMode;
  /**
   * Optional owned-route handler. Return true if the request was handled.
   * Unhandled requests fall through to the upstream proxy.
   */
  handleOwned?: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) => boolean | Promise<boolean>;
};

export function startStranglerProxy(opts: StranglerOptions) {
  const mode: StranglerMode = opts.mode ?? "proxy";
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
    void (async () => {
      if (req.url === "/health" || req.url === "/api/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ok: true,
            service: opts.service,
            upstream: opts.upstream,
            owns: opts.owns,
            mode,
          }),
        );
        return;
      }

      if (opts.handleOwned) {
        const handled = await opts.handleOwned(req, res);
        if (handled) return;
      }

      req.headers["x-strangler-service"] = opts.service;
      req.headers["x-strangler-mode"] = mode;
      proxy.web(req, res);
    })();
  });

  server.listen(opts.port, () => {
    console.log(
      `[${opts.service}] :${opts.port} → ${opts.upstream} (strangler ${mode} owns ${opts.owns.join(", ")})`,
    );
  });

  return server;
}
