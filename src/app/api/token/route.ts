import { joinToken, livekitUrl, roomService } from "@/lib/livekit";
import { MAX_ROOM_SIZE, parseJoinInput, readRoomMeta } from "@/lib/room-meta";

export async function POST(request: Request) {
  const parsed = parseJoinInput(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const { roomId, name, avatar } = parsed.value;

  // Only hand out tokens for rooms created through the lobby; LiveKit would
  // otherwise auto-create a blank room for any name.
  const [room] = await roomService().listRooms([roomId]);
  if (!room) return Response.json({ error: "ห้องนี้ปิดไปแล้ว" }, { status: 404 });
  if (room.numParticipants >= MAX_ROOM_SIZE) {
    return Response.json({ error: "ห้องนี้คนเต็มแล้ว" }, { status: 409 });
  }

  return Response.json({
    token: await joinToken(roomId, name, avatar),
    serverUrl: livekitUrl(),
    room: readRoomMeta(room.metadata),
  });
}
