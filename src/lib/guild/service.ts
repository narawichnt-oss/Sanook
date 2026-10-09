// Everything the guild API does, on top of a DocStore. No Next.js or env
// imports here, so tests drive it directly with a MemoryStore and a fake clock.

import { AVATARS, MAX_NAME, cleanName, truncateGraphemes } from "@/lib/room-meta";
import { LOSER_BOOTY_CHANCE, ROUND_REWARD, cosmeticById, levelOf, memberCap, rollBooty, type LookSlot, type SlotId } from "./catalog";
import { mutate, type DocStore } from "./docstore";
import {
  NPC_GUILDS,
  addMember,
  applyWarResult,
  buyDecor,
  canManage,
  changeMember,
  newGuild,
  npcGuild,
  parseGuildInput,
  placeDecor,
  removeMember,
  roleOf,
  storeDecor,
  summarize,
  type MemberAction,
} from "./guild";
import { GAMES, type RoundAnswers } from "./games";
import { hashSeed, newId, randomSeed, seeded } from "./rng";
import { answerKey, buildRound, scoreRound } from "./rounds";
import { playerToken, readPlayerToken, readRoundToken, roundToken } from "./tokens";
import type {
  ActiveWarView,
  Guild,
  GuildSummary,
  GuildView,
  LiveView,
  MeView,
  Player,
  PresenceEvent,
  SideKey,
  War,
  WarView,
} from "./types";
import { beginAttempt, createWar, participants, pickStage, recordScore, settleWar, stageBoard, warTotals, warView } from "./war";

export class GuildError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const INDEX = "guild-index";
const ONLINE_MS = 30_000;
const EVENT_MS = 20_000;
const LIVE_MS = 25_000;
const CHEER_MS = 15_000;
/** Rounds handed out just before the bell still get to finish. */
const SETTLE_GRACE_MS = 3 * 60_000;
const MAX_INCOMING_WARS = 2;

export const CHEER_EMOJIS = ["👏", "🔥", "💪", "🎉", "❤️", "😂"] as const;

const GUILD_ID = /^[a-z0-9-]{3,24}$/;
const WAR_ID = /^[a-z0-9]{12}$/;

type Index = Record<string, GuildSummary>;
type Presence = { seen: Record<string, number>; events: PresenceEvent[] };
type Live = {
  playing: Record<string, LiveView["playing"][number]>;
  cheers: (LiveView["cheers"][number] & { from: string })[];
};

export type ServiceOptions = { warHours: number; now?: () => number };

export class GuildService {
  private now: () => number;

  constructor(
    private store: DocStore,
    private secret: string,
    private opts: ServiceOptions,
  ) {
    this.now = opts.now ?? Date.now;
  }

  // ---- Players ------------------------------------------------------------------

  /** The player id behind a request's token, or null. */
  playerIdFrom(token: string | null): string | null {
    return readPlayerToken(token, this.secret);
  }

  /** Registers a new device, or refreshes the name and avatar of a known one. */
  async register(token: string | null, name: string, avatar: string): Promise<{ token: string; me: MeView }> {
    name = truncateGraphemes(cleanName(name), MAX_NAME) || "ผู้เล่น";
    if (!(AVATARS as readonly string[]).includes(avatar)) avatar = AVATARS[0];
    let id = this.playerIdFrom(token);
    if (id && !(await this.store.get<Player>(`player:${id}`))) id = null;
    if (!id) {
      id = newId(12);
      const player: Player = { id, name, avatar, guildId: null, look: {}, items: [], fresh: [], claimed: [], createdAt: this.now() };
      await this.store.put(`player:${id}`, player, null);
    } else {
      const changed = await mutate<Player, boolean>(this.store, `player:${id}`, (p) => {
        if (!p || (p.name === name && p.avatar === avatar)) return { result: false };
        return { value: { ...p, name, avatar }, result: true };
      });
      if (changed) await this.syncMember(id);
    }
    return { token: playerToken(id, this.secret), me: await this.me(id) };
  }

