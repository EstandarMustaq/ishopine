import { startStranglerProxy } from "@ishopine/shared";

/** Phase 6: identity edge — still proxies auth to monolith. */
startStranglerProxy({
  service: "identity",
  port: Number(process.env.PORT || 4107),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: ["/api/auth"],
  mode: "proxy",
});
