/**
 * Phase 15: billing owns pricing/subscriptions/usage when BILLING_OWNED≠0.
 * PaySuite remains payments owned (gateway) / Nest fallthrough.
 */
import { startStranglerProxy } from "@ishopine/shared";
import { handleOwnedBilling } from "./owned";

const owned = process.env.BILLING_OWNED !== "0";

startStranglerProxy({
  service: "billing",
  port: Number(process.env.PORT || 4104),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: ["/api/pricing", "/api/subscriptions", "/api/billing"],
  mode: owned ? "owned" : "proxy",
  handleOwned: owned ? handleOwnedBilling : undefined,
});
