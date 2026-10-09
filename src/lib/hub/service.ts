// The hub's server side: turns heartbeats and taps into EXP. Storage and LiveKit
// are injected so tests can run it without a network.

import { mutate, type DocStore } from "@/lib/guild/docstore";
import {
  BEAT_MS,
  applyBeat,
  chatters,
  eventDamage,
  isOver,
  levelInfo,
  maybeSpawn,
  newHubPlayer,
  newHubRoom,
  noteChat,
  payEvent,
  roomMultiplier,
  tapEvent,
  type HubEvent,
  type HubPlayer,
  type HubRoom,
  type LevelInfo,
  type Rand,
} from "./rules";

export class HubError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** What LiveKit says about a room right now. */
export type LiveParticipant = { identity: string; talking: boolean };

export interface HubLive {
  participants(roomId: string): Promise<LiveParticipant[]>;
  /** Pushes a hub message to everyone in the room (best effort). */
  broadcast(roomId: string, message: HubMessage): Promise<void>;
}

export type EventView = {
  id: string;
  kind: HubEvent["kind"];
  spawnAt: number;
  expiresAt: number;
  hp: number;
  damage: number;
  defeated: boolean;
  mine: number;
};

export type HubMessage = { type: "event"; event: EventView; now: number } | { type: "hp"; id: string; damage: number; defeated: boolean };

export type HubView = {
  now: number;
  exp: number;
  level: LevelInfo;
  /** Presence EXP from this beat. */
  gained: number;
  /** Event EXP paid out by this call. */
  paid: number;
  multiplier: number;
  talkers: number;
  chatters: number;
  /** Today's full-rate minutes are used up. */
  capped: boolean;
  chests: number;
  spirits: number;
  event: EventView | null;
  nextBeatMs: number;
};

export type Seat = { roomId: string; identity: string };

type Options = { rand?: Rand; newId?: () => string; gap?: [number, number] };

const playerKey = (id: string) => `hub:player:${id}`;
const roomKey = (id: string) => `hub:room:${id}`;

function eventView(event: HubEvent, playerId: string): EventView {
  return {
    id: event.id,
    kind: event.kind,
    spawnAt: event.spawnAt,
    expiresAt: event.expiresAt,
    hp: event.hp,
    damage: eventDamage(event),
    defeated: event.defeatedAt !== null,
    mine: event.taps[playerId] ?? 0,
  };
}

export class HubService {
  private rand: Rand;
  private newId: () => string;
  private gap?: [number, number];

  constructor(
    private store: DocStore,
    private live: HubLive,
    options: Options = {},
  ) {
    this.rand = options.rand ?? Math.random;
    this.newId = options.newId ?? (() => Math.random().toString(36).slice(2, 12));
    this.gap = options.gap;
  }

  /** The caller must really be sitting in the room their join token names. */
  private async presence(seat: Seat) {
    const people = await this.live.participants(seat.roomId);
    if (!people.some((p) => p.identity === seat.identity)) throw new HubError("ยังไม่ได้อยู่ในห้องนี้", 403);
    return people;
  }

  /** Read-only summary for places outside a room (lobby). */
  async me(playerId: string, now: number) {
    const doc = await this.store.get<HubPlayer>(playerKey(playerId));
    const player = doc?.value ?? newHubPlayer(now);
    return { exp: player.exp, level: levelInfo(player.exp), chests: player.chests, spirits: player.spirits };
  }

  /** Once a minute while the room is open: credit time, maybe spawn an event, pay what's owed. */
  async beat(playerId: string, seat: Seat, input: { idle: boolean; chatted: boolean }, now: number): Promise<HubView> {
    const people = await this.presence(seat);
    const talkers = people.filter((p) => p.talking).length;

    let created: string | null = null;
    const room = await mutate<HubRoom, HubRoom>(this.store, roomKey(seat.roomId), (current) => {
      created = null;
      let next = current ?? newHubRoom(now, this.rand, this.gap);
      let changed = !current;
      if (input.chatted) {
        next = noteChat(next, playerId, now);
        changed = true;
      }
      const spawned = maybeSpawn(next, now, this.rand, people.length, this.newId, this.gap);
      if (spawned) {
        next = spawned;
        created = spawned.event!.id;
        changed = true;
      }
      return changed ? { value: next, result: next } : { result: next };
    });

    if (created && room.event?.id === created) {
      await this.live.broadcast(seat.roomId, { type: "event", event: eventView(room.event, ""), now }).catch(() => {});
    }

    const multiplier = roomMultiplier(talkers, chatters(room, now));
    const outcome = await mutate<HubPlayer, { player: HubPlayer; gained: number; paid: number; capped: boolean }>(
      this.store,
      playerKey(playerId),
      (current) => {
        const beat = applyBeat(current ?? newHubPlayer(now), { roomId: seat.roomId, now, multiplier, idle: input.idle });
        let player = beat.player;
        let paid = 0;
        if (room.event) {
          const settled = payEvent(player, room.event, playerId, now);
          if (settled) {
            paid = settled.exp - player.exp;
            player = settled;
          }
        }
        return { value: player, result: { player, gained: beat.gained, paid, capped: beat.capped } };
      },
    );

    return {
      now,
      exp: outcome.player.exp,
      level: levelInfo(outcome.player.exp),
      gained: outcome.gained,
      paid: outcome.paid,
      multiplier,
      talkers,
      chatters: chatters(room, now),
      capped: outcome.capped,
      chests: outcome.player.chests,
      spirits: outcome.player.spirits,
      // Running event, so a client that missed the broadcast can still join in.
      event: room.event && !isOver(room.event, now) ? eventView(room.event, playerId) : null,
      nextBeatMs: BEAT_MS,
    };
  }

  /** Taps on the current chest or spirit. Pays immediately when the outcome is decided. */
  async tap(playerId: string, seat: Seat, eventId: string, taps: number, now: number) {
    await this.presence(seat);

    const tapped = await mutate<HubRoom, ReturnType<typeof tapEvent>>(this.store, roomKey(seat.roomId), (current) => {
      if (!current) return { result: { ok: false, reason: "gone" } as const };
      const result = tapEvent(current, eventId, playerId, taps, now);
      return result.ok ? { value: result.room, result } : { result };
    });

    if (!tapped.ok) {
      const message = { gone: "พลาดไปแล้ว อีเวนต์นี้หายไปแล้ว", closed: "ช้าไปนิด! หมดเวลาแล้ว", taken: "เก็บไปแล้ว" }[tapped.reason];
      throw new HubError(message, 409);
    }
    const event = tapped.room.event!;

    if (event.kind === "spirit") {
      await this.live
        .broadcast(seat.roomId, { type: "hp", id: event.id, damage: eventDamage(event), defeated: event.defeatedAt !== null })
        .catch(() => {});
    }

    const outcome = await mutate<HubPlayer, { player: HubPlayer; paid: number }>(this.store, playerKey(playerId), (current) => {
      const player = current ?? newHubPlayer(now);
      const settled = payEvent(player, event, playerId, now);
      return settled ? { value: settled, result: { player: settled, paid: settled.exp - player.exp } } : { result: { player, paid: 0 } };
    });

    return {
      accepted: tapped.accepted,
      event: eventView(event, playerId),
      paid: outcome.paid,
      exp: outcome.player.exp,
      level: levelInfo(outcome.player.exp),
    };
  }
}
