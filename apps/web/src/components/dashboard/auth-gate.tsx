"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

interface AuthGateProps {
  children: React.ReactNode;
  roles?: Array<"ADMIN" | "OPERATOR" | "CUSTOMER">;
  adminOnly?: boolean;
}

export function AuthGate({ children, roles, adminOnly }: AuthGateProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!accessToken || !user) {
      router.replace("/entrar");
      return;
    }
    if (adminOnly && user.role !== "ADMIN") {
      router.replace("/painel");
      return;
    }
    if (roles && !roles.includes(user.role)) {
      router.replace("/");
    }
  }, [ready, accessToken, user, roles, adminOnly, router]);

  if (!ready || !accessToken || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-taupe">
        Carregando...
      </div>
    );
  }

  if (adminOnly && user.role !== "ADMIN") return null;
  if (roles && !roles.includes(user.role)) return null;

  return <>{children}</>;
}
