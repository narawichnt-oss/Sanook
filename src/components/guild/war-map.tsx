"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { haptic } from "@/lib/haptics";
import { guildApi, usePoll } from "@/lib/guild/client";
import { GAMES } from "@/lib/guild/games";
import type { BoardRow, SideKey, WarView } from "@/lib/guild/types";
import type { Session } from "./gate";
import { Duel, ErrorNote, Figure, GuildBadge, Sheet, THEM, Ticker, US, fmt, message, timeLeft, useNow } from "./ui";

const POLL_MS = 5000;

// Stage spots along the board path, from our island (bottom-left) to theirs (top-right), in %.
const NODES = [
  { x: 32, y: 73 },
  { x: 68, y: 64 },
  { x: 80, y: 44 },
  { x: 34, y: 41 },
  { x: 58, y: 21 },
];
const HOME = { x: 11, y: 92 };
const AWAY = { x: 87, y: 8 };

export function WarMap({ id }: { id: string; session: Session }) {
  const now = useNow(1000);
  const [war, setWar] = useState<WarView | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setWar(await guildApi<WarView>(`/api/war/${id}`));
      setError("");
    } catch (e) {
      setError(message(e));
    }
  }, [id]);
  usePoll(load, POLL_MS);

  if (!war) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 px-4 pt-6">
        <ErrorNote text={error} />
        {!error && <div className="aspect-[3/4] animate-pulse rounded-[2rem] bg-night-2" />}
        <Link href="/guild" className="text-center text-sm text-muted underline">
          กลับเกาะกิลด์
        </Link>
      </main>
    );
  }

  // Everything is drawn from the viewer's side: we're blue at the bottom, they're red at the top.
  const us: SideKey = war.us ?? "attacker";
  const them: SideKey = us === "attacker" ? "defender" : "attacker";
  const order = us === "attacker" ? [0, 1, 2, 3, 4] : [4, 3, 2, 1, 0];
  const done = war.status === "done";
  const left = war.endsAt - now;
  const playable = war.us && !done && left > 0 && war.stages.some((s) => s.attemptsLeft > 0);
  const capturedNote = war.us === "defender" ? `โดนยึดไป ${war.captured.length}/5` : `ยึดได้ ${war.captured.length}/5`;

  const path = [HOME, ...NODES, AWAY].map((p, i) => `${i ? "L" : "M"} ${p.x * 10} ${p.y * 13.33}`).join(" ");

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-3 pt-3 pb-40">
      <header className="flex flex-col gap-2 px-4">
        <div className="flex items-center gap-2">
          <Link href="/guild" aria-label="กลับเกาะกิลด์" className="glass grid size-9 shrink-0 place-items-center rounded-full text-sm">
            ←
          </Link>
          <GuildBadge emblem={war.sides[us].emblem} color={war.sides[us].color} size={34} />
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-sky">{war.sides[us].name}</span>
          <span className="text-xs font-extrabold text-muted">VS</span>
          <span className="min-w-0 flex-1 truncate text-right text-sm font-bold text-coral">{war.sides[them].name}</span>
          <GuildBadge emblem={war.sides[them].emblem} color={war.sides[them].color} size={34} />
        </div>
        <Duel ours={war.totals[us]} theirs={war.totals[them]} height={18} />
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-sky">{fmt(war.totals[us])} แต้ม</span>
          <span className="rounded-full bg-night-3 px-2.5 py-0.5 text-muted">
            {done ? "จบศึกแล้ว" : `⏳ ${timeLeft(left)}`} · {capturedNote}
          </span>
          <span className="font-bold text-coral">{fmt(war.totals[them])} แต้ม</span>
        </div>
        <Ticker log={war.log} us={war.us} />
      </header>

      {done && war.result && <ResultBanner war={war} us={us} />}

      <section className="relative mx-2 aspect-[3/4] overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#123a5c] via-[#1a2350] to-[#3d1838] ring-1 ring-white/10">
        <svg viewBox="0 0 1000 1333" className="absolute inset-0 size-full" aria-hidden>
          <path d={path} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="46" strokeLinecap="round" strokeLinejoin="round" />
          <path d={path} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="6" strokeDasharray="4 22" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <Isle at={HOME} emblem={war.sides[us].emblem} label="เกาะเรา" color={US} />
        <Isle at={AWAY} emblem={war.sides[them].emblem} label="เกาะเขา" color={THEM} />

        {order.map((stageIndex, spot) => {
          const s = war.stages[stageIndex];
          const meta = GAMES[s.game];
          const ours = s.leader === us;
          const at = NODES[spot];
          return (
            <button
              key={stageIndex}
              onClick={() => {
                haptic("tick");
                setOpen(stageIndex);
              }}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 transition active:scale-95"
              style={{ left: `${at.x}%`, top: `${at.y}%` }}
            >
              <span className="text-lg leading-none" style={{ filter: `drop-shadow(0 0 6px ${ours ? US : THEM})` }}>
                {ours ? "🚩" : "🏴"}
              </span>
              <span
                className="grid size-14 place-items-center rounded-full bg-night-2 text-2xl ring-4 sm:size-20 sm:text-4xl"
                style={{ boxShadow: `0 0 0 4px ${ours ? US : THEM}, 0 10px 30px -6px ${ours ? US : THEM}` }}
              >
                {meta.icon}
              </span>
              <span className="rounded-full bg-night/80 px-2 py-0.5 text-[11px] leading-tight font-bold whitespace-nowrap">{meta.name.replace("ด่าน", "")}</span>
              <span className="rounded-full bg-night/80 px-2 py-0.5 text-[11px] font-bold tabular-nums">
                <span className="text-sky">{fmt(s.scores[us])}</span>
                <span className="text-muted"> : </span>
                <span className="text-coral">{fmt(s.scores[them])}</span>
              </span>
            </button>
          );
        })}
      </section>

      <p className="px-4 text-center text-xs text-muted">
        แตะด่านเพื่อดูอันดับ · ทุกด่านนับ 3 คะแนนสูงสุดของแต่ละฝั่ง · ฝั่งบุกต้องยึดให้ได้ 3 ใน 5 ด่าน
      </p>

      {/* Exactly two actions, bottom-right, where thumbs already are. */}
      {war.us && !done && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-20 mx-auto flex max-w-2xl flex-col items-end gap-3 px-4 *:pointer-events-auto">
          <Link
            href={`/guild/war/${id}/watch`}
            onClick={() => haptic("tick")}
            className="glass-strong flex h-14 items-center gap-2 rounded-full px-5 font-bold shadow-xl transition active:scale-95"
          >
            📣 เชียร์เพื่อน
          </Link>
          {playable ? (
            <Link
              href={`/guild/war/${id}/play/auto`}
              onClick={() => haptic("tap")}
              className="neon flex h-16 items-center gap-2 rounded-full bg-sun px-7 text-xl font-extrabold text-night transition active:scale-95"
            >
              ▶ ลุยเลย!
            </Link>
          ) : (
            <span className="glass rounded-full px-5 py-3 text-sm text-muted">เล่นครบทุกด่านแล้ว 🎉</span>
          )}
        </div>
      )}

      {open !== null && <StageSheet war={war} index={open} us={us} now={now} onClose={() => setOpen(null)} />}
    </main>
  );
}

