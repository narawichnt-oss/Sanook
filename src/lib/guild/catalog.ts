// Everything a guild can earn, buy, or wear. Pure data + tiny helpers, shared
// by the API and the UI.

import { ROOM_COLORS, type RoomColor } from "@/lib/room-meta";

export const GUILD_EMBLEMS = ["⚡", "🐉", "🌊", "🔥", "🌸", "🍀", "🦁", "🐳", "🌙", "⭐", "🍉", "🎸"] as const;
export const GUILD_COLORS = ROOM_COLORS;
export type GuildColor = RoomColor;

export const MAX_GUILD_NAME = 24;
export const MAX_MOTTO = 60;

// ---- Levels -----------------------------------------------------------------

/** Total XP needed to reach each level (index 0 = level 1). */
export const LEVEL_XP = [0, 200, 600, 1200, 2000, 3200, 5000] as const;
export const MAX_LEVEL = LEVEL_XP.length;

export function levelOf(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) level = i + 1;
  return level;
}

/** How far into the current level a guild is, for the XP bar. */
export function levelProgress(xp: number): { level: number; into: number; need: number } {
  const level = levelOf(xp);
  if (level >= MAX_LEVEL) return { level, into: 1, need: 1 };
  const floor = LEVEL_XP[level - 1];
  return { level, into: xp - floor, need: LEVEL_XP[level] - floor };
}

export function memberCap(level: number): number {
  return Math.min(40, 10 + level * 5);
}

// ---- Island ----------------------------------------------------------------

export const ISLAND_SIZE = 9;

export const ZONES = [
  { id: "plaza", name: "ลานกลาง", level: 1 },
  { id: "garden", name: "สวนดอกไม้", level: 2 },
  { id: "fun", name: "สวนสนุก", level: 3 },
  { id: "gacha", name: "ลานกาชา", level: 4 },
  { id: "statue", name: "เนินรูปปั้น", level: 5 },
] as const;

export type ZoneId = (typeof ZONES)[number]["id"];

/** Which zone a tile belongs to. The island is a 9×9 diamond seen from above. */
export function zoneAt(c: number, r: number): ZoneId {
  const d = c + r;
  const e = c - r;
  if (d <= 4) return "statue"; // top of the screen
  if (e <= -3) return "garden"; // left
  if (e >= 3) return "fun"; // right
  if (d >= 12) return "gacha"; // bottom
  return "plaza";
}

export function zoneUnlocked(zone: ZoneId, level: number): boolean {
  return level >= ZONES.find((z) => z.id === zone)!.level;
}

/** The clubhouse that holds the Trophy Room. Always there, never moves. */
export const HALL_TILE = { c: 4, r: 4 } as const;

export const DECOR_SLOTS = [
  { id: "p1", c: 5, r: 3 },
  { id: "p2", c: 3, r: 5 },
  { id: "p3", c: 5, r: 5 },
  { id: "g1", c: 1, r: 5 },
  { id: "g2", c: 2, r: 7 },
  { id: "g3", c: 0, r: 6 },
  { id: "f1", c: 5, r: 1 },
  { id: "f2", c: 7, r: 2 },
  { id: "f3", c: 6, r: 0 },
  { id: "c1", c: 6, r: 7 },
  { id: "c2", c: 8, r: 6 },
  { id: "c3", c: 7, r: 8 },
  { id: "s1", c: 2, r: 2 },
  { id: "s2", c: 0, r: 3 },
  { id: "s3", c: 3, r: 0 },
] as const;

export type SlotId = (typeof DECOR_SLOTS)[number]["id"];

export function slotZone(slot: SlotId): ZoneId {
  const s = DECOR_SLOTS.find((d) => d.id === slot)!;
  return zoneAt(s.c, s.r);
}

export type DecorItem = { id: string; emoji: string; name: string; cost: number; minLevel: number };

