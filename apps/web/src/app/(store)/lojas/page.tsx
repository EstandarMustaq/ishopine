import Image from "next/image";
import Link from "next/link";
import { ShopFilters } from "@/components/shops/shop-filters";
import { ReputationBadge } from "@/components/shops/reputation-badge";
import { apiFetch } from "@/lib/api";
import { SHOP_TYPES, shopTypeLabel } from "@/lib/mozambique";
import type { Paginated, Shop } from "@/lib/types";
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
    return await apiFetch<Paginated<Shop>>(`/shops?${qs.toString()}`, {
      token: null,
    });
  } catch {
    return {
      items: [] as Shop[],
      meta: { page: 1, limit: 24, total: 0, totalPages: 1 },
    };
  }
}

export default async function LojasPage({ searchParams }: LojasPageProps) {
  const params = await searchParams;
  const data = await getShops(params.q, params.type, params.page);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-charcoal">Lojas</h1>
      <p className="mt-2 text-sm text-taupe">
        Conheça vendedores do iShopine por tipo de loja e reputação.
      </p>

      <ShopFilters initialQ={params.q} initialType={params.type} />

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/lojas"
          className={cn(
            "rounded-full border px-3 py-1.5 text-[12px] font-medium",
            !params.type
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-200 text-zinc-600",
          )}
        >
          Todos
        </Link>
        {SHOP_TYPES.map((type) => (
          <Link
            key={type.value}
            href={`/lojas?type=${type.value}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12px] font-medium",
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
            className="group overflow-hidden rounded-[12px] border border-border transition-transform duration-300 hover:scale-[1.01]"
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
              <p className="font-semibold text-charcoal group-hover:text-[#111111]">
                {shop.name}
              </p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                {shopTypeLabel(shop.shopType)}
              </p>
              {shop.description && (
                <p className="mt-1 line-clamp-2 text-sm text-taupe">
                  {shop.description}
                </p>
              )}
              <ReputationBadge
                className="mt-3"
                ratingAvg={shop.ratingAvg}
                ratingCount={shop.ratingCount}
                reputationScore={shop.reputationScore}
              />
              <p className="mt-2 text-xs text-taupe">
                {[shop.district, shop.province].filter(Boolean).join(" · ")}
                {shop._count?.products != null
                  ? ` · ${shop._count.products} produtos`
                  : ""}
              </p>
            </div>
          </Link>
        ))}
        {data.items.length === 0 && (
          <p className="col-span-full text-sm text-taupe">
            Nenhuma loja encontrada.
          </p>
        )}
      </div>
    </div>
  );
}
