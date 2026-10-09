// The rules of the Social Grinding Hub: being in a voice room slowly earns EXP,
// talking together earns it faster, and surprise events reward people who are
// actually watching. Pure functions only — the server owns every number here,
// clients just display what it returns.

// ---- Levels -----------------------------------------------------------------

export const MAX_LEVEL = 99;

/** Total EXP needed to reach `level` (level 1 starts at 0). */
export function expForLevel(level: number): number {
  const n = Math.max(0, Math.min(MAX_LEVEL, level) - 1);
  return 50 * n * n + 100 * n;
}

const TITLES: [number, string][] = [
  [1, "ศิษย์ฝึกหัด"],
  [5, "ผู้ฝึกตน"],
  [12, "จอมยุทธ์"],
  [25, "ยอดฝีมือ"],
  [40, "เซียน"],
  [60, "เทพ"],
];

export function titleFor(level: number): string {
  let title = TITLES[0][1];
  for (const [min, name] of TITLES) if (level >= min) title = name;
  return title;
}

export type LevelInfo = { level: number; into: number; need: number; title: string };

export function levelInfo(exp: number): LevelInfo {
  let level = 1;
  while (level < MAX_LEVEL && exp >= expForLevel(level + 1)) level++;
  const floor = expForLevel(level);
  const need = level >= MAX_LEVEL ? 1 : expForLevel(level + 1) - floor;
  return { level, into: level >= MAX_LEVEL ? 1 : exp - floor, need, title: titleFor(level) };
}

// ---- Presence EXP --------------------------------------------------------------

export const BEAT_MS = 60_000;
/** A beat counts at most this much time, so a late beat can't bank hours. */
export const MAX_CREDIT_MS = 75_000;
/** Longer than this since the last beat means the session lapsed; start fresh. */
export const LAPSE_MS = 3 * 60_000;
export const EXP_PER_MINUTE = 10;
/** Full-rate minutes per day; after that presence EXP is halved. */
export const DAILY_FULL_MINUTES = 120;
/** No touch for this long and we treat the player as dozing (half rate). */
export const IDLE_AFTER_MS = 10 * 60_000;

export type HubPlayer = {
  exp: number;
  /** Bangkok calendar day the daily counter belongs to, e.g. "2026-10-09". */
  day: string;
  /** Full-rate minutes already used today. */
  dayMinutes: number;
  lastBeat: number | null;
  lastRoom: string | null;
  /** Event ids already rewarded, newest last (kept short). */
  rewarded: string[];
  chests: number;
  spirits: number;
};

export function newHubPlayer(now: number): HubPlayer {
  return { exp: 0, day: bangkokDay(now), dayMinutes: 0, lastBeat: null, lastRoom: null, rewarded: [], chests: 0, spirits: 0 };
}

export function bangkokDay(now: number): string {
  return new Date(now + 7 * 3600_000).toISOString().slice(0, 10);
}

/**
 * Voice and chat make the whole room grind faster. Talkers are people with an
 * open mic (seen by the server via LiveKit); chatters sent a message recently.
 */
export function roomMultiplier(talkers: number, chatters: number): number {
  let bonus = 0;
  if (talkers >= 2) bonus += 0.25;
  if (talkers >= 3) bonus += 0.25;
  if (chatters >= 2) bonus += 0.25;
  return 1 + Math.min(0.5, bonus);
}

export type BeatInput = { roomId: string; now: number; multiplier: number; idle: boolean };
export type BeatResult = { player: HubPlayer; gained: number; capped: boolean };

/** Credits the time since the previous beat in the same room. */
export function applyBeat(previous: HubPlayer, input: BeatInput): BeatResult {
  const { roomId, now, multiplier, idle } = input;
  const today = bangkokDay(now);
  const player: HubPlayer = { ...previous, ...(previous.day !== today ? { day: today, dayMinutes: 0 } : {}) };

  const continuing =
    player.lastBeat !== null && player.lastRoom === roomId && now > player.lastBeat && now - player.lastBeat <= LAPSE_MS;
  const minutes = continuing ? Math.min(now - player.lastBeat!, MAX_CREDIT_MS) / 60_000 : 0;

  const full = Math.min(minutes, Math.max(0, DAILY_FULL_MINUTES - player.dayMinutes));
  const half = minutes - full;
  const raw = (full + half * 0.5) * EXP_PER_MINUTE * multiplier * (idle ? 0.5 : 1);
  const gained = Math.round(raw);

  return {
    player: { ...player, exp: player.exp + gained, dayMinutes: player.dayMinutes + full, lastBeat: now, lastRoom: roomId },
    gained,
    capped: player.dayMinutes + full >= DAILY_FULL_MINUTES,
  };
}

// ---- Surprise events (QTE) ---------------------------------------------------------

export type EventKind = "chest" | "spirit";

export type HubEvent = {
  id: string;
  kind: EventKind;
  spawnAt: number;
  expiresAt: number;
  /** Spirit only: taps the room needs to land together. */
  hp: number;
  /** Taps landed per player. */
  taps: Record<string, number>;
  defeatedAt: number | null;
};

export type HubRoom = {
  nextEventAt: number;
  event: HubEvent | null;
  /** Player id → last time they chatted, for the chat boost. */
  chat: Record<string, number>;
};

