import Image from "next/image";
import Link from "next/link";
import { EmptyState } from "@ishopine/ui";
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
      <section className="relative min-h-[88svh] w-full overflow-hidden sm:min-h-[90svh]">
        <Image
          src={heroAd?.imageUrl || HERO_IMAGE}
          alt=""
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#202223]/80 via-[#202223]/35 to-[#202223]/15" />
        <div className="relative z-10 mx-auto flex min-h-[88svh] max-w-[var(--ds-max-width)] flex-col justify-end px-4 pb-14 pt-28 sm:min-h-[90svh] sm:px-6 sm:pb-20">
          <div className="max-w-xl animate-[fadeIn_0.6s_ease-out]">
            <p className="text-[40px] font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-[48px]">
              iShopine
            </p>
            <h1 className="mt-3 text-[28px] font-bold leading-[1.2] tracking-[-0.01em] text-white sm:text-[32px]">
              {heroAd?.title || "Mercado de Moçambique"}
            </h1>
            <p className="mt-3 max-w-md text-[14px] leading-[1.6] text-white/85">
              {heroAd?.subtitle ||
                "Compre e venda com M-Pesa, e-Mola ou cartão."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href={heroAd?.linkUrl || "/produtos"}>Explorar mercado</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/vender">Abrir loja</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {stripAds.length > 0 ? (
        <section className="bg-[var(--ds-bg)] px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-[var(--ds-max-width)]">
            <AdStrip ads={stripAds} />
          </div>
        </section>
      ) : null}

      <section className="bg-[var(--ds-bg)] px-4 py-10 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-[var(--ds-max-width)]">
          <h2 className="text-[20px] font-semibold leading-[1.3] text-[var(--ds-text)]">
            Categorias
          </h2>
          <p className="mt-1 text-[14px] text-[var(--ds-text-secondary)]">
            Encontre o que precisa no mercado.
          </p>
          <div className="mt-6">
            <HorizontalCatalog>
              {categories.map((category) => (
                <HorizontalCatalogItem key={category.id}>
                  <Link
                    href={`/produtos?category=${category.slug}`}
                    className="group block overflow-hidden rounded-[var(--ds-radius-md)] border border-[var(--ds-border-subdued)] bg-[var(--ds-surface)] shadow-[var(--ds-shadow-raised)]"
                  >
                    <div className="relative aspect-square bg-[var(--ds-bg)]">
                      {category.imageUrl ? (
                        <Image
                          src={category.imageUrl}
                          alt={category.name}
                          fill
                          className="object-cover"
                          sizes="168px"
                        />
                      ) : null}
                    </div>
                    <div className="px-3 py-3">
                      <p className="text-[14px] font-semibold text-[var(--ds-text)]">
                        {category.name}
                      </p>
                      {category._count ? (
                        <p className="text-[12px] text-[var(--ds-text-secondary)]">
                          {category._count.products} itens
                        </p>
                      ) : null}
                    </div>
                  </Link>
                </HorizontalCatalogItem>
              ))}
              {categories.length === 0 ? (
                <p className="text-[14px] text-[var(--ds-text-secondary)]">
                  Categorias em breve.
                </p>
              ) : null}
            </HorizontalCatalog>
          </div>
        </div>
      </section>

      <section className="bg-[var(--ds-bg)] px-4 py-10 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-[var(--ds-max-width)]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[20px] font-semibold leading-[1.3] text-[var(--ds-text)]">
                Em destaque
              </h2>
              <p className="mt-1 text-[14px] text-[var(--ds-text-secondary)]">
                Selecção do mercado.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/produtos">Ver todos</Link>
            </Button>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
            {featured.length === 0 ? (
              <EmptyState
                className="col-span-full py-10"
                title="Sem produtos em destaque"
                description="Quando houver produtos em destaque, eles aparecerão aqui."
                action={
                  <Link
                    href="/produtos"
                    className="inline-flex min-h-9 items-center justify-center rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-2 text-[14px] font-medium text-[var(--ds-text)] hover:bg-[var(--ds-bg)]"
                  >
                    Ver mercado
                  </Link>
                }
              />
            ) : null}
          </div>
        </div>
      </section>

      {heroAds.length > 1 ? (
        <section className="bg-[var(--ds-bg)] px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-[var(--ds-max-width)]">
            <AdBanner ads={heroAds.slice(1)} />
          </div>
        </section>
      ) : null}

      <section className="bg-[var(--ds-bg)] px-4 py-10 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-[var(--ds-max-width)]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[20px] font-semibold leading-[1.3] text-[var(--ds-text)]">
                Lojas
              </h2>
              <p className="mt-1 text-[14px] text-[var(--ds-text-secondary)]">
                Vendedores em Moçambique.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/lojas">Ver lojas</Link>
            </Button>
          </div>
          <div className="mt-6">
            <HorizontalCatalog>
              {shops.map((shop) => (
                <HorizontalCatalogItem
                  key={shop.id}
                  className="w-[220px] sm:w-[240px]"
                >
                  <Link
                    href={`/lojas/${shop.slug}`}
                    className="block h-full rounded-[var(--ds-radius-md)] border border-[var(--ds-border-subdued)] bg-[var(--ds-surface)] px-5 py-5 shadow-[var(--ds-shadow-raised)]"
                  >
                    <p className="text-[16px] font-semibold text-[var(--ds-text)]">
                      {shop.name}
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--ds-text-secondary)]">
                      {shopTypeLabel(shop.shopType)}
                    </p>
                    <p className="mt-2 line-clamp-2 text-[14px] leading-[1.6] text-[var(--ds-text-secondary)]">
                      {shop.description || "Loja no iShopine"}
                    </p>
                    <ReputationBadge
                      className="mt-3"
                      compact
                      ratingAvg={shop.ratingAvg}
                      ratingCount={shop.ratingCount}
                      reputationScore={shop.reputationScore}
                    />
                  </Link>
                </HorizontalCatalogItem>
              ))}
              {shops.length === 0 ? (
                <EmptyState
                  className="w-[280px] py-8"
                  title="Sem lojas publicadas"
                  description="As lojas ativas aparecerão nesta área."
                  action={
                    <Link
                      href="/vender"
                      className="inline-flex min-h-9 items-center justify-center rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-2 text-[14px] font-medium text-[var(--ds-text)] hover:bg-[var(--ds-bg)]"
                    >
                      Abrir loja
                    </Link>
                  }
                />
              ) : null}
            </HorizontalCatalog>
          </div>
        </div>
      </section>
    </>
  );
}
