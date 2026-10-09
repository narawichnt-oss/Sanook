import { describe, expect, it } from "vitest";
import { MemoryStore } from "@/lib/guild/docstore";
import { CHEST_EXP, EXP_PER_MINUTE, SPIRIT_EXP } from "@/lib/hub/rules";
import { HubService, type HubLive, type HubMessage, type LiveParticipant } from "@/lib/hub/service";

const T0 = Date.UTC(2026, 9, 9, 5, 0, 0);
const MIN = 60_000;

function setup(people: LiveParticipant[], rand = 0.1) {
  const sent: HubMessage[] = [];
  const live: HubLive = {
    participants: async () => people,
    broadcast: async (_room, message) => {
      sent.push(message);
    },
  };
  // Events due one minute after the room is first seen.
  const hub = new HubService(new MemoryStore(), live, { rand: () => rand, newId: () => "ev1", gap: [MIN, MIN] });
  return { hub, sent, people };
}

const seatA = { roomId: "room0001", identity: "lk-a" };
const seatB = { roomId: "room0001", identity: "lk-b" };
const quiet = { idle: false, chatted: false };

describe("HubService", () => {
  it("refuses beats from someone LiveKit doesn't see in the room", async () => {
    const { hub } = setup([{ identity: "lk-b", talking: false }]);
    await expect(hub.beat("pa", seatA, quiet, T0)).rejects.toMatchObject({ status: 403 });
  });

  it("credits presence and boosts it when two people have open mics", async () => {
    const { hub, people } = setup([{ identity: "lk-a", talking: false }]);
    await hub.beat("pa", seatA, quiet, T0);
    expect((await hub.beat("pa", seatA, quiet, T0 + 30_000)).gained).toBe(EXP_PER_MINUTE / 2);

    people.push({ identity: "lk-b", talking: true });
    people[0].talking = true;
    const view = await hub.beat("pa", seatA, quiet, T0 + 90_000);
    expect(view.multiplier).toBe(1.25);
    expect(view.gained).toBe(13); // 1 min × 10 × 1.25, rounded
  });

  it("spawns a chest when due, broadcasts it, and pays one tap", async () => {
    const { hub, sent } = setup([{ identity: "lk-a", talking: false }]);
    await hub.beat("pa", seatA, quiet, T0);
    const view = await hub.beat("pa", seatA, quiet, T0 + MIN);
    expect(view.event?.kind).toBe("chest");
    expect(sent[0]).toMatchObject({ type: "event", event: { id: "ev1", kind: "chest" } });

    const tap = await hub.tap("pa", seatA, "ev1", 1, T0 + MIN + 2000);
    expect(tap.paid).toBe(CHEST_EXP);
    await expect(hub.tap("pa", seatA, "ev1", 1, T0 + MIN + 3000)).rejects.toMatchObject({ status: 409 });
  });

  it("a spirit beaten together pays everyone who helped, the rest on their next beat", async () => {
    const { hub } = setup(
      [
        { identity: "lk-a", talking: false },
        { identity: "lk-b", talking: false },
      ],
      0.9,
    );
    await hub.beat("pa", seatA, quiet, T0);
    await hub.beat("pb", seatB, quiet, T0);
    const view = await hub.beat("pa", seatA, quiet, T0 + MIN);
    expect(view.event).toMatchObject({ kind: "spirit", hp: 50 });

    await hub.tap("pb", seatB, "ev1", 20, T0 + MIN + 2000);
    const finisher = await hub.tap("pa", seatA, "ev1", 30, T0 + MIN + 3000);
    expect(finisher.event.defeated).toBe(true);
    expect(finisher.paid).toBe(SPIRIT_EXP);

    const helper = await hub.beat("pb", seatB, quiet, T0 + MIN + 20_000);
    expect(helper.paid).toBe(SPIRIT_EXP);
    expect(helper.spirits).toBe(1);
    expect((await hub.beat("pb", seatB, quiet, T0 + MIN + 40_000)).paid).toBe(0);
  });

  it("the lobby summary reflects stored EXP", async () => {
    const { hub } = setup([{ identity: "lk-a", talking: false }]);
    await hub.beat("pa", seatA, quiet, T0);
    await hub.beat("pa", seatA, quiet, T0 + MIN);
    expect(await hub.me("pa", T0 + MIN)).toMatchObject({ exp: EXP_PER_MINUTE, level: { level: 1 } });
  });
});
