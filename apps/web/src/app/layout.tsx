import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "iShopine — mercado de Moçambique",
    template: "%s · iShopine",
  },
  description:
    "iShopine — mercado moçambicano de bens. Compre e venda em MZN com M-Pesa, e-Mola e cartões via PaySuite.",
  metadataBase: new URL("https://ishopine.com"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-MZ">
      <body className={`${jakarta.variable} font-sans antialiased`}>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster theme="light" position="top-center" richColors />
        </TooltipProvider>
      </body>
    </html>
  );
}
