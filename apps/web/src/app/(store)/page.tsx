import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/products/product-card";
import { apiFetch } from "@/lib/api";
import type { Category, Paginated, Product, Shop } from "@/lib/types";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=2000&q=80";

async function getHomeData() {
  try {
    const [categories, featured, shops] = await Promise.all([
      apiFetch<Category[]>("/categories", { token: null }),
      apiFetch<Paginated<Product>>(
        "/products?featured=true&limit=8&sort=newest",
        { token: null },
      ),
      apiFetch<Paginated<Shop>>("/shops?limit=6", { token: null }),
    ]);
    return {
      categories,
      featured: featured.items,
      shops: shops.items,
    };
  } catch {
    return {
      categories: [] as Category[],
      featured: [] as Product[],
      shops: [] as Shop[],
    };
  }
}

export default async function HomePage() {
  const { categories, featured, shops } = await getHomeData();

  return (
    <>
      <section className="relative min-h-[100svh] w-full overflow-hidden">
        <Image
          src={HERO_IMAGE}
          alt="iShoppine — mercado aberto, compre e venda"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-black/20" />
        <div className="relative z-10 flex min-h-[100svh] flex-col justify-end px-4 pb-16 pt-28 sm:px-8 sm:pb-20 lg:px-16">
          <div className="max-w-xl text-white">
            <p className="animate-hero-in text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
              iShoppine
            </p>
            <h1 className="animate-hero-in-delay mt-4 text-2xl font-semibold leading-snug sm:text-3xl">
              Compre e venda no mercado aberto
            </h1>
            <p className="animate-hero-in-delay-2 mt-3 max-w-md text-base text-white/90 sm:text-lg">
              Marketplace aberto onde qualquer pessoa compra e vende bens com
              segurança.
            </p>
            <div className="animate-hero-in-delay-2 mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="shadow-none">
                <Link href="/produtos">Explorar mercado</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/70 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <Link href="/vender">Abrir loja</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-beige px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold text-charcoal sm:text-3xl">
            Categorias
          </h2>
          <p className="mt-2 text-sm text-taupe">
            Navegue pelo catálogo do mercado.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/produtos?category=${category.slug}`}
                className="group overflow-hidden rounded-[12px] bg-white transition-transform duration-300 hover:scale-[1.02]"
              >
                <div className="relative aspect-square bg-[var(--brand-purple-light)]">
                  {category.imageUrl ? (
                    <Image
                      src={category.imageUrl}
                      alt={category.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="160px"
                    />
                  ) : null}
                </div>
                <div className="px-3 py-3">
                  <p className="text-sm font-semibold text-charcoal">
                    {category.name}
                  </p>
                  {category._count && (
                    <p className="text-xs text-taupe">
                      {category._count.products} itens
                    </p>
                  )}
                </div>
              </Link>
            ))}
            {categories.length === 0 && (
              <p className="col-span-full text-sm text-taupe">
                Categorias em breve. Inicie a API para carregar o catálogo.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-charcoal sm:text-3xl">
                Em destaque
              </h2>
              <p className="mt-2 text-sm text-taupe">
                Seleção do mercado aberto.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/produtos">Ver todos</Link>
            </Button>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
            {featured.length === 0 && (
              <p className="col-span-full text-sm text-taupe">
                Nenhum destaque disponível no momento.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="bg-beige px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-charcoal sm:text-3xl">
                Lojas
              </h2>
              <p className="mt-2 text-sm text-taupe">
                Conheça vendedores do iShoppine.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/lojas">Ver lojas</Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shops.map((shop) => (
              <Link
                key={shop.id}
                href={`/lojas/${shop.slug}`}
                className="rounded-[12px] bg-white px-5 py-4 transition-transform duration-300 hover:scale-[1.01]"
              >
                <p className="font-semibold text-charcoal">{shop.name}</p>
                <p className="mt-1 line-clamp-2 text-sm text-taupe">
                  {shop.description || "Vitrine no mercado aberto"}
                </p>
              </Link>
            ))}
            {shops.length === 0 && (
              <p className="col-span-full text-sm text-taupe">
                Ainda não há lojas públicas. Seja o primeiro a{" "}
                <Link href="/vender" className="font-medium text-[#61005D]">
                  abrir a sua
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
