"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { haptic } from "@/lib/haptics";
import { guildApi } from "@/lib/guild/client";
import {
  COSMETICS,
  DECOR,
  RARITY_LABEL,
  ZONES,
  cosmeticById,
  decorById,
  slotZone,
  type LookSlot,
  type SlotId,
} from "@/lib/guild/catalog";
import type { GuildSummary, GuildView, Member, MeView, Role } from "@/lib/guild/types";
import type { Session } from "./gate";
import { Duel, ErrorNote, Figure, GuildBadge, Sheet, fmt, message, timeLeft, useNow } from "./ui";

export const ROLE_LABEL: Record<Role, string> = { leader: "👑 หัวหน้า", officer: "⭐ รองหัวหน้า", member: "สมาชิก" };

const RARITY_RING = { common: "ring-white/20", rare: "ring-sky", epic: "ring-sun" } as const;

// ---- War room ------------------------------------------------------------------

type Target = GuildSummary & { busy: boolean; gap: number };

export function WarSheet({ guild, canManage, onClose }: { guild: GuildView; canManage: boolean; onClose: () => void }) {
  const router = useRouter();
  const now = useNow(1000);
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const attacking = guild.wars.some((w) => w.side === "attacker");

  useEffect(() => {
    if (!canManage || attacking) return;
    guildApi<{ targets: Target[] }>("/api/war")
      .then((d) => setTargets(d.targets))
      .catch((e) => setError(message(e)));
  }, [canManage, attacking]);

  async function attack(id: string) {
    haptic("nudge");
    setBusy(id);
    setError("");
    try {
      const { warId } = await guildApi<{ warId: string }>("/api/war", { body: { target: id } });
      router.push(`/guild/war/${warId}`);
    } catch (e) {
      setError(message(e));
      setBusy("");
    }
  }

  return (
    <Sheet title="⚔️ ห้องวางแผนสงคราม" onClose={onClose} wide>
      {guild.wars.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-muted">ศึกที่กำลังดำเนินอยู่</h3>
          {guild.wars.map((w) => {
            const ours = w.totals[w.side];
            const theirs = w.totals[w.side === "attacker" ? "defender" : "attacker"];
            return (
              <Link key={w.id} href={`/guild/war/${w.id}`} className="glass flex flex-col gap-2 rounded-2xl p-3 transition active:scale-[0.98]">
                <span className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-bold">
                    {w.side === "attacker" ? "⚔️ บุกเกาะ" : "🛡️ ป้องกันจาก"} {w.opponentEmblem} {w.opponent}
                  </span>
                  <span className="text-xs text-muted">⏳ {timeLeft(w.endsAt - now)}</span>
                </span>
                <Duel ours={ours} theirs={theirs} height={10} />
                <span className="text-xs text-muted">
                  {w.side === "attacker" ? `ยึดได้ ${w.captured}/5 ด่าน` : `โดนยึดไป ${w.captured}/5 ด่าน`} · แตะเพื่อไปที่แผนที่
                </span>
              </Link>
            );
          })}
        </section>
      )}

      {!canManage && !guild.wars.length && (
        <p className="glass rounded-2xl p-4 text-center text-sm text-muted">
          ตอนนี้ยังไม่มีศึก หัวหน้าหรือรองหัวหน้าเป็นคนเลือกว่าจะไปบุกเกาะไหน
        </p>
      )}

      {canManage && attacking && (
        <p className="text-center text-sm text-muted">บุกได้ทีละ 1 เกาะ จบศึกนี้แล้วค่อยเลือกเกาะต่อไปนะ</p>
      )}

      {canManage && !attacking && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-muted">เลือกเกาะที่จะบุก</h3>
          <p className="text-xs text-muted">
            เพื่อนในกิลด์มีเวลา 24 ชั่วโมง เล่นมินิเกม 5 ด่านแข่งกับยามหุ่นยนต์และคะแนนของอีกฝั่ง ถ้ายึดได้ 3 ด่านขึ้นไปถือว่าชนะ แพ้ก็ไม่เสียอะไร แค่ได้รางวัลน้อยกว่า
          </p>
          <ErrorNote text={error} />
          {!targets && !error && <div className="h-24 animate-pulse rounded-2xl bg-night-3" />}
          {targets?.map((t) => (
            <div key={t.id} className="glass flex items-center gap-3 rounded-2xl p-3">
              <GuildBadge emblem={t.emblem} color={t.color} size={44} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-bold">{t.name}</span>
                <span className="text-xs text-muted">
                  Lv.{t.level} · {t.npc ? "เกาะฝึกซ้อม 🤖" : `${t.members} คน`} ·{" "}
                  {t.gap === 0 ? "สมน้ำสมเนื้อ" : t.gap > 0 ? `แกร่งกว่า ${t.gap} เลเวล 💪` : `อ่อนกว่า ${-t.gap} เลเวล`}
                </span>
              </span>
              <button
                disabled={Boolean(busy) || t.busy}
                onClick={() => attack(t.id)}
                className="neon rounded-full bg-coral px-4 py-2 text-sm font-extrabold text-night [--glow:var(--color-coral)] disabled:opacity-50"
              >
                {t.busy ? "กำลังรบ" : busy === t.id ? "…" : "บุก!"}
              </button>
            </div>
          ))}
        </section>
      )}

      {guild.history.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold text-muted">ศึกที่ผ่านมา</h3>
          {guild.history.slice(0, 8).map((h) => (
            <Link key={h.warId} href={`/guild/war/${h.warId}`} className="flex items-center justify-between rounded-xl px-2 py-1.5 text-sm hover:bg-night-3">
              <span>
                {h.won ? "🏆" : "🎗️"} {h.side === "attacker" ? "บุก" : "รับ"} {h.opponentEmblem} {h.opponent}
              </span>
              <span className={h.won ? "font-bold text-mint" : "text-muted"}>{h.won ? "ชนะ" : "แพ้"}</span>
            </Link>
          ))}
        </section>
      )}
    </Sheet>
  );
}

