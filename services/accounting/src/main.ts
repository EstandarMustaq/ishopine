/**
 * Phase 21: accounting owns /api/accounting when ACCOUNTING_OWNED≠0.
 */
import { startStranglerProxy } from "@ishopine/shared";
import { handleOwnedAccounting } from "./owned";

const owned = process.env.ACCOUNTING_OWNED !== "0";

startStranglerProxy({
  service: "accounting",
  port: Number(process.env.PORT || 4113),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: ["/api/accounting"],
  mode: owned ? "owned" : "proxy",
  handleOwned: owned ? handleOwnedAccounting : undefined,
});
