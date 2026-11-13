import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const interTight = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cartise CRM",
  description: "Pipeline comercial da Cartise",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-PT" className={`${inter.variable} ${interTight.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
