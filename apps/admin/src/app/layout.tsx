import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { BackofficeShell } from "@/components/backoffice/backoffice-shell";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "iShopine Backoffice",
    template: "%s · Backoffice",
  },
  description: "Operabilidade e métricas da plataforma iShopine",
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
        <BackofficeShell>{children}</BackofficeShell>
        <Toaster theme="light" position="top-center" richColors />
      </body>
    </html>
  );
}