function Isle({ at, emblem, label, color }: { at: { x: number; y: number }; emblem: string; label: string; color: string }) {
  return (
    <span className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `${at.x}%`, top: `${at.y}%` }}>
      <span className="grid size-16 place-items-center rounded-[40%] bg-[#7fd68c] text-3xl shadow-[0_10px_0_#8a5d37]" style={{ outline: `3px solid ${color}` }}>
        {emblem}
      </span>
      <span className="mt-2 rounded-full bg-night/80 px-2 text-[11px] font-bold" style={{ color }}>
        {label}
      </span>
    </span>
  );
}

function StageSheet({ war, index, us, now, onClose }: { war: WarView; index: number; us: SideKey; now: number; onClose: () => void }) {
  const s = war.stages[index];
  const meta = GAMES[s.game];
  const them: SideKey = us === "attacker" ? "defender" : "attacker";
  const canPlay = war.us && war.status === "active" && war.endsAt > now && s.attemptsLeft > 0;
  return (
    <Sheet title={`${meta.icon} ${meta.name}`} onClose={onClose} wide>
      <p className="text-sm text-muted">{meta.blurb}</p>
      <div
        className="rounded-2xl px-4 py-2 text-center text-sm font-bold"
        style={{ background: `color-mix(in srgb, ${s.leader === us ? US : THEM} 20%, transparent)` }}
      >
        {s.leader === us ? "🚩 ฝั่งเรากำลังครองด่านนี้" : "🏴 อีกฝั่งยังครองด่านนี้อยู่"} ({fmt(s.scores[us])} : {fmt(s.scores[them])})
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Board title="ฝั่งเรา" rows={s.rows[us]} color={US} />
        <Board title="ฝั่งเขา" rows={s.rows[them]} color={THEM} />
      </div>
      {war.us && (
        <p className="text-center text-sm text-muted">
          สถิติของคุณ {fmt(s.myBest)} แต้ม · เหลือสิทธิ์เล่น {s.attemptsLeft} ครั้ง
        </p>
      )}
      {canPlay && (
        <Link
          href={`/guild/war/${war.id}/play/${index}`}
          className="neon grid h-14 place-items-center rounded-full bg-sun text-lg font-extrabold text-night"
          onClick={() => haptic("tap")}
        >
          ▶ เล่นด่านนี้
        </Link>
      )}
    </Sheet>
  );
}

