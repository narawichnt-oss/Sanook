import { body, guildService, handle, playerOf } from "@/lib/guild/server";

/** Who is playing right now, and the cheers flying around. */
export async function GET(_request: Request, ctx: RouteContext<"/api/war/[id]/live">) {
  const { id } = await ctx.params;
  return handle(() => guildService().live(id));
}

/** `{ progress, score }` from a player mid-round, or `{ cheer: { to, emoji } }` from a fan. */
export async function POST(request: Request, ctx: RouteContext<"/api/war/[id]/live">) {
  const { id } = await ctx.params;
  return handle(async () => {
    const me = playerOf(request);
    const data = await body(request);
    const cheer = data.cheer as { to?: unknown; emoji?: unknown } | undefined;
    if (cheer) return guildService().cheer(me, id, String(cheer.to ?? ""), String(cheer.emoji ?? ""));
    return guildService().progress(me, id, String(data.progress ?? ""), Number(data.score) || 0);
  });
}
