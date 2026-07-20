import Image from "next/image";
import Link from "next/link";
import { AdBanner } from "@/components/ads/ad-banner";
import { ShopFilters } from "@/components/shops/shop-filters";
import { ReputationBadge } from "@/components/shops/reputation-badge";
import { apiFetch } from "@/lib/api";
import { SHOP_TYPES, shopTypeLabel } from "@/lib/mozambique";
import type { Ad, Paginated, Shop } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LojasPageProps {
  searchParams: Promise<{ q?: string; type?: string; page?: string }>;
}

async function getShops(q?: string, type?: string, page?: string) {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (type) qs.set("type", type);
  if (page) qs.set("page", page);
  qs.set("limit", "24");
  try {
    const [shops, ads] = await Promise.all([
      apiFetch<Paginated<Shop>>(`/shops?${qs.toString()}`, { token: null }),
      apiFetch<Ad[]>("/ads?slot=LOJAS_TOP", { token: null }).catch(
        () => [] as Ad[],
      ),
    ]);
    return { shops, ads };
  } catch {
    return {
      shops: {
        items: [] as Shop[],
        meta: { page: 1, limit: 24, total: 0, totalPages: 1 },
      },
      ads: [] as Ad[],
    };
  }
}

export default async function LojasPage({ searchParams }: LojasPageProps) {
  const params = await searchParams;
  const { shops: data, ads } = await getShops(
    params.q,
    params.type,
    params.page,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-3xl font-bold lowercase tracking-tight text-zinc-900">
        lojas
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        conheça vendedores do ishopine por tipo e reputação.
      </p>

      {ads.length > 0 && (
        <div className="mt-6">
          <AdBanner ads={ads} />
        </div>
      )}

      <ShopFilters initialType={params.type} />

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/lojas"
          className={cn(
            "rounded-full border px-3 py-1.5 text-[12px] font-medium lowercase",
            !params.type
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-200 text-zinc-600",
          )}
        >
          todos
        </Link>
        {SHOP_TYPES.map((type) => (
          <Link
            key={type.value}
            href={`/lojas?type=${type.value}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12px] font-medium lowercase",
              params.type === type.value
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 text-zinc-600",
            )}
          >
            {type.label}
          </Link>
        ))}
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((shop) => (
          <Link
            key={shop.id}
            href={`/lojas/${shop.slug}`}
            className="group overflow-hidden rounded-2xl border border-zinc-100 bg-white transition-transform duration-300 hover:scale-[1.01]"
          >
            <div className="relative h-28 bg-[var(--brand-purple-light)]">
              {shop.bannerUrl || shop.logoUrl ? (
                <Image
                  src={shop.bannerUrl || shop.logoUrl!}
                  alt={shop.name}
                  fill
                  className="object-cover"
                  sizes="400px"
                />
              ) : null}
            </div>
            <div className="p-4">
              <p className="font-semibold text-zinc-900 group-hover:underline">
                {shop.name}
              </p>
              <p className="mt-1 text-[11px] font-medium lowercase tracking-wide text-zinc-400">
                {shopTypeLabel(shop.shopType)}
              </p>
              {shop.description && (
                <p className="mt-1 line-clamp-2 text-sm text-zinc-500">
                  {shop.description}
                </p>
              )}
              <ReputationBadge
                className="mt-3"
                ratingAvg={shop.ratingAvg}
                ratingCount={shop.ratingCount}
                reputationScore={shop.reputationScore}
              />
              <p className="mt-2 text-xs text-zinc-500">
                {[shop.district, shop.province].filter(Boolean).join(" · ")}
                {shop._count?.products != null
                  ? ` · ${shop._count.products} produtos`
                  : ""}
              </p>
            </div>
          </Link>
        ))}
        {data.items.length === 0 && (
          <p className="col-span-full text-sm text-zinc-500">
            nenhuma loja encontrada.
          </p>
        )}
      </div>
    </div>
  );
}
