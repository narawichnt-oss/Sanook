// Rules of the Async Invasion: five stages between two islands, 24 hours to
// play them, best scores count. Pure functions over the War document.

import { WAR_REWARDS, levelOf, type Look } from "./catalog";
import { GAME_IDS, GAMES, MAX_SCORE } from "./games";
import { hashSeed, seeded, shuffle, type Rand } from "./rng";
import type { BoardRow, Guild, LogEntry, SideKey, Stage, StageView, War, WarResult, WarSide, WarView } from "./types";

/** How many of each side's best scores count per stage. Big guilds don't win just by being big. */
export const TOP_SLOTS = 3;
export const ATTEMPTS_PER_STAGE = 3;
/** Attacker needs this many of the five stages to take the island. */
export const STAGES_TO_WIN = 3;
export const LOG_LIMIT = 40;

export const SIDES: readonly SideKey[] = ["attacker", "defender"];

export function other(side: SideKey): SideKey {
  return side === "attacker" ? "defender" : "attacker";
}

export function sideOf(guild: Guild): WarSide {
  const level = guild.npc?.level ?? levelOf(guild.xp);
  return {
    guildId: guild.id,
    name: guild.name,
    emblem: guild.emblem,
    color: guild.color,
    level,
    difficulty: guild.npc?.difficulty ?? Math.min(1.1, 0.8 + 0.04 * level),
    npc: Boolean(guild.npc),
  };
}

export function createWar(opts: {
  id: string;
  seed: number;
  attacker: Guild;
  defender: Guild;
  now: number;
  hours: number;
}): War {
  const order = shuffle(GAME_IDS, seeded(opts.seed));
  return {
    id: opts.id,
    seed: opts.seed,
    mode: "invasion",
    attacker: sideOf(opts.attacker),
    defender: sideOf(opts.defender),
    startedAt: opts.now,
    endsAt: opts.now + opts.hours * 3600_000,
    stages: order.map((game) => ({ game, attacker: {}, defender: {} })),
    log: [
      {
        at: opts.now,
        side: "attacker",
        icon: "📣",
        text: `${opts.attacker.name} ประกาศบุกเกาะ ${opts.defender.name}! มีเวลา ${opts.hours} ชั่วโมง`,
      },
    ],
    status: "active",
  };
}

const GUARD_NAMES = ["ยามหุ่นยนต์ A", "ยามหุ่นยนต์ B", "ยามหุ่นยนต์ C"];

/** The defending island's AI guards. Fixed per war, so the bar doesn't move on its own. */
export function guardScores(war: War, stageIndex: number): number[] {
  const rand = seeded(war.seed ^ hashSeed(`guard:${stageIndex}`));
  const par = GAMES[war.stages[stageIndex].game].par;
  return GUARD_NAMES.map(() => Math.min(MAX_SCORE, Math.round(par * war.defender.difficulty * (0.8 + rand() * 0.3))));
}

function playerRows(entries: Stage[SideKey]): BoardRow[] {
  return Object.entries(entries)
    .filter(([, e]) => e.best > 0)
    .map(([id, e]) => ({ kind: "player" as const, id, name: e.name, avatar: e.avatar, look: e.look, score: e.best }));
}

function top(rows: BoardRow[]): BoardRow[] {
  return [...rows].sort((a, b) => b.score - a.score).slice(0, TOP_SLOTS);
}

export function stageBoard(war: War, i: number) {
  const stage = war.stages[i];
  const guards: BoardRow[] = guardScores(war, i).map((score, k) => ({
    kind: "guard",
    name: GUARD_NAMES[k],
    avatar: "🤖",
    score,
  }));
  const rows = {
    attacker: top(playerRows(stage.attacker)),
    // Defenders who play push the guards out of the top slots.
    defender: top([...playerRows(stage.defender), ...guards]),
  };
  const scores = {
    attacker: rows.attacker.reduce((s, r) => s + r.score, 0),
    defender: rows.defender.reduce((s, r) => s + r.score, 0),
  };
  // A tie means the defender keeps the ground.
  const leader: SideKey = scores.attacker > scores.defender ? "attacker" : "defender";
  return { rows, scores, leader };
}

export function warTotals(war: War) {
  const totals = { attacker: 0, defender: 0 };
  const captured: number[] = [];
  war.stages.forEach((_, i) => {
    const b = stageBoard(war, i);
    totals.attacker += b.scores.attacker;
    totals.defender += b.scores.defender;
    if (b.leader === "attacker") captured.push(i);
  });
  return { totals, captured };
}

export function attemptsLeft(war: War, i: number, side: SideKey, playerId: string): number {
  return ATTEMPTS_PER_STAGE - (war.stages[i]?.[side][playerId]?.attempts ?? 0);
}

type Who = { id: string; name: string; avatar: string; look: Look };

export type Fail = { ok: false; error: string };

/** Spends one attempt. Mutates `war`. */
export function beginAttempt(war: War, i: number, side: SideKey, who: Who, seed: number, now: number): { ok: true } | Fail {
  if (war.status !== "active" || now >= war.endsAt) return { ok: false, error: "สงครามนี้จบไปแล้ว" };
  if (side === "defender" && war.defender.npc) return { ok: false, error: "กิลด์นี้ไม่มีคนป้องกัน" };
  const stage = war.stages[i];
  if (!stage) return { ok: false, error: "ไม่พบด่านนี้" };
  if (attemptsLeft(war, i, side, who.id) <= 0) return { ok: false, error: `เล่นด่านนี้ครบ ${ATTEMPTS_PER_STAGE} ครั้งแล้ว ลองด่านอื่นนะ` };
  const entry = stage[side][who.id];
  stage[side][who.id] = {
    name: who.name,
    avatar: who.avatar,
    look: who.look,
    best: entry?.best ?? 0,
    attempts: (entry?.attempts ?? 0) + 1,
    at: now,
    open: seed,
  };
  return { ok: true };
}

