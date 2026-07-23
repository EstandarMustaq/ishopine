/**
 * Phase 28: platform-ops owns users / reliability / cron when OWNED≠0.
 */
import { startStranglerProxy } from "@ishopine/shared";
import { handleOwnedPlatformOps } from "./owned";

const owned = process.env.PLATFORM_OPS_OWNED !== "0";

startStranglerProxy({
  service: "platform-ops",
  port: Number(process.env.PORT || 4119),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: ["/api/users", "/api/reliability", "/api/cron"],
  mode: owned ? "owned" : "proxy",
  handleOwned: owned ? handleOwnedPlatformOps : undefined,
});
