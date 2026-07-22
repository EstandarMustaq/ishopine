export type AppTarget = "marketplace" | "seller" | "backoffice" | "affiliate";

export function getAppUrls() {
  return {
    marketplace:
      process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3000",
    seller: process.env.NEXT_PUBLIC_SELLER_URL || "http://localhost:3001",
    backoffice:
      process.env.NEXT_PUBLIC_BACKOFFICE_URL || "http://localhost:3002",
    affiliate:
      process.env.NEXT_PUBLIC_AFFILIATE_URL || "http://localhost:3003",
  };
}

/** Absolute URL into another app, with one-time token handoff. */
export function appHandoffUrl(
  target: Exclude<AppTarget, "marketplace">,
  accessToken: string,
  path = "/",
): string {
  const urls = getAppUrls();
  const base = urls[target].replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${cleanPath}`);
  url.searchParams.set("token", accessToken);
  return url.toString();
}
