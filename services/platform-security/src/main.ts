/**
 * Phase 29: platform-security owns /api/security when OWNED≠0.
 */
import { startStranglerProxy } from "@ishopine/shared";
import { handleOwnedPlatformSecurity } from "./owned";
import { syncSystem } from "./security-core";

const owned = process.env.PLATFORM_SECURITY_OWNED !== "0";

startStranglerProxy({
  service: "platform-security",
  port: Number(process.env.PORT || 4120),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: ["/api/security"],
  mode: owned ? "owned" : "proxy",
  handleOwned: owned ? handleOwnedPlatformSecurity : undefined,
});

/** Nest SecurityModule.onModuleInit parity — best-effort boot sync. */
if (owned) {
  syncSystem().catch((error) => {
    console.warn("[platform-security] boot sync skipped", error);
  });
}
