import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/products/product-card";
import { ReputationBadge } from "@/components/shops/reputation-badge";
import { SiteSearch } from "@/components/search/site-search";
import { apiFetch } from "@/lib/api";
import { shopTypeLabel } from "@/lib/mozambique";
import type { Paginated, Product, Shop } from "@/lib/types";

interface PesquisaPageProps {
  searchParams: Promise<{ q?: string }>;
}

async function getResults(q?: string) {
  if (!q?.trim()) {
    return {
      products: [] as Product[],
      shops: [] as Shop[],
    };
  }
  const encoded = encodeURIComponent(q.trim());
  try {
    const [products, shops] = await Promise.all([
      apiFetch<Paginated<Product>>(`/products?q=${encoded}&limit=24`, {
        token: null,
      }),
      apiFetch<Paginated<Shop>>(`/shops?q=${encoded}&limit=12`, {
        token: null,
      }),
    ]);
    return {
      products: products.items ?? [],
      shops: shops.items ?? [],
    };
  } catch {
    return {
      products: [] as Product[],
      shops: [] as Shop[],
    };
  }
}

export default async function PesquisaPage({ searchParams }: PesquisaPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const { products, shops } = await getResults(q);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-charcoal">Pesquisa</h1>
      <p className="mt-2 text-sm text-taupe">
        {q
          ? `Resultados para “${q}”`
          : "Escreva um termo para encontrar produtos e lojas."}
      </p>

      <div className="mt-6 max-w-md">
        <SiteSearch className="max-w-none" />
      </div>

      {q && (
        <>
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-zinc-900">
              Produtos ({products.length})
            </h2>
            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            {products.length === 0 && (
              <p className="mt-4 text-sm text-taupe">Nenhum produto encontrado.</p>
            )}
          </section>

          <section className="mt-12">
            <h2 className="text-lg font-semibold text-zinc-900">
              Lojas ({shops.length})
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shops.map((shop) => (
                <Link
                  key={shop.id}
                  href={`/lojas/${shop.slug}`}
                  className="overflow-hidden rounded-xl border border-border transition-transform hover:scale-[1.01]"
                >
                  <div className="relative h-24 bg-zinc-100">
                    {shop.bannerUrl || shop.logoUrl ? (
                      <Image
                        src={shop.bannerUrl || shop.logoUrl!}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="400px"
                      />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-zinc-900">{shop.name}</p>
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                      {shopTypeLabel(shop.shopType)}
                    </p>
                    <ReputationBadge
                      className="mt-2"
                      compact
                      ratingAvg={shop.ratingAvg}
                      ratingCount={shop.ratingCount}
                      reputationScore={shop.reputationScore}
                    />
                  </div>
                </Link>
              ))}
            </div>
            {shops.length === 0 && (
              <p className="mt-4 text-sm text-taupe">Nenhuma loja encontrada.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
