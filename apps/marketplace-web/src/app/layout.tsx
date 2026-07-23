import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "iShopine — marketplace livre de Moçambique",
    template: "%s · iShopine",
  },
  description:
    "iShopine — o marketplace livre de Moçambique. Compre e venda em meticais com M-Pesa, e-Mola ou cartão.",
  metadataBase: new URL("https://ishopine.com"),
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/favicon.svg" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-MZ">
      <body className="font-sans antialiased">
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster theme="light" position="top-center" richColors />
        </TooltipProvider>
      </body>
    </html>
  );
}
