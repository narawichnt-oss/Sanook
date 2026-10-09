import { guildService, handle, maybePlayerOf } from "@/lib/guild/server";

export async function GET(request: Request, ctx: RouteContext<"/api/war/[id]">) {
  const { id } = await ctx.params;
  return handle(() => guildService().warView(id, maybePlayerOf(request)));
}
