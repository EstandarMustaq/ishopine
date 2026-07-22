/**
 * Phase 22: comms owns notifications/conversations/disputes when COMMS_OWNED≠0.
 */
import { startStranglerProxy } from "@ishopine/shared";
import { handleOwnedComms } from "./owned";

const owned = process.env.COMMS_OWNED !== "0";

startStranglerProxy({
  service: "comms",
  port: Number(process.env.PORT || 4114),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: ["/api/notifications", "/api/conversations", "/api/disputes"],
  mode: owned ? "owned" : "proxy",
  handleOwned: owned ? handleOwnedComms : undefined,
});
