import { startStranglerProxy } from "@ishopine/shared";

startStranglerProxy({
  service: "payments",
  port: Number(process.env.PORT || 4102),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: ["/api/billing/paysuite"],
  mode: "proxy",
});
