import type { LookSlot, SlotId } from "@/lib/guild/catalog";
import type { MemberAction } from "@/lib/guild/guild";
import { GuildError } from "@/lib/guild/service";
import { body, guildService, handle, playerOf } from "@/lib/guild/server";

/** Everything a player does to themselves or their guild. Each returns the fresh MeView. */
export async function POST(request: Request) {
  return handle(async () => {
    const me = playerOf(request);
    const data = await body(request);
    const s = guildService();
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    switch (data.action) {
      case "create":
        return s.createGuild(me, data);
      case "join":
        return s.joinGuild(me, str(data.guildId));
      case "leave":
        return s.leaveGuild(me);
      case "member":
        return s.memberAction(me, str(data.target), str(data.kind) as MemberAction);
      case "decor": {
        const kind = str(data.kind);
        if (kind !== "buy" && kind !== "place" && kind !== "store") throw new GuildError("ไม่รู้จักคำสั่งนี้");
        return s.decorate(me, kind, str(data.item), (str(data.slot) || undefined) as SlotId | undefined);
      }
      case "equip":
        return s.equip(me, str(data.slot) as LookSlot, str(data.item) || null);
      case "seen":
        await s.seen(me);
        return s.me(me);
      default:
        throw new GuildError("ไม่รู้จักคำสั่งนี้");
    }
  });
}
