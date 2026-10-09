"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { haptic } from "@/lib/haptics";
import { guildApi, usePoll } from "@/lib/guild/client";
import { GAMES } from "@/lib/guild/games";
import type { LiveView, WarView } from "@/lib/guild/types";
import type { Session } from "./gate";
import { Duel, ErrorNote, Figure, Ticker, fmt, message } from "./ui";

// Mirrors CHEER_EMOJIS on the server.
const CHEERS = ["👏", "🔥", "💪", "🎉", "❤️", "😂"] as const;
const LIVE_MS = 2000;

/** For anyone not up for playing right now: watch friends score live and cheer them on. */
export function WarWatch({ id, session }: { id: string; session: Session }) {
  const [war, setWar] = useState<WarView | null>(null);
  const [live, setLive] = useState<LiveView | null>(null);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<{ key: number; emoji: string; to: string }[]>([]);
  const seq = useRef(0);

  usePoll(async () => {
    try {
      setLive(await guildApi<LiveView>(`/api/war/${id}/live`));
      setError("");
    } catch (e) {
      setError(message(e));
    }
  }, LIVE_MS);
  usePoll(async () => setWar(await guildApi<WarView>(`/api/war/${id}`)), 6000);

  async function cheer(to: string, emoji: string) {
    haptic("tick");
    const key = ++seq.current;
    setSent((s) => [...s.slice(-10), { key, emoji, to }]);
    try {
      setLive(await guildApi<LiveView>(`/api/war/${id}/live`, { body: { cheer: { to, emoji } } }));
    } catch (e) {
      setError(message(e));
    }
  }

  const us = war?.us ?? null;
  const them = us === "attacker" ? "defender" : "attacker";
  const friends = live?.playing.filter((p) => p.side === us) ?? [];
  const rivals = live?.playing.filter((p) => p.side !== us) ?? [];

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 px-4 pt-4 pb-10">
      <header className="flex items-center gap-3">
        <Link href={`/guild/war/${id}`} aria-label="กลับแผนที่" className="glass grid size-10 shrink-0 place-items-center rounded-full">
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">อัฒจันทร์กองเชียร์</p>
          <h1 className="text-xl font-extrabold">📣 เชียร์เพื่อน</h1>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-pink/20 px-2.5 py-1 text-xs font-bold">
          <span className="live-dot size-2 rounded-full bg-pink" /> LIVE
        </span>
      </header>

      {war && us && (
        <div className="flex flex-col gap-1.5">
          <Duel ours={war.totals[us]} theirs={war.totals[them]} />
          <div className="flex justify-between text-xs">
            <span className="font-bold text-sky">
              {war.sides[us].emblem} {fmt(war.totals[us])}
            </span>
            <span className="font-bold text-coral">
              {fmt(war.totals[them])} {war.sides[them].emblem}
            </span>
          </div>
          <Ticker log={war.log} us={us} />
        </div>
      )}

      <ErrorNote text={error} />

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">เพื่อนที่กำลังลงสนาม</h2>
        {live && friends.length === 0 && (
          <div className="glass flex flex-col items-center gap-2 rounded-3xl p-6 text-center">
            <span className="text-5xl">🏟️</span>
            <p className="font-semibold">ตอนนี้ยังไม่มีเพื่อนเล่นอยู่</p>
            <p className="text-sm text-muted">ชวนเพื่อนในกิลด์มาลุยกัน หรือลงสนามเองเลยก็ได้</p>
            <Link href={`/guild/war/${id}/play/auto`} className="mt-2 rounded-full bg-sun px-5 py-2 font-extrabold text-night">
              ▶ ลุยเองเลย!
            </Link>
          </div>
        )}
        {friends.map((p) => (
          <div key={p.id} className="glass relative flex flex-col gap-3 overflow-hidden rounded-3xl p-4">
            <div className="flex items-center gap-3">
              <Figure avatar={p.avatar} look={p.look} size={52} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{p.name}</p>
                <p className="text-sm text-muted">
                  {GAMES[p.game].icon} {GAMES[p.game].name}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted">{p.progress}</p>
                {p.score > 0 && <p className="text-xl font-extrabold text-sun tabular-nums">{fmt(p.score)}</p>}
              </div>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {CHEERS.map((e) => (
                <button key={e} onClick={() => cheer(p.id, e)} className="rounded-2xl bg-night-3 py-2 text-2xl transition active:scale-90" aria-label={`ส่ง ${e} ให้ ${p.name}`}>
                  {e}
                </button>
              ))}
            </div>
            {sent
              .filter((s) => s.to === p.id)
              .map((s) => (
                <span key={s.key} className="guild-cheer pointer-events-none absolute right-6 bottom-14 text-3xl">
                  {s.emoji}
                </span>
              ))}
          </div>
        ))}
      </section>

      {rivals.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">ฝั่งตรงข้ามที่กำลังเล่น</h2>
          {rivals.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-coral/10 px-3 py-2">
              <Figure avatar={p.avatar} look={p.look} size={36} />
              <span className="min-w-0 flex-1 truncate text-sm">
                {p.name} · {GAMES[p.game].icon} {p.progress}
              </span>
              {p.score > 0 && <span className="font-bold text-coral tabular-nums">{fmt(p.score)}</span>}
            </div>
          ))}
        </section>
      )}

      <p className="text-center text-xs text-muted">
        เสียงเชียร์จะลอยขึ้นบนจอของเพื่อนตอนที่เขากำลังเล่น {session.me.player.avatar}
      </p>
    </main>
  );
}