  async player(id: string): Promise<Player> {
    const doc = await this.store.get<Player>(`player:${id}`);
    if (!doc) throw new GuildError("ไม่พบผู้เล่น ลองรีเฟรชหน้าใหม่", 401);
    return doc.value;
  }

  async me(id: string): Promise<MeView> {
    const first = await this.player(id);
    const guild = first.guildId ? await this.guildView(first.guildId).catch(() => null) : null;
    // Loading the guild may have paid out a war and dropped booty, so read the player after.
    const player = guild ? await this.player(id) : first;
    const member = guild?.members.some((m) => m.id === id) ? guild : null;
    return {
      player: { id, name: player.name, avatar: player.avatar, look: player.look, items: player.items, fresh: player.fresh },
      guild: member,
      role: member ? roleOf(member, id) : null,
    };
  }

  /** Copies a player's name, avatar, and look onto their member card. */
  private async syncMember(playerId: string) {
    const player = await this.player(playerId);
    if (!player.guildId) return;
    await mutate<Guild, void>(this.store, `guild:${player.guildId}`, (g) => {
      const m = g?.members.find((x) => x.id === playerId);
      if (!g || !m) return { result: undefined };
      Object.assign(m, { name: player.name, avatar: player.avatar, look: player.look });
      return { value: g, result: undefined };
    });
  }

  async equip(playerId: string, slot: LookSlot, itemId: string | null) {
    if (slot !== "hat" && slot !== "hand") throw new GuildError("ไม่รู้จักช่องนี้");
    await mutate<Player, void>(this.store, `player:${playerId}`, (p) => {
      if (!p) throw new GuildError("ไม่พบผู้เล่น", 401);
      if (itemId) {
        const item = cosmeticById(itemId);
        if (!item || item.slot !== slot || !p.items.includes(itemId)) throw new GuildError("ยังไม่มีของชิ้นนี้");
        p.look = { ...p.look, [slot]: itemId };
      } else {
        const look = { ...p.look };
        delete look[slot];
        p.look = look;
      }
      return { value: p, result: undefined };
    });
    await this.syncMember(playerId);
    return this.me(playerId);
  }

  /** Clears the "new item!" badge. */
  async seen(playerId: string) {
    await mutate<Player, void>(this.store, `player:${playerId}`, (p) =>
      p && p.fresh.length ? { value: { ...p, fresh: [] }, result: undefined } : { result: undefined },
    );
  }

  // ---- Guilds -------------------------------------------------------------------

  private async index(): Promise<Index> {
    const doc = await this.store.get<Index>(INDEX);
    const index = doc?.value ?? {};
    if (NPC_GUILDS.every((n) => index[n.id])) return index;
    for (const def of NPC_GUILDS) {
      if (!(await this.store.get(`guild:${def.id}`))) await this.store.put(`guild:${def.id}`, npcGuild(def, this.now()), null);
      await this.syncIndex(npcGuild(def, this.now()));
    }
    return (await this.store.get<Index>(INDEX))?.value ?? {};
  }

  private async syncIndex(guild: Guild) {
    await mutate<Index, void>(this.store, INDEX, (index) => {
      const next = { ...(index ?? {}) };
      if (guild.disbanded) delete next[guild.id];
      else next[guild.id] = summarize(guild);
      return { value: next, result: undefined };
    });
  }

  async listGuilds(query = ""): Promise<GuildSummary[]> {
    const q = query.trim().toLowerCase();
    return Object.values(await this.index())
      .filter((g) => !q || g.name.toLowerCase().includes(q))
      .sort((a, b) => Number(a.npc) - Number(b.npc) || b.level - a.level || b.wins - a.wins || b.members - a.members)
      .slice(0, 50);
  }

  async guild(id: string): Promise<Guild> {
    if (!GUILD_ID.test(id)) throw new GuildError("ไม่พบกิลด์นี้", 404);
    if (id.startsWith("npc-")) await this.index();
    const doc = await this.store.get<Guild>(`guild:${id}`);
    if (!doc || doc.value.disbanded) throw new GuildError("ไม่พบกิลด์นี้", 404);
    return doc.value;
  }

