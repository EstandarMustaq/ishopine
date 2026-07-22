/**
 * Phase 14: affiliates owns /api/affiliate when AFFILIATES_OWNED≠0.
 * Internal: POST /api/affiliate/internal/register-conversion (settle from Nest).
 */
import { startStranglerProxy } from "@ishopine/shared";
import { handleOwnedAffiliates } from "./owned";

const owned = process.env.AFFILIATES_OWNED !== "0";

startStranglerProxy({
  service: "affiliates",
  port: Number(process.env.PORT || 4108),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: ["/api/affiliate"],
  mode: owned ? "owned" : "proxy",
  handleOwned: owned ? handleOwnedAffiliates : undefined,
});
