import { roomService, verifyJoinToken } from "@/lib/livekit";
import { MAX_PHOTO_CHARS, isPhotoDataUrl } from "@/lib/room-meta";

/**
 * Puts the caller's profile photo on their seat. Clients can't edit their own
 * attributes (that would let them rename themselves too), so the server does it
 * after checking the join token says who they are.
 */
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_PHOTO_CHARS + 1024) {
    return Response.json({ error: "รูปใหญ่เกินไป" }, { status: 413 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const who = await verifyJoinToken(token);
  if (!who) return Response.json({ error: "ไม่มีสิทธิ์" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { photo?: unknown } | null;
  const photo = body?.photo ?? "";
  // An empty string removes the photo and the seat falls back to the emoji.
  if (photo !== "" && !isPhotoDataUrl(photo)) {
    return Response.json({ error: "ไฟล์รูปไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    await roomService().updateParticipant(who.roomId, who.identity, { attributes: { photo: photo as string } });
  } catch {
    // Usually the participant hasn't finished joining yet; the client retries.
    return Response.json({ error: "ยังไม่พบคุณในห้อง" }, { status: 409 });
  }
  return new Response(null, { status: 204 });
}
