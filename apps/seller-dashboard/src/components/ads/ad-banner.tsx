"use client";

import Image from "next/image";
import Link from "next/link";
import type { Ad } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AdBanner({
  ads,
  className,
}: {
  ads: Ad[];
  className?: string;
}) {
  if (!ads.length) return null;
  const ad = ads[0];

  return (
    <Link
      href={ad.linkUrl}
      className={cn(
        "group relative block overflow-hidden rounded-2xl bg-zinc-100",
        className,
      )}
    >
      <div className="relative aspect-[21/9] w-full sm:aspect-[3/1]">
        <Image
          src={ad.imageUrl}
          alt={ad.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          sizes="(max-width: 768px) 100vw, 1100px"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/55 via-zinc-900/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
            anúncio
          </p>
          <p className="mt-1 text-lg font-bold text-white sm:text-2xl">
            {ad.title}
          </p>
          {ad.subtitle ? (
            <p className="mt-1 max-w-lg text-[13px] text-white/80 sm:text-sm">
              {ad.subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function AdStrip({ ads }: { ads: Ad[] }) {
  if (!ads.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ads.slice(0, 3).map((ad) => (
        <Link
          key={ad.id}
          href={ad.linkUrl}
          className="group overflow-hidden rounded-2xl bg-zinc-100"
        >
          <div className="relative aspect-[16/10]">
            <Image
              src={ad.imageUrl}
              alt={ad.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              sizes="400px"
            />
          </div>
          <div className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              anúncio
            </p>
            <p className="mt-0.5 text-[14px] font-semibold text-zinc-900">
              {ad.title}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
