import { describe, expect, it } from "vitest";
import {
  CHEST_EXP,
  DAILY_FULL_MINUTES,
  EXP_PER_MINUTE,
  SPIRIT_CONSOLATION_EXP,
  SPIRIT_EXP,
  applyBeat,
  bangkokDay,
  expForLevel,
  levelInfo,
  maybeSpawn,
  newHubPlayer,
  newHubRoom,
  payEvent,
  roomMultiplier,
  tapEvent,
  type HubRoom,
} from "@/lib/hub/rules";

const T0 = Date.UTC(2026, 9, 9, 5, 0, 0); // 12:00 in Bangkok
const MIN = 60_000;
const fixed = (v: number) => () => v;

describe("levels", () => {
  it("starts at level 1 and grows faster than linearly", () => {
    expect(levelInfo(0)).toMatchObject({ level: 1, into: 0, need: 150, title: "ศิษย์ฝึกหัด" });
    expect(levelInfo(expForLevel(5))).toMatchObject({ level: 5, into: 0, title: "ผู้ฝึกตน" });
    expect(expForLevel(10) - expForLevel(9)).toBeGreaterThan(expForLevel(3) - expForLevel(2));
    expect(levelInfo(expForLevel(60)).title).toBe("เทพ");
  });
});

describe("presence EXP", () => {
  it("credits nothing on the first beat, then the real time between beats", () => {
    const first = applyBeat(newHubPlayer(T0), { roomId: "r1", now: T0, multiplier: 1, idle: false });
    expect(first.gained).toBe(0);
    const second = applyBeat(first.player, { roomId: "r1", now: T0 + MIN, multiplier: 1, idle: false });
    expect(second.gained).toBe(EXP_PER_MINUTE);
  });

  it("can't bank time: a late beat counts at most 75 seconds, a lapsed one nothing", () => {
    const p = applyBeat(newHubPlayer(T0), { roomId: "r1", now: T0, multiplier: 1, idle: false }).player;
    expect(applyBeat(p, { roomId: "r1", now: T0 + 2 * MIN, multiplier: 1, idle: false }).gained).toBe(13);
    expect(applyBeat(p, { roomId: "r1", now: T0 + 30 * MIN, multiplier: 1, idle: false }).gained).toBe(0);
  });

  it("switching rooms restarts the clock", () => {
    const p = applyBeat(newHubPlayer(T0), { roomId: "r1", now: T0, multiplier: 1, idle: false }).player;
    expect(applyBeat(p, { roomId: "r2", now: T0 + MIN, multiplier: 1, idle: false }).gained).toBe(0);
  });

  it("talking rooms grind faster, dozing players slower", () => {
    const p = applyBeat(newHubPlayer(T0), { roomId: "r1", now: T0, multiplier: 1, idle: false }).player;
    expect(applyBeat(p, { roomId: "r1", now: T0 + MIN, multiplier: 1.5, idle: false }).gained).toBe(15);
    expect(applyBeat(p, { roomId: "r1", now: T0 + MIN, multiplier: 1, idle: true }).gained).toBe(5);
  });

  it("halves presence EXP after the daily full-rate minutes, and resets at Bangkok midnight", () => {
    const tired = { ...newHubPlayer(T0), dayMinutes: DAILY_FULL_MINUTES, lastBeat: T0, lastRoom: "r1" };
    const slow = applyBeat(tired, { roomId: "r1", now: T0 + MIN, multiplier: 1, idle: false });
    expect(slow.gained).toBe(5);
    expect(slow.capped).toBe(true);

    const midnight = Date.UTC(2026, 9, 9, 17, 0, 0); // 00:00 Bangkok on the 10th
    expect(bangkokDay(midnight)).toBe("2026-10-10");
    const late = { ...tired, lastBeat: midnight - 30_000 };
    expect(applyBeat(late, { roomId: "r1", now: midnight + 30_000, multiplier: 1, idle: false }).gained).toBe(10);
  });
});

