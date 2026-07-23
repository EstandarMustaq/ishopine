import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { SellerShell } from "@/components/seller/seller-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "iShopine Seller",
    template: "%s · Seller",
  },
  description: "Painel do vendedor iShopine — particular e lojas",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-MZ">
      <body className="font-sans antialiased">
        <SellerShell>{children}</SellerShell>
        <Toaster theme="light" position="top-center" richColors />
      </body>
    </html>
  );
}
