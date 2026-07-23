import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { CustomerShell } from "@/components/customer-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Minha conta · iShopine",
    template: "%s · iShopine",
  },
  description: "Conta do cliente iShopine — pedidos, endereços e favoritos",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-MZ">
      <body className="font-sans antialiased">
        <CustomerShell>{children}</CustomerShell>
        <Toaster theme="light" position="top-center" richColors />
      </body>
    </html>
  );
}
