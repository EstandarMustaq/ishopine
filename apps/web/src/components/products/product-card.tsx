import Image from "next/image";
import Link from "next/link";
import { WishlistButton } from "@/components/products/wishlist-button";
import { formatMZN } from "@/lib/format";
import type { Product } from "@/lib/types";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const image =
    product.images?.find((img) => img.isPrimary)?.url ??
    product.images?.[0]?.url ??
    "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80";

  return (
    <div className="group relative block overflow-hidden rounded-[12px] transition-transform duration-300 hover:scale-[1.02]">
      <Link href={`/produtos/${product.id}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden bg-beige">
          <Image
            src={image}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        <div className="pt-3">
          {product.shop?.name ? (
            <p className="text-xs font-medium uppercase tracking-wide text-taupe">
              {product.shop.name}
            </p>
          ) : product.category?.name ? (
            <p className="text-xs font-medium uppercase tracking-wide text-taupe">
              {product.category.name}
            </p>
          ) : null}
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-charcoal">
            {product.name}
          </h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-base font-bold text-[#111111]">
              {formatMZN(product.priceCents)}
            </span>
            {product.compareAtCents &&
              product.compareAtCents > product.priceCents && (
                <span className="text-xs text-taupe line-through">
                  {formatMZN(product.compareAtCents)}
                </span>
              )}
          </div>
        </div>
      </Link>
      <div className="absolute right-2 top-2 z-10">
        <WishlistButton productId={product.id} />
      </div>
    </div>
  );
}
