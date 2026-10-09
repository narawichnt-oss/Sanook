import { describe, expect, it } from "vitest";
import { COSMETICS, levelOf, levelProgress, rollBooty, zoneAt } from "@/lib/guild/catalog";
import { buyDecor, changeMember, newGuild, parseGuildInput, placeDecor, removeMember, storeDecor } from "@/lib/guild/guild";
import { GAMES, GAME_IDS, MEMORY_LENGTH } from "@/lib/guild/games";
import { seeded } from "@/lib/guild/rng";
import { answerKey, buildRound, scoreRound } from "@/lib/guild/rounds";
import { playerToken, readPlayerToken, readRoundToken, roundToken } from "@/lib/guild/tokens";
import type { Guild, Player } from "@/lib/guild/types";
import {
  ATTEMPTS_PER_STAGE,
  beginAttempt,
  createWar,
  guardScores,
  pickStage,
  recordScore,
  settleWar,
  stageBoard,
  warTotals,
} from "@/lib/guild/war";

const player = (id: string, name = id): Player => ({
  id,
  name,
  avatar: "🐼",
  guildId: null,
  look: {},
  items: [],
  fresh: [],
  claimed: [],
  createdAt: 0,
});

function guild(id: string, xp = 0): Guild {
  const g = newGuild(id, { name: `กิลด์ ${id}`, emblem: "⚡", color: "sky", motto: "" }, player(`${id}-lead`), 0);
  g.xp = xp;
  return g;
}

const who = (id: string) => ({ id, name: id, avatar: "🐸", look: {} });

describe("levels", () => {
  it("maps XP to levels and progress", () => {
    expect(levelOf(0)).toBe(1);
    expect(levelOf(199)).toBe(1);
    expect(levelOf(200)).toBe(2);
    expect(levelOf(99999)).toBe(7);
    expect(levelProgress(300)).toEqual({ level: 2, into: 100, need: 400 });
  });

  it("splits the island into five zones with the plaza in the middle", () => {
    expect(zoneAt(4, 4)).toBe("plaza");
    expect(zoneAt(1, 1)).toBe("statue");
    expect(zoneAt(0, 6)).toBe("garden");
    expect(zoneAt(6, 0)).toBe("fun");
    expect(zoneAt(7, 7)).toBe("gacha");
  });
});

describe("guild membership", () => {
  it("validates names and falls back on unknown emblem/color", () => {
    expect(parseGuildInput({ name: "  " }).ok).toBe(false);
    expect(parseGuildInput({ name: "ก".repeat(25) }).ok).toBe(false);
    const r = parseGuildInput({ name: " แมว  เหมียว ", emblem: "💣", color: "black" });
    expect(r.ok && r.value).toEqual({ name: "แมว เหมียว", emblem: "⚡", color: "coral", motto: "" });
  });

  it("passes leadership to the most senior officer when the leader leaves", () => {
    const g = guild("a");
    g.members.push({ ...g.members[0], id: "m1", role: "member", joinedAt: 1 });
    g.members.push({ ...g.members[0], id: "o1", role: "officer", joinedAt: 5 });
    removeMember(g, "a-lead");
    expect(g.members.find((m) => m.id === "o1")?.role).toBe("leader");
    removeMember(g, "o1");
    removeMember(g, "m1");
    expect(g.disbanded).toBe(true);
  });

  it("only lets the leader promote; officers may kick plain members", () => {
    const g = guild("a");
    g.members.push({ ...g.members[0], id: "o1", role: "officer" }, { ...g.members[0], id: "m1", role: "member" });
    expect(changeMember(g, "o1", "m1", "promote").ok).toBe(false);
    expect(changeMember(g, "o1", "m1", "kick").ok).toBe(true);
    expect(changeMember(g, "a-lead", "o1", "transfer").ok).toBe(true);
    expect(g.members.find((m) => m.id === "o1")?.role).toBe("leader");
    expect(g.members.find((m) => m.id === "a-lead")?.role).toBe("officer");
  });
});

