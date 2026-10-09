// Guild membership, ranks, island decorating, and war bookkeeping. Pure
// functions that mutate the Guild they're given; the service layer wraps
// them in compare-and-swap writes.

import {
  DECOR_SLOTS,
  GUILD_COLORS,
  GUILD_EMBLEMS,
  MAX_GUILD_NAME,
  MAX_MOTTO,
  decorById,
  levelOf,
  memberCap,
  slotZone,
  zoneUnlocked,
  type GuildColor,
  type SlotId,
} from "./catalog";
import type { Guild, GuildSummary, Member, Player, Role, SideKey, War } from "./types";

type Result<T = true> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export type GuildInput = { name: string; emblem: string; color: GuildColor; motto: string };

export function parseGuildInput(input: unknown): Result<GuildInput> {
  const body = (input ?? {}) as Record<string, unknown>;
  const name = clean(body.name);
  const motto = clean(body.motto);
  if (!name) return fail("ตั้งชื่อกิลด์ก่อนนะ");
  if ([...name].length > MAX_GUILD_NAME) return fail(`ชื่อกิลด์ยาวได้ไม่เกิน ${MAX_GUILD_NAME} ตัวอักษร`);
  if ([...motto].length > MAX_MOTTO) return fail(`คำขวัญยาวได้ไม่เกิน ${MAX_MOTTO} ตัวอักษร`);
  const emblem = (GUILD_EMBLEMS as readonly string[]).includes(body.emblem as string) ? (body.emblem as string) : GUILD_EMBLEMS[0];
  const color = (GUILD_COLORS as readonly string[]).includes(body.color as string) ? (body.color as GuildColor) : GUILD_COLORS[0];
  return { ok: true, value: { name, emblem, color, motto } };
}

function memberFrom(player: Player, role: Role, now: number): Member {
  return { id: player.id, name: player.name, avatar: player.avatar, look: player.look, role, joinedAt: now, contribution: 0 };
}

export function newGuild(id: string, input: GuildInput, founder: Player, now: number): Guild {
  return {
    id,
    ...input,
    createdAt: now,
    xp: 0,
    // Enough for a first decoration, so the island isn't bare on day one.
    coins: 100,
    members: [memberFrom(founder, "leader", now)],
    decor: { p1: "tulips" },
    storage: [],
    trophies: [],
    history: [],
    activeWars: [],
    wins: 0,
    losses: 0,
  };
}

export function summarize(guild: Guild): GuildSummary {
  return {
    id: guild.id,
    name: guild.name,
    emblem: guild.emblem,
    color: guild.color,
    motto: guild.motto,
    level: guild.npc?.level ?? levelOf(guild.xp),
    members: guild.members.length,
    wins: guild.wins,
    npc: Boolean(guild.npc),
  };
}

export function roleOf(guild: Guild, playerId: string): Role | null {
  return guild.members.find((m) => m.id === playerId)?.role ?? null;
}

/** Leaders and officers run the island and pick fights. */
export function canManage(role: Role | null): boolean {
  return role === "leader" || role === "officer";
}

export function addMember(guild: Guild, player: Player, now: number): Result {
  if (guild.npc) return fail("กิลด์นี้เป็นกิลด์ของระบบ เข้าร่วมไม่ได้");
  if (guild.disbanded) return fail("กิลด์นี้ปิดไปแล้ว");
  if (guild.members.some((m) => m.id === player.id)) return { ok: true, value: true };
  if (guild.members.length >= memberCap(levelOf(guild.xp))) return fail("กิลด์นี้สมาชิกเต็มแล้ว");
  guild.members.push(memberFrom(player, "member", now));
  return { ok: true, value: true };
}

const RANK: Record<Role, number> = { leader: 0, officer: 1, member: 2 };

/** Removes a member. If the leader leaves, the most senior officer (or member) takes over. */
export function removeMember(guild: Guild, playerId: string) {
  const leaving = guild.members.find((m) => m.id === playerId);
  guild.members = guild.members.filter((m) => m.id !== playerId);
  if (leaving?.role === "leader" && guild.members.length) {
    const heir = [...guild.members].sort((a, b) => RANK[a.role] - RANK[b.role] || a.joinedAt - b.joinedAt)[0];
    heir.role = "leader";
  }
  if (!guild.members.length) guild.disbanded = true;
}

export type MemberAction = "promote" | "demote" | "kick" | "transfer";

export function changeMember(guild: Guild, actorId: string, targetId: string, action: MemberAction): Result {
  const actor = guild.members.find((m) => m.id === actorId);
  const target = guild.members.find((m) => m.id === targetId);
  if (!actor || !target) return fail("ไม่พบสมาชิกคนนี้");
  if (actor.id === target.id) return fail("ทำกับตัวเองไม่ได้");
  if (actor.role !== "leader" && !(action === "kick" && actor.role === "officer" && target.role === "member")) {
    return fail("หัวหน้ากิลด์เท่านั้นที่ทำได้");
  }
  switch (action) {
    case "promote":
      target.role = "officer";
      break;
    case "demote":
      target.role = "member";
      break;
    case "transfer":
      target.role = "leader";
      actor.role = "officer";
      break;
    case "kick":
      removeMember(guild, target.id);
      break;
  }
  return { ok: true, value: true };
}

