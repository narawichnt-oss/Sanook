"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DECOR_SLOTS,
  HALL_TILE,
  ISLAND_SIZE,
  ZONES,
  decorById,
  zoneAt,
  zoneUnlocked,
  type Look,
  type SlotId,
  type ZoneId,
} from "@/lib/guild/catalog";
import { hashSeed } from "@/lib/guild/rng";
import type { PresenceEvent } from "@/lib/guild/types";
import { Figure } from "./ui";

// Isometric layout in a 1000-wide coordinate space. Tiles are diamonds twice as
// wide as they are tall; the island's top corner sits TOP below the frame so
// tall decorations have room.
const W = 1000;
const TW = W / ISLAND_SIZE;
const TH = TW / 2;
const TOP = 120;
const DEPTH = 46;
const H = TOP + ISLAND_SIZE * TH + DEPTH + 14;

function center(c: number, r: number) {
  return { x: W / 2 + ((c - r) * TW) / 2, y: TOP + ((c + r + 1) * TH) / 2 };
}

/** Where something standing on tile (c, r) goes, as % of the island box. */
function spot(c: number, r: number) {
  const p = center(c, r);
  return { left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%`, z: 10 + c + r };
}

const GROUND: Record<ZoneId, [string, string]> = {
  plaza: ["#f3dca8", "#ead095"],
  garden: ["#7fd68c", "#70c97e"],
  fun: ["#8de2c0", "#7ad6b1"],
  gacha: ["#f6b8d4", "#efa7c8"],
  statue: ["#69c27f", "#5db574"],
};

const SAND: [string, string] = ["#f8e6b4", "#f1dca2"];

export type IslandMember = { id: string; name: string; avatar: string; look: Look };

type Props = {
  level: number;
  decor: Partial<Record<SlotId, string>>;
  members: IslandMember[];
  /** Avatar shown on the leader statue, if the guild built one. */
  leaderAvatar?: string;
  trophies: number;
  events?: PresenceEvent[];
  meId?: string;
  editing?: boolean;
  onMember?: (id: string) => void;
  onSlot?: (slot: SlotId) => void;
  onHall?: () => void;
};

export function Island({ level, decor, members, leaderAvatar, trophies, events = [], meId, editing, onMember, onSlot, onHall }: Props) {
  const walkable = useMemo(() => {
    const blocked = new Set<string>([`${HALL_TILE.c},${HALL_TILE.r}`]);
    for (const s of DECOR_SLOTS) if (decor[s.id]) blocked.add(`${s.c},${s.r}`);
    const tiles: { c: number; r: number }[] = [];
    for (let c = 0; c < ISLAND_SIZE; c++)
      for (let r = 0; r < ISLAND_SIZE; r++) if (zoneUnlocked(zoneAt(c, r), level) && !blocked.has(`${c},${r}`)) tiles.push({ c, r });
    return tiles;
  }, [decor, level]);

  const positions = useWander(
    members.map((m) => m.id),
    walkable,
  );

  // Fresh wave/high-five bubbles, keyed by the avatar they float over.
  const bubbles = useMemo(() => {
    const out: Record<string, { key: string; text: string }[]> = {};
    for (const e of events) {
      const icon = e.kind === "wave" ? "👋" : "🙌";
      (out[e.from] ??= []).push({ key: `${e.id}-f`, text: icon });
      (out[e.to] ??= []).push({ key: `${e.id}-t`, text: e.kind === "wave" ? "😊" : "🙌" });
    }
    return out;
  }, [events]);

  const lockedZones = ZONES.filter((z) => !zoneUnlocked(z.id, level));

  return (
    <div className="relative w-full select-none" style={{ aspectRatio: `${W} / ${H}` }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <radialGradient id="sea" cx="50%" cy="58%" r="55%">
            <stop offset="0%" stopColor="#5cb8ff" stopOpacity="0.55" />
            <stop offset="70%" stopColor="#5cb8ff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#5cb8ff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse className="guild-sea" cx={W / 2} cy={TOP + (ISLAND_SIZE * TH) / 2 + 20} rx={W * 0.56} ry={ISLAND_SIZE * TH * 0.72} fill="url(#sea)" />
        {/* Cliff faces under the island give it its 2.5D thickness. */}
        <polygon points={`0,${TOP + (ISLAND_SIZE * TH) / 2} ${W / 2},${TOP + ISLAND_SIZE * TH} ${W / 2},${TOP + ISLAND_SIZE * TH + DEPTH} 0,${TOP + (ISLAND_SIZE * TH) / 2 + DEPTH}`} fill="#a9774a" />
        <polygon points={`${W},${TOP + (ISLAND_SIZE * TH) / 2} ${W / 2},${TOP + ISLAND_SIZE * TH} ${W / 2},${TOP + ISLAND_SIZE * TH + DEPTH} ${W},${TOP + (ISLAND_SIZE * TH) / 2 + DEPTH}`} fill="#8a5d37" />
        {Array.from({ length: ISLAND_SIZE * ISLAND_SIZE }, (_, k) => {
          const c = k % ISLAND_SIZE;
          const r = Math.floor(k / ISLAND_SIZE);
          const zone = zoneAt(c, r);
          const open = zoneUnlocked(zone, level);
          const edge = c === 0 || r === 0 || c === ISLAND_SIZE - 1 || r === ISLAND_SIZE - 1;
          const [a, b] = edge ? SAND : GROUND[zone];
          const { x, y } = center(c, r);
          return (
            <polygon
              key={k}
              points={`${x},${y - TH / 2} ${x + TW / 2},${y} ${x},${y + TH / 2} ${x - TW / 2},${y}`}
              fill={(c + r) % 2 ? a : b}
              stroke="rgba(0,0,0,0.06)"
              strokeWidth={1}
              opacity={open ? 1 : 0.32}
            />
          );
        })}
      </svg>

      {/* Fog and a lock over zones the guild hasn't unlocked yet. */}
      {lockedZones.map((z) => {
        const tiles = [];
        for (let c = 0; c < ISLAND_SIZE; c++) for (let r = 0; r < ISLAND_SIZE; r++) if (zoneAt(c, r) === z.id) tiles.push({ c, r });
        const c = tiles.reduce((s, t) => s + t.c, 0) / tiles.length;
        const r = tiles.reduce((s, t) => s + t.r, 0) / tiles.length;
        const p = spot(c, r);
        return (
          <span
            key={z.id}
            className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"
            style={{ left: p.left, top: p.top, zIndex: 5 }}
          >
            <span className="text-2xl opacity-80 sm:text-4xl">☁️</span>
            <span className="rounded-full bg-night/75 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-ink/90 sm:text-xs">
              🔒 {z.name} · Lv.{z.level}
            </span>
          </span>
        );
      })}

      {/* Clubhouse with the Trophy Room. */}
      <button
        type="button"
        onClick={onHall}
        aria-label={`ห้องถ้วยรางวัล ${trophies} ใบ`}
        className="absolute -translate-x-1/2 -translate-y-[85%] text-[clamp(2rem,9vw,4.2rem)] leading-none drop-shadow-[0_8px_8px_rgba(0,0,0,0.35)] transition active:scale-95"
        style={{ ...pos(spot(HALL_TILE.c, HALL_TILE.r)) }}
      >
        🏛️
        {trophies > 0 && (
          <span className="absolute -top-1 -right-2 rounded-full bg-sun px-1.5 text-xs font-extrabold text-night">🏆{trophies}</span>
        )}
      </button>

      {DECOR_SLOTS.map((s) => {
        const itemId = decor[s.id];
        const item = itemId ? decorById(itemId) : undefined;
        const open = zoneUnlocked(zoneAt(s.c, s.r), level);
        const p = spot(s.c, s.r);
        if (!item && !(editing && open)) return null;
        const statue = item?.id === "statue" && leaderAvatar;
        return (
          <button
            key={s.id}
            type="button"
            disabled={!editing}
            onClick={() => onSlot?.(s.id)}
            aria-label={item ? item.name : "ช่องว่างสำหรับวางของ"}
            className={`absolute -translate-x-1/2 -translate-y-[80%] leading-none transition ${editing ? "cursor-pointer hover:scale-110" : "cursor-default"}`}
            style={pos(p)}
          >
            {item ? (
              statue ? (
                <span className="flex flex-col items-center">
                  <span className="text-[clamp(1.4rem,6vw,2.8rem)] [filter:sepia(1)_saturate(4)_hue-rotate(-12deg)_brightness(1.1)]">{leaderAvatar}</span>
                  <span className="-mt-1 h-2 w-8 rounded-sm bg-[#c9a227] sm:w-12" />
                </span>
              ) : (
                <span className="text-[clamp(1.6rem,7vw,3.2rem)] drop-shadow-[0_6px_6px_rgba(0,0,0,0.3)]">{item.emoji}</span>
              )
            ) : (
              <span className="grid size-8 place-items-center rounded-full border-2 border-dashed border-white/70 bg-night/40 text-sm sm:size-11">＋</span>
            )}
            {editing && item && <span className="absolute -top-2 -right-2 rounded-full bg-night/80 px-1 text-[10px]">✎</span>}
          </button>
        );
      })}

      {members.map((m) => {
        const tile = positions[m.id];
        if (!tile) return null;
        const p = spot(tile.c, tile.r);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onMember?.(m.id)}
            aria-label={m.name}
            className="absolute flex -translate-x-1/2 -translate-y-[92%] flex-col items-center transition-[left,top] duration-[1800ms] ease-linear"
            style={{ ...pos(p), zIndex: p.z + 1 }}
          >
            <span className={tile.moving ? "guild-walk" : ""}>
              <Figure avatar={m.avatar} look={m.look} size={34} className={m.id === meId ? "drop-shadow-[0_0_8px_var(--color-sun)]" : ""} />
            </span>
            <span className="mt-0.5 max-w-20 truncate rounded-full bg-night/70 px-1.5 text-[10px] font-semibold">{m.id === meId ? "คุณ" : m.name}</span>
            {bubbles[m.id]?.map((b) => (
              <span key={b.key} className="guild-pop pointer-events-none absolute -top-9 left-1/2 rounded-full bg-white px-2 py-0.5 text-xl shadow-lg">
                {b.text}
              </span>
            ))}
          </button>
        );
      })}
    </div>
  );
}

function pos(p: { left: string; top: string; z: number }) {
  return { left: p.left, top: p.top, zIndex: p.z };
}

type Tile = { c: number; r: number; moving: boolean };

/** Gives each online avatar a tile and nudges them to a neighbouring one every few seconds. */
function useWander(ids: string[], walkable: { c: number; r: number }[]) {
  // Only steps live in state; anyone without a valid spot yet stands on a tile picked from their id.
  const [steps, setSteps] = useState<Record<string, Tile>>({});
  const key = ids.join(",");

  const positions = useMemo(() => {
    const out: Record<string, Tile> = {};
    if (!walkable.length) return out;
    const has = (t: Tile | undefined) => t && walkable.some((w) => w.c === t.c && w.r === t.r);
    for (const id of key ? key.split(",") : []) {
      out[id] = has(steps[id]) ? steps[id] : { ...walkable[hashSeed(id) % walkable.length], moving: false };
    }
    return out;
  }, [key, steps, walkable]);

  const latest = useRef(positions);
  useEffect(() => {
    latest.current = positions;
  });

  useEffect(() => {
    const has = (c: number, r: number) => walkable.some((t) => t.c === c && t.r === r);
    const timer = setInterval(() => {
      const next: Record<string, Tile> = {};
      for (const [id, t] of Object.entries(latest.current)) {
        // Most of the time people just hang around; sometimes they take a step.
        if (Math.random() < 0.55) {
          next[id] = { ...t, moving: false };
          continue;
        }
        const options = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].filter(([dc, dr]) => has(t.c + dc, t.r + dr));
        const [dc, dr] = options.length ? options[Math.floor(Math.random() * options.length)] : [0, 0];
        next[id] = { c: t.c + dc, r: t.r + dr, moving: dc !== 0 || dr !== 0 };
      }
      setSteps(next);
    }, 1900);
    return () => clearInterval(timer);
  }, [walkable]);

  return positions;
}
