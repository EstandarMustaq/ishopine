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
          alt="iShopine — mercado aberto, compre e venda"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 via-zinc-900/35 to-zinc-900/20" />
        <div className="relative z-10 flex min-h-[100svh] flex-col justify-end px-4 pb-16 pt-28 sm:px-8 sm:pb-20 lg:px-16">
          <div className="glass-dark animate-hero-in max-w-lg rounded-2xl p-6 sm:p-8">
            <p className="text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
              iShopine
            </p>
            <h1 className="animate-hero-in-delay mt-3 text-lg font-medium leading-snug text-white/95 sm:text-xl">
              De Moçambique, para Moçambique
            </h1>
            <p className="animate-hero-in-delay-2 mt-2 max-w-md text-[14px] leading-relaxed text-white/75">
              Mercado em meticais. Pague com M-Pesa, e-Mola ou cartão via
              PaySuite.
            </p>
            <div className="animate-hero-in-delay-2 mt-6 flex flex-wrap gap-2.5">
              <Button asChild size="lg" className="bg-white text-zinc-900 hover:bg-zinc-100">
                <Link href="/produtos">Explorar mercado</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/vender">Abrir loja</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
            Categorias
          </h2>
          <p className="mt-1.5 text-[13px] text-zinc-500">
            Navegue pelo catálogo do mercado.
          </p>
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/produtos?category=${category.slug}`}
                className="glass-panel group overflow-hidden transition-transform duration-300 hover:scale-[1.02]"
              >
                <div className="relative aspect-square bg-zinc-100">
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
                  <p className="text-[13px] font-semibold text-zinc-900">
                    {category.name}
                  </p>
                  {category._count && (
                    <p className="text-[12px] text-zinc-500">
                      {category._count.products} itens
                    </p>
                  )}
                </div>
              </Link>
            ))}
            {categories.length === 0 && (
              <p className="col-span-full text-[13px] text-zinc-500">
                Categorias em breve. Inicie a API para carregar o catálogo.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
                Em destaque
              </h2>
              <p className="mt-1.5 text-[13px] text-zinc-500">
                Seleção do mercado aberto.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/produtos">Ver todos</Link>
            </Button>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
            {featured.length === 0 && (
              <p className="col-span-full text-[13px] text-zinc-500">
                Nenhum destaque disponível no momento.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
                Lojas
              </h2>
              <p className="mt-1.5 text-[13px] text-zinc-500">
                Conheça vendedores do iShopine.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/lojas">Ver lojas</Link>
            </Button>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shops.map((shop) => (
              <Link
                key={shop.id}
                href={`/lojas/${shop.slug}`}
                className="glass-panel px-5 py-4 transition-transform duration-300 hover:scale-[1.01]"
              >
                <p className="text-[14px] font-semibold text-zinc-900">
                  {shop.name}
                </p>
                <p className="mt-1 line-clamp-2 text-[13px] text-zinc-500">
                  {shop.description || "Vitrine no mercado aberto"}
                </p>
              </Link>
            ))}
            {shops.length === 0 && (
              <p className="col-span-full text-[13px] text-zinc-500">
                Ainda não há lojas públicas. Seja o primeiro a{" "}
                <Link href="/vender" className="font-medium text-zinc-900 underline-offset-4 hover:underline">
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