  /** A guild as the browser sees it, with any finished wars paid out first. */
  async guildView(id: string): Promise<GuildView> {
    let guild = await this.guild(id);
    if (guild.activeWars.length) {
      for (const w of guild.activeWars) await this.war(w.id);
      guild = await this.guild(id);
    }
    const wars: ActiveWarView[] = [];
    for (const w of guild.activeWars) {
      const war = (await this.store.get<War>(`war:${w.id}`))?.value;
      if (!war) continue;
      const { totals, captured } = war.result ?? warTotals(war);
      wars.push({ ...w, totals, captured: captured.length, status: war.status });
    }
    const level = guild.npc?.level ?? levelOf(guild.xp);
    return { ...guild, level, cap: memberCap(level), wars };
  }

  async createGuild(playerId: string, input: unknown): Promise<MeView> {
    const parsed = parseGuildInput(input);
    if (!parsed.ok) throw new GuildError(parsed.error);
    const player = await this.player(playerId);
    if (player.guildId && (await this.isMember(player.guildId, playerId))) throw new GuildError("ออกจากกิลด์เดิมก่อน แล้วค่อยตั้งกิลด์ใหม่");
    const taken = Object.values(await this.index()).some((g) => g.name.toLowerCase() === parsed.value.name.toLowerCase());
    if (taken) throw new GuildError("ชื่อนี้มีกิลด์ใช้แล้ว ลองชื่ออื่นนะ");

    const guild = newGuild(`g${newId(9)}`, parsed.value, player, this.now());
    await this.store.put(`guild:${guild.id}`, guild, null);
    await this.setPlayerGuild(playerId, guild.id);
    await this.syncIndex(guild);
    return this.me(playerId);
  }

  private async isMember(guildId: string, playerId: string) {
    const doc = await this.store.get<Guild>(`guild:${guildId}`);
    return Boolean(doc && !doc.value.disbanded && doc.value.members.some((m) => m.id === playerId));
  }

  private async setPlayerGuild(playerId: string, guildId: string | null) {
    await mutate<Player, void>(this.store, `player:${playerId}`, (p) => (p ? { value: { ...p, guildId }, result: undefined } : { result: undefined }));
  }

  async joinGuild(playerId: string, guildId: string): Promise<MeView> {
    const player = await this.player(playerId);
    if (player.guildId && player.guildId !== guildId && (await this.isMember(player.guildId, playerId))) {
      throw new GuildError("ออกจากกิลด์เดิมก่อน แล้วค่อยเข้ากิลด์ใหม่");
    }
    await this.guild(guildId);
    const guild = await mutate<Guild, Guild>(this.store, `guild:${guildId}`, (g) => {
      if (!g) throw new GuildError("ไม่พบกิลด์นี้", 404);
      const added = addMember(g, player, this.now());
      if (!added.ok) throw new GuildError(added.error);
      return { value: g, result: g };
    });
    await this.setPlayerGuild(playerId, guildId);
    await this.syncIndex(guild);
    return this.me(playerId);
  }

  async leaveGuild(playerId: string): Promise<MeView> {
    const player = await this.player(playerId);
    if (player.guildId) {
      const guild = await mutate<Guild, Guild | null>(this.store, `guild:${player.guildId}`, (g) => {
        if (!g) return { result: null };
        removeMember(g, playerId);
        return { value: g, result: g };
      });
      if (guild) await this.syncIndex(guild);
    }
    await this.setPlayerGuild(playerId, null);
    return this.me(playerId);
  }

  private async myGuild(playerId: string) {
    const player = await this.player(playerId);
    if (!player.guildId) throw new GuildError("ยังไม่ได้อยู่ในกิลด์ไหนเลย");
    const guild = await this.guild(player.guildId);
    const role = roleOf(guild, playerId);
    if (!role) throw new GuildError("ยังไม่ได้อยู่ในกิลด์ไหนเลย");
    return { player, guild, role };
  }

