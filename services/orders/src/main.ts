/**
 * Phase 8–10: orders service owns cart, reads, status, and checkout
 * when ORDERS_OWNED≠0. PaySuite stays Nest / payments proxy.
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
