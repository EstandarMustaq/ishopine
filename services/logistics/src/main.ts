/**
 * Phase 20: logistics owns /api/logistics when LOGISTICS_OWNED≠0.
 */
import { startStranglerProxy } from "@ishopine/shared";
import { handleOwnedLogistics } from "./owned";

const owned = process.env.LOGISTICS_OWNED !== "0";

startStranglerProxy({
  service: "logistics",
  port: Number(process.env.PORT || 4112),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: ["/api/logistics"],
  mode: owned ? "owned" : "proxy",
  handleOwned: owned ? handleOwnedLogistics : undefined,
});