  async memberAction(playerId: string, targetId: string, action: MemberAction): Promise<MeView> {
    if (!["promote", "demote", "kick", "transfer"].includes(action)) throw new GuildError("ไม่รู้จักคำสั่งนี้");
    const { guild } = await this.myGuild(playerId);
    const updated = await mutate<Guild, Guild>(this.store, `guild:${guild.id}`, (g) => {
      if (!g) throw new GuildError("ไม่พบกิลด์นี้", 404);
      const done = changeMember(g, playerId, targetId, action);
      if (!done.ok) throw new GuildError(done.error);
      return { value: g, result: g };
    });
    if (action === "kick") await this.setPlayerGuild(targetId, null);
    await this.syncIndex(updated);
    return this.me(playerId);
  }

  async decorate(playerId: string, action: "buy" | "place" | "store", itemId: string, slot?: SlotId): Promise<MeView> {
    const { guild, role } = await this.myGuild(playerId);
    if (!canManage(role)) throw new GuildError("หัวหน้าหรือรองหัวหน้าเท่านั้นที่ตกแต่งเกาะได้", 403);
    await mutate<Guild, void>(this.store, `guild:${guild.id}`, (g) => {
      if (!g) throw new GuildError("ไม่พบกิลด์นี้", 404);
      const done =
        action === "buy"
          ? buyDecor(g, itemId, slot)
          : action === "place" && slot
            ? placeDecor(g, itemId, slot)
            : action === "store" && slot
              ? storeDecor(g, slot)
              : ({ ok: false, error: "ไม่รู้จักคำสั่งนี้" } as const);
      if (!done.ok) throw new GuildError(done.error);
      return { value: g, result: undefined };
    });
    return this.me(playerId);
  }

  // ---- Presence on the island ---------------------------------------------------------

  async presence(playerId: string, guildId: string, since: number, interact?: { to: string; kind: PresenceEvent["kind"] }) {
    const guild = await this.guild(guildId);
    const isMember = guild.members.some((m) => m.id === playerId);
    const now = this.now();
    const doc = await mutate<Presence, Presence>(this.store, `presence:${guildId}`, (cur) => {
      const p: Presence = cur ?? { seen: {}, events: [] };
      // Visitors can look around, but only members show up walking on the island.
      if (isMember) p.seen[playerId] = now;
      for (const [id, at] of Object.entries(p.seen)) if (now - at > ONLINE_MS * 2) delete p.seen[id];
      p.events = p.events.filter((e) => now - e.at < EVENT_MS);
      if (isMember && interact && interact.to !== playerId && guild.members.some((m) => m.id === interact.to)) {
        if (interact.kind === "wave" || interact.kind === "highfive") {
          p.events.push({ id: newId(8), at: now, from: playerId, to: interact.to, kind: interact.kind });
        }
      }
      return { value: p, result: p };
    });
    return {
      now,
      online: Object.entries(doc.seen)
        .filter(([, at]) => now - at < ONLINE_MS)
        .map(([id]) => id),
      events: doc.events.filter((e) => e.at > since),
    };
  }

  // ---- War ------------------------------------------------------------------------

  async targets(playerId: string) {
    const { guild } = await this.myGuild(playerId);
    const busy = new Set(guild.activeWars.map((w) => w.opponentId));
    const level = levelOf(guild.xp);
    return (await this.listGuilds())
      .filter((g) => g.id !== guild.id)
      .map((g) => ({ ...g, busy: busy.has(g.id), gap: g.level - level }))
      .sort((a, b) => Number(b.npc) - Number(a.npc) || Math.abs(a.gap) - Math.abs(b.gap));
  }

