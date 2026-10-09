// Shapes of the stored documents and the views the API sends to the browser.

import type { GuildColor, Look, SlotId } from "./catalog";
import type { GameId } from "./games";

export type Role = "leader" | "officer" | "member";

export type Member = {
  id: string;
  name: string;
  avatar: string;
  look: Look;
  role: Role;
  joinedAt: number;
  /** War points this member has added for the guild, for the member list. */
  contribution: number;
};

export type SideKey = "attacker" | "defender";

export type ActiveWar = {
  id: string;
  side: SideKey;
  opponentId: string;
  opponent: string;
  opponentEmblem: string;
  endsAt: number;
};

export type Trophy = {
  warId: string;
  kind: "conquer" | "defend";
  opponent: string;
  opponentEmblem: string;
  captured: number;
  at: number;
};

export type WarRecord = {
  warId: string;
  side: SideKey;
  opponent: string;
  opponentEmblem: string;
  won: boolean;
  captured: number;
  at: number;
};

export type Guild = {
  id: string;
  name: string;
  emblem: string;
  color: GuildColor;
  motto: string;
  createdAt: number;
  xp: number;
  coins: number;
  members: Member[];
  decor: Partial<Record<SlotId, string>>;
  /** Bought decor that isn't placed on the island yet. */
  storage: string[];
  trophies: Trophy[];
  history: WarRecord[];
  activeWars: ActiveWar[];
  wins: number;
  losses: number;
  /** Computer-run guilds that are always around to practise against. */
  npc?: { difficulty: number; level: number };
  disbanded?: boolean;
};

export type GuildSummary = {
  id: string;
  name: string;
  emblem: string;
  color: GuildColor;
  motto: string;
  level: number;
  members: number;
  wins: number;
  npc: boolean;
};

export type Player = {
  id: string;
  name: string;
  avatar: string;
  guildId: string | null;
  look: Look;
  /** Cosmetic ids the player owns. */
  items: string[];
  /** Newly dropped items the player hasn't opened yet. */
  fresh: string[];
  /** Wars whose rewards were already handed to this player. */
  claimed: string[];
  createdAt: number;
};

// ---- War ----------------------------------------------------------------------

export type Entry = {
  name: string;
  avatar: string;
  look: Look;
  best: number;
  attempts: number;
  at: number;
  /** Seed of the round handed out but not yet submitted; a round counts once. */
  open?: number;
};

export type Stage = {
  game: GameId;
  attacker: Record<string, Entry>;
  defender: Record<string, Entry>;
};

export type WarSide = {
  guildId: string;
  name: string;
  emblem: string;
  color: GuildColor;
  level: number;
  /** AI guard strength: NPC guilds set it, real guilds scale with level. */
  difficulty: number;
  npc: boolean;
};

export type LogEntry = { at: number; side: SideKey; icon: string; text: string };

export type WarResult = {
  winner: SideKey;
  captured: number[];
  totals: Record<SideKey, number>;
  mvp: { side: SideKey; name: string; avatar: string; points: number } | null;
  rewards: Record<SideKey, { xp: number; coins: number }>;
};

export type War = {
  id: string;
  seed: number;
  mode: "invasion";
  attacker: WarSide;
  defender: WarSide;
  startedAt: number;
  endsAt: number;
  stages: Stage[];
  log: LogEntry[];
  status: "active" | "done";
  result?: WarResult;
};

export type BoardRow = { kind: "player" | "guard"; id?: string; name: string; avatar: string; look?: Look; score: number };

export type StageView = {
  game: GameId;
  rows: Record<SideKey, BoardRow[]>;
  scores: Record<SideKey, number>;
  leader: SideKey;
  myBest: number;
  attemptsLeft: number;
};

export type WarView = {
  id: string;
  status: War["status"];
  startedAt: number;
  endsAt: number;
  now: number;
  /** Which side the viewer fights for, or null for a visitor. */
  us: SideKey | null;
  sides: Record<SideKey, WarSide>;
  stages: StageView[];
  totals: Record<SideKey, number>;
  captured: number[];
  log: LogEntry[];
  result?: WarResult;
};

// ---- Views ----------------------------------------------------------------------

export type ActiveWarView = ActiveWar & { totals: Record<SideKey, number>; captured: number; status: War["status"] };

export type GuildView = Omit<Guild, "history"> & {
  level: number;
  history: WarRecord[];
  wars: ActiveWarView[];
  cap: number;
};

export type MeView = {
  player: Pick<Player, "id" | "name" | "avatar" | "look" | "items" | "fresh">;
  guild: GuildView | null;
  role: Role | null;
};

export type PresenceEvent = { id: string; at: number; from: string; to: string; kind: "wave" | "highfive" };

export type LiveView = {
  playing: { id: string; side: SideKey; name: string; avatar: string; look: Look; game: GameId; progress: string; score: number; at: number }[];
  cheers: { id: string; at: number; to: string; emoji: string; fromName: string; fromAvatar: string }[];
};
