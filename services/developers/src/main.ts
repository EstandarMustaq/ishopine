/**
 * Phase 19: developers owns API keys / v1 / feature-flags when DEVELOPERS_OWNED≠0.
 */
import { startStranglerProxy } from "@ishopine/shared";
import { handleOwnedDevelopers } from "./owned";

const owned = process.env.DEVELOPERS_OWNED !== "0";

startStranglerProxy({
  service: "developers",
  port: Number(process.env.PORT || 4106),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: ["/api/developers", "/api/v1", "/api/feature-flags"],
  mode: owned ? "owned" : "proxy",
  handleOwned: owned ? handleOwnedDevelopers : undefined,
});
