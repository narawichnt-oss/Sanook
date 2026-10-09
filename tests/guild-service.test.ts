import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { cosmeticById } from "@/lib/guild/catalog";
import { MemoryStore, PgStore, mutate, type DocStore } from "@/lib/guild/docstore";
import { answerKey } from "@/lib/guild/rounds";
import { GuildService } from "@/lib/guild/service";
import { readRoundToken } from "@/lib/guild/tokens";

const SECRET = "test-secret";

function setup(store: DocStore = new MemoryStore()) {
  let now = 1_000_000;
  const service = new GuildService(store, SECRET, { warHours: 24, now: () => now });
  return { service, store, tick: (ms: number) => (now += ms), at: () => now };
}

async function newPlayer(service: GuildService, name: string) {
  const { token, me } = await service.register(null, name, "🐼");
  return { token, id: me.player.id };
}

/** Plays a perfect quiz/memory round on whatever stage the server picks. */
async function playPerfect(service: GuildService, playerId: string, warId: string, stage: number | "auto", tick: (ms: number) => void) {
  const round = await service.startRound(playerId, warId, stage);
  const seed = readRoundToken(round.token, SECRET)!.seed;
  tick(30_000);
  const view = round.view;
  const answers =
    view.game === "memory"
      ? { game: "memory" as const, level: 20 }
      : view.game === "pairs"
        ? {
            game: "pairs" as const,
            flips: view.cards.flatMap((f, i) => {
              const j = view.cards.indexOf(f);
              return j === i ? [i, view.cards.indexOf(f, i + 1)] : [];
            }),
          }
        : { game: view.game, picks: answerKey(view.game, seed) };
  if (view.game === "memory") tick(60_000);
  return service.submitRound(playerId, round.token, answers);
}

