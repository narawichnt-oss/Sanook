import { notFound } from "next/navigation";
import { RoomGate } from "@/components/room/room-gate";
import { isRoomId } from "@/lib/room-meta";

export default async function RoomPage({ params }: PageProps<"/room/[id]">) {
  const { id } = await params;
  if (!isRoomId(id)) notFound();
  return <RoomGate roomId={id} />;
}
