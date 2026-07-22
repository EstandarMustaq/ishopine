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
    <div className="group relative block">
      <Link href={`/produtos/${product.slug ?? product.id}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-zinc-100">
          <Image
            src={image}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        <div className="pt-2.5">
          {product.shop?.name ? (
            <p className="truncate text-[11px] font-medium lowercase text-zinc-400">
              {product.shop.name}
            </p>
          ) : null}
          <h3 className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-snug text-zinc-800 sm:text-[14px]">
            {product.name}
          </h3>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-[15px] font-bold text-zinc-900">
              {formatMZN(product.priceCents)}
            </span>
            {product.compareAtCents &&
              product.compareAtCents > product.priceCents && (
                <span className="text-[12px] text-zinc-400 line-through">
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
