import { roomService } from "@/lib/livekit";
import { MAX_ROOM_SIZE, newRoomId, parseRoomInput, readRoomMeta, type RoomSummary } from "@/lib/room-meta";

const MAX_OPEN_ROOMS = 50;

export async function GET() {
  const rooms = await roomService().listRooms();
  const summaries: RoomSummary[] = rooms
    .map((room) => ({
      id: room.name,
      listeners: room.numParticipants,
      createdAt: Number(room.creationTime) * 1000,
      ...readRoomMeta(room.metadata),
    }))
    // Busiest rooms first, then newest.
    .sort((a, b) => b.listeners - a.listeners || b.createdAt - a.createdAt);

  return Response.json({ rooms: summaries }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const parsed = parseRoomInput(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const service = roomService();
  if ((await service.listRooms()).length >= MAX_OPEN_ROOMS) {
    return Response.json({ error: "ตอนนี้ห้องเต็มแล้ว ลองเข้าห้องที่มีอยู่ก่อนนะ" }, { status: 429 });
  }

  const id = newRoomId();
  await service.createRoom({
    name: id,
    metadata: JSON.stringify(parsed.value),
    maxParticipants: MAX_ROOM_SIZE,
    // Give the creator time to arrive, and let people drop back in after a blip.
    emptyTimeout: 120,
    departureTimeout: 60,
  });

  return Response.json({ id }, { status: 201 });
}
