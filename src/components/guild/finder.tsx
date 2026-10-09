"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { haptic } from "@/lib/haptics";
import { guildApi } from "@/lib/guild/client";
import { GUILD_COLORS, GUILD_EMBLEMS, MAX_GUILD_NAME, MAX_MOTTO, memberCap, type GuildColor } from "@/lib/guild/catalog";
import type { GuildSummary } from "@/lib/guild/types";
import { ROOM_BG } from "../colors";
import type { Session } from "./gate";
import { ErrorNote, GuildBadge, Sheet, message } from "./ui";

/** For players without a guild: browse islands, join one, or found your own. */
export function GuildFinder({ session }: { session: Session }) {
  const [guilds, setGuilds] = useState<GuildSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      guildApi<{ guilds: GuildSummary[] }>(`/api/guilds?q=${encodeURIComponent(query)}`)
        .then((d) => alive && setGuilds(d.guilds.filter((g) => !g.npc)))
        .catch((e) => alive && setError(message(e)));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);

  async function join(id: string) {
    haptic("tap");
    setBusy(id);
    setError("");
    try {
      await session.act({ action: "join", guildId: id });
    } catch (e) {
      setError(message(e));
      setBusy("");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 px-4 pt-4 pb-32">
      <header className="flex items-center gap-3">
        <Link href="/" aria-label="กลับล็อบบี้" className="glass grid size-10 shrink-0 place-items-center rounded-full">
          ←
        </Link>
        <h1 className="text-2xl font-extrabold">กิลด์</h1>
      </header>

      <section className="flex flex-col items-center gap-3 rounded-[2rem] bg-gradient-to-br from-sky/30 via-lilac/20 to-pink/25 p-6 text-center ring-1 ring-white/10">
        <span className="bob text-7xl">🏝️</span>
        <h2 className="text-2xl font-extrabold">หาเกาะให้ตัวเอง</h2>
        <p className="max-w-sm text-sm text-ink/80">
          รวมแก๊งเป็นกิลด์ แต่งเกาะด้วยกัน แล้วไปยึดเกาะกิลด์อื่นด้วยมินิเกมสนุก ๆ ทั้งเด็กและผู้ใหญ่เล่นด้วยกันได้ แพ้ก็ไม่เสียอะไร
        </p>
        <button
          onClick={() => {
            haptic("tap");
            setCreating(true);
          }}
          className="neon mt-1 rounded-full bg-sun px-6 py-3 text-lg font-extrabold text-night"
        >
          ＋ ตั้งกิลด์ของฉัน
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">กิลด์ที่เปิดรับสมาชิก</h2>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔎 ค้นหาชื่อกิลด์"
          className="glass rounded-2xl px-4 py-3 outline-none placeholder:text-muted/60 focus:ring-2 focus:ring-lilac"
        />
        <ErrorNote text={error} />
        {guilds === null && !error && <div className="h-28 animate-pulse rounded-3xl bg-night-2" />}
        {guilds?.length === 0 && (
          <p className="glass rounded-3xl p-6 text-center text-sm text-muted">
            {query ? "ไม่เจอกิลด์ชื่อนี้" : "ยังไม่มีใครตั้งกิลด์เลย เป็นกิลด์แรกของแอปกันเถอะ!"}
          </p>
        )}
        {guilds?.map((g) => {
          const full = g.members >= memberCap(g.level);
          return (
            <div key={g.id} className="glass flex items-center gap-3 rounded-3xl p-3">
              <GuildBadge emblem={g.emblem} color={g.color} size={52} />
              <Link href={`/guild/${g.id}`} className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-bold">{g.name}</span>
                <span className="text-xs text-muted">
                  Lv.{g.level} · {g.members}/{memberCap(g.level)} คน · ชนะ {g.wins} ศึก
                </span>
                {g.motto && <span className="truncate text-xs text-ink/70">“{g.motto}”</span>}
              </Link>
              <button
                disabled={Boolean(busy) || full}
                onClick={() => join(g.id)}
                className="rounded-full bg-mint px-4 py-2 text-sm font-bold text-night disabled:opacity-50"
              >
                {full ? "เต็ม" : busy === g.id ? "…" : "เข้าร่วม"}
              </button>
            </div>
          );
        })}
      </section>

      {creating && <CreateGuild session={session} onClose={() => setCreating(false)} />}
    </main>
  );
}

function CreateGuild({ session, onClose }: { session: Session; onClose: () => void }) {
  const [name, setName] = useState("");
  const [motto, setMotto] = useState("");
  const [emblem, setEmblem] = useState<string>(GUILD_EMBLEMS[0]);
  const [color, setColor] = useState<GuildColor>("sky");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    haptic("tap");
    setBusy(true);
    setError("");
    try {
      await session.act({ action: "create", name, motto, emblem, color });
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  }

  return (
    <Sheet title="ตั้งกิลด์ใหม่" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex justify-center">
          <GuildBadge emblem={emblem} color={color} size={84} />
        </div>
        <div className="grid grid-cols-6 gap-2">
          {GUILD_EMBLEMS.map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={e === emblem}
              onClick={() => setEmblem(e)}
              className={`grid aspect-square place-items-center rounded-xl text-xl ${e === emblem ? "bg-night-3 ring-2 ring-sun" : "glass"}`}
            >
              {e}
            </button>
          ))}
        </div>
        <div className="flex justify-center gap-3">
          {GUILD_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={c === color}
              onClick={() => setColor(c)}
              className={`size-9 rounded-full ${ROOM_BG[c]} ${c === color ? "ring-4 ring-white/80" : "opacity-70"}`}
            />
          ))}
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_GUILD_NAME}
          autoFocus
          placeholder="ชื่อกิลด์ เช่น แก๊งชาไทย"
          className="glass rounded-2xl px-4 py-3 outline-none placeholder:text-muted/60 focus:ring-2 focus:ring-lilac"
        />
        <input
          value={motto}
          onChange={(e) => setMotto(e.target.value)}
          maxLength={MAX_MOTTO}
          placeholder="คำขวัญกิลด์ (ไม่ใส่ก็ได้)"
          className="glass rounded-2xl px-4 py-3 outline-none placeholder:text-muted/60 focus:ring-2 focus:ring-lilac"
        />
        <ErrorNote text={error} />
        <button disabled={busy || !name.trim()} className="neon rounded-full bg-sun py-3.5 text-lg font-extrabold text-night disabled:opacity-50">
          {busy ? "กำลังสร้างเกาะ…" : "สร้างเกาะกิลด์ 🏝️"}
        </button>
      </form>
    </Sheet>
  );
}
