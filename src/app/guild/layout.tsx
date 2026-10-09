import type { Metadata } from "next";
import "@/components/guild/guild.css";

export const metadata: Metadata = {
  title: "กิลด์ · คุยกัน",
  description: "รวมแก๊งเป็นกิลด์ แต่งเกาะด้วยกัน แล้วไปยึดเกาะกิลด์อื่นด้วยมินิเกม",
};

export default function GuildLayout({ children }: { children: React.ReactNode }) {
  return children;
}
