import { describe, expect, it } from "vitest";
import { isRoomId, newRoomId, parseJoinInput, parseRoomInput, readRoomMeta } from "@/lib/room-meta";

describe("parseRoomInput", () => {
  it("trims and collapses whitespace", () => {
    const r = parseRoomInput({ title: "  นั่ง   เล่น ", topic: " เรื่อยเปื่อย ", emoji: "🎧", color: "mint" });
    expect(r).toEqual({ ok: true, value: { title: "นั่ง เล่น", topic: "เรื่อยเปื่อย", emoji: "🎧", color: "mint" } });
  });

  it("requires a title and caps lengths by character, not byte", () => {
    expect(parseRoomInput({ title: "   " }).ok).toBe(false);
    expect(parseRoomInput({ title: "ก".repeat(40) }).ok).toBe(true);
    expect(parseRoomInput({ title: "ก".repeat(41) }).ok).toBe(false);
    expect(parseRoomInput({ title: "x", topic: "y".repeat(81) }).ok).toBe(false);
  });

  it("falls back to defaults for unknown emoji and colors", () => {
    const r = parseRoomInput({ title: "x", emoji: "<script>", color: "black" });
    expect(r.ok && [r.value.emoji, r.value.color]).toEqual(["☕", "coral"]);
  });
});

describe("parseJoinInput", () => {
  it("accepts a valid join", () => {
    expect(parseJoinInput({ roomId: "abcd1234", name: "ต้น", avatar: "🐼" })).toEqual({
      ok: true,
      value: { roomId: "abcd1234", name: "ต้น", avatar: "🐼" },
    });
  });

  it("rejects bad room ids and missing names", () => {
    expect(parseJoinInput({ roomId: "../admin", name: "a" }).ok).toBe(false);
    expect(parseJoinInput({ roomId: "abcd1234", name: "" }).ok).toBe(false);
    expect(parseJoinInput(null).ok).toBe(false);
  });
});

describe("room ids", () => {
  it("generates ids the validator accepts", () => {
    for (let i = 0; i < 50; i++) expect(isRoomId(newRoomId())).toBe(true);
  });
});

describe("readRoomMeta", () => {
  it("survives missing or foreign metadata", () => {
    expect(readRoomMeta(undefined).title).toBe("ห้องไม่มีชื่อ");
    expect(readRoomMeta("not json").title).toBe("ห้องไม่มีชื่อ");
    expect(readRoomMeta(JSON.stringify({ title: "ห้องเรา", color: "sky" })).color).toBe("sky");
  });
});