function pushLog(war: War, entry: LogEntry) {
  war.log.push(entry);
  if (war.log.length > LOG_LIMIT) war.log.splice(0, war.log.length - LOG_LIMIT);
}

/**
 * Records a finished round. Only a player's best per stage counts. Mutates `war`
 * and writes a ticker line when something worth cheering happens.
 */
export function recordScore(war: War, i: number, side: SideKey, who: Who, score: number, now: number) {
  const stage = war.stages[i];
  const before = stageBoard(war, i);
  const stageRecord = Math.max(0, ...SIDES.flatMap((s) => Object.values(stage[s]).map((e) => e.best)));
  const entry = stage[side][who.id] ?? { name: who.name, avatar: who.avatar, look: who.look, best: 0, attempts: 1, at: now };
  const previous = entry.best;
  const improved = score > previous;
  stage[side][who.id] = { ...entry, name: who.name, avatar: who.avatar, look: who.look, best: Math.max(previous, score), at: now };

  if (improved && war.status === "active") {
    const after = stageBoard(war, i);
    const stageName = GAMES[stage.game].name;
    const guild = war[side].name;
    if (after.leader === side && before.leader !== side) {
      pushLog(war, {
        at: now,
        side,
        icon: "🔥",
        text:
          side === "attacker"
            ? `${who.name} พลิกเกม! ${guild} ยึด${stageName}ได้แล้ว`
            : `${who.name} ทวงคืน${stageName}ให้ ${guild} สำเร็จ!`,
      });
    } else if (score > stageRecord && stageRecord > 0) {
      pushLog(war, { at: now, side, icon: "⭐", text: `${who.name} เพิ่งทำลายสถิติ${stageName} ด้วย ${score} แต้ม!` });
    } else {
      pushLog(war, { at: now, side, icon: "💪", text: `${who.name} เก็บ ${score} แต้มที่${stageName} ให้ ${guild}` });
    }
  }
  return { improved, previous, gain: improved ? score - previous : 0 };
}

/** Closes the war and decides who won. Returns a new War; the input is untouched. */
export function settleWar(war: War): War {
  const { totals, captured } = warTotals(war);
  const winner: SideKey = captured.length >= STAGES_TO_WIN ? "attacker" : "defender";

  let mvp: WarResult["mvp"] = null;
  for (const side of SIDES) {
    const sums = new Map<string, { name: string; avatar: string; points: number }>();
    for (const stage of war.stages) {
      for (const [id, e] of Object.entries(stage[side])) {
        const prev = sums.get(id);
        sums.set(id, { name: e.name, avatar: e.avatar, points: (prev?.points ?? 0) + e.best });
      }
    }
    for (const s of sums.values()) if (!mvp || s.points > mvp.points) mvp = { side, ...s };
  }

  const result: WarResult = {
    winner,
    captured,
    totals,
    mvp: mvp && mvp.points > 0 ? mvp : null,
    rewards: {
      attacker: winner === "attacker" ? WAR_REWARDS.win : WAR_REWARDS.lose,
      defender: winner === "defender" ? WAR_REWARDS.win : WAR_REWARDS.lose,
    },
  };
  const done: War = { ...war, status: "done", result, log: [...war.log] };
  pushLog(done, {
    at: war.endsAt,
    side: winner,
    icon: "🏆",
    text:
      winner === "attacker"
        ? `${war.attacker.name} ยึดเกาะ ${war.defender.name} ได้ ${captured.length}/5 ด่าน!`
        : `${war.defender.name} ป้องกันเกาะไว้ได้! (${war.attacker.name} ยึดได้ ${captured.length}/5 ด่าน)`,
  });
  return done;
}

/** Everyone who played at least once on a side. */
export function participants(war: War, side: SideKey): string[] {
  const ids = new Set<string>();
  for (const stage of war.stages) for (const id of Object.keys(stage[side])) ids.add(id);
  return [...ids];
}

/**
 * "Play Now": a stage where our side is behind and the player still has tries,
 * else any stage they can still play. `null` when they've used everything.
 */
export function pickStage(war: War, side: SideKey, playerId: string, rand: Rand): number | null {
  const playable = war.stages.map((_, i) => i).filter((i) => attemptsLeft(war, i, side, playerId) > 0);
  const behind = playable.filter((i) => stageBoard(war, i).leader !== side);
  const pool = behind.length ? behind : playable;
  return pool.length ? pool[Math.floor(rand() * pool.length)] : null;
}

export function warView(war: War, viewerGuildId: string | null, viewerId: string | null, now: number): WarView {
  const us: SideKey | null =
    viewerGuildId === war.attacker.guildId ? "attacker" : viewerGuildId === war.defender.guildId ? "defender" : null;
  const stages: StageView[] = war.stages.map((stage, i) => {
    const board = stageBoard(war, i);
    const mine = us && viewerId ? stage[us][viewerId] : undefined;
    return {
      game: stage.game,
      rows: board.rows,
      scores: board.scores,
      leader: board.leader,
      myBest: mine?.best ?? 0,
      attemptsLeft: us && viewerId ? attemptsLeft(war, i, us, viewerId) : 0,
    };
  });
  const { totals, captured } = war.result ?? warTotals(war);
  return {
    id: war.id,
    status: war.status,
    startedAt: war.startedAt,
    endsAt: war.endsAt,
    now,
    us,
    sides: { attacker: war.attacker, defender: war.defender },
    stages,
    totals,
    captured,
    log: war.log,
    result: war.result,
  };
}
