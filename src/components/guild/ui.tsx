"use client";

import { useEffect, useState } from "react";
import { cosmeticById, type Look } from "@/lib/guild/catalog";
import type { LogEntry, SideKey } from "@/lib/guild/types";
import { ROOM_BG, ROOM_VAR } from "../colors";
import type { GuildColor } from "@/lib/guild/catalog";

/** Bottom sheet on phones, centred card on desktop. */
export function Sheet({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`glass-strong flex max-h-[88dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-[2rem] p-5 pb-8 sm:rounded-[2rem] sm:pb-5 ${wide ? "max-w-xl" : "max-w-md"}`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="rounded-full px-3 py-1 text-muted hover:bg-night-3">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** An avatar wearing its war booty: hat on top, a prop in hand. Sized by `size` in px. */
export function Figure({ avatar, look, size = 48, className = "" }: { avatar: string; look?: Look; size?: number; className?: string }) {
  const hat = look?.hat ? cosmeticById(look.hat) : undefined;
  const hand = look?.hand ? cosmeticById(look.hand) : undefined;
  return (
    <span className={`relative inline-grid shrink-0 place-items-center ${className}`} style={{ width: size, height: size }}>
      <span className="grid size-full place-items-center rounded-full bg-night-3/90 ring-2 ring-white/15" style={{ fontSize: size * 0.58 }}>
        {avatar}
      </span>
      {hat && (
        <span aria-hidden className="absolute left-1/2 -translate-x-1/2" style={{ top: -size * 0.42, fontSize: size * 0.5 }}>
          {hat.emoji}
        </span>
      )}
      {hand && (
        <span aria-hidden className="absolute" style={{ right: -size * 0.28, bottom: -size * 0.08, fontSize: size * 0.42 }}>
          {hand.emoji}
        </span>
      )}
    </span>
  );
}

export function GuildBadge({ emblem, color, size = 44 }: { emblem: string; color: GuildColor; size?: number }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-2xl ${ROOM_BG[color]} shadow-lg`}
      style={{ width: size, height: size, fontSize: size * 0.55, boxShadow: `0 8px 24px -8px ${ROOM_VAR[color]}` }}
    >
      {emblem}
    </span>
  );
}

// Our side is always blue and theirs red, whatever the guild colors, so one
// glance at the bar says who's ahead.
export const US = "var(--color-sky)";
export const THEM = "var(--color-coral)";

/** Tug-of-war bar: our points push from the left, theirs from the right. */
export function Duel({ ours, theirs, height = 14 }: { ours: number; theirs: number; height?: number }) {
  const total = ours + theirs;
  const share = total ? Math.min(96, Math.max(4, (ours / total) * 100)) : 50;
  return (
    <div className="guild-duel relative flex w-full overflow-hidden rounded-full bg-night-3" style={{ height }}>
      <span className="h-full" style={{ width: `${share}%`, background: `linear-gradient(90deg, ${US}, color-mix(in srgb, ${US} 70%, white))` }} />
      <span className="h-full flex-1" style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${THEM} 70%, white), ${THEM})` }} />
      <span aria-hidden className="absolute top-0 bottom-0 w-1 -translate-x-1/2 bg-white/90 shadow" style={{ left: `${share}%` }} />
    </div>
  );
}

/** Scrolling news strip of the battle log. */
export function Ticker({ log, us }: { log: LogEntry[]; us: SideKey | null }) {
  const items = [...log].reverse().slice(0, 12);
  if (!items.length) return null;
  const strip = items.map((l, i) => (
    <span key={i} className="flex shrink-0 items-center gap-1.5 pr-10">
      <span>{l.icon}</span>
      <span style={{ color: us ? (l.side === us ? "color-mix(in srgb, var(--color-sky) 55%, white)" : "color-mix(in srgb, var(--color-coral) 55%, white)") : undefined }}>
        {l.text}
      </span>
    </span>
  ));
  return (
    <div className="relative overflow-hidden rounded-full bg-night/70 py-1.5 text-sm ring-1 ring-white/10" aria-live="polite">
      <span className="sr-only">{items[0].text}</span>
      <div aria-hidden className="guild-ticker flex w-max whitespace-nowrap" style={{ ["--ticker-duration" as string]: `${8 + items.length * 6}s` }}>
        {strip}
        {strip}
      </div>
    </div>
  );
}

/** Re-renders every `ms` so countdowns tick. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function timeLeft(ms: number): string {
  if (ms <= 0) return "หมดเวลา";
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  if (h > 0) return `${h} ชม. ${m} นาที`;
  if (m > 0) return `${m} นาที ${s} วิ`;
  return `${s} วิ`;
}

export function fmt(n: number): string {
  return n.toLocaleString("th-TH");
}

export function ErrorNote({ text }: { text: string }) {
  if (!text) return null;
  return <p className="rounded-2xl bg-coral/15 px-4 py-2 text-sm text-coral">{text}</p>;
}

export function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
