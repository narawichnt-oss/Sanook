"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { haptic } from "@/lib/haptics";
import { guildApi, usePoll } from "@/lib/guild/client";
import { levelProgress, type SlotId } from "@/lib/guild/catalog";
import { canManage } from "@/lib/guild/guild";
import type { PresenceEvent } from "@/lib/guild/types";
import type { Session } from "./gate";
import { Island } from "./island";
import { BootyReveal, MemberCard, MembersSheet, SlotSheet, TrophySheet, WardrobeSheet, WarSheet } from "./sheets";
import { Duel, GuildBadge, fmt, timeLeft, useNow } from "./ui";

type Panel = "war" | "wardrobe" | "trophies" | "members" | { slot: SlotId } | { member: string } | null;

const PRESENCE_MS = 4000;

/** The guild's home island: who's around, what's going on, and the doors to everything else. */
export function GuildBase({ session }: { session: Session }) {
  const { me } = session;
  const guild = me.guild!;
  const manage = canManage(me.role);
  const now = useNow(1000);
  const [panel, setPanel] = useState<Panel>(null);
  const [editing, setEditing] = useState(false);
  const [online, setOnline] = useState<string[]>([me.player.id]);
  const [events, setEvents] = useState<PresenceEvent[]>([]);
  const since = useRef(0);
  const [booty, setBooty] = useState(me.player.fresh.length > 0);

  const beat = useCallback(
    async (interact?: { to: string; kind: "wave" | "highfive" }) => {
      const res = await guildApi<{ now: number; online: string[]; events: PresenceEvent[] }>(`/api/guilds/${guild.id}`, {
        body: { since: since.current, interact },
      });
      setOnline(res.online);
      if (res.events.length) {
        setEvents((prev) => [...prev.filter((e) => res.now - e.at < 3000), ...res.events.filter((e) => !prev.some((p) => p.id === e.id))]);
      } else {
        setEvents((prev) => prev.filter((e) => res.now - e.at < 3000));
      }
      since.current = res.now - 1;
    },
    [guild.id],
  );
  usePoll(() => beat(), PRESENCE_MS);

  // The guild document changes when friends play (coins, XP, war bars); refresh it now and then.
  usePoll(session.refresh, 20_000, { immediate: false });

  const onlineSet = useMemo(() => new Set(online), [online]);
  const walkers = guild.members.filter((m) => onlineSet.has(m.id) || m.id === me.player.id);
  const leader = guild.members.find((m) => m.role === "leader");
  const xp = levelProgress(guild.xp);
  const tapped = panel && typeof panel === "object" && "member" in panel ? guild.members.find((m) => m.id === panel.member) : undefined;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 pt-4 pb-36">
      <header className="flex items-center gap-3 px-4">
        <Link href="/" aria-label="กลับล็อบบี้" className="glass grid size-10 shrink-0 place-items-center rounded-full">
          ←
        </Link>
        <GuildBadge emblem={guild.emblem} color={guild.color} size={48} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="truncate text-xl leading-tight font-extrabold">{guild.name}</h1>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full bg-lilac/25 px-2 py-0.5 font-bold text-lilac">Lv.{xp.level}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-night-3">
              <span className="block h-full rounded-full bg-lilac" style={{ width: `${(xp.into / xp.need) * 100}%` }} />
            </span>
          </div>
        </div>
        <span className="rounded-full bg-sun/15 px-3 py-1.5 text-sm font-bold text-sun">🪙 {fmt(guild.coins)}</span>
      </header>

      {guild.motto && <p className="px-4 text-sm text-muted">“{guild.motto}”</p>}

      {/* Live wars sit right on top, so a glance says how the fight is going. */}
      {guild.wars.map((w) => {
        const them = w.side === "attacker" ? "defender" : "attacker";
        return (
          <Link
            key={w.id}
            href={`/guild/war/${w.id}`}
            onClick={() => haptic("tick")}
            className="mx-4 flex flex-col gap-2 rounded-3xl border border-white/10 bg-gradient-to-r from-sky/25 via-night-2 to-coral/25 p-4 transition active:scale-[0.98]"
          >
            <span className="flex items-center justify-between text-sm font-bold">
              <span>
                {w.side === "attacker" ? "⚔️ กำลังบุก" : "🛡️ โดนบุกโดย"} {w.opponentEmblem} {w.opponent}
              </span>
              <span className="text-xs font-normal text-muted">⏳ {timeLeft(w.endsAt - now)}</span>
            </span>
            <Duel ours={w.totals[w.side]} theirs={w.totals[them]} />
            <span className="flex justify-between text-xs">
              <span className="text-sky">เรา {fmt(w.totals[w.side])}</span>
              <span className="font-semibold text-ink">ลุยเลย →</span>
              <span className="text-coral">{fmt(w.totals[them])} เขา</span>
            </span>
          </Link>
        );
      })}

      <section className="relative mx-2 overflow-hidden rounded-[2rem] bg-gradient-to-b from-[#123a5c] via-[#0f2c4a] to-night-2 px-1 pt-2 pb-3 ring-1 ring-white/10">
        <div className="absolute top-3 left-4 z-40 flex items-center gap-1.5 rounded-full bg-night/60 px-2.5 py-1 text-xs">
          <span className="live-dot size-2 rounded-full bg-mint" /> ออนไลน์ {walkers.length} คน
        </div>
        {manage && (
          <button
            onClick={() => {
              haptic("tick");
              setEditing((v) => !v);
            }}
            className={`absolute top-3 right-4 z-40 rounded-full px-3 py-1 text-xs font-bold transition ${editing ? "bg-sun text-night" : "bg-night/60"}`}
          >
            {editing ? "✓ เสร็จแล้ว" : "🎨 ตกแต่ง"}
          </button>
        )}
        <Island
          level={guild.level}
          decor={guild.decor}
          members={walkers}
          leaderAvatar={leader?.avatar}
          trophies={guild.trophies.length}
          events={events}
          meId={me.player.id}
          editing={editing}
          onMember={(id) => setPanel({ member: id })}
          onSlot={(slot) => setPanel({ slot })}
          onHall={() => setPanel("trophies")}
        />
        {editing && <p className="text-center text-xs text-ink/80">แตะช่อง ＋ หรือของที่วางอยู่ เพื่อซื้อ วาง หรือเก็บของแต่ง</p>}
      </section>

      <p className="px-4 text-center text-xs text-muted">แตะเพื่อนบนเกาะเพื่อโบกมือหรือไฮไฟว์ · แตะ 🏛️ เพื่อดูถ้วยรางวัล</p>

      {/* Thumb zone */}
      <nav className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-night via-night/95 to-transparent px-4 pt-8 pb-5">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
          <DockButton icon="⚔️" label="สงคราม" accent onClick={() => setPanel("war")} badge={guild.wars.length || undefined} />
          <DockButton icon="👕" label="แต่งตัว" onClick={() => setPanel("wardrobe")} badge={me.player.fresh.length || undefined} />
          <DockButton icon="🏆" label="ถ้วยรางวัล" onClick={() => setPanel("trophies")} />
          <DockButton icon="👥" label="สมาชิก" onClick={() => setPanel("members")} />
        </div>
      </nav>

      {panel === "war" && <WarSheet guild={guild} canManage={manage} onClose={() => setPanel(null)} />}
      {panel === "wardrobe" && (
        <WardrobeSheet
          me={me}
          session={session}
          onClose={() => {
            setPanel(null);
            if (me.player.fresh.length) session.act({ action: "seen" }).catch(() => {});
          }}
        />
      )}
      {panel === "trophies" && <TrophySheet guild={guild} onClose={() => setPanel(null)} />}
      {panel === "members" && <MembersSheet guild={guild} me={me} online={onlineSet} session={session} onClose={() => setPanel(null)} />}
      {panel && typeof panel === "object" && "slot" in panel && (
        <SlotSheet guild={guild} slot={panel.slot} session={session} onClose={() => setPanel(null)} />
      )}
      {tapped && (
        <MemberCard
          member={tapped}
          isMe={tapped.id === me.player.id}
          onInteract={(kind) => {
            beat({ to: tapped.id, kind }).catch(() => {});
            setPanel(null);
          }}
          onClose={() => setPanel(null)}
        />
      )}
      {booty && !panel && (
        <BootyReveal
          items={me.player.fresh}
          onClose={() => {
            setBooty(false);
            session.act({ action: "seen" }).catch(() => {});
          }}
          onWear={() => {
            setBooty(false);
            setPanel("wardrobe");
          }}
        />
      )}
    </main>
  );
}

function DockButton({ icon, label, onClick, accent, badge }: { icon: string; label: string; onClick: () => void; accent?: boolean; badge?: number }) {
  return (
    <button
      onClick={() => {
        haptic("tick");
        onClick();
      }}
      className={`relative flex h-16 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-semibold transition active:scale-95 ${
        accent ? "neon bg-coral text-night [--glow:var(--color-coral)]" : "glass"
      }`}
    >
      <span className="text-2xl leading-none">{icon}</span>
      {label}
      {badge ? <span className="absolute -top-1.5 -right-1 min-w-5 rounded-full bg-pink px-1.5 text-[11px] font-bold text-white">{badge}</span> : null}
    </button>
  );
}