  async declareWar(playerId: string, targetId: string): Promise<{ warId: string }> {
    const { guild, role } = await this.myGuild(playerId);
    if (!canManage(role)) throw new GuildError("หัวหน้าหรือรองหัวหน้าเท่านั้นที่สั่งบุกได้", 403);
    if (targetId === guild.id) throw new GuildError("บุกเกาะตัวเองไม่ได้นะ");
    const target = await this.guild(targetId);
    if (!target.npc && target.activeWars.filter((w) => w.side === "defender").length >= MAX_INCOMING_WARS) {
      throw new GuildError("เกาะนี้กำลังโดนบุกหลายทางอยู่ ลองเกาะอื่นก่อนนะ");
    }

    const now = this.now();
    const war = createWar({ id: newId(12), seed: randomSeed(), attacker: guild, defender: target, now, hours: this.opts.warHours });

    await mutate<Guild, void>(this.store, `guild:${guild.id}`, (g) => {
      if (!g) throw new GuildError("ไม่พบกิลด์นี้", 404);
      if (g.activeWars.some((w) => w.side === "attacker")) throw new GuildError("บุกได้ทีละ 1 เกาะ รอศึกเดิมจบก่อนนะ");
      if (g.activeWars.some((w) => w.opponentId === targetId)) throw new GuildError("กำลังรบกับกิลด์นี้อยู่แล้ว");
      g.activeWars.push({ id: war.id, side: "attacker", opponentId: target.id, opponent: target.name, opponentEmblem: target.emblem, endsAt: war.endsAt });
      return { value: g, result: undefined };
    });
    await this.store.put(`war:${war.id}`, war, null);
    if (!target.npc) {
      await mutate<Guild, void>(this.store, `guild:${target.id}`, (g) => {
        if (!g) return { result: undefined };
        g.activeWars.push({ id: war.id, side: "defender", opponentId: guild.id, opponent: guild.name, opponentEmblem: guild.emblem, endsAt: war.endsAt });
        return { value: g, result: undefined };
      });
    }
    return { warId: war.id };
  }

  /** Loads a war, closing and paying it out if its time is up. */
  async war(id: string): Promise<War> {
    if (!WAR_ID.test(id)) throw new GuildError("ไม่พบสงครามนี้", 404);
    let war = (await this.store.get<War>(`war:${id}`))?.value;
    if (!war) throw new GuildError("ไม่พบสงครามนี้", 404);
    const now = this.now();
    if (war.status === "active" && now >= war.endsAt + SETTLE_GRACE_MS) {
      war = await mutate<War, War>(this.store, `war:${id}`, (cur) => {
        if (!cur) throw new GuildError("ไม่พบสงครามนี้", 404);
        if (cur.status !== "active") return { result: cur };
        const done = settleWar(cur);
        return { value: done, result: done };
      });
    }
    if (war.status === "done") await this.payout(war);
    return war;
  }

  private async payout(war: War) {
    for (const side of ["attacker", "defender"] as const) {
      if (war[side].npc) continue;
      const applied = await mutate<Guild, Guild | null>(this.store, `guild:${war[side].guildId}`, (g) => {
        if (!g || !applyWarResult(g, war, side)) return { result: null };
        return { value: g, result: g };
      });
      if (!applied) continue;
      await this.syncIndex(applied);
      const won = war.result!.winner === side;
      for (const pid of participants(war, side)) {
        await mutate<Player, void>(this.store, `player:${pid}`, (p) => {
          if (!p || p.claimed.includes(war.id)) return { result: undefined };
          p.claimed = [war.id, ...p.claimed].slice(0, 50);
          // Same roll every time for this player and war, so a retry can't reroll.
          const rand = seeded(hashSeed(`${war.id}:${pid}`));
          if (won || rand() < LOSER_BOOTY_CHANCE) {
            const item = rollBooty(p.items, rand);
            if (!p.items.includes(item)) {
              p.items.push(item);
              p.fresh.push(item);
            }
          }
          return { value: p, result: undefined };
        });
      }
    }
  }

  async warView(warId: string, playerId: string | null): Promise<WarView> {
    const war = await this.war(warId);
    let guildId: string | null = null;
    if (playerId) {
      const player = await this.store.get<Player>(`player:${playerId}`);
      guildId = player?.value.guildId ?? null;
    }
    return warView(war, guildId, playerId, this.now());
  }

