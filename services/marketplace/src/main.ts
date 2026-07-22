/**
 * Phase 18: marketplace owns shops/ads/wishlist when MARKETPLACE_OWNED≠0.
 */
import { startStranglerProxy } from "@ishopine/shared";
import { handleOwnedMarketplace } from "./owned";

const owned = process.env.MARKETPLACE_OWNED !== "0";

startStranglerProxy({
  service: "marketplace",
  port: Number(process.env.PORT || 4111),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: ["/api/shops", "/api/ads", "/api/wishlist"],
  mode: owned ? "owned" : "proxy",
  handleOwned: owned ? handleOwnedMarketplace : undefined,
});
