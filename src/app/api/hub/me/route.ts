import { playerOf } from "@/lib/guild/server";
import { handleHub, hubService } from "@/lib/hub/server";

/** Level summary for the lobby. */
export async function GET(request: Request) {
  return handleHub(async () => hubService().me(playerOf(request), Date.now()));
}
