import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AffiliateShell } from "@/components/layout/AffiliateShell";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "iShopine Afiliados",
    template: "%s · Afiliados",
  },
  description: "Programa de afiliados iShopine",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-MZ">
      <body className={`${outfit.variable} font-sans antialiased`}>
        <AffiliateShell>{children}</AffiliateShell>
        <Toaster theme="light" position="top-center" richColors />
      </body>
    </html>
  );
}
