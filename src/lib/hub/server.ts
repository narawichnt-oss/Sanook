import "server-only";
import { neon } from "@neondatabase/serverless";
import { DataPacket_Kind, TrackType } from "livekit-server-sdk";
import { MemoryStore, PgStore, type DocStore } from "@/lib/guild/docstore";
import { roomService, verifyJoinToken } from "@/lib/livekit";
import { HubError, HubService, type HubLive, type Seat } from "./service";

export const HUB_TOPIC = "hub";

// Same table as the guild system (keys are prefixed "hub:"), separate instance
// so the two features stay independent. Kept on globalThis for dev reloads.
const holder = globalThis as unknown as { __hubService?: HubService };

function createStore(): DocStore {
  const url = process.env.DATABASE_URL;
  if (!url) return new MemoryStore();
  const sql = neon(url);
  return new PgStore((text, params) => sql.query(text, params) as Promise<Record<string, unknown>[]>);
}

const encoder = new TextEncoder();

const live: HubLive = {
  async participants(roomId) {
    const people = await roomService().listParticipants(roomId).catch(() => []);
    return people.map((p) => ({
      identity: p.identity,
      // An open, published mic is the server-side signal that someone is in the conversation.
      talking: p.tracks.some((t) => t.type === TrackType.AUDIO && !t.muted),
    }));
  },
  async broadcast(roomId, message) {
    await roomService().sendData(roomId, encoder.encode(JSON.stringify(message)), DataPacket_Kind.RELIABLE, {
      topic: HUB_TOPIC,
    });
  },
};

/** "30-60" (seconds) → a quicker event gap for local testing. */
function gapFromEnv(): [number, number] | undefined {
  const match = /^(\d+)-(\d+)$/.exec(process.env.HUB_EVENT_GAP_SEC ?? "");
  return match ? [Number(match[1]) * 1000, Number(match[2]) * 1000] : undefined;
}

export function hubService(): HubService {
  holder.__hubService ??= new HubService(createStore(), live, { gap: gapFromEnv() });
  return holder.__hubService;
}

/** The voice-room seat a request speaks for, proven by its LiveKit join token. */
export async function seatOf(token: unknown): Promise<Seat> {
  const seat = typeof token === "string" ? await verifyJoinToken(token) : null;
  if (!seat) throw new HubError("เซสชันห้องหมดอายุ ลองออกแล้วเข้าห้องใหม่", 401);
  return seat;
}

/** Runs a handler and turns known errors (hub or guild) into friendly JSON. */
export async function handleHub(fn: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await fn(), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const status = (err as { status?: unknown })?.status;
    if (err instanceof Error && typeof status === "number") return Response.json({ error: err.message }, { status });
    console.error("[hub]", err);
    return Response.json({ error: "ลานฝึกขัดข้อง ลองใหม่อีกครั้งนะ" }, { status: 500 });
  }
}