describe("GuildService", () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it("registers a device and keeps the same id on re-register", async () => {
    const { service } = ctx;
    const a = await service.register(null, "  ต้น  ", "🐼");
    expect(a.me.player.name).toBe("ต้น");
    const b = await service.register(a.token, "ต้นกล้า", "🐸");
    expect(b.me.player.id).toBe(a.me.player.id);
    expect(b.me.player.avatar).toBe("🐸");
    const forged = await service.register(a.token.slice(0, -2) + "xx", "x", "🐼");
    expect(forged.me.player.id).not.toBe(a.me.player.id);
  });

  it("creates, joins, lists, and leaves guilds; names are unique", async () => {
    const { service } = ctx;
    const lead = await newPlayer(service, "หัวหน้า");
    const fan = await newPlayer(service, "ลูกทีม");
    const me = await service.createGuild(lead.id, { name: "แมวส้ม", emblem: "🔥", color: "sun" });
    const gid = me.guild!.id;
    expect(me.role).toBe("leader");
    await expect(service.createGuild(fan.id, { name: "แมวส้ม" })).rejects.toThrow("ชื่อนี้");
    await expect(service.createGuild(lead.id, { name: "อีกกิลด์" })).rejects.toThrow("ออกจากกิลด์เดิม");

    const joined = await service.joinGuild(fan.id, gid);
    expect(joined.guild?.members).toHaveLength(2);
    const list = await service.listGuilds();
    expect(list[0]).toMatchObject({ id: gid, members: 2, npc: false });
    expect(list.filter((g) => g.npc)).toHaveLength(3);

    await service.leaveGuild(lead.id);
    const after = await service.me(fan.id);
    expect(after.role).toBe("leader");
    await service.leaveGuild(fan.id);
    expect((await service.listGuilds()).some((g) => g.id === gid)).toBe(false);
  });

  it("can't join an NPC guild", async () => {
    const { service } = ctx;
    const p = await newPlayer(service, "x");
    await service.listGuilds();
    await expect(service.joinGuild(p.id, "npc-thunder")).rejects.toThrow("ระบบ");
  });

  it("runs a full invasion against an NPC: play, settle, rewards, trophy, booty", async () => {
    const { service, tick } = ctx;
    const lead = await newPlayer(service, "ปู่จอน");
    const g = (await service.createGuild(lead.id, { name: "สายลม" })).guild!;
    const { warId } = await service.declareWar(lead.id, "npc-thunder");
    await expect(service.declareWar(lead.id, "npc-mango")).rejects.toThrow("ทีละ 1 เกาะ");

    // One player alone can't fill three slots, so bring friends.
    const friends = [lead, await newPlayer(service, "ย่าแดง"), await newPlayer(service, "น้องบี")];
    for (const f of friends.slice(1)) await service.joinGuild(f.id, g.id);
    for (const f of friends) for (const stage of [0, 1, 2, 3, 4]) await playPerfect(service, f.id, warId, stage, tick);

    const mid = await service.warView(warId, lead.id);
    expect(mid.us).toBe("attacker");
    expect(mid.captured.length).toBeGreaterThanOrEqual(3);
    expect(mid.log.length).toBeGreaterThan(1);

    const before = await service.me(lead.id);
    expect(before.guild!.coins).toBeGreaterThan(100); // per-round trickle
    expect(before.guild!.wars[0].status).toBe("active");

    tick(25 * 3600_000);
    const after = await service.me(lead.id);
    expect(after.guild!.activeWars).toHaveLength(0);
    expect(after.guild!.wins).toBe(1);
    expect(after.guild!.trophies[0]).toMatchObject({ kind: "conquer", opponent: "กิลด์สายฟ้า" });
    expect(after.guild!.xp).toBeGreaterThanOrEqual(300);
    expect(after.player.items).toHaveLength(1);
    expect(after.player.fresh).toEqual(after.player.items);

    // Paying out again is a no-op.
    await service.warView(warId, lead.id);
    const again = await service.me(lead.id);
    expect(again.guild!.xp).toBe(after.guild!.xp);
    expect(again.player.items).toEqual(after.player.items);

    const item = cosmeticById(after.player.items[0])!;
    await service.equip(lead.id, item.slot, item.id);
    const dressed = await service.me(lead.id);
    expect(Object.values(dressed.player.look)).toContain(after.player.items[0]);
    expect(Object.values(dressed.guild!.members.find((m) => m.id === lead.id)!.look)).toContain(after.player.items[0]);
  });

  it("guild vs guild: both sides see the war, losers still get rewards", async () => {
    const { service, tick } = ctx;
    const a = await newPlayer(service, "A");
    const d = await newPlayer(service, "D");
    await service.createGuild(a.id, { name: "บุก" });
    const dg = (await service.createGuild(d.id, { name: "รับ" })).guild!;
    const { warId } = await service.declareWar(a.id, dg.id);
    const dv = await service.warView(warId, d.id);
    expect(dv.us).toBe("defender");
    expect((await service.me(d.id)).guild!.wars[0]).toMatchObject({ side: "defender", opponent: "บุก" });

    await playPerfect(service, d.id, warId, 0, tick);
    tick(25 * 3600_000);
    const da = await service.me(d.id);
    const aa = await service.me(a.id);
    expect(da.guild!.wins).toBe(1);
    expect(aa.guild!.losses).toBe(1);
    expect(aa.guild!.xp).toBe(120); // zero-loss: the loser still earns
    expect(da.guild!.trophies[0].kind).toBe("defend");
  });

  it("rejects a round submitted twice, by someone else, or too late", async () => {
    const { service, tick } = ctx;
    const lead = await newPlayer(service, "L");
    const other = await newPlayer(service, "O");
    await service.createGuild(lead.id, { name: "ทดสอบ" });
    const { warId } = await service.declareWar(lead.id, "npc-thunder");
    const round = await service.startRound(lead.id, warId, "auto");
    await expect(service.submitRound(other.id, round.token, { game: "memory", level: 1 })).rejects.toThrow();
    tick(5000);
    await service.submitRound(lead.id, round.token, { game: "memory", level: 1 });
    await expect(service.submitRound(lead.id, round.token, { game: "memory", level: 1 })).rejects.toThrow("ไปแล้ว");
    const late = await service.startRound(lead.id, warId, "auto");
    tick(10 * 60_000);
    await expect(service.submitRound(lead.id, late.token, { game: "memory", level: 1 })).rejects.toThrow("ช้าเกินไป");
  });

  it("only leaders and officers declare war or decorate", async () => {
    const { service } = ctx;
    const lead = await newPlayer(service, "L");
    const mem = await newPlayer(service, "M");
    const g = (await service.createGuild(lead.id, { name: "ยศ" })).guild!;
    await service.joinGuild(mem.id, g.id);
    await expect(service.declareWar(mem.id, "npc-thunder")).rejects.toThrow("หัวหน้า");
    await expect(service.decorate(mem.id, "buy", "palm", "p2")).rejects.toThrow("หัวหน้า");
    await service.memberAction(lead.id, mem.id, "promote");
    const me = await service.decorate(mem.id, "buy", "palm", "p2");
    expect(me.guild!.decor.p2).toBe("palm");
    expect(me.guild!.coins).toBe(40);
  });

  it("presence shows members online and passes waves along", async () => {
    const { service, tick } = ctx;
    const a = await newPlayer(service, "A");
    const b = await newPlayer(service, "B");
    const g = (await service.createGuild(a.id, { name: "เกาะ" })).guild!;
    await service.joinGuild(b.id, g.id);
    await service.presence(b.id, g.id, 0);
    const p = await service.presence(a.id, g.id, 0, { to: b.id, kind: "wave" });
    expect(p.online.sort()).toEqual([a.id, b.id].sort());
    expect(p.events).toHaveLength(1);
    tick(70_000);
    const later = await service.presence(a.id, g.id, 0);
    expect(later.online).toEqual([a.id]);
    expect(later.events).toHaveLength(0);
  });

  it("spectators see who is playing and can cheer their own side", async () => {
    const { service } = ctx;
    const a = await newPlayer(service, "A");
    const b = await newPlayer(service, "B");
    const g = (await service.createGuild(a.id, { name: "เชียร์" })).guild!;
    await service.joinGuild(b.id, g.id);
    const { warId } = await service.declareWar(a.id, "npc-mango");
    await service.startRound(a.id, warId, 0);
    await service.progress(a.id, warId, "ข้อ 3/8", 250);
    const live = await service.cheer(b.id, warId, a.id, "🔥");
    expect(live.playing[0]).toMatchObject({ id: a.id, progress: "ข้อ 3/8", score: 250 });
    expect(live.cheers[0]).toMatchObject({ to: a.id, emoji: "🔥", fromName: "B" });
    await expect(service.cheer(b.id, warId, a.id, "💣")).rejects.toThrow();
  });
});