function Board({ title, rows, color }: { title: string; rows: BoardRow[]; color: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-night-3/60 p-2.5">
      <span className="text-xs font-bold" style={{ color }}>
        {title}
      </span>
      {rows.length === 0 && <span className="py-3 text-center text-xs text-muted">ยังไม่มีใครลงสนาม</span>}
      {rows.map((r, i) => (
        <span key={`${r.name}-${i}`} className="flex items-center gap-2 text-sm">
          {r.kind === "guard" ? (
            <span className="grid size-7 place-items-center rounded-full bg-night text-base">🤖</span>
          ) : (
            <Figure avatar={r.avatar} look={r.look} size={28} />
          )}
          <span className={`min-w-0 flex-1 truncate ${r.kind === "guard" ? "text-muted" : ""}`}>{r.name}</span>
          <span className="font-bold tabular-nums">{fmt(r.score)}</span>
        </span>
      ))}
    </div>
  );
}

function ResultBanner({ war, us }: { war: WarView; us: SideKey }) {
  const r = war.result!;
  const won = war.us ? r.winner === war.us : null;
  const reward = war.us ? r.rewards[war.us] : null;
  return (
    <section
      className={`mx-4 flex flex-col items-center gap-2 rounded-3xl p-5 text-center ring-1 ring-white/10 ${
        won === false ? "bg-gradient-to-br from-lilac/25 to-night-2" : "bg-gradient-to-br from-sun/30 via-pink/15 to-night-2"
      }`}
    >
      <span className="guild-drop text-6xl">{won === false ? "🎗️" : "🏆"}</span>
      <h2 className="text-2xl font-extrabold">
        {won === null ? `${war.sides[r.winner].name} ชนะ!` : won ? "ชนะแล้ว!" : "สู้ได้ดีมาก!"}
      </h2>
      <p className="text-sm text-ink/80">
        {r.winner === "attacker"
          ? `${war.sides.attacker.name} ยึดได้ ${r.captured.length} จาก 5 ด่าน`
          : `${war.sides.defender.name} ป้องกันเกาะไว้ได้ (โดนยึด ${r.captured.length} ด่าน)`}
      </p>
      {r.mvp && (
        <p className="text-sm">
          ⭐ MVP: {r.mvp.avatar} {r.mvp.name} ({fmt(r.mvp.points)} แต้ม{r.mvp.side === us ? " · ฝั่งเรา" : ""})
        </p>
      )}
      {reward && (
        <p className="rounded-full bg-night/50 px-4 py-1.5 text-sm font-bold">
          กิลด์ได้ +{reward.xp} XP · 🪙 +{reward.coins} {won ? "· 🏆 ถ้วยใหม่" : ""}
        </p>
      )}
      {won === false && <p className="text-xs text-muted">แพ้ก็ไม่เสียอะไรเลย แถมคนที่ลงเล่นยังมีลุ้นของแต่งตัวด้วย</p>}
      <Link href="/guild" className="mt-1 rounded-full bg-sun px-6 py-2.5 font-extrabold text-night">
        กลับเกาะไปดูของรางวัล
      </Link>
    </section>
  );
}
