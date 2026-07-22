import { startStranglerProxy } from "./strangler";

startStranglerProxy({
  service: "developers",
  port: Number(process.env.PORT || 4106),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: ["/api/developers", "/api/v1", "/api/feature-flags"],
});
