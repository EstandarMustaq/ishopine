"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/api";
import { formatMZN } from "@/lib/format";
import type { Paginated, Product, Shop } from "@/lib/types";
import { cn } from "@/lib/utils";

type Preview = {
  products: Product[];
  shops: Shop[];
};

export function SiteSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview>({ products: [], shops: [] });
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const focused = useRef(false);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2) {
      setPreview({ products: [], shops: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(() => {
      void (async () => {
        try {
          const [products, shops] = await Promise.all([
            apiFetch<Paginated<Product>>(
              `/products?q=${encodeURIComponent(q)}&limit=5`,
              { token: null },
            ),
            apiFetch<Paginated<Shop>>(
              `/shops?q=${encodeURIComponent(q)}&limit=3`,
              { token: null },
            ),
          ]);
          setPreview({
            products: products.items ?? [],
            shops: shops.items ?? [],
          });
          if (focused.current) setOpen(true);
        } catch {
          setPreview({ products: [], shops: [] });
        } finally {
          setLoading(false);
        }
      })();
    }, 280);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  function goToResults(value?: string) {
    const q = (value ?? query).trim();
    if (!q) return;
    setOpen(false);
    startTransition(() => {
      router.push(`/pesquisa?q=${encodeURIComponent(q)}`);
    });
  }

  const hasResults =
    preview.products.length > 0 || preview.shops.length > 0;
  const showCard = open && query.trim().length >= 2;

  return (
    <HoverCard
      open={showCard}
      openDelay={0}
      closeDelay={120}
      onOpenChange={(next) => {
        if (!next && focused.current) return;
        setOpen(next);
      }}
    >
      <HoverCardTrigger asChild>
        <form
          className={cn("relative w-full max-w-xs", className)}
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            goToResults();
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-zinc-400" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              focused.current = true;
              if (query.trim().length >= 2) setOpen(true);
            }}
            onBlur={() => {
              focused.current = false;
            }}
            placeholder="Pesquisar…"
            className="h-8 pl-8 text-[13px]"
            aria-label="Pesquisar no iShopine"
            role="searchbox"
            autoComplete="off"
          />
          {(loading || pending) && (
            <Spinner className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-zinc-400" />
          )}
        </form>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        className="w-[min(100vw-2rem,22rem)] p-2"
        sideOffset={8}
      >
        {!hasResults && !loading ? (
          <p className="px-2 py-3 text-[13px] text-zinc-500">
            Sem prévias para “{query.trim()}”.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {preview.products.length > 0 && (
              <>
                <p className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Produtos
                </p>
                {preview.products.map((product) => {
                  const image =
                    product.images?.find((i) => i.isPrimary)?.url ||
                    product.images?.[0]?.url;
                  return (
                    <Link
                      key={product.id}
                      href={`/produtos/${product.slug}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-zinc-100"
                    >
                      <div className="relative size-9 shrink-0 overflow-hidden rounded-md bg-zinc-100">
                        {image ? (
                          <Image
                            src={image}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="36px"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-zinc-900">
                          {product.name}
                        </p>
                        <p className="text-[12px] text-zinc-500">
                          {formatMZN(product.priceCents)}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </>
            )}
            {preview.shops.length > 0 && (
              <>
                <p className="px-2 pt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Lojas
                </p>
                {preview.shops.map((shop) => (
                  <Link
                    key={shop.id}
                    href={`/lojas/${shop.slug}`}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-2 py-2 hover:bg-zinc-100"
                  >
                    <p className="truncate text-[13px] font-medium text-zinc-900">
                      {shop.name}
                    </p>
                    <p className="truncate text-[12px] text-zinc-500">
                      {[shop.district, shop.province]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </Link>
                ))}
              </>
            )}
            <button
              type="button"
              onClick={() => goToResults()}
              className="mt-1 rounded-lg px-2 py-2 text-left text-[13px] font-medium text-zinc-900 hover:bg-zinc-100"
            >
              Ver todos os resultados →
            </button>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
