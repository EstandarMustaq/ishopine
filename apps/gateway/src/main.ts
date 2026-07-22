import http from "node:http";
import httpProxy from "http-proxy";

const port = Number(process.env.PORT || 8080);
const upstream = process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000";

const proxy = httpProxy.createProxyServer({
  target: upstream,
  changeOrigin: true,
  xfwd: true,
});

proxy.on("error", (err, _req, res) => {
  console.error("[gateway] proxy error", err.message);
  if ("writeHead" in res) {
    (res as http.ServerResponse).writeHead(502, {
      "Content-Type": "application/json",
    });
    (res as http.ServerResponse).end(
      JSON.stringify({ message: "Upstream indisponível", upstream }),
    );
  }
});

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "gateway",
        upstream,
        mode: "strangler",
      }),
    );
    return;
  }

  // Preserve /api prefix expected by the monolith.
  proxy.web(req, res);
});

server.listen(port, () => {
  console.log(
    `[gateway] listening on :${port} → ${upstream} (strangler)`,
  );
});
