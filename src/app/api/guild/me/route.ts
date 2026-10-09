import { body, guildService, handle, playerOf, PLAYER_HEADER } from "@/lib/guild/server";

export async function GET(request: Request) {
  return handle(() => guildService().me(playerOf(request)));
}

/** Registers this device (or refreshes its name and avatar) and returns a player token. */
export async function POST(request: Request) {
  const data = await body(request);
  return handle(() =>
    guildService().register(request.headers.get(PLAYER_HEADER), String(data.name ?? ""), String(data.avatar ?? "🦊")),
  );
}
