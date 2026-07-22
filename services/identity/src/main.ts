/**
 * Phase 13: identity owns local auth / 2FA / session when IDENTITY_OWNED≠0.
 * Google OAuth remains Nest fallthrough.
 */
import { startStranglerProxy } from "@ishopine/shared";
import { handleOwnedIdentity } from "./owned";

const owned = process.env.IDENTITY_OWNED !== "0";

startStranglerProxy({
  service: "identity",
  port: Number(process.env.PORT || 4107),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: ["/api/auth"],
  mode: owned ? "owned" : "proxy",
  handleOwned: owned ? handleOwnedIdentity : undefined,
});