describe("decorating", () => {
  it("spends coins, respects level and zone locks, and swaps placed items", () => {
    const g = guild("a");
    g.coins = 1000;
    expect(buyDecor(g, "fountain").ok).toBe(false); // needs level 2
    expect(buyDecor(g, "palm", "g1").ok).toBe(false); // garden locked at level 1
    expect(buyDecor(g, "palm", "p1").ok).toBe(true);
    expect(g.decor.p1).toBe("palm");
    expect(g.storage).toEqual(["tulips"]); // the starter tulips moved to storage
    expect(g.coins).toBe(940);
    expect(placeDecor(g, "tulips", "p2").ok).toBe(true);
    expect(storeDecor(g, "p1").ok).toBe(true);
    expect(g.storage).toEqual(["palm"]);
    g.coins = 10;
    expect(buyDecor(g, "tent").ok).toBe(false);
  });
});

describe("rounds", () => {
  it("rebuilds the same round from the same seed", () => {
    for (const game of GAME_IDS) expect(buildRound(game, 42)).toEqual(buildRound(game, 42));
    expect(buildRound("trivia", 1)).not.toEqual(buildRound("trivia", 2));
  });

  it("scores a perfect quiz near the max, slow and wrong answers lower", () => {
    const key = answerKey("trivia", 7);
    const fast = scoreRound("trivia", 7, { game: "trivia", picks: key }, 5000).score;
    const slow = scoreRound("trivia", 7, { game: "trivia", picks: key }, 74000).score;
    const half = scoreRound("trivia", 7, { game: "trivia", picks: key.map((k, i) => (i % 2 ? k : (k + 1) % 4)) }, 5000).score;
    expect(fast).toBeGreaterThan(950);
    expect(slow).toBeGreaterThanOrEqual(800);
    expect(slow).toBeLessThan(fast);
    expect(half).toBeLessThan(slow);
    expect(scoreRound("trivia", 7, { game: "emoji", picks: key }, 5000).score).toBe(0);
  });

  it("math questions are well-formed with one right answer among four", () => {
    const { view, key } = buildRound("math", 99);
    if (view.game !== "math") throw new Error("wrong game");
    view.questions.forEach((q, i) => {
      expect(new Set(q.choices).size).toBe(4);
      const [a, sign, b] = q.prompt.replace(" = ?", "").split(" ");
      const answer = sign === "+" ? +a + +b : sign === "−" ? +a - +b : +a * +b;
      expect(Number(q.choices[key[i]])).toBe(answer);
    });
  });

  it("memory: caps impossible speed", () => {
    expect(scoreRound("memory", 1, { game: "memory", level: 10 }, 60_000).score).toBe(500);
    expect(scoreRound("memory", 1, { game: "memory", level: MEMORY_LENGTH + 5 }, 999_999).score).toBe(1000);
    // 20 levels can't be done in 2 seconds
    expect(scoreRound("memory", 1, { game: "memory", level: 20 }, 2000).score).toBeLessThan(200);
  });

  it("pairs: replays the flips to count moves", () => {
    const { view } = buildRound("pairs", 5);
    if (view.game !== "pairs") throw new Error("wrong game");
    const flips: number[] = [];
    const seen = new Set<number>();
    view.cards.forEach((face, i) => {
      if (seen.has(i)) return;
      const j = view.cards.findIndex((f, k) => k > i && f === face);
      seen.add(i).add(j);
      flips.push(i, j);
    });
    const perfect = scoreRound("pairs", 5, { game: "pairs", flips }, 15_000);
    expect(perfect.score).toBe(1000);
    expect(scoreRound("pairs", 5, { game: "pairs", flips: [0, 0, 1] }, 15_000).score).toBeLessThan(150);
    expect(scoreRound("pairs", 5, { game: "pairs", flips }, 200).score).toBe(0); // inhumanly fast
  });
});

describe("tokens", () => {
  it("round-trips and rejects tampering", () => {
    const t = playerToken("abcdefghijkl", "s");
    expect(readPlayerToken(t, "s")).toBe("abcdefghijkl");
    expect(readPlayerToken(t, "other")).toBeNull();
    expect(readPlayerToken(t.replace("abc", "xyz"), "s")).toBeNull();
    const ticket = { war: "w", stage: 2, game: "math" as const, player: "p", seed: 9, startedAt: 1 };
    const rt = roundToken(ticket, "s");
    expect(readRoundToken(rt, "s")).toEqual(ticket);
    expect(readRoundToken(rt + "x", "s")).toBeNull();
  });
});

