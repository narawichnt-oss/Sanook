// Pure helpers shared by the API routes and the UI. No server-only imports here,
// so tests and client components can use them too.

export const ROOM_EMOJIS = ["☕", "🎧", "🌙", "🔥", "🎮", "📚", "🍜", "🌈", "🐱", "🎤"] as const;
export const AVATARS = ["🦊", "🐼", "🐸", "🐯", "🐨", "🐙", "🦄", "🐧", "🐵", "🐻", "🐰", "🐢"] as const;
export const ROOM_COLORS = ["coral", "mint", "sky", "lilac", "sun", "pink"] as const;

export type RoomColor = (typeof ROOM_COLORS)[number];

export const MAX_TITLE = 40;
export const MAX_TOPIC = 80;
export const MAX_NAME = 20;
export const MAX_ROOM_SIZE = 12;

export type RoomMeta = {
  title: string;
  topic: string;
  emoji: string;
  color: RoomColor;
};

export type RoomSummary = RoomMeta & {
  id: string;
  listeners: number;
  createdAt: number;
};

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function parseRoomInput(input: unknown): Result<RoomMeta> {
  const body = (input ?? {}) as Record<string, unknown>;
  const title = clean(body.title);
  const topic = clean(body.topic);

  if (!title) return { ok: false, error: "ตั้งชื่อห้องก่อนนะ" };
  if ([...title].length > MAX_TITLE) return { ok: false, error: `ชื่อห้องยาวได้ไม่เกิน ${MAX_TITLE} ตัวอักษร` };
  if ([...topic].length > MAX_TOPIC) return { ok: false, error: `หัวข้อยาวได้ไม่เกิน ${MAX_TOPIC} ตัวอักษร` };

  const emoji = (ROOM_EMOJIS as readonly string[]).includes(body.emoji as string) ? (body.emoji as string) : ROOM_EMOJIS[0];
  const color = (ROOM_COLORS as readonly string[]).includes(body.color as string) ? (body.color as RoomColor) : ROOM_COLORS[0];

  return { ok: true, value: { title, topic, emoji, color } };
}

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("th", { granularity: "grapheme" }) : null;

/** Characters as people see them: "กิ่", "👨‍👩‍👧" and "𝓐" each count as one. */
export function graphemes(text: string): string[] {
  return segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : [...text];
}

export function truncateGraphemes(text: string, max: number): string {
  const parts = graphemes(text);
  return parts.length > max ? parts.slice(0, max).join("") : text;
}

// Invisible or layout-breaking characters. Kept: ZWJ (joins emoji like 👨‍👩‍👧) and
// tag characters (regional flags like 🏴󠁧󠁢󠁳󠁣󠁴󠁿). Also drops "blank" letters people use
// to make names look empty.
const INVISIBLE = /(?![‍\u{E0020}-\u{E007F}])[\p{Cc}\p{Cf}\p{Zl}\p{Zp}ᅟᅠ⠀ㅤﾠ]/gu;
// Thai needs at most two marks per letter (vowel + tone); Zalgo text stacks dozens.
const EXCESS_MARKS = /(\p{M}{3})\p{M}+/gu;
const VISIBLE = /[\p{L}\p{N}\p{S}\p{P}]/u;
const MAX_NAME_CODE_POINTS = 80;

/**
 * Nicknames may use any script, emoji and fancy Unicode letters (𝓢𝓪𝓷𝓸𝓸𝓴, ꧁…꧂),
 * but not invisible tricks or text that spills over other people's seats.
 */
export function cleanName(value: unknown): string {
  if (typeof value !== "string") return "";
  const name = value.normalize("NFC").replace(INVISIBLE, "").replace(EXCESS_MARKS, "$1").replace(/\s+/g, " ").trim();
  return VISIBLE.test(name) ? name : "";
}

export function parseJoinInput(input: unknown): Result<{ roomId: string; name: string; avatar: string }> {
  const body = (input ?? {}) as Record<string, unknown>;
  const roomId = clean(body.roomId);
  const name = cleanName(body.name);

  if (!isRoomId(roomId)) return { ok: false, error: "ไม่พบห้องนี้" };
  if (!name) return { ok: false, error: "ใส่ชื่อเล่นก่อนนะ" };
  if (graphemes(name).length > MAX_NAME || [...name].length > MAX_NAME_CODE_POINTS) {
    return { ok: false, error: `ชื่อเล่นยาวได้ไม่เกิน ${MAX_NAME} ตัวอักษร` };
  }

  const avatar = (AVATARS as readonly string[]).includes(body.avatar as string) ? (body.avatar as string) : AVATARS[0];
  return { ok: true, value: { roomId, name, avatar } };
}

// Profile photos travel as small data URLs (resized to 128px in the browser).
// Raster formats only: an SVG could carry script.
export const MAX_PHOTO_CHARS = 20_000;
const PHOTO = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/;

export function isPhotoDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_PHOTO_CHARS && PHOTO.test(value);
}

const ROOM_ID = /^[a-z0-9]{8}$/;

export function isRoomId(id: string): boolean {
  return ROOM_ID.test(id);
}

export function newRoomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
}

/**
 * Where "Play Now" drops you: the liveliest room that still has a seat, so you
 * land in a conversation rather than an empty room. `null` means open a new one.
 */
export function pickQuickRoom(rooms: RoomSummary[]): RoomSummary | null {
  const open = rooms.filter((r) => r.listeners > 0 && r.listeners < MAX_ROOM_SIZE);
  open.sort((a, b) => b.listeners - a.listeners || b.createdAt - a.createdAt);
  return open[0] ?? null;
}

export function randomItem<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/** Reads metadata LiveKit stores on the room; tolerates rooms created some other way. */
export function readRoomMeta(raw: string | undefined): RoomMeta {
  let data: Record<string, unknown> = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    // not ours — fall through to defaults
  }
  const parsed = parseRoomInput(data);
  return parsed.ok ? parsed.value : { title: "ห้องไม่มีชื่อ", topic: "", emoji: ROOM_EMOJIS[0], color: ROOM_COLORS[0] };
}
