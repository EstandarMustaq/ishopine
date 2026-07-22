import { startStranglerProxy } from "./strangler";

startStranglerProxy({
  service: "billing",
  port: Number(process.env.PORT || 4104),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: ["/api/pricing", "/api/subscriptions", "/api/billing"],
});