  private async sideIn(war: War, playerId: string): Promise<{ side: SideKey; player: Player }> {
    const player = await this.player(playerId);
    const side: SideKey | null =
      player.guildId === war.attacker.guildId ? "attacker" : player.guildId === war.defender.guildId ? "defender" : null;
    if (!side || !(await this.isMember(player.guildId!, playerId))) throw new GuildError("สงครามนี้ไม่ใช่ของกิลด์คุณ", 403);
    return { side, player };
  }

  /** Hands out a round. `stage` may be "auto" for the Play Now button. */
  async startRound(playerId: string, warId: string, stage: number | "auto") {
    const war = await this.war(warId);
    const { side, player } = await this.sideIn(war, playerId);
    const index = stage === "auto" ? pickStage(war, side, playerId, Math.random) : stage;
    if (index === null) throw new GuildError("เล่นครบทุกด่านแล้ว ไปเชียร์เพื่อนกันดีกว่า");
    if (!Number.isInteger(index) || !war.stages[index]) throw new GuildError("ไม่พบด่านนี้");

    const seed = randomSeed();
    const who = { id: playerId, name: player.name, avatar: player.avatar, look: player.look };
    await mutate<War, void>(this.store, `war:${warId}`, (w) => {
      if (!w) throw new GuildError("ไม่พบสงครามนี้", 404);
      const ok = beginAttempt(w, index, side, who, seed, this.now());
      if (!ok.ok) throw new GuildError(ok.error);
      return { value: w, result: undefined };
    });

    const game = war.stages[index].game;
    const startedAt = this.now();
    const token = roundToken({ war: warId, stage: index, game, player: playerId, seed, startedAt }, this.secret);
    await this.updateLive(warId, playerId, { side, game, progress: "เพิ่งเริ่ม", score: 0, who });
    return { token, stage: index, game, limitSec: GAMES[game].limitSec, view: buildRound(game, seed).view };
  }

  async submitRound(playerId: string, token: unknown, answers: RoundAnswers) {
    const ticket = readRoundToken(token, this.secret);
    if (!ticket || ticket.player !== playerId) throw new GuildError("รอบนี้ใช้ไม่ได้ ลองเริ่มใหม่นะ");
    const elapsed = this.now() - ticket.startedAt;
    if (elapsed > (GAMES[ticket.game].limitSec + 30) * 1000) throw new GuildError("ส่งคะแนนช้าเกินไป รอบนี้ไม่นับนะ");

    const war = await this.war(ticket.war);
    const { side, player } = await this.sideIn(war, playerId);
    const { score, detail } = scoreRound(ticket.game, ticket.seed, answers, elapsed);
    const who = { id: playerId, name: player.name, avatar: player.avatar, look: player.look };

    const outcome = await mutate<War, ReturnType<typeof recordScore> & { before: number; after: number }>(this.store, `war:${ticket.war}`, (w) => {
      if (!w) throw new GuildError("ไม่พบสงครามนี้", 404);
      if (w.status !== "active") throw new GuildError("สงครามนี้จบไปแล้ว");
      const entry = w.stages[ticket.stage]?.[side][playerId];
      if (!entry || entry.open !== ticket.seed) throw new GuildError("ส่งรอบนี้ไปแล้ว");
      const before = stageBoard(w, ticket.stage).scores[side];
      const rec = recordScore(w, ticket.stage, side, who, score, this.now());
      delete w.stages[ticket.stage][side][playerId].open;
      return { value: w, result: { ...rec, before, after: stageBoard(w, ticket.stage).scores[side] } };
    });

    await mutate<Guild, void>(this.store, `guild:${player.guildId}`, (g) => {
      const m = g?.members.find((x) => x.id === playerId);
      if (!g || !m) return { result: undefined };
      m.contribution += Math.max(0, Math.round((outcome.after - outcome.before) / 10)) + 1;
      g.xp += ROUND_REWARD.xp;
      g.coins += ROUND_REWARD.coins;
      return { value: g, result: undefined };
    });
    await this.clearLive(ticket.war, playerId);

    return {
      score,
      detail,
      improved: outcome.improved,
      best: Math.max(outcome.previous, score),
      previous: outcome.previous,
      stage: ticket.stage,
      game: ticket.game,
      key: ticket.game === "emoji" || ticket.game === "trivia" || ticket.game === "math" ? answerKey(ticket.game, ticket.seed) : null,
    };
  }

