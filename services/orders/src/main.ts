import { startStranglerProxy } from "./strangler";

startStranglerProxy({
  service: "orders",
  port: Number(process.env.PORT || 4101),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: ["/api/orders", "/api/cart"],
});
