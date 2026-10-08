import "server-only";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} — copy .env.example to .env.local and fill it in`);
  return value;
}

export function livekitUrl(): string {
  return env("LIVEKIT_URL");
}

export function roomService(): RoomServiceClient {
  // The REST API lives on the same host as the websocket, over https.
  const host = livekitUrl().replace(/^ws/, "http");
  return new RoomServiceClient(host, env("LIVEKIT_API_KEY"), env("LIVEKIT_API_SECRET"));
}

export async function joinToken(roomId: string, name: string, avatar: string): Promise<string> {
  const token = new AccessToken(env("LIVEKIT_API_KEY"), env("LIVEKIT_API_SECRET"), {
    identity: `${crypto.randomUUID()}`,
    name,
    attributes: { avatar },
    ttl: "6h",
  });
  token.addGrant({
    room: roomId,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    // Name and avatar come from the token; don't let clients rewrite them.
    canUpdateOwnMetadata: false,
  });
  return token.toJwt();
}
