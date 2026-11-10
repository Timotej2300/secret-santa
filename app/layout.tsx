import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Snow } from "@/components/Snow";
import { ToastProvider } from "@/components/Toast";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin", "latin-ext"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: { default: "SECRET SANTA", template: "%s · SECRET SANTA" },
  description: "Organizuj vianočné Secret Santa losovanie jednoducho a bezpečne.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://secret-santa.vercel.app"),
};
export const viewport: Viewport = { themeColor: "#faf6ec", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="flex min-h-screen flex-col">
        <ToastProvider>
          <Snow />
          <Header />
          <main className="relative z-10 flex-1">{children}</main>
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}
