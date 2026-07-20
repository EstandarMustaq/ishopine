"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock, Package, Search, Store, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/api";
import { formatMZN } from "@/lib/format";
import type { Paginated, Product, Shop } from "@/lib/types";
import { cn } from "@/lib/utils";

const RECENT_KEY = "ishopine-recent-searches";
const MAX_RECENT = 8;

type SearchMode = "products" | "shops";

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
}

function saveRecent(term: string) {
  const q = term.trim();
  if (!q) return;
  const next = [q, ...loadRecent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(
    0,
    MAX_RECENT,
  );
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export function SiteSearch({
  className,
  variant = "nav",
}: {
  className?: string;
  variant?: "nav" | "mercado";
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 text-left text-zinc-500 transition-colors hover:border-zinc-300 hover:bg-white",
          variant === "nav" && "h-9 max-w-md px-3.5 text-[13px]",
          variant === "mercado" && "h-11 px-4 text-[14px] shadow-soft",
          className,
        )}
        aria-label="Abrir pesquisa"
      >
        <Search className="size-4 shrink-0 text-zinc-400" />
        <span className="truncate">
          {variant === "mercado" ? "buscar no mercado…" : "buscar produtos ou lojas…"}
        </span>
      </button>
      {mounted && open
        ? createPortal(
            <SearchOverlay
              onClose={() => setOpen(false)}
              initialMode={variant === "mercado" ? "products" : "products"}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function SearchOverlay({
  onClose,
  initialMode,
}: {
  onClose: () => void;
  initialMode: SearchMode;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>(initialMode);
  const [recent, setRecent] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRecent(loadRecent());
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2) {
      setProducts([]);
      setShops([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(() => {
      void (async () => {
        try {
          if (mode === "products") {
            const data = await apiFetch<Paginated<Product>>(
              `/products?q=${encodeURIComponent(q)}&limit=12`,
              { token: null },
            );
            setProducts(data.items ?? []);
            setShops([]);
          } else {
            const data = await apiFetch<Paginated<Shop>>(
              `/shops?q=${encodeURIComponent(q)}&limit=12`,
              { token: null },
            );
            setShops(data.items ?? []);
            setProducts([]);
          }
        } catch {
          setProducts([]);
          setShops([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, mode]);

  function pickRecent(term: string) {
    setQuery(term);
    saveRecent(term);
    setRecent(loadRecent());
  }

  function rememberAndClose(term?: string) {
    if (term?.trim()) {
      saveRecent(term);
      setRecent(loadRecent());
    }
    onClose();
  }

  const empty = query.trim().length < 2;
  const placeholder =
    mode === "products" ? "buscar produtos…" : "buscar lojas…";

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby={inputId}
    >
      <div className="border-b border-zinc-100">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition-colors hover:bg-zinc-200"
            aria-label="Fechar pesquisa"
          >
            <X className="size-5" />
          </button>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              ref={inputRef}
              id={inputId}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="h-11 rounded-full border-zinc-200 bg-zinc-50 pl-10 text-[15px] focus-visible:ring-[var(--brand-yellow)]"
              aria-label={
                mode === "products" ? "Buscar produtos" : "Buscar lojas"
              }
            />
            {loading && (
              <Spinner className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-zinc-400" />
            )}
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-3xl gap-2 px-4 pb-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMode("products")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors",
              mode === "products"
                ? "bg-[var(--brand-yellow)] text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
            )}
          >
            <Package className="size-3.5" />
            produtos
          </button>
          <button
            type="button"
            onClick={() => setMode("shops")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors",
              mode === "shops"
                ? "bg-[var(--brand-yellow)] text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
            )}
          >
            <Store className="size-3.5" />
            lojas
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {empty ? (
          <div>
            <p className="text-[13px] font-semibold lowercase tracking-wide text-zinc-400">
              pesquisas recentes
            </p>
            {recent.length === 0 ? (
              <p className="mt-4 text-[14px] text-zinc-500">
                ainda sem pesquisas. digite acima para começar.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1">
                {recent.map((term) => (
                  <li key={term}>
                    <button
                      type="button"
                      onClick={() => pickRecent(term)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] text-zinc-800 hover:bg-zinc-50"
                    >
                      <Clock className="size-4 shrink-0 text-zinc-400" />
                      <span className="truncate">{term}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : mode === "products" ? (
          <div className="flex flex-col gap-1">
            {products.length === 0 && !loading && (
              <p className="py-8 text-center text-[14px] text-zinc-500">
                nenhum produto para “{query.trim()}”
              </p>
            )}
            {products.map((product) => {
              const image =
                product.images?.find((i) => i.isPrimary)?.url ||
                product.images?.[0]?.url;
              return (
                <Link
                  key={product.id}
                  href={`/produtos/${product.slug ?? product.id}`}
                  onClick={() => rememberAndClose(query)}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-zinc-50"
                >
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                    {image ? (
                      <Image
                        src={image}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-zinc-900">
                      {product.name}
                    </p>
                    <p className="mt-0.5 text-[13px] font-semibold text-zinc-900">
                      {formatMZN(product.priceCents)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {shops.length === 0 && !loading && (
              <p className="py-8 text-center text-[14px] text-zinc-500">
                nenhuma loja para “{query.trim()}”
              </p>
            )}
            {shops.map((shop) => (
              <Link
                key={shop.id}
                href={`/lojas/${shop.slug}`}
                onClick={() => rememberAndClose(query)}
                className="rounded-xl px-3 py-3 hover:bg-zinc-50"
              >
                <p className="truncate text-[14px] font-medium text-zinc-900">
                  {shop.name}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-zinc-500">
                  {[shop.district, shop.province].filter(Boolean).join(" · ")}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