describe("room multiplier", () => {
  it("rewards open mics and lively chat, capped at x1.5", () => {
    expect(roomMultiplier(0, 0)).toBe(1);
    expect(roomMultiplier(1, 1)).toBe(1);
    expect(roomMultiplier(2, 0)).toBe(1.25);
    expect(roomMultiplier(3, 0)).toBe(1.5);
    expect(roomMultiplier(5, 4)).toBe(1.5);
    expect(roomMultiplier(0, 2)).toBe(1.25);
  });
});

describe("events", () => {
  const ids = () => "ev1";
  const due = (): HubRoom => ({ ...newHubRoom(T0, fixed(0)), nextEventAt: T0 });

  it("spawns only when due, and not over a running event", () => {
    expect(maybeSpawn(newHubRoom(T0, fixed(0)), T0, fixed(0), 3, ids)).toBeNull();
    const room = maybeSpawn(due(), T0, fixed(0.1), 3, ids)!;
    expect(room.event?.kind).toBe("chest");
    expect(room.nextEventAt).toBeGreaterThanOrEqual(T0 + 10 * MIN);
    expect(maybeSpawn({ ...room, nextEventAt: T0 }, T0 + 1000, fixed(0), 3, ids)).toBeNull();
  });

  it("chest: one tap each inside the window, paid once", () => {
    let room = maybeSpawn(due(), T0, fixed(0.1), 2, ids)!;
    const tap = tapEvent(room, "ev1", "p1", 5, T0 + 2000);
    expect(tap.ok && tap.accepted).toBe(1);
    room = tap.ok ? tap.room : room;
    expect(tapEvent(room, "ev1", "p1", 1, T0 + 3000)).toEqual({ ok: false, reason: "taken" });
    expect(tapEvent(room, "ev1", "p2", 1, T0 + 11_000)).toEqual({ ok: false, reason: "closed" });

    const paid = payEvent(newHubPlayer(T0), room.event!, "p1", T0 + 2000)!;
    expect(paid.exp).toBe(CHEST_EXP);
    expect(payEvent(paid, room.event!, "p1", T0 + 2000)).toBeNull();
    expect(payEvent(newHubPlayer(T0), room.event!, "p2", T0 + 2000)).toBeNull();
  });

  it("spirit: needs the room's combined taps, ignores impossible tap counts", () => {
    let room = maybeSpawn(due(), T0, fixed(0.9), 2, ids)!; // 2 players → 50 hp
    expect(room.event).toMatchObject({ kind: "spirit", hp: 50 });

    const cheat = tapEvent(room, "ev1", "p1", 500, T0 + 1000);
    expect(cheat.ok && cheat.accepted).toBe(24); // 12/s × (1 s + 1 s grace)
    room = cheat.ok ? cheat.room : room;
    const help = tapEvent(room, "ev1", "p2", 30, T0 + 3000);
    room = help.ok ? help.room : room;
    expect(room.event?.defeatedAt).toBe(T0 + 3000);

    expect(payEvent(newHubPlayer(T0), room.event!, "p2", T0 + 3000)!.exp).toBe(SPIRIT_EXP);
    expect(payEvent(newHubPlayer(T0), room.event!, "p2", T0 + 3000)!.spirits).toBe(1);
  });

  it("spirit that escapes pays a small consolation after the window, nothing before", () => {
    let room = maybeSpawn(due(), T0, fixed(0.9), 4, ids)!;
    const t = tapEvent(room, "ev1", "p1", 10, T0 + 2000);
    room = t.ok ? t.room : room;
    expect(payEvent(newHubPlayer(T0), room.event!, "p1", T0 + 5000)).toBeNull();
    expect(payEvent(newHubPlayer(T0), room.event!, "p1", T0 + 16_000)!.exp).toBe(SPIRIT_CONSOLATION_EXP);
  });
});
