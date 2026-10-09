import type { RoundAnswers } from "@/lib/guild/games";
import { body, guildService, handle, playerOf } from "@/lib/guild/server";

/** `{ stage }` starts a round ("auto" = Play Now); `{ token, answers }` submits one. */
export async function POST(request: Request, ctx: RouteContext<"/api/war/[id]/round">) {
  const { id } = await ctx.params;
  return handle(async () => {
    const me = playerOf(request);
    const data = await body(request);
    if (data.token) return guildService().submitRound(me, data.token, (data.answers ?? {}) as RoundAnswers);
    return guildService().startRound(me, id, data.stage === "auto" ? "auto" : Number(data.stage));
  });
}
