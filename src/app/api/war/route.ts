import { body, guildService, handle, playerOf } from "@/lib/guild/server";

/** Islands this player's guild could invade. */
export async function GET(request: Request) {
  return handle(async () => ({ targets: await guildService().targets(playerOf(request)) }));
}

export async function POST(request: Request) {
  return handle(async () => {
    const data = await body(request);
    return guildService().declareWar(playerOf(request), String(data.target ?? ""));
  });
}