// ---- Decorating --------------------------------------------------------------------

export function SlotSheet({ guild, slot, session, onClose }: { guild: GuildView; slot: SlotId; session: Session; onClose: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const current = guild.decor[slot] ? decorById(guild.decor[slot]!) : undefined;
  const zone = ZONES.find((z) => z.id === slotZone(slot))!;
  const stored = [...new Set(guild.storage)];

  async function run(body: Record<string, unknown>) {
    haptic("tap");
    setBusy(true);
    setError("");
    try {
      await session.act({ action: "decor", slot, ...body });
      onClose();
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  }

  return (
    <Sheet title={`ตกแต่ง${zone.name}`} onClose={onClose} wide>
      <p className="flex items-center justify-between text-sm">
        <span className="text-muted">{current ? `ตอนนี้วาง ${current.emoji} ${current.name}` : "ช่องนี้ยังว่างอยู่"}</span>
        <span className="rounded-full bg-sun/15 px-3 py-1 font-bold text-sun">🪙 {fmt(guild.coins)}</span>
      </p>
      <ErrorNote text={error} />
      {current && (
        <button disabled={busy} onClick={() => run({ kind: "store" })} className="glass rounded-2xl py-2.5 text-sm">
          📦 เก็บ {current.name} เข้าโกดัง
        </button>
      )}
      {stored.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-muted">ของในโกดัง (วางได้ฟรี)</h3>
          <div className="grid grid-cols-4 gap-2">
            {stored.map((id) => {
              const item = decorById(id)!;
              return (
                <button key={id} disabled={busy} onClick={() => run({ kind: "place", item: id })} className="glass flex flex-col items-center gap-1 rounded-2xl p-2 text-xs">
                  <span className="text-3xl">{item.emoji}</span>
                  <span className="line-clamp-1">{item.name}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-muted">ร้านของแต่งเกาะ</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {DECOR.map((item) => {
            const locked = guild.level < item.minLevel;
            const poor = guild.coins < item.cost;
            return (
              <button
                key={item.id}
                disabled={busy || locked || poor}
                onClick={() => run({ kind: "buy", item: item.id })}
                className="glass flex flex-col items-center gap-1 rounded-2xl p-2 text-xs disabled:opacity-45"
              >
                <span className={`text-3xl ${locked ? "grayscale" : ""}`}>{item.emoji}</span>
                <span className="line-clamp-1 font-medium">{item.name}</span>
                <span className={locked ? "text-muted" : "font-bold text-sun"}>{locked ? `🔒 Lv.${item.minLevel}` : `🪙 ${item.cost}`}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted">เหรียญกิลด์ได้จากการเล่นด่านในสงคราม และรางวัลเมื่อศึกจบ</p>
      </section>
    </Sheet>
  );
}

// ---- Wardrobe --------------------------------------------------------------------

export function WardrobeSheet({ me, session, onClose }: { me: MeView; session: Session; onClose: () => void }) {
  const [error, setError] = useState("");
  const owned = new Set(me.player.items);

  async function wear(slot: LookSlot, item: string | null) {
    haptic("tick");
    setError("");
    try {
      await session.act({ action: "equip", slot, item });
    } catch (e) {
      setError(message(e));
    }
  }

  return (
    <Sheet title="👕 ตู้เสื้อผ้า" onClose={onClose}>
      <div className="flex flex-col items-center gap-2 py-4">
        <Figure avatar={me.player.avatar} look={me.player.look} size={96} />
        <span className="mt-2 font-bold">{me.player.name}</span>
      </div>
      <ErrorNote text={error} />
      {(["hat", "hand"] as const).map((slot) => (
        <section key={slot} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-muted">{slot === "hat" ? "หมวก" : "ของในมือ"}</h3>
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => wear(slot, null)}
              aria-pressed={!me.player.look[slot]}
              className={`glass grid aspect-square place-items-center rounded-2xl text-xs text-muted ${!me.player.look[slot] ? "ring-2 ring-lilac" : ""}`}
            >
              ไม่ใส่
            </button>
            {COSMETICS.filter((c) => c.slot === slot).map((c) => {
              const has = owned.has(c.id);
              const on = me.player.look[slot] === c.id;
              return (
                <button
                  key={c.id}
                  disabled={!has}
                  onClick={() => wear(slot, c.id)}
                  aria-pressed={on}
                  title={has ? c.name : `${RARITY_LABEL[c.rarity]} · ได้จากสงคราม`}
                  className={`relative grid aspect-square place-items-center rounded-2xl bg-night-3 ring-2 ${on ? "ring-lilac" : RARITY_RING[c.rarity]} disabled:opacity-40`}
                >
                  <span className={`text-3xl ${has ? "" : "blur-[3px] grayscale"}`}>{c.emoji}</span>
                  <span className="absolute bottom-0.5 text-[9px] text-muted">{has ? c.name : "???"}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <p className="text-xs text-muted">ของแต่งตัวสุ่มดรอปเมื่อสงครามจบ ฝั่งชนะได้ทุกคน ฝั่งแพ้ก็มีลุ้น</p>
    </Sheet>
  );
}

/** Pops up when a war dropped new fashion on this player. */
export function BootyReveal({ items, onWear, onClose }: { items: string[]; onWear: () => void; onClose: () => void }) {
  return (
    <Sheet title="🎁 ได้ของจากสงคราม!" onClose={onClose}>
      <div className="flex flex-wrap justify-center gap-4 py-4">
        {items.map((id, i) => {
          const c = cosmeticById(id);
          if (!c) return null;
          return (
            <div key={id} className="guild-drop flex flex-col items-center gap-1" style={{ animationDelay: `${i * 180}ms` }}>
              <span className={`grid size-20 place-items-center rounded-3xl bg-night-3 text-5xl ring-4 ${RARITY_RING[c.rarity]}`}>{c.emoji}</span>
              <span className="text-sm font-bold">{c.name}</span>
              <span className="text-xs text-muted">{RARITY_LABEL[c.rarity]}</span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button onClick={onClose} className="glass flex-1 rounded-full py-3">
          เก็บไว้ก่อน
        </button>
        <button onClick={onWear} className="neon flex-1 rounded-full bg-sun py-3 font-extrabold text-night">
          ใส่เลย!
        </button>
      </div>
    </Sheet>
  );
}

// ---- Trophy room ----------------------------------------------------------------

export function TrophySheet({ guild, onClose }: { guild: GuildView; onClose: () => void }) {
  return (
    <Sheet title="🏆 ห้องถ้วยรางวัล" onClose={onClose}>
      <p className="text-center text-sm text-muted">
        ชนะ {guild.wins} · แพ้ {guild.losses} ศึก
      </p>
      {guild.trophies.length === 0 ? (
        <div className="glass flex flex-col items-center gap-2 rounded-2xl p-6 text-center">
          <span className="text-5xl grayscale">🏆</span>
          <p className="text-sm text-muted">ตู้ยังว่างอยู่ ชนะศึกแรกแล้วถ้วยจะมาวางตรงนี้</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {guild.trophies.map((t) => (
            <Link key={t.warId} href={`/guild/war/${t.warId}`} className="glass flex flex-col items-center gap-1 rounded-2xl p-3 text-center">
              <span className="text-4xl drop-shadow-[0_0_12px_var(--color-sun)]">{t.kind === "conquer" ? "🏆" : "🛡️"}</span>
              <span className="text-xs font-bold">{t.kind === "conquer" ? "พิชิต" : "ปกป้อง"}</span>
              <span className="line-clamp-1 text-[11px] text-muted">
                {t.opponentEmblem} {t.opponent}
              </span>
              <span className="text-[10px] text-muted">{new Date(t.at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span>
            </Link>
          ))}
        </div>
      )}
    </Sheet>
  );
}

// ---- Members ------------------------------------------------------------------------

export function MembersSheet({
  guild,
  me,
  online,
  session,
  onClose,
}: {
  guild: GuildView;
  me: MeView;
  online: Set<string>;
  session: Session;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const order: Record<Role, number> = { leader: 0, officer: 1, member: 2 };
  const members = [...guild.members].sort(
    (a, b) => order[a.role] - order[b.role] || Number(online.has(b.id)) - Number(online.has(a.id)) || b.contribution - a.contribution,
  );

  async function run(target: string, kind: string) {
    setError("");
    try {
      await session.act({ action: "member", target, kind });
      setOpen(null);
    } catch (e) {
      setError(message(e));
    }
  }

  return (
    <Sheet title={`👥 สมาชิก ${guild.members.length}/${guild.cap}`} onClose={onClose}>
      <ErrorNote text={error} />
      <ul className="flex flex-col gap-1">
        {members.map((m) => (
          <li key={m.id} className="flex flex-col rounded-2xl px-2 py-2 hover:bg-night-3/60">
            <div className="flex items-center gap-3">
              <span className="relative">
                <Figure avatar={m.avatar} look={m.look} size={40} />
                <span className={`absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-night-2 ${online.has(m.id) ? "bg-mint" : "bg-muted/50"}`} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">
                  {m.name} {m.id === me.player.id && <span className="text-xs text-muted">(คุณ)</span>}
                </span>
                <span className="text-xs text-muted">
                  {ROLE_LABEL[m.role]} · ผลงาน {fmt(m.contribution)}
                </span>
              </span>
              {me.role === "leader" && m.id !== me.player.id && (
                <button onClick={() => setOpen(open === m.id ? null : m.id)} className="rounded-full px-3 py-1 text-muted hover:bg-night-3" aria-label="จัดการ">
                  ⋯
                </button>
              )}
              {me.role === "officer" && m.role === "member" && (
                <button onClick={() => run(m.id, "kick")} className="rounded-full px-3 py-1 text-xs text-coral hover:bg-night-3">
                  เชิญออก
                </button>
              )}
            </div>
            {open === m.id && <MemberActions member={m} onRun={(kind) => run(m.id, kind)} />}
          </li>
        ))}
      </ul>
      {leaving ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-coral/10 p-3 text-center text-sm">
          <p>ออกจากกิลด์ {guild.name} จริงไหม? คะแนนที่เล่นไว้ในสงครามยังนับให้กิลด์อยู่นะ</p>
          <div className="flex gap-2">
            <button onClick={() => setLeaving(false)} className="glass flex-1 rounded-full py-2">
              ไม่ออกแล้ว
            </button>
            <button
              onClick={() => session.act({ action: "leave" }).catch((e) => setError(message(e)))}
              className="flex-1 rounded-full bg-coral py-2 font-bold text-night"
            >
              ออกจากกิลด์
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setLeaving(true)} className="text-sm text-muted underline-offset-4 hover:underline">
          ออกจากกิลด์
        </button>
      )}
    </Sheet>
  );
}

function MemberActions({ member, onRun }: { member: Member; onRun: (kind: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2 pl-14 text-xs">
      {member.role === "member" ? (
        <button onClick={() => onRun("promote")} className="glass rounded-full px-3 py-1.5">
          ⭐ ตั้งเป็นรองหัวหน้า
        </button>
      ) : (
        <button onClick={() => onRun("demote")} className="glass rounded-full px-3 py-1.5">
          ลดเป็นสมาชิก
        </button>
      )}
      <button onClick={() => onRun("transfer")} className="glass rounded-full px-3 py-1.5">
        👑 ยกตำแหน่งหัวหน้าให้
      </button>
      <button onClick={() => onRun("kick")} className="rounded-full bg-coral/15 px-3 py-1.5 text-coral">
        เชิญออก
      </button>
    </div>
  );
}

/** Tap an avatar on the island: say hi, or see who they are. */
export function MemberCard({
  member,
  isMe,
  onInteract,
  onClose,
}: {
  member: Member;
  isMe: boolean;
  onInteract: (kind: "wave" | "highfive") => void;
  onClose: () => void;
}) {
  const joined = new Date(member.joinedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
  return (
    <Sheet title={isMe ? "นี่คือคุณ" : member.name} onClose={onClose}>
      <div className="flex flex-col items-center gap-2 py-3">
        <Figure avatar={member.avatar} look={member.look} size={88} />
        <span className="mt-2 text-lg font-bold">{member.name}</span>
        <span className="text-sm text-muted">
          {ROLE_LABEL[member.role]} · ผลงาน {fmt(member.contribution)} · อยู่กิลด์ตั้งแต่ {joined}
        </span>
        <span className="flex gap-1 text-xl">
          {Object.values(member.look).map((id) => (
            <span key={id} title={cosmeticById(id!)?.name}>
              {cosmeticById(id!)?.emoji}
            </span>
          ))}
        </span>
      </div>
      {!isMe && (
        <div className="flex gap-2">
          <button
            onClick={() => {
              haptic("tap");
              onInteract("wave");
            }}
            className="glass flex-1 rounded-full py-3 text-lg"
          >
            👋 โบกมือ
          </button>
          <button
            onClick={() => {
              haptic("nudge");
              onInteract("highfive");
            }}
            className="neon flex-1 rounded-full bg-mint py-3 text-lg font-bold text-night [--glow:var(--color-mint)]"
          >
            🙌 ไฮไฟว์
          </button>
        </div>
      )}
    </Sheet>
  );
}
