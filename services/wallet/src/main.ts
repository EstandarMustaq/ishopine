import { startStranglerProxy } from "@ishopine/shared";
import { handleOwnedWallet } from "./owned";

const owned = process.env.WALLET_OWNED !== "0";

startStranglerProxy({
  service: "wallet",
  port: Number(process.env.PORT || 4103),
  upstream: process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000",
  owns: ["/api/wallet"],
  mode: owned ? "owned" : "proxy",
  handleOwned: owned ? handleOwnedWallet : undefined,
});
