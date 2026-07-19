import Image from "next/image";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { Paginated, Shop } from "@/lib/types";

interface LojasPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

async function getShops(q?: string, page?: string) {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
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
  const data = await getShops(params.q, params.page);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-charcoal">Lojas</h1>
      <p className="mt-2 text-sm text-taupe">
        Explore vendedores do mercado aberto iShopine.
      </p>

      <form className="mt-6 flex gap-2" action="/lojas">
        <input
          name="q"
          defaultValue={params.q}
          placeholder="Buscar loja..."
          className="h-10 flex-1 rounded-input border border-input bg-white px-3 text-sm outline-none ring-ring focus:ring-2"
        />
        <button
          type="submit"
          className="h-10 rounded-button bg-[#111111] px-4 text-sm font-medium text-white"
        >
          Buscar
        </button>
      </form>

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
              {shop.description && (
                <p className="mt-1 line-clamp-2 text-sm text-taupe">
                  {shop.description}
                </p>
              )}
              <p className="mt-2 text-xs text-taupe">
                {[shop.city, shop.state].filter(Boolean).join(", ") ||
                  "Brasil"}
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
