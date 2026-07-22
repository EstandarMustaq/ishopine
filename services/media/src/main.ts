import { startStranglerProxy } from "./strangler";

startStranglerProxy({
  service: "media",
  port: Number(process.env.PORT || 4105),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: ["/api/media", "/api/uploads"],
});
