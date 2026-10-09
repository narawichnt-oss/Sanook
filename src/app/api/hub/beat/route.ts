import { body, playerOf } from "@/lib/guild/server";
import { handleHub, hubService, seatOf } from "@/lib/hub/server";

/** Heartbeat from an open room: credits presence EXP and returns the hub state. */
export async function POST(request: Request) {
  return handleHub(async () => {
    const playerId = playerOf(request);
    const data = await body(request);
    const seat = await seatOf(data.lk);
    return hubService().beat(playerId, seat, { idle: data.idle === true, chatted: data.chatted === true }, Date.now());
  });
}
