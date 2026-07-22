import { startStranglerProxy } from "@ishopine/shared";

startStranglerProxy({
  service: "wallet",
  port: Number(process.env.PORT || 4103),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: ["/api/wallet"],
  mode: "proxy",
});
