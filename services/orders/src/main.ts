/**
 * Phase 8–9: orders service owns cart + order reads + status writes
 * when ORDERS_OWNED≠0. Checkout stays on Nest upstream.
 */
import { startStranglerProxy } from "@ishopine/shared";
import { handleOwnedOrders } from "./owned";

const owned = process.env.ORDERS_OWNED !== "0";

startStranglerProxy({
  service: "orders",
  port: Number(process.env.PORT || 4101),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: ["/api/orders", "/api/cart"],
  mode: owned ? "owned" : "proxy",
  handleOwned: owned ? handleOwnedOrders : undefined,
});
