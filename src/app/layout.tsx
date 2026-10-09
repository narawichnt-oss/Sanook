import type { Metadata, Viewport } from "next";
import { Mitr, Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-nunito",
});

const mitr = Mitr({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500"],
  variable: "--font-mitr",
});

export const metadata: Metadata = {
  title: "สนุก",
  description: "สนุก — ห้องคุยด้วยเสียงกับเพื่อน เปิดห้อง ชวนเพื่อน แล้วคุยกันได้เลย",
};

export const viewport: Viewport = {
  themeColor: "#0c0a1d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${nunito.variable} ${mitr.variable}`}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
