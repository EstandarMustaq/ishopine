/**
 * Phase 24: reviews owns /api/products/:id/reviews when REVIEWS_OWNED≠0.
 */
import { startStranglerProxy } from "@ishopine/shared";
import { handleOwnedReviews } from "./owned";

const owned = process.env.REVIEWS_OWNED !== "0";

startStranglerProxy({
  service: "reviews",
  port: Number(process.env.PORT || 4117),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: ["/api/products/:id/reviews"],
  mode: owned ? "owned" : "proxy",
  handleOwned: owned ? handleOwnedReviews : undefined,
});