  // ---- Cheering (spectators) --------------------------------------------------------

  private async updateLive(
    warId: string,
    playerId: string,
    u: { side: SideKey; game: War["stages"][number]["game"]; progress: string; score: number; who: { name: string; avatar: string; look: Player["look"] } },
  ) {
    const now = this.now();
    await mutate<Live, void>(this.store, `live:${warId}`, (cur) => {
      const live: Live = cur ?? { playing: {}, cheers: [] };
      live.playing[playerId] = {
        id: playerId,
        side: u.side,
        name: u.who.name,
        avatar: u.who.avatar,
        look: u.who.look,
        game: u.game,
        progress: u.progress.slice(0, 40),
        score: Math.max(0, Math.min(1000, Math.round(u.score) || 0)),
        at: now,
      };
      return { value: prune(live, now), result: undefined };
    });
  }

  private async clearLive(warId: string, playerId: string) {
    await mutate<Live, void>(this.store, `live:${warId}`, (cur) => {
      if (!cur?.playing[playerId]) return { result: undefined };
      delete cur.playing[playerId];
      return { value: cur, result: undefined };
    });
  }

  /** A player mid-round reports how it's going, so friends can watch. */
  async progress(playerId: string, warId: string, progress: string, score: number) {
    const live = (await this.store.get<Live>(`live:${warId}`))?.value;
    const mine = live?.playing[playerId];
    if (!mine) return this.live(warId);
    await this.updateLive(warId, playerId, { side: mine.side, game: mine.game, progress, score, who: mine });
    return this.live(warId);
  }

  async cheer(playerId: string, warId: string, to: string, emoji: string) {
    if (!(CHEER_EMOJIS as readonly string[]).includes(emoji)) throw new GuildError("ส่งอีโมจินี้ไม่ได้");
    const war = await this.war(warId);
    const { side, player } = await this.sideIn(war, playerId);
    const now = this.now();
    await mutate<Live, void>(this.store, `live:${warId}`, (cur) => {
      const live: Live = cur ?? { playing: {}, cheers: [] };
      const target = live.playing[to];
      if (!target || target.side !== side) throw new GuildError("เพื่อนคนนี้เล่นจบไปแล้ว");
      // One cheer per second per person keeps the screen fun instead of flooded.
      if (live.cheers.some((c) => c.from === playerId && now - c.at < 1000)) return { result: undefined };
      live.cheers.push({ id: newId(8), at: now, from: playerId, to, emoji, fromName: player.name, fromAvatar: player.avatar });
      return { value: prune(live, now), result: undefined };
    });
    return this.live(warId);
  }

  async live(warId: string): Promise<LiveView> {
    const live = (await this.store.get<Live>(`live:${warId}`))?.value ?? { playing: {}, cheers: [] };
    const now = this.now();
    const pruned = prune(live, now);
    return {
      playing: Object.values(pruned.playing).sort((a, b) => a.at - b.at),
      cheers: pruned.cheers.map((c) => ({ id: c.id, at: c.at, to: c.to, emoji: c.emoji, fromName: c.fromName, fromAvatar: c.fromAvatar })),
    };
  }
}

function prune(live: Live, now: number): Live {
  for (const [id, p] of Object.entries(live.playing)) if (now - p.at > LIVE_MS) delete live.playing[id];
  live.cheers = live.cheers.filter((c) => now - c.at < CHEER_MS).slice(-40);
  return live;
}

