import { guildService, handle } from "@/lib/guild/server";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return handle(async () => ({ guilds: await guildService().listGuilds(q) }));
}