function slotOpen(guild: Guild, slot: SlotId): Result {
  if (!DECOR_SLOTS.some((s) => s.id === slot)) return fail("ไม่พบตำแหน่งนี้บนเกาะ");
  if (!zoneUnlocked(slotZone(slot), levelOf(guild.xp))) return fail("โซนนี้ยังไม่ปลดล็อก อัปเลเวลกิลด์ก่อนนะ");
  return { ok: true, value: true };
}

/** Buys a decoration. Placed straight onto `slot` when given, otherwise kept in storage. */
export function buyDecor(guild: Guild, itemId: string, slot?: SlotId): Result {
  const item = decorById(itemId);
  if (!item) return fail("ไม่พบของชิ้นนี้");
  if (levelOf(guild.xp) < item.minLevel) return fail(`ต้องเป็นกิลด์เลเวล ${item.minLevel} ก่อน`);
  if (guild.coins < item.cost) return fail("เหรียญกิลด์ไม่พอ ไปตีกิลด์เก็บเหรียญก่อนนะ");
  if (slot) {
    const open = slotOpen(guild, slot);
    if (!open.ok) return open;
  }
  guild.coins -= item.cost;
  guild.storage.push(itemId);
  return slot ? placeDecor(guild, itemId, slot) : { ok: true, value: true };
}

/** Moves a stored decoration onto the island; whatever was there goes back to storage. */
export function placeDecor(guild: Guild, itemId: string, slot: SlotId): Result {
  const open = slotOpen(guild, slot);
  if (!open.ok) return open;
  const at = guild.storage.indexOf(itemId);
  if (at < 0) return fail("ไม่มีของชิ้นนี้ในโกดัง");
  guild.storage.splice(at, 1);
  const previous = guild.decor[slot];
  if (previous) guild.storage.push(previous);
  guild.decor[slot] = itemId;
  return { ok: true, value: true };
}

export function storeDecor(guild: Guild, slot: SlotId): Result {
  const item = guild.decor[slot];
  if (!item) return fail("ตรงนี้ยังว่างอยู่");
  delete guild.decor[slot];
  guild.storage.push(item);
  return { ok: true, value: true };
}

/**
 * Books a finished war into one side's guild: XP, coins, record, and a trophy
 * for the winner. Safe to call twice — the second call does nothing.
 */
export function applyWarResult(guild: Guild, war: War, side: SideKey): boolean {
  if (!war.result || guild.history.some((h) => h.warId === war.id)) return false;
  const won = war.result.winner === side;
  const opponent = war[side === "attacker" ? "defender" : "attacker"];
  const reward = war.result.rewards[side];
  guild.xp += reward.xp;
  guild.coins += reward.coins;
  if (won) guild.wins++;
  else guild.losses++;
  guild.activeWars = guild.activeWars.filter((w) => w.id !== war.id);
  guild.history.unshift({
    warId: war.id,
    side,
    opponent: opponent.name,
    opponentEmblem: opponent.emblem,
    won,
    captured: war.result.captured.length,
    at: war.endsAt,
  });
  guild.history = guild.history.slice(0, 30);
  if (won) {
    guild.trophies.unshift({
      warId: war.id,
      kind: side === "attacker" ? "conquer" : "defend",
      opponent: opponent.name,
      opponentEmblem: opponent.emblem,
      captured: war.result.captured.length,
      at: war.endsAt,
    });
    guild.trophies = guild.trophies.slice(0, 24);
  }
  return true;
}

// ---- Computer-run guilds -------------------------------------------------------

/** Always-available opponents, so a brand-new guild has someone to invade on day one. */
export const NPC_GUILDS = [
  {
    id: "npc-thunder",
    name: "กิลด์สายฟ้า",
    emblem: "⚡",
    color: "sky",
    motto: "เกาะฝึกซ้อมสำหรับมือใหม่",
    difficulty: 0.8,
    level: 1,
    decor: { p1: "palm", p2: "tent" },
  },
  {
    id: "npc-mango",
    name: "แก๊งมะม่วงหาว",
    emblem: "🍉",
    color: "sun",
    motto: "หวานแต่ไม่ยอมใคร",
    difficulty: 1,
    level: 3,
    decor: { p1: "fountain", g1: "tulips", f1: "slide" },
  },
  {
    id: "npc-dragon",
    name: "มังกรทองคำ",
    emblem: "🐉",
    color: "coral",
    motto: "เกาะในตำนาน ใครตีแตกคือของจริง",
    difficulty: 1.2,
    level: 6,
    decor: { p1: "fountain", f1: "ferris", c1: "gacha", s1: "castle", g1: "streamer" },
  },
] as const;

export function npcGuild(def: (typeof NPC_GUILDS)[number], now: number): Guild {
  return {
    id: def.id,
    name: def.name,
    emblem: def.emblem,
    color: def.color,
    motto: def.motto,
    createdAt: now,
    xp: 0,
    coins: 0,
    members: [],
    decor: { ...def.decor },
    storage: [],
    trophies: [],
    history: [],
    activeWars: [],
    wins: 0,
    losses: 0,
    npc: { difficulty: def.difficulty, level: def.level },
  };
}