describe("PgStore", () => {
  it("does compare-and-swap like the memory store", async () => {
    const db = new PGlite();
    const store = new PgStore(async (text, params) => (await db.query<Record<string, unknown>>(text, params)).rows);
    expect(await store.get("k")).toBeNull();
    expect(await store.put("k", { n: 1 }, null)).toBe(true);
    expect(await store.put("k", { n: 2 }, null)).toBe(false);
    expect(await store.get("k")).toEqual({ value: { n: 1 }, version: 1 });
    expect(await store.put("k", { n: 2 }, 1)).toBe(true);
    expect(await store.put("k", { n: 3 }, 1)).toBe(false);

    await Promise.all(
      Array.from({ length: 10 }, () => mutate<{ n: number }, void>(store, "k", (cur) => ({ value: { n: cur!.n + 1 }, result: undefined }))),
    );
    expect((await store.get<{ n: number }>("k"))?.value.n).toBe(12);
  });

  it("runs the service end to end", async () => {
    const db = new PGlite();
    const { service } = setup(new PgStore(async (text, params) => (await db.query<Record<string, unknown>>(text, params)).rows));
    const lead = await newPlayer(service, "PG");
    const me = await service.createGuild(lead.id, { name: "โพสต์เกรส" });
    expect(me.guild?.name).toBe("โพสต์เกรส");
    const { warId } = await service.declareWar(lead.id, "npc-dragon");
    expect((await service.warView(warId, lead.id)).stages).toHaveLength(5);
  });
});
