/**
 * Phase 11–31: payments owns PaySuite + legacy stripe/mpesa when OWNED≠0.
 */
import { startStranglerProxy } from "@ishopine/shared";
import { handleOwnedPayments } from "./owned";

const owned = process.env.PAYMENTS_OWNED !== "0";

startStranglerProxy({
  service: "payments",
  port: Number(process.env.PORT || 4102),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: [
    "/api/billing/paysuite",
    "/api/billing/stripe",
    "/api/billing/mpesa",
  ],
  mode: owned ? "owned" : "proxy",
  handleOwned: owned ? handleOwnedPayments : undefined,
});
