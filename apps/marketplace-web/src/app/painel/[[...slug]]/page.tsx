"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { appHandoffUrl, getAppUrls } from "@/lib/app-urls";
import { useAuthStore } from "@/lib/auth-store";

/**
 * Legacy /painel/* → seller or backoffice apps.
 */
export default function PainelRedirectPage() {
  const params = useParams<{ slug?: string[] }>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const isStaff = useAuthStore((s) => s.isStaff);

  useEffect(() => {
    const slug = params.slug?.join("/") ?? "";
    const path = slug ? `/${slug}` : "/";
    const urls = getAppUrls();

    if (!accessToken || !user) {
      window.location.href = `${urls.marketplace}/entrar?next=seller`;
      return;
    }

    if (isStaff()) {
      window.location.href = appHandoffUrl("backoffice", accessToken, path);
      return;
    }

    window.location.href = appHandoffUrl("seller", accessToken, path);
  }, [params.slug, accessToken, user, isStaff]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-taupe">
      A redirecionar para o painel…
    </div>
  );
}
