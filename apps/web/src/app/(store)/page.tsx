import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/products/product-card";
import { AdBanner, AdStrip } from "@/components/ads/ad-banner";
import {
  HorizontalCatalog,
  HorizontalCatalogItem,
} from "@/components/catalog/horizontal-catalog";
import { ReputationBadge } from "@/components/shops/reputation-badge";
import { apiFetch } from "@/lib/api";
import { shopTypeLabel } from "@/lib/mozambique";
import type { Ad, Category, Paginated, Product, Shop } from "@/lib/types";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=2000&q=80";

async function getHomeData() {
  try {
    const [categories, featured, shops, heroAds, stripAds] = await Promise.all([
      apiFetch<Category[]>("/categories", { token: null }),
      apiFetch<Paginated<Product>>(
        "/products?featured=true&limit=8&sort=newest",
        { token: null },
      ),
      apiFetch<Paginated<Shop>>("/shops?limit=12", { token: null }),
      apiFetch<Ad[]>("/ads?slot=HOME_HERO", { token: null }).catch(() => [] as Ad[]),
      apiFetch<Ad[]>("/ads?slot=HOME_STRIP", { token: null }).catch(() => [] as Ad[]),
    ]);
    return {
      categories,
      featured: featured.items,
      shops: shops.items,
      heroAds,
      stripAds,
    };
  } catch {
    return {
      categories: [] as Category[],
      featured: [] as Product[],
      shops: [] as Shop[],
      heroAds: [] as Ad[],
      stripAds: [] as Ad[],
    };
  }
}

export default async function HomePage() {
  const { categories, featured, shops, heroAds, stripAds } = await getHomeData();
  const heroAd = heroAds[0];

  return (
    <>
      <section className="relative min-h-[88svh] w-full overflow-hidden sm:min-h-[92svh]">
        <Image
          src={heroAd?.imageUrl || HERO_IMAGE}
          alt={heroAd?.title || "iShopine — mercado aberto"}
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/75 via-zinc-900/25 to-zinc-900/10" />
        <div className="relative z-10 flex min-h-[88svh] flex-col justify-end px-4 pb-14 pt-28 sm:min-h-[92svh] sm:px-8 sm:pb-20 lg:px-16">
          <div className="animate-hero-in max-w-xl">
            <p className="inline-flex rounded-full bg-[var(--brand-orange)] px-3 py-1 text-[12px] font-bold lowercase text-white">
              ishopine
            </p>
            <h1 className="animate-hero-in-delay mt-4 text-4xl font-bold lowercase leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl">
              {heroAd?.title || "mercado livre"}
            </h1>
            <p className="animate-hero-in-delay-2 mt-3 max-w-md text-[15px] leading-relaxed text-white/80 sm:text-base">
              {heroAd?.subtitle ||
                "venda e pague com m-pesa, e-mola ou cartão."}
            </p>
            <div className="animate-hero-in-delay-2 mt-7 flex flex-wrap gap-2.5">
              <Button
                asChild
                size="lg"
                className="rounded-full font-semibold"
              >
                <Link href={heroAd?.linkUrl || "/produtos"}>explorar mercado</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-white/35 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/vender">abrir loja</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {stripAds.length > 0 && (
        <section className="px-4 py-10 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <AdStrip ads={stripAds} />
          </div>
        </section>
      )}

      <section className="px-4 py-12 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-6xl">
          <h2 className="section-title">categorias</h2>
          <p className="mt-1.5 text-[14px] text-zinc-500">
            deslize e ache o que procura.
          </p>
          <div className="mt-7">
            <HorizontalCatalog>
              {categories.map((category) => (
                <HorizontalCatalogItem key={category.id}>
                  <Link
                    href={`/produtos?category=${category.slug}`}
                    className="group block overflow-hidden rounded-2xl bg-zinc-50 transition-transform duration-300 hover:scale-[1.02]"
                  >
                    <div className="relative aspect-square bg-zinc-100">
                      {category.imageUrl ? (
                        <Image
                          src={category.imageUrl}
                          alt={category.name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="168px"
                        />
                      ) : null}
                    </div>
                    <div className="px-3 py-3">
                      <p className="text-[13px] font-semibold lowercase text-zinc-900">
                        {category.name}
                      </p>
                      {category._count && (
                        <p className="text-[12px] text-zinc-500">
                          {category._count.products} itens
                        </p>
                      )}
                    </div>
                  </Link>
                </HorizontalCatalogItem>
              ))}
              {categories.length === 0 && (
                <p className="text-[13px] text-zinc-500">
                  categorias em breve.
                </p>
              )}
            </HorizontalCatalog>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="section-title">corre pra pegar</h2>
              <p className="mt-1.5 text-[14px] text-zinc-500">
                selecção em destaque no mercado.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="rounded-full"
            >
              <Link href="/produtos">ver todos</Link>
            </Button>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 lg:grid-cols-4 md:gap-x-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
            {featured.length === 0 && (
              <p className="col-span-full text-[13px] text-zinc-500">
                nenhum destaque disponível no momento.
              </p>
            )}
          </div>
        </div>
      </section>

      {heroAds.length > 1 && (
        <section className="px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <AdBanner ads={heroAds.slice(1)} />
          </div>
        </section>
      )}

      <section className="px-4 py-12 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="section-title">lojas pra visitar</h2>
              <p className="mt-1.5 text-[14px] text-zinc-500">
                vendedores com reputação em moçambique.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="rounded-full"
            >
              <Link href="/lojas">ver lojas</Link>
            </Button>
          </div>
          <div className="mt-7">
            <HorizontalCatalog>
              {shops.map((shop) => (
                <HorizontalCatalogItem
                  key={shop.id}
                  className="w-[220px] sm:w-[240px]"
                >
                  <Link
                    href={`/lojas/${shop.slug}`}
                    className="block h-full rounded-2xl border border-zinc-100 bg-white px-4 py-4 transition-transform duration-300 hover:scale-[1.01]"
                  >
                    <p className="text-[14px] font-semibold text-zinc-900">
                      {shop.name}
                    </p>
                    <p className="mt-1 text-[11px] font-medium lowercase tracking-wide text-zinc-400">
                      {shopTypeLabel(shop.shopType)}
                    </p>
                    <p className="mt-2 line-clamp-2 text-[13px] text-zinc-500">
                      {shop.description || "vitrine no mercado aberto"}
                    </p>
                    <ReputationBadge
                      className="mt-3"
                      compact
                      ratingAvg={shop.ratingAvg}
                      ratingCount={shop.ratingCount}
                      reputationScore={shop.reputationScore}
                    />
                    <p className="mt-2 text-[12px] text-zinc-500">
                      {[shop.district, shop.province]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </Link>
                </HorizontalCatalogItem>
              ))}
              {shops.length === 0 && (
                <p className="text-[13px] text-zinc-500">
                  ainda não há lojas. seja o primeiro a{" "}
                  <Link
                    href="/vender"
                    className="font-medium text-zinc-900 underline-offset-4 hover:underline"
                  >
                    abrir a sua
                  </Link>
                  .
                </p>
              )}
            </HorizontalCatalog>
          </div>
        </div>
      </section>
    </>
  );
}
