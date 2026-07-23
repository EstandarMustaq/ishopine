/**
 * Phase 24: coupons owns /api/coupons when COUPONS_OWNED≠0.
 */
import { startStranglerProxy } from "@ishopine/shared";
import { handleOwnedCoupons } from "./owned";

const owned = process.env.COUPONS_OWNED !== "0";

startStranglerProxy({
  service: "coupons",
  port: Number(process.env.PORT || 4115),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: ["/api/coupons"],
  mode: owned ? "owned" : "proxy",
  handleOwned: owned ? handleOwnedCoupons : undefined,
});
