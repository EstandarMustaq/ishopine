/**
 * Phase 27: platform-settings owns dashboard + settings when OWNED≠0.
 */
import { startStranglerProxy } from "@ishopine/shared";
import { handleOwnedPlatformSettings } from "./owned";

const owned = process.env.PLATFORM_SETTINGS_OWNED !== "0";

startStranglerProxy({
  service: "platform-settings",
  port: Number(process.env.PORT || 4118),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: ["/api/dashboard", "/api/store/settings", "/api/platform/settings"],
  mode: owned ? "owned" : "proxy",
  handleOwned: owned ? handleOwnedPlatformSettings : undefined,
});
