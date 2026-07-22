/**
 * Phase 17: catalog owns categories/products when CATALOG_OWNED≠0.
 */
import { startStranglerProxy } from "@ishopine/shared";
import { handleOwnedCatalog } from "./owned";

const owned = process.env.CATALOG_OWNED !== "0";

startStranglerProxy({
  service: "catalog",
  port: Number(process.env.PORT || 4110),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: [
    "/api/categories",
    "/api/products",
    "/api/seller/categories",
    "/api/seller/products",
    "/api/admin/products",
  ],
  mode: owned ? "owned" : "proxy",
  handleOwned: owned ? handleOwnedCatalog : undefined,
});
