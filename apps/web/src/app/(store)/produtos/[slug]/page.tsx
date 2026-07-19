import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "./add-to-cart-button";
import { StartConversationButton } from "@/components/messages/start-conversation-button";
import { ProductReviews } from "@/components/products/product-reviews";
import { WishlistButton } from "@/components/products/wishlist-button";
import { apiFetch } from "@/lib/api";
import { formatBRL } from "@/lib/format";
import type { Product } from "@/lib/types";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

async function getProduct(slugOrId: string) {
  try {
    return await apiFetch<Product>(`/products/${slugOrId}`, { token: null });
  } catch {
    return null;
  }
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const image =
    product.images?.find((img) => img.isPrimary)?.url ??
    product.images?.[0]?.url ??
    "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=80";

  const available = product.stock - product.reservedStock;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav className="mb-6 text-sm text-taupe">
        <Link href="/produtos" className="hover:text-[#111111]">
          Mercado
        </Link>
        <span className="mx-2">/</span>
        {product.shop && (
          <>
            <Link
              href={`/lojas/${product.shop.slug}`}
              className="hover:text-[#111111]"
            >
              {product.shop.name}
            </Link>
            <span className="mx-2">/</span>
          </>
        )}
        <span className="text-charcoal">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-[12px] bg-beige">
          <Image
            src={image}
            alt={product.name}
            fill
            priority
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          <div className="absolute right-3 top-3 z-10">
            <WishlistButton productId={product.id} />
          </div>
        </div>

        <div>
          {product.shop?.name && (
            <p className="text-xs font-semibold uppercase tracking-wide text-taupe">
              Vendido por{" "}
              <Link
                href={`/lojas/${product.shop.slug}`}
                className="text-[#111111] hover:underline"
              >
                {product.shop.name}
              </Link>
            </p>
          )}
          {product.category?.name && (
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-taupe">
              {product.category.name}
            </p>
          )}
          <h1 className="mt-2 text-3xl font-bold text-charcoal sm:text-4xl">
            {product.name}
          </h1>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-2xl font-bold text-[#111111]">
              {formatBRL(product.priceCents)}
            </span>
            {product.compareAtCents &&
              product.compareAtCents > product.priceCents && (
                <span className="text-base text-taupe line-through">
                  {formatBRL(product.compareAtCents)}
                </span>
              )}
          </div>

          {product.shortDescription && (
            <p className="mt-4 text-base text-taupe">{product.shortDescription}</p>
          )}

          <p className="mt-6 text-sm leading-relaxed text-charcoal">
            {product.description}
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
            {product.material && (
              <>
                <dt className="text-taupe">Material</dt>
                <dd className="font-medium">{product.material}</dd>
              </>
            )}
            {product.dimensions && (
              <>
                <dt className="text-taupe">Dimensões</dt>
                <dd className="font-medium">{product.dimensions}</dd>
              </>
            )}
            {product.color && (
              <>
                <dt className="text-taupe">Cor</dt>
                <dd className="font-medium">{product.color}</dd>
              </>
            )}
            <dt className="text-taupe">Disponibilidade</dt>
            <dd className="font-medium">
              {available > 0 ? `${available} em estoque` : "Indisponível"}
            </dd>
          </dl>

          <div className="mt-8 flex flex-wrap gap-3">
            <AddToCartButton
              productId={product.id}
              disabled={available <= 0}
            />
            {product.shopId && (
              <StartConversationButton
                shopId={product.shopId}
                productId={product.id}
                subject={product.name}
                label="Falar com vendedor"
              />
            )}
          </div>
        </div>
      </div>

      <ProductReviews productId={product.id} />
    </div>
  );
}