export const DECOR: readonly DecorItem[] = [
  { id: "tulips", emoji: "🌷", name: "แปลงทิวลิป", cost: 40, minLevel: 1 },
  { id: "palm", emoji: "🌴", name: "ต้นมะพร้าว", cost: 60, minLevel: 1 },
  { id: "tent", emoji: "⛺", name: "เต็นท์แคมป์", cost: 80, minLevel: 1 },
  { id: "streamer", emoji: "🎏", name: "ธงปลาคาร์ป", cost: 50, minLevel: 2 },
  { id: "fountain", emoji: "⛲", name: "น้ำพุ", cost: 150, minLevel: 2 },
  { id: "slide", emoji: "🛝", name: "สไลเดอร์", cost: 200, minLevel: 3 },
  { id: "carousel", emoji: "🎠", name: "ม้าหมุน", cost: 260, minLevel: 3 },
  { id: "gacha", emoji: "🎰", name: "ตู้สุ่มกาชา", cost: 300, minLevel: 4 },
  { id: "ferris", emoji: "🎡", name: "ชิงช้าสวรรค์", cost: 400, minLevel: 4 },
  { id: "statue", emoji: "🗿", name: "รูปปั้นหัวหน้ากิลด์", cost: 500, minLevel: 5 },
  { id: "castle", emoji: "🏰", name: "ปราสาท", cost: 800, minLevel: 6 },
];

export function decorById(id: string): DecorItem | undefined {
  return DECOR.find((d) => d.id === id);
}

// ---- Avatar fashion (war booty) ---------------------------------------------

export type Rarity = "common" | "rare" | "epic";
export type LookSlot = "hat" | "hand";
export type Look = Partial<Record<LookSlot, string>>;
export type Cosmetic = { id: string; emoji: string; name: string; slot: LookSlot; rarity: Rarity };

export const COSMETICS: readonly Cosmetic[] = [
  { id: "tophat", emoji: "🎩", name: "หมวกนักมายากล", slot: "hat", rarity: "common" },
  { id: "cap", emoji: "🧢", name: "หมวกแก๊ป", slot: "hat", rarity: "common" },
  { id: "bow", emoji: "🎀", name: "โบว์สีชมพู", slot: "hat", rarity: "common" },
  { id: "sunhat", emoji: "👒", name: "หมวกปีกกว้าง", slot: "hat", rarity: "common" },
  { id: "knight", emoji: "🪖", name: "หมวกอัศวิน", slot: "hat", rarity: "rare" },
  { id: "grad", emoji: "🎓", name: "หมวกบัณฑิต", slot: "hat", rarity: "rare" },
  { id: "crown", emoji: "👑", name: "มงกุฎราชา", slot: "hat", rarity: "epic" },
  { id: "flower", emoji: "🌸", name: "ช่อดอกไม้", slot: "hand", rarity: "common" },
  { id: "balloon", emoji: "🎈", name: "ลูกโป่ง", slot: "hand", rarity: "common" },
  { id: "lolly", emoji: "🍭", name: "อมยิ้มยักษ์", slot: "hand", rarity: "common" },
  { id: "shield", emoji: "🛡️", name: "โล่ผู้พิทักษ์", slot: "hand", rarity: "rare" },
  { id: "lamp", emoji: "🏮", name: "โคมไฟวิเศษ", slot: "hand", rarity: "rare" },
  { id: "wand", emoji: "🪄", name: "คทาเวทมนตร์", slot: "hand", rarity: "epic" },
];

export const RARITY_LABEL: Record<Rarity, string> = { common: "ธรรมดา", rare: "หายาก", epic: "ตำนาน" };

export function cosmeticById(id: string): Cosmetic | undefined {
  return COSMETICS.find((c) => c.id === id);
}

const RARITY_WEIGHT: Record<Rarity, number> = { common: 70, rare: 25, epic: 5 };

/** Rolls one cosmetic, trying once more if the first roll is something they already own. */
export function rollBooty(owned: readonly string[], rand: () => number): string {
  const roll = () => {
    const total = COSMETICS.reduce((s, c) => s + RARITY_WEIGHT[c.rarity], 0);
    let n = rand() * total;
    for (const c of COSMETICS) {
      n -= RARITY_WEIGHT[c.rarity];
      if (n < 0) return c.id;
    }
    return COSMETICS[0].id;
  };
  const first = roll();
  return owned.includes(first) ? roll() : first;
}

// ---- War rewards -------------------------------------------------------------

/** Nobody loses anything in a war; the winner simply gets more. */
export const WAR_REWARDS = {
  win: { xp: 300, coins: 200 },
  lose: { xp: 120, coins: 80 },
} as const;

/** Small trickle for every finished round, so playing always moves the guild forward. */
export const ROUND_REWARD = { xp: 5, coins: 2 } as const;

/** Chance a participant on the losing side still gets a booty drop. */
export const LOSER_BOOTY_CHANCE = 0.4;
