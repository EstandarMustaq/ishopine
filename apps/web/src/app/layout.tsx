import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "iShopine — mercado aberto de bens",
    template: "%s · iShopine",
  },
  description:
    "iShopine — mercado aberto de bens. Compre e venda com segurança. Operado por Nkateko Investment and Service.",
  metadataBase: new URL("https://ishopine.com"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${montserrat.variable} font-sans antialiased`}>
        {children}
        <Toaster theme="light" position="top-center" richColors />
      </body>
    </html>
  );
}
