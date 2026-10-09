import { body, playerOf } from "@/lib/guild/server";
import { handleHub, hubService, seatOf } from "@/lib/hub/server";

/** Taps on the room's chest or spirit. */
export async function POST(request: Request) {
  return handleHub(async () => {
    const playerId = playerOf(request);
    const data = await body(request);
    const seat = await seatOf(data.lk);
    const taps = Number(data.taps);
    return hubService().tap(playerId, seat, String(data.eventId ?? ""), Number.isFinite(taps) ? taps : 0, Date.now());
  });
}
