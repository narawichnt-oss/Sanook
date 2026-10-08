// Pure helpers shared by the API routes and the UI. No server-only imports here,
// so tests and client components can use them too.

export const ROOM_EMOJIS = ["☕", "🎧", "🌙", "🔥", "🎮", "📚", "🍜", "🌈", "🐱", "🎤"] as const;
export const AVATARS = ["🦊", "🐼", "🐸", "🐯", "🐨", "🐙", "🦄", "🐧", "🐵", "🐻", "🐰", "🐢"] as const;
export const ROOM_COLORS = ["coral", "mint", "sky", "lilac", "sun"] as const;

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

export function parseJoinInput(input: unknown): Result<{ roomId: string; name: string; avatar: string }> {
  const body = (input ?? {}) as Record<string, unknown>;
  const roomId = clean(body.roomId);
  const name = clean(body.name);

  if (!isRoomId(roomId)) return { ok: false, error: "ไม่พบห้องนี้" };
  if (!name) return { ok: false, error: "ใส่ชื่อเล่นก่อนนะ" };
  if ([...name].length > MAX_NAME) return { ok: false, error: `ชื่อเล่นยาวได้ไม่เกิน ${MAX_NAME} ตัวอักษร` };

  const avatar = (AVATARS as readonly string[]).includes(body.avatar as string) ? (body.avatar as string) : AVATARS[0];
  return { ok: true, value: { roomId, name, avatar } };
}

const ROOM_ID = /^[a-z0-9]{8}$/;

export function isRoomId(id: string): boolean {
  return ROOM_ID.test(id);
}

export function newRoomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
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
