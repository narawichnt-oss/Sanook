import type { Metadata, Viewport } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";

const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-prompt",
});

export const metadata: Metadata = {
  title: "คุยกัน",
  description: "ห้องคุยด้วยเสียง เปิดห้อง ชวนเพื่อน แล้วคุยกันได้เลย",
};

export const viewport: Viewport = {
  themeColor: "#15131f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={prompt.variable}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
