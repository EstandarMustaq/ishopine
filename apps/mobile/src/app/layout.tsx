import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { MobileShell } from "@/components/mobile-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "iShopine",
  description: "Compre em Moçambique — M-Pesa, e-Mola e cartão",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "iShopine",
  },
};

export const viewport: Viewport = {
  themeColor: "#008060",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-MZ">
      <body className="font-sans antialiased">
        <MobileShell>{children}</MobileShell>
        <Toaster theme="light" position="top-center" richColors />
      </body>
    </html>
  );
}
