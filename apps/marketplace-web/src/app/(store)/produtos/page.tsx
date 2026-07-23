import Link from "next/link";
import { EmptyState, ErrorState } from "@ishopine/ui";
import { ProductCard } from "@/components/products/product-card";
import { AdBanner } from "@/components/ads/ad-banner";
import { MercadoSearchBar } from "@/components/search/mercado-search-bar";
import { apiFetch } from "@/lib/api";
import type { Ad, Category, Paginated, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProductsPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
    page?: string;
  }>;
}

const sortOptions = [
  { value: "newest", label: "mais recentes" },
  { value: "price_asc", label: "menor preço" },
  { value: "price_desc", label: "maior preço" },
  { value: "name", label: "nome" },
];

async function getData(params: {
  q?: string;
  category?: string;
  sort?: string;
  page?: string;
}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.category) qs.set("category", params.category);
  if (params.sort) qs.set("sort", params.sort);
  if (params.page) qs.set("page", params.page);
  qs.set("limit", "12");

  try {
    const [categories, products, ads] = await Promise.all([
      apiFetch<Category[]>("/categories", { token: null }),
      apiFetch<Paginated<Product>>(`/products?${qs.toString()}`, {
        token: null,
      }),
      apiFetch<Ad[]>("/ads?slot=MERCADO_TOP", { token: null }).catch(
        () => [] as Ad[],
      ),
    ]);
    return { categories, products, ads, error: false };
  } catch {
    return {
      categories: [] as Category[],
      products: {
        items: [] as Product[],
        meta: { page: 1, limit: 12, total: 0, totalPages: 1 },
      },
      ads: [] as Ad[],
      error: true,
    };
  }
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const { categories, products, ads, error } = await getData(params);
  const currentSort = params.sort ?? "newest";
  const currentCategory = params.category;

  function hrefFor(next: {
    category?: string | null;
    sort?: string;
    page?: number;
    q?: string | null;
  }) {
    const qs = new URLSearchParams();
    const q = next.q === null ? undefined : (next.q ?? params.q);
    if (q) qs.set("q", q);
    const category =
      next.category === null ? undefined : (next.category ?? currentCategory);
    if (category) qs.set("category", category);
    const sort = next.sort ?? currentSort;
    if (sort) qs.set("sort", sort);
    if (next.page && next.page > 1) qs.set("page", String(next.page));
    const query = qs.toString();
    return query ? `/produtos?${query}` : "/produtos";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 md:hidden">
        <MercadoSearchBar />
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold lowercase tracking-tight text-zinc-900">
          mercado
        </h1>
        <p className="mt-1.5 text-[14px] text-zinc-500">
          {products.meta.total} {products.meta.total === 1 ? "item" : "itens"}
          {params.q ? ` para “${params.q}”` : ""}
        </p>
      </div>

      {ads.length > 0 && (
        <div className="mb-8">
          <AdBanner ads={ads} />
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href={hrefFor({ category: null, page: 1 })}
          className={cn(
            "rounded-full border px-4 py-2 text-sm font-medium lowercase transition-colors",
            !currentCategory
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400",
          )}
        >
          todos
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={hrefFor({ category: category.slug, page: 1 })}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium lowercase transition-colors",
              currentCategory === category.slug
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400",
            )}
          >
            {category.name}
          </Link>
        ))}
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-2">
        <span className="text-sm text-zinc-400">ordenar:</span>
        {sortOptions.map((option) => (
          <Link
            key={option.value}
            href={hrefFor({ sort: option.value, page: 1 })}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium lowercase",
              currentSort === option.value
                ? "bg-[var(--ds-brand)] text-white"
                : "text-zinc-500 hover:text-zinc-900",
            )}
          >
            {option.label}
          </Link>
        ))}
      </div>

      {error ? (
        <ErrorState
          title="Não foi possível carregar os produtos"
          description="Atualize a página ou tente novamente em alguns instantes."
          action={
            <Link
              href={hrefFor({})}
              className="inline-flex min-h-9 items-center justify-center rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-2 text-[14px] font-medium text-[var(--ds-text)] hover:bg-[var(--ds-bg)]"
            >
              Atualizar
            </Link>
          }
        />
      ) : products.items.length === 0 ? (
        <EmptyState
          title="Nenhum produto encontrado"
          description={
            params.q || currentCategory
              ? "Ajuste os filtros ou procure por outro termo."
              : "Os produtos publicados aparecerão nesta página."
          }
          action={
            params.q || currentCategory ? (
              <Link
                href="/produtos"
                className="inline-flex min-h-9 items-center justify-center rounded-[var(--ds-radius-sm)] bg-[var(--ds-brand)] px-4 py-2 text-[14px] font-medium text-white hover:bg-[var(--ds-brand-dark)]"
              >
                Limpar filtros
              </Link>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 lg:grid-cols-4 md:gap-x-4">
          {products.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {!error && products.meta.totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-3">
          {products.meta.page > 1 && (
            <Link
              href={hrefFor({ page: products.meta.page - 1 })}
              className="rounded-full border px-4 py-2 text-sm font-medium"
            >
              anterior
            </Link>
          )}
          <span className="text-sm text-zinc-500">
            página {products.meta.page} de {products.meta.totalPages}
          </span>
          {products.meta.page < products.meta.totalPages && (
            <Link
              href={hrefFor({ page: products.meta.page + 1 })}
              className="rounded-full border px-4 py-2 text-sm font-medium"
            >
              próxima
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