describe("war", () => {
  const make = (defXp = 0) => createWar({ id: "w1", seed: 123, attacker: guild("a"), defender: guild("d", defXp), now: 0, hours: 24 });

  it("puts all five games on the map once, defender leads at the start", () => {
    const war = make();
    expect(new Set(war.stages.map((s) => s.game))).toEqual(new Set(GAME_IDS));
    expect(warTotals(war).captured).toEqual([]);
    war.stages.forEach((_, i) => expect(stageBoard(war, i).leader).toBe("defender"));
  });

  it("guards are steady and scale with the defender's level", () => {
    const easy = make(0);
    const hard = make(5000);
    expect(guardScores(easy, 0)).toEqual(guardScores(easy, 0));
    const sum = (n: number[]) => n.reduce((a, b) => a + b, 0);
    expect(sum(guardScores(hard, 0))).toBeGreaterThan(sum(guardScores(easy, 0)));
    expect(Math.max(...guardScores(hard, 0))).toBeLessThanOrEqual(1000);
  });

  it("counts only the best attempt and only the top three per side", () => {
    const war = make();
    for (const id of ["p1", "p2", "p3", "p4"]) {
      expect(beginAttempt(war, 0, "attacker", who(id), 1, 10).ok).toBe(true);
      recordScore(war, 0, "attacker", who(id), 900, 10);
    }
    beginAttempt(war, 0, "attacker", who("p1"), 2, 11);
    recordScore(war, 0, "attacker", who("p1"), 100, 11); // worse — ignored
    const board = stageBoard(war, 0);
    expect(board.rows.attacker).toHaveLength(3);
    expect(board.scores.attacker).toBe(2700);
    expect(board.leader).toBe("attacker");
    expect(war.log.some((l) => l.icon === "🔥")).toBe(true);
  });

  it("limits attempts per stage and stops at the bell", () => {
    const war = make();
    for (let k = 0; k < ATTEMPTS_PER_STAGE; k++) expect(beginAttempt(war, 1, "attacker", who("p"), k, 5).ok).toBe(true);
    expect(beginAttempt(war, 1, "attacker", who("p"), 9, 5).ok).toBe(false);
    expect(beginAttempt(war, 2, "attacker", who("p"), 9, war.endsAt).ok).toBe(false);
  });

  it("defenders playing push guards out of the top slots", () => {
    const war = make();
    const before = stageBoard(war, 0).scores.defender;
    beginAttempt(war, 0, "defender", who("d1"), 1, 5);
    recordScore(war, 0, "defender", who("d1"), 1000, 5);
    const after = stageBoard(war, 0);
    expect(after.scores.defender).toBeGreaterThan(before);
    expect(after.rows.defender.filter((r) => r.kind === "guard")).toHaveLength(2);
  });

  it("attacker needs three stages; nobody loses anything, the winner just gets more", () => {
    const war = make();
    for (const i of [0, 1, 2]) {
      for (const id of ["p1", "p2", "p3"]) {
        beginAttempt(war, i, "attacker", who(id), 1, 5);
        recordScore(war, i, "attacker", who(id), 1000, 5);
      }
    }
    const done = settleWar(war);
    expect(done.status).toBe("done");
    expect(done.result?.winner).toBe("attacker");
    expect(done.result?.captured).toEqual([0, 1, 2]);
    expect(done.result?.rewards.defender.xp).toBeGreaterThan(0);
    expect(done.result!.rewards.attacker.xp).toBeGreaterThan(done.result!.rewards.defender.xp);
    expect(done.result?.mvp?.points).toBe(3000);
    expect(war.status).toBe("active"); // input untouched

    const held = settleWar(make());
    expect(held.result?.winner).toBe("defender");
  });

  it("Play Now prefers stages we're losing", () => {
    const war = make();
    for (const id of ["p1", "p2", "p3"]) {
      beginAttempt(war, 0, "attacker", who(id), 1, 5);
      recordScore(war, 0, "attacker", who(id), 1000, 5);
    }
    const rand = seeded(1);
    for (let k = 0; k < 20; k++) expect(pickStage(war, "attacker", "p9", rand)).not.toBe(0);
  });
});

describe("booty", () => {
  it("rolls a real cosmetic and rerolls once on a duplicate", () => {
    const ids = COSMETICS.map((c) => c.id);
    const rand = seeded(3);
    for (let k = 0; k < 50; k++) expect(ids).toContain(rollBooty([], rand));
    expect(GAMES.emoji.limitSec).toBeGreaterThan(0);
  });
});
