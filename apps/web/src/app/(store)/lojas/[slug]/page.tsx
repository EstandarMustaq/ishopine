import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StartConversationButton } from "@/components/messages/start-conversation-button";
import { ProductCard } from "@/components/products/product-card";
import { FollowShopButton } from "@/components/shops/follow-shop-button";
import { ReputationBadge } from "@/components/shops/reputation-badge";
import { apiFetch } from "@/lib/api";
import { shopTypeLabel } from "@/lib/mozambique";
import type { Paginated, Product, Shop } from "@/lib/types";

interface ShopPageProps {
  params: Promise<{ slug: string }>;
}

async function getShop(slug: string) {
  try {
    return await apiFetch<Shop>(`/shops/${slug}`, { token: null });
  } catch {
    return null;
  }
}

async function getShopProducts(slug: string) {
  try {
    return await apiFetch<Paginated<Product>>(
      `/products?shop=${encodeURIComponent(slug)}&limit=48&sort=newest`,
      { token: null },
    );
  } catch {
    return {
      items: [] as Product[],
      meta: { page: 1, limit: 48, total: 0, totalPages: 1 },
    };
  }
}

export default async function ShopDetailPage({ params }: ShopPageProps) {
  const { slug } = await params;
  const shop = await getShop(slug);
  if (!shop) notFound();

  const products = await getShopProducts(slug);

  return (
    <div>
      <section className="relative min-h-[220px] overflow-hidden bg-[var(--brand-purple-light)] sm:min-h-[280px]">
        {shop.bannerUrl && (
          <Image
            src={shop.bannerUrl}
            alt=""
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="relative z-10 mx-auto flex min-h-[220px] max-w-6xl flex-col justify-end px-4 py-10 sm:min-h-[280px] sm:px-6">
          <p className="text-sm text-white/80">
            <Link href="/lojas" className="hover:underline">
              Lojas
            </Link>
            <span className="mx-2">/</span>
            {shop.name}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
            {shop.name}
          </h1>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-white/70">
            {shopTypeLabel(shop.shopType)}
          </p>
          {shop.description && (
            <p className="mt-2 max-w-2xl text-sm text-white/90">
              {shop.description}
            </p>
          )}
          <ReputationBadge
            className="mt-3 text-white/90 [&_span]:text-white/90"
            ratingAvg={shop.ratingAvg}
            ratingCount={shop.ratingCount}
            reputationScore={shop.reputationScore}
          />
          <p className="mt-2 text-xs text-white/70">
            {[shop.district, shop.province].filter(Boolean).join(" · ")}
            {shop._count?.products != null
              ? ` · ${shop._count.products} produtos`
              : ""}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <FollowShopButton shopId={shop.id} />
            <StartConversationButton
              shopId={shop.id}
              subject={`Contato — ${shop.name}`}
              label="Mensagem"
              className="border-white/70 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h2 className="text-xl font-semibold text-charcoal">Produtos</h2>
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {products.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
          {products.items.length === 0 && (
            <p className="col-span-full text-sm text-taupe">
              Esta loja ainda não tem produtos publicados.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
