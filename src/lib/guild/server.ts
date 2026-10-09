import "server-only";
import { neon } from "@neondatabase/serverless";
import { MemoryStore, PgStore, type DocStore } from "./docstore";
import { GuildError, GuildService } from "./service";

// One service per server process. In dev, Next reloads modules on every edit,
// so it lives on globalThis to keep the in-memory store between reloads.
const holder = globalThis as unknown as { __guildService?: GuildService };

function createStore(): DocStore {
  const url = process.env.DATABASE_URL;
  if (url) {
    const sql = neon(url);
    return new PgStore((text, params) => sql.query(text, params) as Promise<Record<string, unknown>[]>);
  }
  if (process.env.NODE_ENV === "production") {
    console.warn("[guild] DATABASE_URL is not set — guild data is kept in memory and will be lost on restart");
  }
  return new MemoryStore();
}

function secret(): string {
  const value = process.env.GUILD_SECRET || process.env.LIVEKIT_API_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("Missing GUILD_SECRET");
  return "dev-only-guild-secret";
}

export function guildService(): GuildService {
  holder.__guildService ??= new GuildService(createStore(), secret(), {
    warHours: Number(process.env.GUILD_WAR_HOURS) || 24,
  });
  return holder.__guildService;
}

export const PLAYER_HEADER = "x-player";

/** The signed-in player for a request, or a 401. */
export function playerOf(request: Request): string {
  const id = guildService().playerIdFrom(request.headers.get(PLAYER_HEADER));
  if (!id) throw new GuildError("ยังไม่ได้เข้าสู่ระบบกิลด์ ลองรีเฟรชหน้าใหม่", 401);
  return id;
}

export function maybePlayerOf(request: Request): string | null {
  return guildService().playerIdFrom(request.headers.get(PLAYER_HEADER));
}

export async function body(request: Request): Promise<Record<string, unknown>> {
  const data = await request.json().catch(() => null);
  return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
}

/** Runs a handler and turns GuildErrors into friendly JSON errors. */
export async function handle(fn: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await fn(), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof GuildError) return Response.json({ error: err.message }, { status: err.status });
    console.error("[guild]", err);
    return Response.json({ error: "ระบบกิลด์ขัดข้อง ลองใหม่อีกครั้งนะ" }, { status: 500 });
  }
}