export const CHEST_MS = 10_000;
export const SPIRIT_MS = 15_000;
export const CHEST_EXP = 150;
export const SPIRIT_EXP = 250;
export const SPIRIT_CONSOLATION_EXP = 30;
export const SPIRIT_HP_PER_PLAYER = 25;
/** Nobody taps faster than this; extra taps in a batch are ignored. */
export const MAX_TAPS_PER_SECOND = 12;
export const CHAT_WINDOW_MS = 3 * 60_000;

export type Rand = () => number;

/** Default gap between events: 10–15 minutes. */
export const EVENT_GAP: [number, number] = [10 * 60_000, 15 * 60_000];

export function nextEventTime(now: number, rand: Rand, gap: [number, number] = EVENT_GAP): number {
  return now + gap[0] + Math.floor(rand() * (gap[1] - gap[0]));
}

export function newHubRoom(now: number, rand: Rand, gap?: [number, number]): HubRoom {
  return { nextEventAt: nextEventTime(now, rand, gap), event: null, chat: {} };
}

/** True once an event's window has closed (or the spirit fell). */
export function isOver(event: HubEvent, now: number): boolean {
  return now >= event.expiresAt || event.defeatedAt !== null;
}

/** Spawns the next event if it's due and the last one is over. Returns null if nothing to do. */
export function maybeSpawn(
  room: HubRoom,
  now: number,
  rand: Rand,
  players: number,
  newId: () => string,
  gap?: [number, number],
): HubRoom | null {
  if (now < room.nextEventAt || (room.event && !isOver(room.event, now))) return null;
  const kind: EventKind = rand() < 0.55 ? "chest" : "spirit";
  const event: HubEvent = {
    id: newId(),
    kind,
    spawnAt: now,
    expiresAt: now + (kind === "chest" ? CHEST_MS : SPIRIT_MS),
    hp: kind === "spirit" ? SPIRIT_HP_PER_PLAYER * Math.max(1, players) : 1,
    taps: {},
    defeatedAt: null,
  };
  return { ...room, event, nextEventAt: nextEventTime(now, rand, gap) };
}

export type TapResult =
  | { ok: true; room: HubRoom; accepted: number }
  | { ok: false; reason: "gone" | "closed" | "taken" };

/**
 * Records taps on the current event. `sinceSpawn` limits how many taps can be
 * real: a player can't have tapped more than MAX_TAPS_PER_SECOND × elapsed.
 */
export function tapEvent(room: HubRoom, eventId: string, playerId: string, taps: number, now: number): TapResult {
  const event = room.event;
  if (!event || event.id !== eventId) return { ok: false, reason: "gone" };
  if (now < event.spawnAt || isOver(event, now)) return { ok: false, reason: "closed" };

  const already = event.taps[playerId] ?? 0;
  if (event.kind === "chest") {
    if (already > 0) return { ok: false, reason: "taken" };
    return { ok: true, accepted: 1, room: { ...room, event: { ...event, taps: { ...event.taps, [playerId]: 1 } } } };
  }

  const ceiling = Math.ceil(((now - event.spawnAt) / 1000 + 1) * MAX_TAPS_PER_SECOND);
  const accepted = Math.max(0, Math.min(Math.floor(taps), ceiling - already));
  const nextTaps = { ...event.taps, [playerId]: already + accepted };
  const total = Object.values(nextTaps).reduce((a, b) => a + b, 0);
  return {
    ok: true,
    accepted,
    room: { ...room, event: { ...event, taps: nextTaps, defeatedAt: total >= event.hp ? now : null } },
  };
}

export function eventDamage(event: HubEvent): number {
  return Object.values(event.taps).reduce((a, b) => a + b, 0);
}

/** What this player is owed for an event, once it's decided. 0 = nothing (yet). */
export function rewardFor(event: HubEvent, playerId: string, now: number): number {
  const tapped = (event.taps[playerId] ?? 0) > 0;
  if (!tapped) return 0;
  if (event.kind === "chest") return CHEST_EXP;
  if (event.defeatedAt !== null) return SPIRIT_EXP;
  return now >= event.expiresAt ? SPIRIT_CONSOLATION_EXP : 0;
}

const KEEP_REWARDED = 30;

/** Pays out an event once; returns null if already paid or nothing is owed. */
export function payEvent(player: HubPlayer, event: HubEvent, playerId: string, now: number): HubPlayer | null {
  if (player.rewarded.includes(event.id)) return null;
  const exp = rewardFor(event, playerId, now);
  if (!exp) return null;
  return {
    ...player,
    exp: player.exp + exp,
    chests: player.chests + (event.kind === "chest" ? 1 : 0),
    spirits: player.spirits + (event.kind === "spirit" && event.defeatedAt !== null ? 1 : 0),
    rewarded: [...player.rewarded, event.id].slice(-KEEP_REWARDED),
  };
}

export function noteChat(room: HubRoom, playerId: string, now: number): HubRoom {
  const chat = Object.fromEntries(Object.entries(room.chat).filter(([, at]) => now - at < CHAT_WINDOW_MS));
  return { ...room, chat: { ...chat, [playerId]: now } };
}

export function chatters(room: HubRoom, now: number): number {
  return Object.values(room.chat).filter((at) => now - at < CHAT_WINDOW_MS).length;
}
