"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { haptic } from "@/lib/haptics";
import { guildApi } from "@/lib/guild/client";
import { memberCap } from "@/lib/guild/catalog";
import { canManage } from "@/lib/guild/guild";
import type { GuildView } from "@/lib/guild/types";
import type { Session } from "./gate";
import { Island } from "./island";
import { ErrorNote, GuildBadge, message } from "./ui";

/** Someone else's island: look around, join it, or (if you lead a guild) invade it. */
export function GuildVisit({ id, session }: { id: string; session: Session }) {
  const router = useRouter();
  const { me } = session;
  const [guild, setGuild] = useState<GuildView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me.guild?.id === id) {
      router.replace("/guild");
      return;
    }
    guildApi<GuildView>(`/api/guilds/${id}`)
      .then(setGuild)
      .catch((e) => setError(message(e)));
  }, [id, me.guild?.id, router]);

  async function run(fn: () => Promise<void>) {
    haptic("tap");
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  }

  if (!guild) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 px-4 pt-6">
        <ErrorNote text={error} />
        {!error && <div className="aspect-[3/2] animate-pulse rounded-[2rem] bg-night-2" />}
        <Link href="/guild" className="text-center text-sm text-muted underline">
          กลับเกาะของฉัน
        </Link>
      </main>
    );
  }

  const leader = guild.members.find((m) => m.role === "leader");
  const atWar = me.guild?.activeWars.some((w) => w.opponentId === guild.id);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 pt-4 pb-32">
      <header className="flex items-center gap-3 px-4">
        <Link href="/guild" aria-label="กลับ" className="glass grid size-10 shrink-0 place-items-center rounded-full">
          ←
        </Link>
        <GuildBadge emblem={guild.emblem} color={guild.color} size={48} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">กำลังเที่ยวเกาะ</p>
          <h1 className="truncate text-xl font-extrabold">{guild.name}</h1>
        </div>
      </header>
      <p className="px-4 text-sm text-muted">
        Lv.{guild.level} · {guild.npc ? "เกาะฝึกซ้อม 🤖" : `${guild.members.length}/${memberCap(guild.level)} คน`} · ชนะ {guild.wins} ศึก
        {guild.motto && <> · “{guild.motto}”</>}
      </p>

      <section className="mx-2 overflow-hidden rounded-[2rem] bg-gradient-to-b from-[#3a1f3f] via-[#24183a] to-night-2 px-1 pt-2 pb-3 ring-1 ring-white/10">
        <Island level={guild.level} decor={guild.decor} members={[]} leaderAvatar={leader?.avatar} trophies={guild.trophies.length} />
      </section>

      <div className="px-4">
        <ErrorNote text={error} />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-night via-night/95 to-transparent px-4 pt-8 pb-6">
        <div className="mx-auto flex max-w-md gap-3">
          {!me.guild && !guild.npc && (
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await session.act({ action: "join", guildId: guild.id });
                  router.push("/guild");
                })
              }
              className="neon h-14 flex-1 rounded-full bg-mint text-lg font-extrabold text-night [--glow:var(--color-mint)] disabled:opacity-60"
            >
              เข้าร่วมกิลด์นี้
            </button>
          )}
          {me.guild && canManage(me.role) && !atWar && (
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const { warId } = await guildApi<{ warId: string }>("/api/war", { body: { target: guild.id } });
                  router.push(`/guild/war/${warId}`);
                })
              }
              className="neon h-14 flex-1 rounded-full bg-coral text-lg font-extrabold text-night [--glow:var(--color-coral)] disabled:opacity-60"
            >
              ⚔️ บุกเกาะนี้!
            </button>
          )}
          {me.guild && (!canManage(me.role) || atWar) && (
            <Link href="/guild" className="glass grid h-14 flex-1 place-items-center rounded-full font-bold">
              กลับเกาะของเรา
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
