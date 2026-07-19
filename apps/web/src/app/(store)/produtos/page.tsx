import Link from "next/link";
import { ProductCard } from "@/components/products/product-card";
import { apiFetch } from "@/lib/api";
import type { Category, Paginated, Product } from "@/lib/types";
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
  { value: "newest", label: "Mais recentes" },
  { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" },
  { value: "name", label: "Nome" },
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
    const [categories, products] = await Promise.all([
      apiFetch<Category[]>("/categories", { token: null }),
      apiFetch<Paginated<Product>>(`/products?${qs.toString()}`, {
        token: null,
      }),
    ]);
    return { categories, products };
  } catch {
    return {
      categories: [] as Category[],
      products: {
        items: [] as Product[],
        meta: { page: 1, limit: 12, total: 0, totalPages: 1 },
      },
    };
  }
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const { categories, products } = await getData(params);
  const currentSort = params.sort ?? "newest";
  const currentCategory = params.category;

  function hrefFor(next: {
    category?: string | null;
    sort?: string;
    page?: number;
  }) {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
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
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-charcoal">Produtos</h1>
        <p className="mt-2 text-sm text-taupe">
          {products.meta.total} {products.meta.total === 1 ? "item" : "itens"}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href={hrefFor({ category: null, page: 1 })}
          className={cn(
            "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
            !currentCategory
              ? "border-[#61005D] bg-[#61005D] text-white"
              : "border-border bg-white text-charcoal hover:border-[#61005D]",
          )}
        >
          Todos
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={hrefFor({ category: category.slug, page: 1 })}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              currentCategory === category.slug
                ? "border-[#61005D] bg-[#61005D] text-white"
                : "border-border bg-white text-charcoal hover:border-[#61005D]",
            )}
          >
            {category.name}
          </Link>
        ))}
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-2">
        <span className="text-sm text-taupe">Ordenar:</span>
        {sortOptions.map((option) => (
          <Link
            key={option.value}
            href={hrefFor({ sort: option.value, page: 1 })}
            className={cn(
              "rounded-[12px] px-3 py-1.5 text-sm font-medium",
              currentSort === option.value
                ? "bg-beige text-[#61005D]"
                : "text-taupe hover:text-charcoal",
            )}
          >
            {option.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
        {products.items.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {products.items.length === 0 && (
        <p className="py-16 text-center text-sm text-taupe">
          Nenhum produto encontrado.
        </p>
      )}

      {products.meta.totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-3">
          {products.meta.page > 1 && (
            <Link
              href={hrefFor({ page: products.meta.page - 1 })}
              className="rounded-[14px] border px-4 py-2 text-sm font-medium"
            >
              Anterior
            </Link>
          )}
          <span className="text-sm text-taupe">
            Página {products.meta.page} de {products.meta.totalPages}
          </span>
          {products.meta.page < products.meta.totalPages && (
            <Link
              href={hrefFor({ page: products.meta.page + 1 })}
              className="rounded-[14px] border px-4 py-2 text-sm font-medium"
            >
              Próxima
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
