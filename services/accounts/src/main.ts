/**
 * Phase 16: accounts owns /api/accounts when ACCOUNTS_OWNED≠0.
 * Nest TenantGuard / AccountsService remain for in-process authz.
 */
import { startStranglerProxy } from "@ishopine/shared";
import { handleOwnedAccounts } from "./owned";

const owned = process.env.ACCOUNTS_OWNED !== "0";

startStranglerProxy({
  service: "accounts",
  port: Number(process.env.PORT || 4109),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: ["/api/accounts"],
  mode: owned ? "owned" : "proxy",
  handleOwned: owned ? handleOwnedAccounts : undefined,
});
