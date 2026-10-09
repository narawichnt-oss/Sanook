import { body, guildService, handle, maybePlayerOf, playerOf } from "@/lib/guild/server";

export async function GET(_request: Request, ctx: RouteContext<"/api/guilds/[id]">) {
  const { id } = await ctx.params;
  return handle(() => guildService().guildView(id));
}

/** Island heartbeat: marks you online and optionally waves or high-fives someone. */
export async function POST(request: Request, ctx: RouteContext<"/api/guilds/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => {
    const data = await body(request);
    const interact = data.interact as { to?: unknown; kind?: unknown } | undefined;
    const viewer = data.visit ? maybePlayerOf(request) : playerOf(request);
    return guildService().presence(
      viewer ?? "",
      id,
      Number(data.since) || 0,
      interact && typeof interact.to === "string" && (interact.kind === "wave" || interact.kind === "highfive")
        ? { to: interact.to, kind: interact.kind }
        : undefined,
    );
  });
}
