import type { Metadata } from "next";
import { Poppins, Open_Sans } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Crédit Unique — Gestion des dossiers",
  description: "Plateforme de gestion des dossiers rachat de crédit",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${poppins.variable} ${openSans.variable} h-full antialiased`}>
      <body className="min-h-full" style={{ background: '#F5F5F5', fontFamily: 'var(--font-open-sans), Open Sans, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
