/**
 * Phase 24: inventory owns /api/inventory when INVENTORY_OWNED≠0.
 */
import { startStranglerProxy } from "@ishopine/shared";
import { handleOwnedInventory } from "./owned";

const owned = process.env.INVENTORY_OWNED !== "0";

startStranglerProxy({
  service: "inventory",
  port: Number(process.env.PORT || 4116),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: ["/api/inventory"],
  mode: owned ? "owned" : "proxy",
  handleOwned: owned ? handleOwnedInventory : undefined,
});
